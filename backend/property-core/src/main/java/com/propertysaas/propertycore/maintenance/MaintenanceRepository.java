package com.propertysaas.propertycore.maintenance;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.maintenance.MaintenanceRequest.*;
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
class MaintenanceRepository {
    private static final String FROM = """
             FROM maintenance_requests m
             JOIN properties p ON p.id = m.property_id
             LEFT JOIN units u ON u.id = m.unit_id
             WHERE m.organization_id = :organization
            """;
    private static final String SELECT = "SELECT m.*, p.name AS property_name, u.unit_number " + FROM;
    private static final RowMapper<MaintenanceRequest> ROW = (rs, row) -> new MaintenanceRequest(
            rs.getObject("id", UUID.class), rs.getObject("property_id", UUID.class),
            rs.getString("property_name"), rs.getObject("unit_id", UUID.class), rs.getString("unit_number"),
            rs.getObject("reported_by", UUID.class), rs.getString("title"), rs.getString("description"),
            Category.valueOf(rs.getString("category")), Priority.valueOf(rs.getString("priority")),
            Status.valueOf(rs.getString("status")), rs.getString("assigned_to"),
            rs.getObject("due_date", LocalDate.class), rs.getString("resolution_notes"),
            rs.getObject("resolved_at", OffsetDateTime.class), rs.getObject("created_at", OffsetDateTime.class),
            rs.getObject("updated_at", OffsetDateTime.class), rs.getLong("version")
    );

    private final NamedParameterJdbcTemplate jdbc;

    MaintenanceRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Page<MaintenanceRequest> list(UUID organization, UUID property, Status status, Priority priority,
                                  String search, PageRequest page) {
        var args = new MapSqlParameterSource("organization", organization);
        var filters = new StringBuilder();
        if (property != null) {
            filters.append(" AND m.property_id = :property");
            args.addValue("property", property);
        }
        if (status != null) {
            filters.append(" AND m.status = :status");
            args.addValue("status", status.name());
        }
        if (priority != null) {
            filters.append(" AND m.priority = :priority");
            args.addValue("priority", priority.name());
        }
        if (!search.isBlank()) {
            filters.append("""
                     AND (strpos(lower(m.title), lower(:search)) > 0
                       OR strpos(lower(p.name), lower(:search)) > 0
                       OR strpos(lower(u.unit_number), lower(:search)) > 0
                       OR strpos(lower(m.assigned_to), lower(:search)) > 0)
                    """);
            args.addValue("search", search.strip());
        }
        long total = jdbc.queryForObject("SELECT count(*) " + FROM + filters, args, Long.class);
        args.addValue("limit", page.getPageSize()).addValue("offset", page.getOffset());
        return new PageImpl<>(jdbc.query(SELECT + filters
                + " ORDER BY m.updated_at DESC, m.id DESC LIMIT :limit OFFSET :offset", args, ROW), page, total);
    }

    Page<PropertyOption> properties(UUID organization, String search, PageRequest page) {
        String filter = """
                FROM properties WHERE organization_id = :organization AND status = 'active'
                  AND (:search = '' OR strpos(lower(name), lower(:search)) > 0)
                """;
        var args = new MapSqlParameterSource("organization", organization).addValue("search", search);
        long total = jdbc.queryForObject("SELECT count(*) " + filter, args, Long.class);
        args.addValue("limit", page.getPageSize()).addValue("offset", page.getOffset());
        var options = jdbc.query("SELECT id, name " + filter
                        + " ORDER BY lower(name), id LIMIT :limit OFFSET :offset", args,
                (rs, row) -> new PropertyOption(rs.getObject("id", UUID.class), rs.getString("name")));
        return new PageImpl<>(options, page, total);
    }

    Summary summary(UUID organization) {
        return jdbc.queryForObject("""
                SELECT count(*) FILTER (WHERE status = 'OPEN') AS open,
                       count(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress,
                       count(*) FILTER (WHERE status IN ('OPEN', 'IN_PROGRESS') AND priority = 'URGENT') AS urgent,
                       count(*) FILTER (WHERE status = 'RESOLVED') AS resolved
                FROM maintenance_requests WHERE organization_id = :organization
                """, new MapSqlParameterSource("organization", organization),
                (rs, row) -> new Summary(rs.getLong("open"), rs.getLong("in_progress"),
                        rs.getLong("urgent"), rs.getLong("resolved")));
    }

    MaintenanceRequest get(UUID organization, UUID id) {
        return jdbc.query(SELECT + " AND m.id = :id",
                new MapSqlParameterSource("organization", organization).addValue("id", id), ROW)
                .stream().findFirst().orElseThrow(() ->
                        new ResponseStatusException(HttpStatus.NOT_FOUND, "Maintenance request not found"));
    }

    MaintenanceRequest create(UUID organization, UUID user, Input input) {
        var args = parameters(organization, input).addValue("user", user);
        UUID id = jdbc.queryForObject("""
                INSERT INTO maintenance_requests
                    (organization_id, property_id, unit_id, reported_by, title, description,
                     category, priority, status, assigned_to, due_date)
                VALUES (:organization, :property, :unit, :user, :title, :description,
                        :category, :priority, 'OPEN', :assignee, :due)
                RETURNING id
                """, args, UUID.class);
        return get(organization, id);
    }

    MaintenanceRequest update(UUID organization, UUID id, Update update) {
        var args = parameters(organization, update.request()).addValue("id", id)
                .addValue("status", update.status().name())
                .addValue("notes", optionalText(update.resolutionNotes()))
                .addValue("version", update.version());
        int changed = jdbc.update("""
                UPDATE maintenance_requests SET property_id = :property, unit_id = :unit,
                    title = :title, description = :description, category = :category, priority = :priority,
                    status = :status, assigned_to = :assignee, due_date = :due, resolution_notes = :notes,
                    resolved_at = CASE WHEN :status = 'RESOLVED' THEN coalesce(resolved_at, CURRENT_TIMESTAMP) END,
                    updated_at = CURRENT_TIMESTAMP, version = version + 1
                WHERE organization_id = :organization AND id = :id AND version = :version
                """, args);
        if (changed == 0) {
            throw new ConflictException("This request was updated by someone else. Reload it before saving.");
        }
        return get(organization, id);
    }

    void validateLocation(UUID organization, Input input, boolean allowArchived) {
        boolean valid = Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (
                    SELECT 1 FROM properties p
                    WHERE p.id = :property AND p.organization_id = :organization
                      AND (:allowArchived OR p.status = 'active')
                      AND (CAST(:unit AS uuid) IS NULL OR EXISTS (
                          SELECT 1 FROM units u WHERE u.id = :unit AND u.property_id = p.id
                      ))
                    FOR SHARE OF p
                )
                """, new MapSqlParameterSource("organization", organization)
                .addValue("property", input.propertyId()).addValue("unit", input.unitId())
                .addValue("allowArchived", allowArchived), Boolean.class));
        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select an active property in this organization and a unit belonging to it.");
        }
    }

    private static MapSqlParameterSource parameters(UUID organization, Input input) {
        if (input.dueDate() != null && (input.dueDate().getYear() < 1 || input.dueDate().getYear() > 9999)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use a due date with a year between 1 and 9999.");
        }
        String title = optionalText(input.title());
        String description = optionalText(input.description());
        if (title == null || description == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Title and description are required.");
        }
        return new MapSqlParameterSource("organization", organization)
                .addValue("property", input.propertyId()).addValue("unit", input.unitId())
                .addValue("title", title).addValue("description", description)
                .addValue("category", input.category().name()).addValue("priority", input.priority().name())
                .addValue("assignee", optionalText(input.assignedTo())).addValue("due", input.dueDate());
    }

    private static String optionalText(String value) {
        if (value != null && value.indexOf(0) >= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Text fields must contain valid text.");
        }
        return value == null || value.isBlank() ? null : value.strip();
    }
}
