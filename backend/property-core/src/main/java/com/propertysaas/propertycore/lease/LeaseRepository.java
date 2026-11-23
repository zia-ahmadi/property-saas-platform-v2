package com.propertysaas.propertycore.lease;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.lease.Lease.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Repository
class LeaseRepository {
    private static final String REGISTER = """
             FROM leases l
             JOIN properties p ON p.id = l.property_id
             JOIN units u ON u.id = l.unit_id
             JOIN renters r ON r.id = l.renter_id
             WHERE l.organization_id = :org
            """;
    private static final String SELECT = """
            SELECT l.*, p.name AS property_name, u.unit_number,
                   concat(r.first_name, ' ', r.last_name) AS renter_name
            """ + REGISTER;
    private static final RowMapper<Lease> LEASE = (rs, row) -> new Lease(
            rs.getObject("id", UUID.class), rs.getObject("property_id", UUID.class), rs.getString("property_name"),
            rs.getObject("unit_id", UUID.class), rs.getString("unit_number"),
            rs.getObject("renter_id", UUID.class), rs.getString("renter_name"),
            rs.getObject("starts_on", LocalDate.class), rs.getObject("ends_on", LocalDate.class),
            rs.getBigDecimal("monthly_rent"), rs.getBigDecimal("deposit"), rs.getString("currency"),
            rs.getString("notes"), Status.valueOf(rs.getString("status")),
            rs.getObject("activated_at", OffsetDateTime.class), rs.getObject("closed_at", OffsetDateTime.class),
            rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class),
            rs.getLong("version")
    );

    private final NamedParameterJdbcTemplate jdbc;

    LeaseRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Page<Lease> list(UUID org, String search, Status status, boolean endingSoon, LocalDate today, PageRequest page) {
        var args = scope(org).addValue("search", search);
        String filters = """
                  AND (:search = '' OR strpos(lower(concat(r.first_name, ' ', r.last_name)), lower(:search)) > 0
                    OR strpos(lower(p.name), lower(:search)) > 0
                    OR strpos(lower(u.unit_number), lower(:search)) > 0)
                """;
        if (status != null) {
            filters += " AND l.status = :status";
            args.addValue("status", status.name());
        }
        if (endingSoon) {
            filters += " AND l.status = 'ACTIVE' AND l.ends_on <= :deadline";
            args.addValue("deadline", today.plusDays(30));
        }
        return paged(REGISTER + filters, SELECT + filters + " ORDER BY l.updated_at DESC, l.id DESC",
                args, LEASE, page);
    }

    Summary summary(UUID org, LocalDate today) {
        return jdbc.queryForObject("""
                SELECT count(*) FILTER (WHERE status = 'DRAFT') AS drafts,
                       count(*) FILTER (WHERE status = 'ACTIVE') AS active,
                       count(*) FILTER (WHERE status = 'ACTIVE' AND ends_on <= :deadline) AS ending_soon,
                       count(*) FILTER (WHERE status = 'ENDED') AS ended
                FROM leases WHERE organization_id = :org
                """, scope(org).addValue("deadline", today.plusDays(30)), (rs, row) -> new Summary(
                rs.getLong("drafts"), rs.getLong("active"), rs.getLong("ending_soon"), rs.getLong("ended"), today));
    }

    Page<UnitOption> units(UUID org, String search, PageRequest page) {
        String filter = """
                 FROM units u JOIN properties p ON p.id = u.property_id
                 WHERE p.organization_id = :org AND p.status = 'active'
                   AND (:search = '' OR strpos(lower(concat(p.name, ' ', u.unit_number)), lower(:search)) > 0)
                """;
        return paged(filter, "SELECT u.id, p.id AS property_id, p.name, u.unit_number, u.availability_status "
                + filter + " ORDER BY lower(p.name), lower(u.unit_number), u.id",
                scope(org).addValue("search", search), (rs, row) -> new UnitOption(
                        rs.getObject("id", UUID.class), rs.getObject("property_id", UUID.class), rs.getString("name"),
                        rs.getString("unit_number"), rs.getString("availability_status").toUpperCase(java.util.Locale.ROOT)), page);
    }

    Lease get(UUID org, UUID id, boolean lock) {
        return jdbc.query(SELECT + " AND l.id = :id" + (lock ? " FOR UPDATE OF l" : ""),
                scope(org).addValue("id", id), LEASE).stream().findFirst().orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Lease not found"));
    }

    UUID validateParties(UUID org, UUID unit, UUID renter) {
        UUID property = jdbc.query("""
                SELECT p.id FROM units u JOIN properties p ON p.id = u.property_id
                WHERE p.organization_id = :org AND p.status = 'active' AND u.id = :unit
                FOR SHARE OF p
                """, scope(org).addValue("unit", unit), (rs, row) -> rs.getObject("id", UUID.class))
                .stream().findFirst().orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a unit in an active property in this organization."));
        boolean activeRenter = !jdbc.query("""
                SELECT id FROM renters WHERE organization_id = :org AND id = :renter AND archived_at IS NULL
                FOR SHARE
                """, scope(org).addValue("renter", renter), (rs, row) -> rs.getObject("id", UUID.class)).isEmpty();
        if (!activeRenter) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select an active renter in this organization.");
        }
        return property;
    }

    Lease create(UUID org, Terms terms, UUID property) {
        UUID id = jdbc.queryForObject("""
                INSERT INTO leases (organization_id, property_id, unit_id, renter_id, starts_on, ends_on,
                                    monthly_rent, deposit, currency, notes)
                VALUES (:org, :property, :unit, :renter, :start, :end, :rent, :deposit, :currency, :notes)
                RETURNING id
                """, parameters(org, terms, property), UUID.class);
        return get(org, id, false);
    }

    Lease update(UUID org, UUID id, Terms terms, UUID property) {
        jdbc.update("""
                UPDATE leases SET property_id = :property, unit_id = :unit, renter_id = :renter,
                    starts_on = :start, ends_on = :end, monthly_rent = :rent, deposit = :deposit,
                    currency = :currency, notes = :notes, updated_at = CURRENT_TIMESTAMP, version = version + 1
                WHERE organization_id = :org AND id = :id
                """, parameters(org, terms, property).addValue("id", id));
        return get(org, id, false);
    }

    Lease transition(UUID org, Lease lease, Status next) {
        if (next == Status.ACTIVE) {
            changeAvailability(lease, "available", "occupied", "This unit is already occupied or unavailable.");
        } else if (next == Status.ENDED) {
            changeAvailability(lease, "occupied", "available", "The unit’s occupancy no longer matches this lease.");
        }
        jdbc.update("""
                UPDATE leases SET status = :status,
                    activated_at = CASE WHEN :status = 'ACTIVE' THEN CURRENT_TIMESTAMP ELSE activated_at END,
                    closed_at = CASE WHEN :status IN ('ENDED', 'CANCELLED') THEN CURRENT_TIMESTAMP ELSE closed_at END,
                    updated_at = CURRENT_TIMESTAMP, version = version + 1
                WHERE organization_id = :org AND id = :id
                """, scope(org).addValue("id", lease.id()).addValue("status", next.name()));
        return get(org, lease.id(), false);
    }

    private void changeAvailability(Lease lease, String from, String to, String conflict) {
        int changed = jdbc.update("""
                UPDATE units SET availability_status = :to, updated_at = CURRENT_TIMESTAMP
                WHERE id = :unit AND property_id = :property AND availability_status = :from
                """, new MapSqlParameterSource("unit", lease.unitId()).addValue("property", lease.propertyId())
                .addValue("from", from).addValue("to", to));
        if (changed == 0) {
            throw new ConflictException(conflict);
        }
    }

    private <T> Page<T> paged(String filter, String query, MapSqlParameterSource args, RowMapper<T> row, PageRequest page) {
        long total = jdbc.queryForObject("SELECT count(*) " + filter, args, Long.class);
        args.addValue("limit", page.getPageSize()).addValue("offset", page.getOffset());
        return new PageImpl<>(jdbc.query(query + " LIMIT :limit OFFSET :offset", args, row), page, total);
    }

    private static MapSqlParameterSource parameters(UUID org, Terms terms, UUID property) {
        return scope(org).addValue("property", property).addValue("unit", terms.unitId())
                .addValue("renter", terms.renterId()).addValue("start", terms.startsOn()).addValue("end", terms.endsOn())
                .addValue("rent", terms.monthlyRent()).addValue("deposit", terms.deposit())
                .addValue("currency", terms.currency()).addValue("notes", terms.notes() == null ? null : terms.notes().strip());
    }

    private static MapSqlParameterSource scope(UUID org) {
        return new MapSqlParameterSource("org", org);
    }
}
