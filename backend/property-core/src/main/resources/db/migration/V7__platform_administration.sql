-- Existing organization statuses are retained. Only future registrations are pending.
ALTER TABLE organizations DROP CONSTRAINT ck_organizations_status;
ALTER TABLE organizations ADD CONSTRAINT ck_organizations_status
    CHECK (status IN ('pending', 'active', 'rejected', 'suspended', 'banned'));

CREATE TABLE platform_authorities (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    authority VARCHAR(30) NOT NULL CHECK (authority = 'PLATFORM_OWNER'),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, authority)
);

CREATE TABLE organization_status_audit (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    actor_user_id UUID NOT NULL REFERENCES users(id),
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    reason VARCHAR(2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organization_messages (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    sender_user_id UUID NOT NULL REFERENCES users(id),
    body VARCHAR(5000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ
);
CREATE INDEX idx_organization_messages_inbox ON organization_messages(organization_id, created_at DESC);
