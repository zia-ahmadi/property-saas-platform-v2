
package com.propertysaas.propertycore.unit.service;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;

import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyStatus;
import com.propertysaas.propertycore.property.repository.PropertyRepository;

import com.propertysaas.propertycore.unit.dto.CreateUnitRequest;
import com.propertysaas.propertycore.unit.dto.UpdateUnitRequest;
import com.propertysaas.propertycore.unit.dto.UnitResponse;
import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.repository.UnitRepository;
import com.propertysaas.propertycore.unit.validation.UpdateUnitRequestValidator;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;


import java.util.UUID;

@Service
public class UnitService {

    private final UnitRepository unitRepository;
    private final PropertyRepository propertyRepository;
    private final AuthenticatedOrganizationContextResolver contextResolver;
    private final CurrentUserAuthorizationService authorizationService;
    private final UpdateUnitRequestValidator updateUnitRequestValidator;

    public UnitService(
            UnitRepository unitRepository,
            PropertyRepository propertyRepository,
            AuthenticatedOrganizationContextResolver contextResolver,
            CurrentUserAuthorizationService authorizationService,
            UpdateUnitRequestValidator updateUnitRequestValidator
    ) {
        this.unitRepository = unitRepository;
        this.propertyRepository = propertyRepository;
        this.contextResolver = contextResolver;
        this.authorizationService = authorizationService;
        this.updateUnitRequestValidator = updateUnitRequestValidator;
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
        contextResolver.resolve(organizationId);

        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        Property property = propertyRepository
                .findByIdAndOrganizationId(
                        propertyId,
                        organizationId
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"
                ));

        if (property.getStatus() == PropertyStatus.ARCHIVED) {
            throw new ConflictException(
                    "Cannot create units under an archived property"
            );
        }

        String unitNumber = request.unitNumber().trim();

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
        contextResolver.resolve(organizationId);

        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "Page must be >= 0 and size must be between 1 and 100"
            );
        }

        if (!propertyRepository.existsByIdAndOrganizationId(
                propertyId,
                organizationId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Property not found"
            );
        }

        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.desc("createdAt"),
                        Sort.Order.desc("id")
                )
        );

        Page<Unit> units =
                unitRepository.findAllByProperty_IdAndProperty_Organization_Id(
                        propertyId,
                        organizationId,
                        pageable
                );

        return units.map(this::toUnitResponse);
    }

    // ---------------------------------------------------------
    // Retrieve Unit Details
    // ---------------------------------------------------------

    @Transactional(readOnly = true)
    public UnitResponse getUnitDetails(
            UUID organizationId,
            UUID propertyId,
            UUID unitId
    ) {
        contextResolver.resolve(organizationId);

        if (!propertyRepository.existsByIdAndOrganizationId(
                propertyId,
                organizationId
        )) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Property not found"
            );
        }

        Unit unit = unitRepository
                .findByIdAndProperty_IdAndProperty_Organization_Id(
                        unitId,
                        propertyId,
                        organizationId
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Unit not found"
                ));

        return toUnitResponse(unit);
    }

    // ---------------------------------------------------------
    // Update Unit
    // ---------------------------------------------------------

    @Transactional
    public UnitResponse updateUnit(
            UUID organizationId,
            UUID propertyId,
            UUID unitId,
            UpdateUnitRequest request
    ) {
        // 1. Verify authenticated organization membership.
        contextResolver.resolve(organizationId);

        // 2. Require permission to manage properties.
        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        // 3. Validate the partial-update payload.
        updateUnitRequestValidator.validate(request);

        // 4. Retrieve the property within the tenant.
        Property property = propertyRepository
                .findByIdAndOrganizationId(
                        propertyId,
                        organizationId
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"
                ));

        // 5. Reject modifications to archived properties.
        if (property.getStatus() == PropertyStatus.ARCHIVED) {
            throw new ConflictException(
                    "Cannot update units under an archived property"
            );
        }

        // 6. Retrieve the unit within the property and tenant.
        Unit unit = unitRepository
                .findByIdAndProperty_IdAndProperty_Organization_Id(
                        unitId,
                        propertyId,
                        organizationId
                )
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Unit not found"
                ));

        // 7. Check for duplicate unit numbers.
        var newUnitNumberNode =
                request.changes().get("unitNumber");

        if (newUnitNumberNode != null) {

            String newUnitNumber =
                    newUnitNumberNode.stringValue().trim();

            if (!newUnitNumber.equals(unit.getUnitNumber())
                    && unitRepository.existsByProperty_IdAndUnitNumber(
                            propertyId,
                            newUnitNumber
                    )) {
                throw new ConflictException(
                        "A unit with this number already exists in the property"
                );
            }
        }

        // 8. Apply validated changes.
        unit.applyUpdates(request.changes());

        // 9. Synchronize changes with PostgreSQL.
        unitRepository.flush();

        // 10. Return the updated unit.
        return toUnitResponse(unit);
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
