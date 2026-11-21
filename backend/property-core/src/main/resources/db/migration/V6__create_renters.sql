CREATE TABLE renters (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    first_name VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(first_name)) > 0),
    last_name VARCHAR(100) NOT NULL CHECK (LENGTH(TRIM(last_name)) > 0),
    email VARCHAR(254),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    UNIQUE (organization_id, id)
);

CREATE INDEX idx_renters_active_order
    ON renters (organization_id, created_at DESC, id DESC) WHERE archived_at IS NULL;

CREATE TABLE renter_audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id UUID NOT NULL,
    renter_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'ARCHIVE')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id, renter_id) REFERENCES renters (organization_id, id) ON DELETE RESTRICT
);

CREATE INDEX idx_renter_audit_events_renter
    ON renter_audit_events (organization_id, renter_id);
