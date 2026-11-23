ALTER TABLE properties ADD CONSTRAINT uq_properties_organization_id UNIQUE (organization_id, id);
ALTER TABLE units ADD CONSTRAINT uq_units_property_id UNIQUE (property_id, id);

CREATE TABLE maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    property_id UUID NOT NULL,
    unit_id UUID,
    reported_by UUID REFERENCES users (id) ON DELETE SET NULL,
    title VARCHAR(150) NOT NULL CHECK (length(trim(title)) > 0),
    description VARCHAR(4000) NOT NULL CHECK (length(trim(description)) > 0),
    category VARCHAR(20) NOT NULL CHECK (category IN ('PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'GENERAL', 'OTHER')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')),
    assigned_to VARCHAR(150),
    due_date DATE,
    resolution_notes VARCHAR(4000),
    resolved_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id, property_id) REFERENCES properties (organization_id, id),
    FOREIGN KEY (property_id, unit_id) REFERENCES units (property_id, id),
    CHECK ((status = 'RESOLVED') = (resolved_at IS NOT NULL))
);

CREATE INDEX idx_maintenance_queue ON maintenance_requests (organization_id, updated_at DESC, id DESC);
CREATE INDEX idx_maintenance_location ON maintenance_requests (property_id, unit_id);
