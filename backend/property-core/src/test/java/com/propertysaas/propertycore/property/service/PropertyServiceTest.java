
package com.propertysaas.propertycore.property.service;

import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;

import com.propertysaas.propertycore.property.dto.CreatePropertyRequest;
import com.propertysaas.propertycore.property.dto.PropertyResponse;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyStatus;
import com.propertysaas.propertycore.property.entity.PropertyType;
import com.propertysaas.propertycore.property.repository.PropertyRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.propertysaas.propertycore.property.validation.UpdatePropertyRequestValidator;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PropertyServiceTest {

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private OrganizationRepository organizationRepository;

    @Mock
    private AuthenticatedOrganizationContextResolver contextResolver;
    
@Mock
private CurrentUserAuthorizationService authorizationService;

@Mock
private UpdatePropertyRequestValidator updatePropertyRequestValidator;

@InjectMocks
private PropertyService propertyService;

    private UUID organizationId;
    private Organization organization;

    
@BeforeEach
void setUp() {
    organizationId = UUID.randomUUID();

    organization = new Organization(
            "Test Property Organization",
            "test-property-organization"
    );

    // Simulate the database-generated organization ID.
    org.springframework.test.util.ReflectionTestUtils.setField(
            organization,
            "id",
            organizationId
    );
}


    @Test
    void createProperty_shouldSavePropertyForAuthorizedOrganization() {

        CreatePropertyRequest request = new CreatePropertyRequest(
                "Kabul Residential Complex",
                PropertyType.APARTMENT,
                "Street 3, Karte Seh",
                null,
                "Kabul",
                "AF"
        );

        when(organizationRepository.findById(organizationId))
                .thenReturn(Optional.of(organization));

        when(propertyRepository.save(any(Property.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PropertyResponse response = propertyService.createProperty(
                organizationId,
                request
        );

        verify(contextResolver).resolve(organizationId);

        verify(authorizationService).requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        verify(organizationRepository).findById(organizationId);

        verify(propertyRepository).save(argThat(property ->
                property.getOrganization() == organization
                        && property.getName().equals(request.name())
                        && property.getPropertyType() == request.propertyType()
                        && property.getStatus() == PropertyStatus.ACTIVE
        ));

        assertNotNull(response);
        assertEquals(organizationId, response.organizationId());
        assertEquals(request.name(), response.name());
        assertEquals(PropertyType.APARTMENT, response.propertyType());
        assertEquals(PropertyStatus.ACTIVE, response.status());
    }


@Test
void createProperty_shouldRejectUserWithoutManagePermission() {

    CreatePropertyRequest request = new CreatePropertyRequest(
            "Unauthorized Property",
            PropertyType.APARTMENT,
            "Street 3, Karte Seh",
            null,
            "Kabul",
            "AF"
    );

    doThrow(new org.springframework.security.access.AccessDeniedException(
            "Insufficient permissions"
    )).when(authorizationService).requirePermission(
            organizationId,
            OrganizationPermission.PROPERTY_MANAGE
    );

    assertThrows(
            org.springframework.security.access.AccessDeniedException.class,
            () -> propertyService.createProperty(organizationId, request)
    );

    verify(contextResolver).resolve(organizationId);

    verify(authorizationService).requirePermission(
            organizationId,
            OrganizationPermission.PROPERTY_MANAGE
    );

    verifyNoInteractions(organizationRepository);
    verifyNoInteractions(propertyRepository);
}

@Test
void createProperty_shouldRejectCrossTenantAccess() {

    UUID unauthorizedOrganizationId = UUID.randomUUID();

    CreatePropertyRequest request = new CreatePropertyRequest(
            "Cross Tenant Property",
            PropertyType.COMMERCIAL,
            "Street 10",
            null,
            "Kabul",
            "AF"
    );

    doThrow(new org.springframework.security.access.AccessDeniedException(
            "Access to this organization is denied"
    )).when(contextResolver).resolve(
            unauthorizedOrganizationId
    );

    assertThrows(
            org.springframework.security.access.AccessDeniedException.class,
            () -> propertyService.createProperty(
                    unauthorizedOrganizationId,
                    request
            )
    );

    verify(contextResolver).resolve(
            unauthorizedOrganizationId
    );

    verifyNoInteractions(authorizationService);
    verifyNoInteractions(organizationRepository);
    verifyNoInteractions(propertyRepository);
}


}
