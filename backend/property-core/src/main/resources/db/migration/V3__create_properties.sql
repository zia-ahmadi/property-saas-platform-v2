
-- V3: Create properties table

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    organization_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    property_type VARCHAR(30) NOT NULL,

    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'active',

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_properties_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations (id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_properties_name
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT ck_properties_type
        CHECK (
            property_type IN (
                'apartment',
                'house',
                'commercial',
                'mixed_use',
                'land',
                'other'
            )
        ),

    CONSTRAINT ck_properties_status
        CHECK (status IN ('active', 'archived')),

    CONSTRAINT ck_properties_address_line1
        CHECK (LENGTH(TRIM(address_line1)) > 0),

    CONSTRAINT ck_properties_city
        CHECK (LENGTH(TRIM(city)) > 0),

    CONSTRAINT ck_properties_country_code
        CHECK (country_code ~ '^[A-Z]{2}$')
);

-- Optimize tenant-scoped property queries.
CREATE INDEX idx_properties_organization_id
    ON properties (organization_id);
