package com.propertysaas.propertycore.maintenance;

import com.propertysaas.propertycore.common.response.PageResponse;
import com.propertysaas.propertycore.maintenance.MaintenanceRequest.*;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

import static com.propertysaas.propertycore.organization.permission.OrganizationPermission.MAINTENANCE_MANAGE;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/maintenance")
public class MaintenanceController {
    private final AuthenticatedOrganizationContextResolver context;
    private final CurrentUserAuthorizationService authorization;
    private final MaintenanceRepository requests;

    MaintenanceController(AuthenticatedOrganizationContextResolver context,
                          CurrentUserAuthorizationService authorization, MaintenanceRepository requests) {
        this.context = context;
        this.authorization = authorization;
        this.requests = requests;
    }

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageResponse<MaintenanceRequest> list(@PathVariable UUID organizationId,
                                                 @RequestParam(required = false) UUID propertyId,
                                                 @RequestParam(required = false) Status status,
                                                 @RequestParam(required = false) Priority priority,
                                                 @RequestParam(defaultValue = "") String search,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "10") int size) {
        authorize(organizationId);
        return PageResponse.from(requests.list(organizationId, propertyId, status, priority, search,
                pagination(search, page, size)));
    }

    @GetMapping("/properties")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageResponse<PropertyOption> properties(@PathVariable UUID organizationId,
                                                    @RequestParam(defaultValue = "") String search,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "25") int size) {
        authorize(organizationId);
        return PageResponse.from(requests.properties(organizationId, search.strip(), pagination(search, page, size)));
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public Summary summary(@PathVariable UUID organizationId) {
        authorize(organizationId);
        return requests.summary(organizationId);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public MaintenanceRequest get(@PathVariable UUID organizationId, @PathVariable UUID id) {
        authorize(organizationId);
        return requests.get(organizationId, id);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<MaintenanceRequest> create(@PathVariable UUID organizationId,
                                                      @Valid @RequestBody Input input) {
        UUID user = authorize(organizationId);
        requests.validateLocation(organizationId, input, false);
        var request = requests.create(organizationId, user, input);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId
                + "/maintenance/" + request.id())).body(request);
    }

    @PutMapping("/{id}")
    @Transactional
    public MaintenanceRequest update(@PathVariable UUID organizationId, @PathVariable UUID id,
                                     @Valid @RequestBody Update update) {
        authorize(organizationId);
        var current = requests.get(organizationId, id);
        requests.validateLocation(organizationId, update.request(),
                current.propertyId().equals(update.request().propertyId()));
        return requests.update(organizationId, id, update);
    }

    private static PageRequest pagination(String search, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || search.length() > 150 || search.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Use a nonnegative page, size from 1 to 100, and valid search text up to 150 characters.");
        }
        return PageRequest.of(page, size);
    }

    private UUID authorize(UUID organizationId) {
        var current = context.resolve(organizationId);
        authorization.requirePermission(organizationId, MAINTENANCE_MANAGE);
        return current.userId();
    }
}
