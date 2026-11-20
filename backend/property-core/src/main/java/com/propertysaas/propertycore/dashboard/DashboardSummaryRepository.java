package com.propertysaas.propertycore.dashboard;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public class DashboardSummaryRepository {
    private final JdbcTemplate jdbc;

    public DashboardSummaryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public DashboardSummary summarize(UUID organizationId) {
        // One statement gives every count the same PostgreSQL MVCC snapshot.
        // Aggregate properties separately to avoid multiplying them by their units.
        return jdbc.queryForObject("""
                WITH scoped_properties AS MATERIALIZED (
                    SELECT id, status FROM properties WHERE organization_id = ?
                )
                SELECT p.*, u.* FROM (
                    SELECT count(*) AS total_properties,
                           count(*) FILTER (WHERE status = 'active') AS active_properties,
                           count(*) FILTER (WHERE status = 'archived') AS archived_properties
                    FROM scoped_properties
                ) p CROSS JOIN (
                    SELECT count(*) AS total_units,
                           count(*) FILTER (WHERE u.availability_status = 'available') AS available_units,
                           count(*) FILTER (WHERE u.availability_status = 'unavailable') AS unavailable_units,
                           count(*) FILTER (WHERE u.availability_status = 'occupied') AS occupied_units
                    FROM units u JOIN scoped_properties p ON p.id = u.property_id
                ) u
                """, (rs, row) -> new DashboardSummary(
                rs.getLong("total_properties"), rs.getLong("active_properties"),
                rs.getLong("archived_properties"), rs.getLong("total_units"),
                rs.getLong("available_units"), rs.getLong("unavailable_units"),
                rs.getLong("occupied_units")
        ), organizationId);
    }
}
