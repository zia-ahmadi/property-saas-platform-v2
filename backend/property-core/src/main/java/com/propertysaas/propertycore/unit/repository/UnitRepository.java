
package com.propertysaas.propertycore.unit.repository;

import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.entity.UnitAvailabilityStatus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UnitRepository
        extends JpaRepository<Unit, UUID> {

    // Retrieve a unit only within its property and organization.
    Optional<Unit> findByIdAndProperty_IdAndProperty_Organization_Id(
            UUID unitId,
            UUID propertyId,
            UUID organizationId
    );

    // List units belonging to a property within an organization.
    Page<Unit> findAllByProperty_IdAndProperty_Organization_Id(
            UUID propertyId,
            UUID organizationId,
            Pageable pageable
    );

    // Check whether a unit number already exists in a property.
    boolean existsByProperty_IdAndUnitNumber(
            UUID propertyId,
            String unitNumber
    );

    // Filter units by availability within a property and organization.
    Page<Unit>
    findAllByProperty_IdAndProperty_Organization_IdAndAvailabilityStatus(
            UUID propertyId,
            UUID organizationId,
            UnitAvailabilityStatus availabilityStatus,
            Pageable pageable
    );
}
