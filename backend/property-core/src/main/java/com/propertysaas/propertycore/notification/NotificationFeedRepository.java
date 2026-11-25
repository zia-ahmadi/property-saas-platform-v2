package com.propertysaas.propertycore.notification;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class NotificationFeedRepository {
    record Event(String cursor, String kind, UUID resourceId, String maintenanceStatus, String occurredAt, boolean unread) {}
    record SupportReply(UUID messageId, UUID organizationId, String organizationName, String occurredAt, boolean unread) {}
    record SupportFeed(List<SupportReply> replies, long unreadCount) {}
    private record SupportRow(SupportReply reply, long unreadCount) {}

    private static final String VISIBLE_EVENTS = """
            FROM organization_notifications n
            LEFT JOIN organization_notification_reads r
              ON r.organization_id = n.organization_id AND r.sequence = n.sequence AND r.user_id = :user
            WHERE n.organization_id = :org
              AND ((:maintenance AND n.kind <> 'PAYMENT_RECORDED') OR (:billing AND n.kind = 'PAYMENT_RECORDED'))
            """;

    private final JdbcClient jdbc;

    NotificationFeedRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    List<Event> read(UUID org, UUID user, Long after, int limit, boolean maintenance, boolean billing) {
        String order = after == null ? "ORDER BY n.sequence DESC" : "AND n.sequence > :after ORDER BY n.sequence ASC";
        var query = visible("SELECT n.*, r.user_id IS NULL AS unread " + VISIBLE_EVENTS + order + " LIMIT :limit",
                org, user, maintenance, billing).param("limit", limit);
        if (after != null) query.param("after", after);
        return query.query((rs, row) -> new Event(Long.toString(rs.getLong("sequence")), rs.getString("kind"),
                rs.getObject("resource_id", UUID.class), rs.getString("maintenance_status"),
                rs.getObject("occurred_at", OffsetDateTime.class).toInstant().toString(),
                rs.getBoolean("unread"))).list();
    }

    long unreadCount(UUID org, UUID user, boolean maintenance, boolean billing) {
        return visible("SELECT count(*) " + VISIBLE_EVENTS + " AND r.user_id IS NULL", org, user, maintenance, billing)
                .query(Long.class).single();
    }

    boolean markRead(UUID org, UUID user, long cursor, boolean maintenance, boolean billing) {
        String sql = """
                WITH event AS (
                    SELECT n.organization_id, n.sequence
                """ + VISIBLE_EVENTS + """
                    AND n.sequence = :cursor
                ), receipt AS (
                    INSERT INTO organization_notification_reads (organization_id, sequence, user_id)
                    SELECT organization_id, sequence, :user FROM event
                    ON CONFLICT DO NOTHING
                )
                SELECT EXISTS (SELECT 1 FROM event)
                """;
        return visible(sql, org, user, maintenance, billing).param("cursor", cursor).query(Boolean.class).single();
    }

    void markAllRead(UUID org, UUID user, boolean maintenance, boolean billing) {
        visible("""
                INSERT INTO organization_notification_reads (organization_id, sequence, user_id)
                SELECT n.organization_id, n.sequence, :user
                """ + VISIBLE_EVENTS + " AND r.user_id IS NULL ON CONFLICT DO NOTHING", org, user, maintenance, billing)
                .update();
    }

    void markSupportRead(UUID user) {
        jdbc.sql("""
                UPDATE organization_messages m SET read_at = CURRENT_TIMESTAMP
                WHERE m.direction = 'platform_to_organization' AND m.read_at IS NULL
                  AND EXISTS (
                    SELECT 1 FROM organization_memberships membership
                    JOIN users u ON u.id = membership.user_id AND u.status = 'active'
                    WHERE membership.organization_id = m.organization_id AND membership.user_id = :user
                      AND membership.role = 'owner' AND membership.status = 'active'
                  )
                """).param("user", user).update();
    }

    SupportFeed support(UUID user) {
        var rows = jdbc.sql("""
                SELECT m.id, o.id AS organization_id, o.name, m.created_at, m.read_at IS NULL AS unread,
                       count(*) FILTER (WHERE m.read_at IS NULL) OVER () AS unread_count
                FROM organization_memberships membership
                JOIN users u ON u.id = membership.user_id AND u.status = 'active'
                JOIN organizations o ON o.id = membership.organization_id
                JOIN organization_messages m ON m.organization_id = o.id AND m.direction = 'platform_to_organization'
                WHERE membership.user_id = :user AND membership.role = 'owner' AND membership.status = 'active'
                ORDER BY m.created_at DESC, m.id DESC
                LIMIT 40
                """).param("user", user).query((rs, row) -> new SupportRow(new SupportReply(
                        rs.getObject("id", UUID.class), rs.getObject("organization_id", UUID.class), rs.getString("name"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant().toString(), rs.getBoolean("unread")),
                        rs.getLong("unread_count"))).list();
        return new SupportFeed(rows.stream().map(SupportRow::reply).toList(), rows.isEmpty() ? 0 : rows.getFirst().unreadCount());
    }

    private JdbcClient.StatementSpec visible(String sql, UUID org, UUID user, boolean maintenance, boolean billing) {
        return jdbc.sql(sql).param("org", org).param("user", user)
                .param("maintenance", maintenance).param("billing", billing);
    }
}
