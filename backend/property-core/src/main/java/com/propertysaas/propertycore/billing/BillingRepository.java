package com.propertysaas.propertycore.billing;

import com.propertysaas.propertycore.billing.Invoice.*;
import com.propertysaas.propertycore.common.exception.ConflictException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
class BillingRepository {
    private static final String STATUS = """
            CASE WHEN voided_at IS NOT NULL THEN 'VOID'
                 WHEN paid_amount = amount THEN 'PAID'
                 WHEN due_on < :today THEN 'OVERDUE'
                 WHEN paid_amount > 0 THEN 'PARTIALLY_PAID'
                 ELSE 'OPEN' END
            """;
    private static final String SELECT = "SELECT *, " + STATUS + " AS status FROM rent_invoices";
    private static final RowMapper<Invoice> INVOICE = (rs, row) -> {
        BigDecimal amount = rs.getBigDecimal("amount");
        BigDecimal paid = rs.getBigDecimal("paid_amount");
        Status status = Status.valueOf(rs.getString("status"));
        return new Invoice(rs.getObject("id", UUID.class), rs.getLong("invoice_number"),
                rs.getObject("lease_id", UUID.class), rs.getString("renter_name"), rs.getString("property_name"),
                rs.getString("unit_number"), rs.getObject("billing_month", LocalDate.class),
                rs.getObject("due_on", LocalDate.class), rs.getString("currency"), amount, paid,
                status == Status.VOID ? BigDecimal.ZERO : amount.subtract(paid), status,
                rs.getObject("issued_at", OffsetDateTime.class), rs.getObject("voided_at", OffsetDateTime.class),
                rs.getString("void_reason"), rs.getLong("version"));
    };

    private final NamedParameterJdbcTemplate jdbc;

    BillingRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Page<Invoice> list(UUID org, LocalDate today, String search, Status status, PageRequest page) {
        var args = scope(org).addValue("today", today).addValue("search", search)
                .addValue("limit", page.getPageSize()).addValue("offset", page.getOffset());
        String filter = """
                 WHERE organization_id = :org
                   AND (:search = '' OR strpos(lower(concat('INV-', invoice_number, ' ', renter_name,
                        ' ', property_name, ' ', unit_number)), lower(:search)) > 0)
                """;
        if (status != null) {
            filter += " AND (" + STATUS + ") = :status";
            args.addValue("status", status.name());
        }
        long total = jdbc.queryForObject("SELECT count(*) FROM rent_invoices" + filter, args, Long.class);
        return new PageImpl<>(jdbc.query(SELECT + filter + " ORDER BY invoice_number DESC LIMIT :limit OFFSET :offset",
                args, INVOICE), page, total);
    }

    Summary summary(UUID org, LocalDate today) {
        var args = scope(org).addValue("today", today);
        List<Totals> totals = jdbc.query("""
                SELECT currency, sum(amount - paid_amount) AS outstanding, sum(paid_amount) AS collected,
                       coalesce(sum(amount - paid_amount) FILTER (WHERE due_on < :today), 0) AS overdue
                FROM rent_invoices WHERE organization_id = :org AND voided_at IS NULL
                GROUP BY currency ORDER BY currency
                """, args, (rs, row) -> new Totals(rs.getString("currency"), rs.getBigDecimal("outstanding"),
                rs.getBigDecimal("overdue"), rs.getBigDecimal("collected")));
        return jdbc.queryForObject("""
                SELECT count(*) FILTER (WHERE paid_amount < amount AND due_on >= :today) AS open,
                       count(*) FILTER (WHERE paid_amount < amount AND due_on < :today) AS overdue,
                       count(*) FILTER (WHERE paid_amount = amount) AS paid
                FROM rent_invoices WHERE organization_id = :org AND voided_at IS NULL
                """, args, (rs, row) -> new Summary(rs.getLong("open"), rs.getLong("overdue"),
                rs.getLong("paid"), totals, today));
    }

    Invoice get(UUID org, UUID id, LocalDate today, boolean lock) {
        return jdbc.query(SELECT + " WHERE organization_id = :org AND id = :id" + (lock ? " FOR UPDATE" : ""),
                scope(org).addValue("id", id).addValue("today", today), INVOICE).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found."));
    }

    List<Payment> payments(UUID org, UUID id) {
        return jdbc.query("""
                SELECT id, amount, received_on, method, reference, recorded_at FROM rent_payments
                WHERE organization_id = :org AND invoice_id = :id
                ORDER BY received_on DESC, recorded_at DESC, id DESC
                """, scope(org).addValue("id", id), (rs, row) -> new Payment(rs.getObject("id", UUID.class),
                rs.getBigDecimal("amount"), rs.getObject("received_on", LocalDate.class),
                Method.valueOf(rs.getString("method")), rs.getString("reference"),
                rs.getObject("recorded_at", OffsetDateTime.class)));
    }

    BillableLease lease(UUID org, UUID id) {
        return jdbc.query("""
                SELECT l.status, l.starts_on, l.ends_on, (l.closed_at AT TIME ZONE 'UTC')::date AS closed_on,
                       l.monthly_rent, l.currency, concat(r.first_name, ' ', r.last_name) AS renter_name,
                       p.name AS property_name, u.unit_number
                FROM leases l JOIN properties p ON p.id = l.property_id
                JOIN units u ON u.id = l.unit_id JOIN renters r ON r.id = l.renter_id
                WHERE l.organization_id = :org AND l.id = :id FOR SHARE OF l
                """, scope(org).addValue("id", id), (rs, row) -> new BillableLease(rs.getString("status"),
                rs.getObject("starts_on", LocalDate.class), rs.getObject("ends_on", LocalDate.class),
                rs.getObject("closed_on", LocalDate.class), rs.getBigDecimal("monthly_rent"),
                rs.getString("currency"), rs.getString("renter_name"), rs.getString("property_name"),
                rs.getString("unit_number"))).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lease not found."));
    }

    UUID issue(UUID org, UUID user, Issue input, BillableLease lease) {
        var args = scope(org).addValue("lease", input.leaseId()).addValue("user", user)
                .addValue("month", input.billingMonth()).addValue("due", input.dueOn())
                .addValue("amount", lease.amount()).addValue("currency", lease.currency())
                .addValue("renter", lease.renterName()).addValue("property", lease.propertyName())
                .addValue("unit", lease.unitNumber());
        return jdbc.query("""
                INSERT INTO rent_invoices (organization_id, lease_id, issued_by, billing_month, due_on, amount,
                                           currency, renter_name, property_name, unit_number)
                VALUES (:org, :lease, :user, :month, :due, :amount, :currency, :renter, :property, :unit)
                ON CONFLICT (organization_id, lease_id, billing_month) WHERE voided_at IS NULL DO NOTHING
                RETURNING id
                """, args, (rs, row) -> rs.getObject("id", UUID.class)).stream().findFirst()
                .orElseThrow(() -> new ConflictException("A rent invoice already exists for this lease and month."));
    }

    void record(UUID org, UUID id, UUID user, RecordPayment input, String reference) {
        var args = scope(org).addValue("id", id).addValue("user", user)
                .addValue("amount", input.amount()).addValue("received", input.receivedOn())
                .addValue("method", input.method().name()).addValue("reference", reference);
        jdbc.update("""
                INSERT INTO rent_payments (organization_id, invoice_id, recorded_by, amount, received_on, method, reference)
                VALUES (:org, :id, :user, :amount, :received, :method, :reference)
                """, args);
        jdbc.update("""
                UPDATE rent_invoices SET paid_amount = paid_amount + :amount, version = version + 1
                WHERE organization_id = :org AND id = :id
                """, args);
    }

    void voidInvoice(UUID org, UUID id, UUID user, String reason) {
        jdbc.update("""
                UPDATE rent_invoices SET voided_at = CURRENT_TIMESTAMP, voided_by = :user, void_reason = :reason,
                                         version = version + 1
                WHERE organization_id = :org AND id = :id
                """, scope(org).addValue("id", id).addValue("user", user).addValue("reason", reason));
    }

    private static MapSqlParameterSource scope(UUID org) {
        return new MapSqlParameterSource("org", org);
    }

    record BillableLease(String status, LocalDate startsOn, LocalDate endsOn, LocalDate closedOn,
                         BigDecimal amount, String currency, String renterName, String propertyName, String unitNumber) {}
}
