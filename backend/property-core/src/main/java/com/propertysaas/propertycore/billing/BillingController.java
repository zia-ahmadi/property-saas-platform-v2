package com.propertysaas.propertycore.billing;

import com.propertysaas.propertycore.billing.Invoice.*;
import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.common.response.PageResponse;
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
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static com.propertysaas.propertycore.organization.permission.OrganizationPermission.BILLING_MANAGE;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/billing/invoices")
public class BillingController {
    private final AuthenticatedOrganizationContextResolver context;
    private final CurrentUserAuthorizationService authorization;
    private final BillingRepository billing;

    BillingController(AuthenticatedOrganizationContextResolver context, CurrentUserAuthorizationService authorization,
                      BillingRepository billing) {
        this.context = context;
        this.authorization = authorization;
        this.billing = billing;
    }

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageResponse<Invoice> list(@PathVariable UUID organizationId, @RequestParam(defaultValue = "") String search,
                                      @RequestParam(required = false) Status status,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "10") int size) {
        authorize(organizationId);
        if (page < 0 || size < 1 || size > 100 || search.length() > 150 || search.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Use a nonnegative page, size from 1 to 100, and valid search text up to 150 characters.");
        }
        return PageResponse.from(billing.list(organizationId, today(), search.strip(), status, PageRequest.of(page, size)));
    }

    @GetMapping("/summary")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Summary summary(@PathVariable UUID organizationId) {
        authorize(organizationId);
        return billing.summary(organizationId, today());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Details get(@PathVariable UUID organizationId, @PathVariable UUID id) {
        authorize(organizationId);
        return details(organizationId, id, today());
    }

    @PostMapping
    @Transactional
    public ResponseEntity<Details> issue(@PathVariable UUID organizationId, @Valid @RequestBody Issue input) {
        UUID user = authorize(organizationId);
        if (!validDate(input.billingMonth()) || input.billingMonth().getDayOfMonth() != 1 || !validDate(input.dueOn())) {
            throw new IllegalArgumentException("Provide a valid due date and the first day of the billing month.");
        }
        var lease = billing.lease(organizationId, input.leaseId());
        if (!List.of("ACTIVE", "ENDED").contains(lease.status()) || lease.amount().signum() <= 0) {
            throw new ConflictException("Choose an active or ended lease with positive monthly rent.");
        }
        LocalDate monthEnd = YearMonth.from(input.billingMonth()).atEndOfMonth();
        if (monthEnd.isBefore(lease.startsOn())
                || (lease.endsOn() != null && input.billingMonth().isAfter(lease.endsOn()))
                || (lease.closedOn() != null && input.billingMonth().isAfter(lease.closedOn()))) {
            throw new IllegalArgumentException("The billing month must overlap the lease term.");
        }
        UUID id = billing.issue(organizationId, user, input, lease);
        return ResponseEntity.created(URI.create("/api/v1/organizations/" + organizationId + "/billing/invoices/" + id))
                .body(details(organizationId, id, today()));
    }

    @PostMapping("/{id}/payments")
    @Transactional
    public Details record(@PathVariable UUID organizationId, @PathVariable UUID id,
                          @Valid @RequestBody RecordPayment input) {
        UUID user = authorize(organizationId);
        LocalDate today = today();
        Invoice invoice = lock(organizationId, id, today, input.version());
        if (invoice.balance().signum() <= 0 || input.amount().compareTo(invoice.balance()) > 0) {
            throw new ConflictException("The payment must fit within the invoice’s outstanding balance.");
        }
        if (!validDate(input.receivedOn()) || input.receivedOn().isAfter(today)) {
            throw new IllegalArgumentException("The payment date must be today or earlier.");
        }
        billing.record(organizationId, id, user, input, clean(input.reference()));
        return details(organizationId, id, today);
    }

    @PostMapping("/{id}/void")
    @Transactional
    public Details voidInvoice(@PathVariable UUID organizationId, @PathVariable UUID id,
                               @Valid @RequestBody VoidInvoice input) {
        UUID user = authorize(organizationId);
        LocalDate today = today();
        Invoice invoice = lock(organizationId, id, today, input.version());
        if (invoice.status() == Status.VOID || invoice.paidAmount().signum() > 0) {
            throw new ConflictException("Only an invoice without recorded payments can be voided.");
        }
        String reason = clean(input.reason());
        if (reason == null) {
            throw new IllegalArgumentException("A void reason is required.");
        }
        billing.voidInvoice(organizationId, id, user, reason);
        return details(organizationId, id, today);
    }

    private Details details(UUID org, UUID id, LocalDate today) {
        return new Details(billing.get(org, id, today, false), billing.payments(org, id), today);
    }

    private Invoice lock(UUID org, UUID id, LocalDate today, long version) {
        Invoice invoice = billing.get(org, id, today, true);
        if (invoice.version() != version) {
            throw new ConflictException("This invoice changed. Reload it before continuing.");
        }
        return invoice;
    }

    private UUID authorize(UUID org) {
        UUID user = context.resolve(org).userId();
        authorization.requirePermission(org, BILLING_MANAGE);
        return user;
    }

    private static String clean(String value) {
        if (value != null && value.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Use valid text in billing fields.");
        }
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static boolean validDate(LocalDate date) {
        return date.getYear() >= 1 && date.getYear() <= 9999;
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }
}
