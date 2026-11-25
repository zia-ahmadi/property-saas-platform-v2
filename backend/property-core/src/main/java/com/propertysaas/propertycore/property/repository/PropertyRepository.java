
package com.propertysaas.propertycore.property.repository;

import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyStatus;
import com.propertysaas.propertycore.property.entity.PropertyType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    @Query("""
            SELECT p FROM Property p
            WHERE p.organization.id = :organizationId
              AND (:status IS NULL OR p.status = :status)
              AND (:type IS NULL OR p.propertyType = :type)
              AND (:search = '' OR locate(lower(:search), lower(concat(p.name, ' ', p.addressLine1, ' ',
                    coalesce(p.addressLine2, ''), ' ', p.city, ' ', p.countryCode))) > 0)
            """)
    Page<Property> search(@Param("organizationId") UUID organizationId, @Param("search") String search,
                          @Param("status") PropertyStatus status, @Param("type") PropertyType type, Pageable pageable);
}
