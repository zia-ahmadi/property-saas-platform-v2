
package com.propertysaas.propertycore.unit.service;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;

import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyStatus;
import com.propertysaas.propertycore.property.repository.PropertyRepository;

import com.propertysaas.propertycore.unit.dto.CreateUnitRequest;
import com.propertysaas.propertycore.unit.dto.UnitResponse;
import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.repository.UnitRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;


import java.util.UUID;

@Service
public class UnitService {

    private final UnitRepository unitRepository;
    private final PropertyRepository propertyRepository;
    private final AuthenticatedOrganizationContextResolver contextResolver;
    private final CurrentUserAuthorizationService authorizationService;

    public UnitService(
            UnitRepository unitRepository,
            PropertyRepository propertyRepository,
            AuthenticatedOrganizationContextResolver contextResolver,
            CurrentUserAuthorizationService authorizationService
    ) {
        this.unitRepository = unitRepository;
        this.propertyRepository = propertyRepository;
        this.contextResolver = contextResolver;
        this.authorizationService = authorizationService;
    }

    // ---------------------------------------------------------
    // Create Unit
    // ---------------------------------------------------------

    @Transactional
    public UnitResponse createUnit(
            UUID organizationId,
            UUID propertyId,
            CreateUnitRequest request
    ) {
        // Validate authenticated organization membership.
        contextResolver.resolve(organizationId);

        // Require property management permission.
        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        // Retrieve the property within the authenticated tenant.
        Property property = propertyRepository
                .findByIdAndOrganizationId(
                        propertyId,
                        organizationId
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"
                ));

        // Archived properties cannot receive new units.
        if (property.getStatus() == PropertyStatus.ARCHIVED) {
            throw new ConflictException(
                    "Cannot create units under an archived property"
            );
        }

        // Normalize the unit number.
        String unitNumber = request.unitNumber().trim();

        // Reject duplicates within the same property.
        if (unitRepository.existsByProperty_IdAndUnitNumber(
                propertyId,
                unitNumber
        )) {
            throw new ConflictException(
                    "A unit with this number already exists in the property"
            );
        }

        Unit unit = new Unit(
                property,
                unitNumber,
                request.unitType(),
                request.floorNumber(),
                request.areaSqm()
        );

        Unit savedUnit = unitRepository.saveAndFlush(unit);

        return toUnitResponse(savedUnit);
    }


    // ---------------------------------------------------------
    // List Units with Pagination
    // ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<UnitResponse> listUnits(
            UUID organizationId,
            UUID propertyId,
            int page,
            int size
    ) {
        // 1. Verify authenticated organization membership.
        contextResolver.resolve(organizationId);

        // 2. Validate pagination parameters.
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "Page must be >= 0 and size must be between 1 and 100"
            );
        }

        // 3. Verify that the property belongs to this organization.
        if (!propertyRepository.existsByIdAndOrganizationId(
                propertyId,
                organizationId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Property not found"
            );
        }

        // 4. Apply deterministic sorting.
        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.desc("createdAt"),
                        Sort.Order.desc("id")
                )
        );

        // 5. Query units within the property and organization.
        Page<Unit> units =
                unitRepository.findAllByProperty_IdAndProperty_Organization_Id(
                        propertyId,
                        organizationId,
                        pageable
                );

        // 6. Convert entities to response DTOs.
        return units.map(this::toUnitResponse);
    }


    // ---------------------------------------------------------
    // Shared Response Mapper
    // ---------------------------------------------------------

    private UnitResponse toUnitResponse(Unit unit) {
        return new UnitResponse(
                unit.getId(),
                unit.getProperty().getId(),
                unit.getUnitNumber(),
                unit.getUnitType(),
                unit.getFloorNumber(),
                unit.getAreaSqm(),
                unit.getAvailabilityStatus(),
                unit.getCreatedAt(),
                unit.getUpdatedAt()
        );
    }
}
