package com.propertysaas.propertycore.renter;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContext;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import jakarta.validation.Validator;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import java.util.Set;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
public class RenterService {
    private static final RenterInput EMPTY_INPUT = new RenterInput(null, null, null, null);
    private static final Set<String> EDITABLE_FIELDS = Set.of("firstName", "lastName", "email", "phone");

    private final RenterRepository renters;
    private final AuthenticatedOrganizationContextResolver contexts;
    private final CurrentUserAuthorizationService authorization;
    private final Validator validator;
    private final JdbcTemplate jdbc;

    public RenterService(RenterRepository renters, AuthenticatedOrganizationContextResolver contexts,
                         CurrentUserAuthorizationService authorization, Validator validator, JdbcTemplate jdbc) {
        this.renters = renters;
        this.contexts = contexts;
        this.authorization = authorization;
        this.validator = validator;
        this.jdbc = jdbc;
    }

    @Transactional
    public RenterResponse create(UUID organizationId, JsonNode body) {
        var context = requireManage(organizationId);
        var input = validatedInput(body, EMPTY_INPUT);
        var renter = renters.saveAndFlush(new Renter(context.organizationId(), input)).response();
        audit(context, renter.id(), "CREATE");
        return renter;
    }

    @Transactional(readOnly = true)
    public Page<RenterResponse> list(UUID organizationId, String search, int page, int size) {
        var context = contexts.resolve(organizationId);
        return renters.searchActive(context.organizationId(), search.strip(),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")))
                .map(Renter::response);
    }

    @Transactional(readOnly = true)
    public RenterResponse get(UUID organizationId, UUID id) {
        var context = contexts.resolve(organizationId);
        return renters.findByIdAndOrganizationId(id, context.organizationId())
                .orElseThrow(RenterService::notFound).response();
    }

    @Transactional
    public RenterResponse update(UUID organizationId, UUID id, JsonNode changes) {
        var context = requireManage(organizationId);
        var renter = renters.findForUpdate(id, context.organizationId()).orElseThrow(RenterService::notFound);
        var current = renter.response();
        if (current.archivedAt() != null) {
            throw new ConflictException("Archived renters cannot be edited");
        }
        renter.update(validatedInput(changes, new RenterInput(
                current.firstName(), current.lastName(), current.email(), current.phone())));
        audit(context, id, "UPDATE");
        return renter.response();
    }

    @Transactional
    public RenterResponse archive(UUID organizationId, UUID id) {
        var context = requireManage(organizationId);
        var renter = renters.findForUpdate(id, context.organizationId()).orElseThrow(RenterService::notFound);
        if (renter.response().archivedAt() == null) {
            renter.archive();
            audit(context, id, "ARCHIVE");
        }
        return renter.response();
    }

    private AuthenticatedOrganizationContext requireManage(UUID organizationId) {
        var context = contexts.resolve(organizationId);
        authorization.requirePermission(context.organizationId(), OrganizationPermission.PROPERTY_MANAGE);
        return context;
    }

    private void audit(AuthenticatedOrganizationContext context, UUID id, String action) {
        jdbc.update("""
                insert into renter_audit_events (organization_id, renter_id, actor_user_id, action)
                values (?, ?, ?, ?)
                """, context.organizationId(), id, context.userId(), action);
    }

    private RenterInput validatedInput(JsonNode changes, RenterInput current) {
        if (!changes.isObject() || changes.isEmpty()) {
            throw new IllegalArgumentException("Payload must be a non-empty JSON object");
        }
        for (var entry : changes.properties()) {
            if (!EDITABLE_FIELDS.contains(entry.getKey())) {
                throw new IllegalArgumentException("Unsupported renter field: " + entry.getKey());
            }
            var value = entry.getValue();
            if (!value.isNull() && (!value.isString() || value.stringValue().indexOf(0) >= 0)) {
                throw new IllegalArgumentException(entry.getKey() + " must be valid text or null");
            }
        }
        var input = new RenterInput(
                field(changes, "firstName", current.firstName()),
                field(changes, "lastName", current.lastName()),
                field(changes, "email", current.email()),
                field(changes, "phone", current.phone()));
        var violations = validator.validate(input);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(violation -> violation.getPropertyPath() + ": " + violation.getMessage())
                    .sorted()
                    .collect(Collectors.joining("; "));
            throw new IllegalArgumentException(message);
        }
        return input;
    }

    private static String field(JsonNode changes, String name, String current) {
        JsonNode value = changes.get(name);
        return value == null ? current : value.isNull() ? null : value.stringValue();
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Renter not found");
    }
}
