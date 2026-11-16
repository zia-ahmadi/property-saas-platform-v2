
package com.propertysaas.propertycore.organization.service;

import com.propertysaas.propertycore.organization.dto.OrganizationResponse;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;

import java.util.Locale;
import java.util.UUID;

@Service
public class OrganizationService {

    private final OrganizationRepository organizationRepository;
    private final CurrentUserAuthorizationService authorizationService;
    private final AuthenticatedOrganizationContextResolver contextResolver;


    public OrganizationService(
        OrganizationRepository organizationRepository,
        CurrentUserAuthorizationService authorizationService,
        AuthenticatedOrganizationContextResolver contextResolver
) {
    this.organizationRepository = organizationRepository;
    this.authorizationService = authorizationService;
    this.contextResolver = contextResolver;
}

    @Transactional(readOnly = true)
    public OrganizationResponse getOrganization(UUID organizationId) {
        contextResolver.resolve(organizationId);
        // Check permission before retrieving organization details.
        authorizationService.requirePermission(
                organizationId,
                OrganizationPermission.ORGANIZATION_VIEW
        );

        // Retrieve the organization.
        Organization organization = organizationRepository
                .findById(organizationId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Organization not found"
                ));

        // Convert the entity to an API response.
        return new OrganizationResponse(
                organization.getId(),
                organization.getName(),
                organization.getSlug(),
                organization.getStatus()
                        .name()
                        .toLowerCase(Locale.ROOT)
        );
    }
}
