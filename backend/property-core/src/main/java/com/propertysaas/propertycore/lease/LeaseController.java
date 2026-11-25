package com.propertysaas.propertycore.lease;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.common.response.PageResponse;
import com.propertysaas.propertycore.lease.Lease.*;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Currency;
import java.util.UUID;

import static com.propertysaas.propertycore.organization.permission.OrganizationPermission.LEASE_MANAGE;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/leases")
public class LeaseController {
    private final AuthenticatedOrganizationContextResolver context;
    private final CurrentUserAuthorizationService authorization;
    private final LeaseRepository leases;

    LeaseController(AuthenticatedOrganizationContextResolver context, CurrentUserAuthorizationService authorization,
                    LeaseRepository leases) {
        this.context = context;
        this.authorization = authorization;
        this.leases = leases;
    }

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageResponse<Lease> list(@PathVariable UUID organizationId,
                                    @RequestParam(defaultValue = "") String search,
                                    @RequestParam(required = false) Status status,
                                    @RequestParam(defaultValue = "false") boolean endingSoon,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "10") int size) {
        authorize(organizationId);
        return PageResponse.from(leases.list(organizationId, search.strip(), status, endingSoon, today(),
                pagination(search, page, size)));
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public Summary summary(@PathVariable UUID organizationId) {
        authorize(organizationId);
        return leases.summary(organizationId, today());
    }

    @GetMapping("/units")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageResponse<UnitOption> units(@PathVariable UUID organizationId,
                                          @RequestParam(defaultValue = "") String search,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        authorize(organizationId);
        return PageResponse.from(leases.units(organizationId, search.strip(), pagination(search, page, size)));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Lease get(@PathVariable UUID organizationId, @PathVariable UUID id) {
        authorize(organizationId);
        return leases.get(organizationId, id, false);
    }

    @GetMapping("/{id}/document")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Document document(@PathVariable UUID organizationId, @PathVariable UUID id) {
        authorize(organizationId);
        return leases.document(organizationId, id);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Lease> create(@PathVariable UUID organizationId, @Valid @RequestBody Terms terms) {
        authorize(organizationId);
        validate(terms);
        UUID property = leases.validateParties(organizationId, terms.unitId(), terms.renterId());
        Lease lease = leases.create(organizationId, terms, property);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId + "/leases/" + lease.id()))
                .body(lease);
    }

    @PutMapping("/{id}")
    @Transactional
    public Lease update(@PathVariable UUID organizationId, @PathVariable UUID id, @Valid @RequestBody Update input) {
        Lease lease = lock(organizationId, id, input.version());
        if (lease.status() != Status.DRAFT) {
            throw new ConflictException("Only draft leases can be edited.");
        }
        Terms terms = input.terms();
        validate(terms);
        UUID property = leases.validateParties(organizationId, terms.unitId(), terms.renterId());
        return leases.update(organizationId, id, terms, property);
    }

    @PostMapping("/{id}/transition")
    @Transactional
    public Lease transition(@PathVariable UUID organizationId, @PathVariable UUID id,
                            @Valid @RequestBody Transition input) {
        Lease lease = lock(organizationId, id, input.version());
        Status next = switch (input.action()) {
            case ACTIVATE -> {
                if (lease.status() != Status.DRAFT) throw new ConflictException("Only a draft can be activated.");
                LocalDate today = today();
                if (lease.startsOn().isAfter(today) || (lease.endsOn() != null && lease.endsOn().isBefore(today))) {
                    throw new ConflictException("Activate this lease during its term. Check the start and end dates.");
                }
                leases.validateParties(organizationId, lease.unitId(), lease.renterId());
                yield Status.ACTIVE;
            }
            case END -> {
                if (lease.status() != Status.ACTIVE) throw new ConflictException("Only an active lease can be ended.");
                yield Status.ENDED;
            }
            case CANCEL -> {
                if (lease.status() != Status.DRAFT) throw new ConflictException("Only a draft can be cancelled.");
                yield Status.CANCELLED;
            }
        };
        return leases.transition(organizationId, lease, next);
    }

    private Lease lock(UUID org, UUID id, long version) {
        authorize(org);
        Lease lease = leases.get(org, id, true);
        if (lease.version() != version) {
            throw new ConflictException("This lease changed since you opened it. Reload it before continuing.");
        }
        return lease;
    }

    private void authorize(UUID org) {
        context.resolve(org);
        authorization.requirePermission(org, LEASE_MANAGE);
    }

    private static PageRequest pagination(String search, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || search.length() > 150 || search.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Use a nonnegative page, size from 1 to 100, and valid search text up to 150 characters.");
        }
        return PageRequest.of(page, size);
    }

    private static void validate(Terms terms) {
        if (invalidDate(terms.startsOn()) || (terms.endsOn() != null
                && (invalidDate(terms.endsOn()) || terms.endsOn().isBefore(terms.startsOn())))) {
            throw new IllegalArgumentException("Use valid lease dates with an end date on or after the start date.");
        }
        Currency.getInstance(terms.currency());
        if (containsNull(terms.notes()) || containsNull(terms.paymentTerms()) || containsNull(terms.agreementTerms())) {
            throw new IllegalArgumentException("Lease text must contain valid characters.");
        }
    }

    private static boolean containsNull(String text) {
        return text != null && text.indexOf(0) >= 0;
    }

    private static boolean invalidDate(LocalDate date) {
        return date.getYear() < 1 || date.getYear() > 9999;
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }
}
