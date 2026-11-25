CREATE TABLE organization_notification_reads (
    organization_id UUID NOT NULL,
    sequence BIGINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (organization_id, user_id, sequence),
    FOREIGN KEY (organization_id, sequence)
        REFERENCES organization_notifications (organization_id, sequence) ON DELETE CASCADE
);

CREATE INDEX idx_organization_notification_reads_event
    ON organization_notification_reads (organization_id, sequence);

CREATE INDEX idx_organization_messages_platform_replies
    ON organization_messages (organization_id, created_at DESC, id DESC)
    WHERE direction = 'platform_to_organization';
