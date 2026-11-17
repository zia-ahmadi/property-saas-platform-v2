
-- V4: Create units table
-- Each unit belongs to exactly one property.
-- Tenant ownership is inherited through the property.

CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    property_id UUID NOT NULL,

    unit_number VARCHAR(50) NOT NULL,
    unit_type VARCHAR(30) NOT NULL,

    floor_number INTEGER,
    area_sqm NUMERIC(12, 2),

    availability_status VARCHAR(20)
        NOT NULL DEFAULT 'available',

    created_at TIMESTAMPTZ
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_units_property
        FOREIGN KEY (property_id)
        REFERENCES properties (id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_units_property_number
        UNIQUE (property_id, unit_number),

    CONSTRAINT ck_units_number
        CHECK (LENGTH(TRIM(unit_number)) > 0),

    CONSTRAINT ck_units_type
        CHECK (
            unit_type IN (
                'apartment',
                'office',
                'shop',
                'other'
            )
        ),

    CONSTRAINT ck_units_area
        CHECK (
            area_sqm IS NULL OR area_sqm > 0
        ),

    CONSTRAINT ck_units_availability
        CHECK (
            availability_status IN (
                'available',
                'occupied',
                'unavailable'
            )
        )
);

-- Optimize property-scoped unit queries.
CREATE INDEX idx_units_property_id
    ON units (property_id);

-- Optimize filtering units by availability.
CREATE INDEX idx_units_property_availability
    ON units (property_id, availability_status);
