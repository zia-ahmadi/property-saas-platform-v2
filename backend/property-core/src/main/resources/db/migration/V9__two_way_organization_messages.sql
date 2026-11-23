ALTER TABLE organization_messages ADD COLUMN direction VARCHAR(30) NOT NULL DEFAULT 'platform_to_organization';
ALTER TABLE organization_messages ADD CONSTRAINT ck_organization_messages_direction CHECK (direction IN ('platform_to_organization', 'organization_to_platform'));
ALTER TABLE organization_messages ADD COLUMN platform_read_at TIMESTAMPTZ;
