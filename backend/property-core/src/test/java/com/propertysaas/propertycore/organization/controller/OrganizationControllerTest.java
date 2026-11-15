
package com.propertysaas.propertycore.organization.controller;

import com.propertysaas.propertycore.organization.dto.OrganizationResponse;
import com.propertysaas.propertycore.organization.service.OrganizationService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizationControllerTest {

    @Mock
    private OrganizationService organizationService;

    private OrganizationController organizationController;

    private UUID organizationId;

    @BeforeEach
    void setUp() {
        organizationController =
                new OrganizationController(organizationService);

        organizationId = UUID.randomUUID();
    }

    @Test
    void getOrganizationShouldReturn200AndOrganizationDetails() {

        OrganizationResponse expectedResponse =
                new OrganizationResponse(
                        organizationId,
                        "Example Property Company",
                        "example-property-company",
                        "active"
                );

        when(organizationService.getOrganization(organizationId))
                .thenReturn(expectedResponse);

        ResponseEntity<OrganizationResponse> response =
                organizationController.getOrganization(organizationId);

        assertEquals(HttpStatus.OK, response.getStatusCode());

        assertNotNull(response.getBody());
        assertEquals(expectedResponse, response.getBody());

        verify(organizationService).getOrganization(organizationId);
        verifyNoMoreInteractions(organizationService);
    }
}
