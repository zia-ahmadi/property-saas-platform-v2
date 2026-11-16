
package com.propertysaas.propertycore.property.service;

import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;

import com.propertysaas.propertycore.property.dto.CreatePropertyRequest;
import com.propertysaas.propertycore.property.dto.PropertyResponse;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.repository.PropertyRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final OrganizationRepository organizationRepository;
    private final AuthenticatedOrganizationContextResolver contextResolver;
    private final CurrentUserAuthorizationService authorizationService;

    public PropertyService(
            PropertyRepository propertyRepository,
            OrganizationRepository organizationRepository,
            AuthenticatedOrganizationContextResolver contextResolver,
            CurrentUserAuthorizationService authorizationService
    ) {
        this.propertyRepository = propertyRepository;
        this.organizationRepository = organizationRepository;
        this.contextResolver = contextResolver;
        this.authorizationService = authorizationService;
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
        // Verify authenticated organization membership.
        contextResolver.resolve(organizationId);

        // Prevent invalid or excessively large page requests.
        if (page < 0 || size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "Page must be >= 0 and size must be between 1 and 100"
            );
        }

        // Stable ordering prevents inconsistent page results
        // when multiple properties share the same creation time.
        Pageable pageable = PageRequest.of(
                page,
                size,
                Sort.by(
                        Sort.Order.desc("createdAt"),
                        Sort.Order.desc("id")
                )
        );

        // Filter by tenant directly in the database.
        Page<Property> properties =
                propertyRepository.findAllByOrganizationId(
                        organizationId,
                        pageable
                );

        return properties.map(this::toPropertyResponse);
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
