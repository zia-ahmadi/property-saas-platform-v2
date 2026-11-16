
package com.propertysaas.propertycore.property.repository;

import com.propertysaas.propertycore.property.entity.Property;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PropertyRepository
        extends JpaRepository<Property, UUID> {

    // Find a property only within its organization.
    Optional<Property> findByIdAndOrganizationId(
            UUID propertyId,
            UUID organizationId
    );

    // Check property existence within its organization.
    boolean existsByIdAndOrganizationId(
            UUID propertyId,
            UUID organizationId
    );

    // List properties belonging to a specific organization.
    Page<Property> findAllByOrganizationId(
            UUID organizationId,
            Pageable pageable
    );
}
