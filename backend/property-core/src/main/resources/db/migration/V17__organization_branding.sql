ALTER TABLE organization_images DROP CONSTRAINT ck_organization_images_resource_type;
ALTER TABLE organization_images ADD CONSTRAINT ck_organization_images_resource_type
    CHECK (resource_type IN ('property', 'unit', 'renter')
        OR (resource_type = 'organization' AND resource_id = organization_id));
