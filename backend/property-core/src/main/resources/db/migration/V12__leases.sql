CREATE TABLE leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    property_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    renter_id UUID NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE,
    monthly_rent NUMERIC(12,2) NOT NULL CHECK (monthly_rent >= 0),
    deposit NUMERIC(12,2) NOT NULL CHECK (deposit >= 0),
    currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    notes VARCHAR(4000),
    status VARCHAR(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED')),
    activated_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    FOREIGN KEY (organization_id, property_id) REFERENCES properties (organization_id, id),
    FOREIGN KEY (property_id, unit_id) REFERENCES units (property_id, id),
    FOREIGN KEY (organization_id, renter_id) REFERENCES renters (organization_id, id),
    CHECK (ends_on IS NULL OR ends_on >= starts_on),
    CHECK ((status IN ('ACTIVE', 'ENDED')) = (activated_at IS NOT NULL)),
    CHECK ((status IN ('ENDED', 'CANCELLED')) = (closed_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_leases_active_unit ON leases (unit_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_leases_register ON leases (organization_id, updated_at DESC, id DESC);
CREATE INDEX idx_leases_renter ON leases (organization_id, renter_id);
CREATE INDEX idx_leases_unit ON leases (property_id, unit_id);
