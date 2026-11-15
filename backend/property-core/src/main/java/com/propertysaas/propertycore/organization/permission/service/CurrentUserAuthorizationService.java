
package com.propertysaas.propertycore.organization.permission.service;

import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CurrentUserAuthorizationService {

    private final AuthenticatedUserService authenticatedUserService;
    private final OrganizationAuthorizationService authorizationService;

    public CurrentUserAuthorizationService(
            AuthenticatedUserService authenticatedUserService,
            OrganizationAuthorizationService authorizationService
    ) {
        this.authenticatedUserService = authenticatedUserService;
        this.authorizationService = authorizationService;
    }

    public boolean hasPermission(
            UUID organizationId,
            OrganizationPermission permission
    ) {
        UUID userId = authenticatedUserService.getCurrentUserId();

        return authorizationService.hasPermission(
                userId,
                organizationId,
                permission
        );
    }

    public void requirePermission(
            UUID organizationId,
            OrganizationPermission permission
    ) {
        UUID userId = authenticatedUserService.getCurrentUserId();

        authorizationService.requirePermission(
                userId,
                organizationId,
                permission
        );
    }
}
