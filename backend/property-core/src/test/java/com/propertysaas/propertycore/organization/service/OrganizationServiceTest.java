
package com.propertysaas.propertycore.organization.service;

import com.propertysaas.propertycore.organization.dto.OrganizationResponse;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizationServiceTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private CurrentUserAuthorizationService authorizationService;

    private OrganizationService organizationService;

    private UUID organizationId;

    @BeforeEach
    void setUp() {
        organizationService = new OrganizationService(
                organizationRepository,
                authorizationService
        );

        organizationId = UUID.randomUUID();
    }

    @Test
    void authorizedUserShouldRetrieveOrganization() {

        Organization organization = new Organization(
                "Example Property Company",
                "example-property-company"
        );

        when(organizationRepository.findById(organizationId))
                .thenReturn(Optional.of(organization));

        OrganizationResponse response =
                organizationService.getOrganization(organizationId);

        assertEquals(
                "Example Property Company",
                response.name()
        );

        assertEquals(
                "example-property-company",
                response.slug()
        );

        assertEquals("active", response.status());

        verify(authorizationService).requirePermission(
                organizationId,
                OrganizationPermission.ORGANIZATION_VIEW
        );

        verify(organizationRepository).findById(organizationId);
    }

    @Test
    void unauthorizedUserShouldNotRetrieveOrganization() {

        doThrow(new AccessDeniedException("Access denied"))
                .when(authorizationService)
                .requirePermission(
                        organizationId,
                        OrganizationPermission.ORGANIZATION_VIEW
                );

        assertThrows(
                AccessDeniedException.class,
                () -> organizationService.getOrganization(organizationId)
        );

        verifyNoInteractions(organizationRepository);
    }

    @Test
    void missingOrganizationShouldThrowNotFound() {

        when(organizationRepository.findById(organizationId))
                .thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> organizationService.getOrganization(organizationId)
        );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );
    }
}
