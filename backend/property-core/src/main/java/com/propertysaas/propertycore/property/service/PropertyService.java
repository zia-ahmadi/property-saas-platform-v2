
package com.propertysaas.propertycore.property.service;

import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;

import com.propertysaas.propertycore.property.dto.CreatePropertyRequest;
import com.propertysaas.propertycore.property.dto.PropertyResponse;
import com.propertysaas.propertycore.property.dto.UpdatePropertyRequest;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyStatus;
import com.propertysaas.propertycore.property.entity.PropertyType;
import com.propertysaas.propertycore.property.repository.PropertyRepository;
import com.propertysaas.propertycore.property.validation.UpdatePropertyRequestValidator;

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
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final OrganizationRepository organizationRepository;
    private final AuthenticatedOrganizationContextResolver contextResolver;
    private final CurrentUserAuthorizationService authorizationService;
    private final UpdatePropertyRequestValidator updatePropertyRequestValidator;

    public PropertyService(
            PropertyRepository propertyRepository,
            OrganizationRepository organizationRepository,
            AuthenticatedOrganizationContextResolver contextResolver,
            CurrentUserAuthorizationService authorizationService,
            UpdatePropertyRequestValidator updatePropertyRequestValidator
    ) {
        this.propertyRepository = propertyRepository;
        this.organizationRepository = organizationRepository;
        this.contextResolver = contextResolver;
        this.authorizationService = authorizationService;
        this.updatePropertyRequestValidator = updatePropertyRequestValidator;
    }

    // ---------------------------------------------------------
    // Create Property
    // ---------------------------------------------------------

    @Transactional
    public PropertyResponse createProperty(
            UUID organizationId,
            CreatePropertyRequest request
    ) {
        contextResolver.resolve(organizationId);

        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        Organization organization = organizationRepository
                .findById(organizationId)
                .orElseThrow(() -> new IllegalStateException(
                        "Authorized organization could not be found"
                ));

        Property property = new Property(
                organization,
                request.name(),
                request.propertyType(),
                request.addressLine1(),
                request.addressLine2(),
                request.city(),
                request.countryCode()
        );

        Property savedProperty = propertyRepository.save(property);

        return toPropertyResponse(savedProperty);
    }

    // ---------------------------------------------------------
    // List Properties with Pagination
    // ---------------------------------------------------------

    @Transactional(readOnly = true)
    public Page<PropertyResponse> listProperties(
            UUID organizationId,
            int page,
            int size
    ) {
        return listProperties(organizationId, page, size, "", null, null);
    }

    @Transactional(readOnly = true)
    public Page<PropertyResponse> listProperties(UUID organizationId, int page, int size, String search,
                                                 PropertyStatus status, PropertyType type) {
        contextResolver.resolve(organizationId);
        if (search.length() > 150 || search.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Use valid search text up to 150 characters.");
        }
        String term = search.strip();

        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "Page must be >= 0 and size must be between 1 and 100"
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

        Page<Property> properties = term.isEmpty() && status == null && type == null
                ? propertyRepository.findAllByOrganizationId(organizationId, pageable)
                : propertyRepository.search(organizationId, term, status, type, pageable);

        return properties.map(this::toPropertyResponse);
    }

    // ---------------------------------------------------------
    // Retrieve Property Details
    // ---------------------------------------------------------

    @Transactional(readOnly = true)
    public PropertyResponse getProperty(
            UUID organizationId,
            UUID propertyId
    ) {
        contextResolver.resolve(organizationId);

        Property property = propertyRepository
                .findByIdAndOrganizationId(propertyId, organizationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"
                ));

        return toPropertyResponse(property);
    }

    // ---------------------------------------------------------
    // Update Property
    // ---------------------------------------------------------

    @Transactional
    public PropertyResponse updateProperty(
            UUID organizationId,
            UUID propertyId,
            UpdatePropertyRequest request
    ) {
        contextResolver.resolve(organizationId);

        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        updatePropertyRequestValidator.validate(request);

        Property property = propertyRepository
                .findByIdAndOrganizationId(propertyId, organizationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"
                ));

        property.applyUpdates(request.changes());

        propertyRepository.flush();

        return toPropertyResponse(property);
    }

    // ---------------------------------------------------------
    // Archive Property
    // ---------------------------------------------------------

    @Transactional
    public PropertyResponse archiveProperty(
            UUID organizationId,
            UUID propertyId
    ) {
        // Validate authenticated organization membership.
        contextResolver.resolve(organizationId);

        // Only users with PROPERTY_MANAGE permission may archive.
        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        // Prevent access to properties belonging to other tenants.
        Property property = propertyRepository
                .findByIdAndOrganizationId(propertyId, organizationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"
                ));

        // ACTIVE -> ARCHIVED.
        // Repeated requests remain successful.
        property.archive();

        // Synchronize the status change with PostgreSQL.
        propertyRepository.flush();

        return toPropertyResponse(property);
    }

    // ---------------------------------------------------------
    // Shared Response Mapper
    // ---------------------------------------------------------

    private PropertyResponse toPropertyResponse(Property property) {
        return new PropertyResponse(
                property.getId(),
                property.getOrganization().getId(),
                property.getName(),
                property.getPropertyType(),
                property.getAddressLine1(),
                property.getAddressLine2(),
                property.getCity(),
                property.getCountryCode(),
                property.getStatus(),
                property.getCreatedAt(),
                property.getUpdatedAt()
        );
    }
}
