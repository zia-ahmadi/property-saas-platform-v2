
package com.propertysaas.propertycore.organization.permission.service;

import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CurrentUserAuthorizationServiceTest {

    @Mock
    private AuthenticatedUserService authenticatedUserService;

    @Mock
    private OrganizationAuthorizationService authorizationService;

    @InjectMocks
    private CurrentUserAuthorizationService currentUserAuthorizationService;

    private UUID userId;
    private UUID organizationId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        organizationId = UUID.randomUUID();
    }

    @Test
    void hasPermissionShouldReturnTrueWhenAuthorized() {

        when(authenticatedUserService.getCurrentUserId())
                .thenReturn(userId);

        when(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.PROPERTY_VIEW
        )).thenReturn(true);

        boolean result = currentUserAuthorizationService.hasPermission(
                organizationId,
                OrganizationPermission.PROPERTY_VIEW
        );

        assertTrue(result);

        verify(authorizationService).hasPermission(
                userId,
                organizationId,
                OrganizationPermission.PROPERTY_VIEW
        );
    }

    @Test
    void hasPermissionShouldReturnFalseWhenUnauthorized() {

        when(authenticatedUserService.getCurrentUserId())
                .thenReturn(userId);

        when(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.BILLING_MANAGE
        )).thenReturn(false);

        assertFalse(currentUserAuthorizationService.hasPermission(
                organizationId,
                OrganizationPermission.BILLING_MANAGE
        ));
    }

    @Test
    void requirePermissionShouldDelegateToAuthorizationService() {

        when(authenticatedUserService.getCurrentUserId())
                .thenReturn(userId);

        currentUserAuthorizationService.requirePermission(
                organizationId,
                OrganizationPermission.MEMBERSHIP_MANAGE
        );

        verify(authorizationService).requirePermission(
                userId,
                organizationId,
                OrganizationPermission.MEMBERSHIP_MANAGE
        );
    }

    @Test
    void requirePermissionShouldPropagateAccessDenied() {

        when(authenticatedUserService.getCurrentUserId())
                .thenReturn(userId);

        doThrow(new AccessDeniedException("Access denied"))
                .when(authorizationService)
                .requirePermission(
                        userId,
                        organizationId,
                        OrganizationPermission.BILLING_MANAGE
                );

        assertThrows(
                AccessDeniedException.class,
                () -> currentUserAuthorizationService.requirePermission(
                        organizationId,
                        OrganizationPermission.BILLING_MANAGE
                )
        );
    }

    @Test
    void missingAuthenticationShouldNotCheckPermissions() {

        when(authenticatedUserService.getCurrentUserId())
                .thenThrow(new AccessDeniedException(
                        "An authenticated user is required"
                ));

        assertThrows(
                AccessDeniedException.class,
                () -> currentUserAuthorizationService.requirePermission(
                        organizationId,
                        OrganizationPermission.PROPERTY_VIEW
                )
        );

        verifyNoInteractions(authorizationService);
    }
}
