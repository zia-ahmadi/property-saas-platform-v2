CREATE TABLE organization_images (
    organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    resource_type VARCHAR(16) NOT NULL,
    resource_id UUID NOT NULL,
    media_type VARCHAR(16) NOT NULL,
    image_data BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, resource_type, resource_id),
    CONSTRAINT ck_organization_images_resource_type
        CHECK (resource_type IN ('property', 'unit', 'renter')),
    CONSTRAINT ck_organization_images_media_type
        CHECK (media_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_organization_images_size
        CHECK (octet_length(image_data) <= 5242880)
);
