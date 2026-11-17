
package com.propertysaas.propertycore.unit.service;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyType;
import com.propertysaas.propertycore.property.repository.PropertyRepository;
import com.propertysaas.propertycore.unit.dto.CreateUnitRequest;
import com.propertysaas.propertycore.unit.dto.UnitResponse;
import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.entity.UnitAvailabilityStatus;
import com.propertysaas.propertycore.unit.entity.UnitType;
import com.propertysaas.propertycore.unit.repository.UnitRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;

import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;


import com.propertysaas.propertycore.common.response.PageResponse;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;


import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UnitServiceTest {

    @Mock
    private UnitRepository unitRepository;

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private AuthenticatedOrganizationContextResolver contextResolver;

    @Mock
    private CurrentUserAuthorizationService authorizationService;

    @InjectMocks
    private UnitService unitService;

    private UUID organizationId;
    private UUID propertyId;
    private Property property;
    private CreateUnitRequest request;

    @BeforeEach
    void setUp() {
        organizationId = UUID.randomUUID();
        propertyId = UUID.randomUUID();

        Organization organization = new Organization(
                "Test Organization",
                "unit-test-organization"
        );

        ReflectionTestUtils.setField(
                organization,
                "id",
                organizationId
        );

        property = new Property(
                organization,
                "Test Property",
                PropertyType.APARTMENT,
                "Street 1",
                null,
                "Kabul",
                "AF"
        );

        ReflectionTestUtils.setField(
                property,
                "id",
                propertyId
        );

        request = new CreateUnitRequest(
                "A-101",
                UnitType.APARTMENT,
                1,
                new BigDecimal("85.50")
        );
    }

    @Test
    void createUnit_shouldSaveAvailableUnit() {
        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        when(unitRepository.saveAndFlush(any(Unit.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UnitResponse response = unitService.createUnit(
                organizationId, propertyId, request
        );

        verify(contextResolver).resolve(organizationId);

        verify(authorizationService).requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        verify(unitRepository).saveAndFlush(argThat(unit ->
                unit.getProperty() == property
                        && unit.getUnitNumber().equals("A-101")
                        && unit.getUnitType() == UnitType.APARTMENT
                        && unit.getAvailabilityStatus()
                            == UnitAvailabilityStatus.AVAILABLE
        ));

        assertEquals(propertyId, response.propertyId());
        assertEquals("A-101", response.unitNumber());
        assertEquals(UnitType.APARTMENT, response.unitType());
        assertEquals(
                UnitAvailabilityStatus.AVAILABLE,
                response.availabilityStatus()
        );
        assertEquals(new BigDecimal("85.50"), response.areaSqm());
    }

    @Test
    void createUnit_shouldTrimUnitNumber() {
        CreateUnitRequest paddedRequest = new CreateUnitRequest(
                "  A-101  ",
                UnitType.APARTMENT,
                1,
                new BigDecimal("85.50")
        );

        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        when(unitRepository.saveAndFlush(any(Unit.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UnitResponse response = unitService.createUnit(
                organizationId, propertyId, paddedRequest
        );

        assertEquals("A-101", response.unitNumber());

        verify(unitRepository).existsByProperty_IdAndUnitNumber(
                propertyId, "A-101"
        );
    }

    @Test
    void createUnit_shouldRejectDuplicateUnitNumber() {
        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        when(unitRepository.existsByProperty_IdAndUnitNumber(
                propertyId, "A-101"
        )).thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> unitService.createUnit(
                        organizationId, propertyId, request
                )
        );

        verify(unitRepository, never()).saveAndFlush(any(Unit.class));
    }

    @Test
    void createUnit_shouldRejectArchivedProperty() {
        property.archive();

        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        assertThrows(
                ConflictException.class,
                () -> unitService.createUnit(
                        organizationId, propertyId, request
                )
        );

        verifyNoInteractions(unitRepository);
    }

    @Test
    void createUnit_shouldRejectPropertyFromAnotherOrganization() {
        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> unitService.createUnit(
                        organizationId, propertyId, request
                )
        );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );

        verifyNoInteractions(unitRepository);
    }

    @Test
    void createUnit_shouldRejectUserWithoutManagePermission() {
        doThrow(new AccessDeniedException(
                "Insufficient permissions"
        )).when(authorizationService).requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );

        assertThrows(
                AccessDeniedException.class,
                () -> unitService.createUnit(
                        organizationId, propertyId, request
                )
        );

        verify(contextResolver).resolve(organizationId);
        verifyNoInteractions(propertyRepository);
        verifyNoInteractions(unitRepository);
    }

    @Test
    void createUnit_shouldRejectUnauthorizedOrganizationContext() {
        doThrow(new AccessDeniedException(
                "Access to this organization is denied"
        )).when(contextResolver).resolve(organizationId);

        assertThrows(
                AccessDeniedException.class,
                () -> unitService.createUnit(
                        organizationId, propertyId, request
                )
        );

        verifyNoInteractions(authorizationService);
        verifyNoInteractions(propertyRepository);
        verifyNoInteractions(unitRepository);
    }

    // ---------------------------------------------------------
    // List Units: Successful retrieval
    // ---------------------------------------------------------

    @Test
    void listUnits_shouldReturnUnitsFromRequestedProperty() {
        Unit unit = new Unit(
                property,
                "A-101",
                UnitType.APARTMENT,
                1,
                new BigDecimal("85.50")
        );

        when(propertyRepository.existsByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(true);

        when(unitRepository.findAllByProperty_IdAndProperty_Organization_Id(
                eq(propertyId),
                eq(organizationId),
                any(Pageable.class)
        )).thenReturn(new PageImpl<>(List.of(unit)));

        Page<UnitResponse> result = unitService.listUnits(
                organizationId, propertyId, 0, 10
        );

        assertEquals(1, result.getTotalElements());
        assertEquals("A-101", result.getContent().get(0).unitNumber());
        assertEquals(propertyId, result.getContent().get(0).propertyId());

        verify(contextResolver).resolve(organizationId);
    }

    // ---------------------------------------------------------
    // List Units: Empty property
    // ---------------------------------------------------------

    @Test
    void listUnits_shouldReturnEmptyPageWhenPropertyHasNoUnits() {
        when(propertyRepository.existsByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(true);

        when(unitRepository.findAllByProperty_IdAndProperty_Organization_Id(
                eq(propertyId),
                eq(organizationId),
                any(Pageable.class)
        )).thenReturn(Page.empty());

        Page<UnitResponse> result = unitService.listUnits(
                organizationId, propertyId, 0, 10
        );

        assertTrue(result.isEmpty());
        assertEquals(0, result.getTotalElements());
    }

    // ---------------------------------------------------------
    // List Units: Property does not belong to organization
    // ---------------------------------------------------------

    @Test
    void listUnits_shouldRejectPropertyOutsideOrganization() {
        when(propertyRepository.existsByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(false);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> unitService.listUnits(
                        organizationId, propertyId, 0, 10
                )
        );

        assertEquals(404, exception.getStatusCode().value());

        verify(unitRepository, never())
                .findAllByProperty_IdAndProperty_Organization_Id(
                        any(), any(), any(Pageable.class)
                );
    }

    // ---------------------------------------------------------
    // List Units: Invalid pagination
    // ---------------------------------------------------------

    @Test
    void listUnits_shouldRejectInvalidPagination() {
        assertThrows(
                IllegalArgumentException.class,
                () -> unitService.listUnits(
                        organizationId, propertyId, -1, 10
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> unitService.listUnits(
                        organizationId, propertyId, 0, 0
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> unitService.listUnits(
                        organizationId, propertyId, 0, 101
                )
        );

        verify(unitRepository, never())
                .findAllByProperty_IdAndProperty_Organization_Id(
                        any(), any(), any(Pageable.class)
                );
    }

    // ---------------------------------------------------------
    // List Units: Unauthorized organization
    // ---------------------------------------------------------

    @Test
    void listUnits_shouldRejectUnauthorizedOrganization() {
        doThrow(new AccessDeniedException("Access denied"))
                .when(contextResolver)
                .resolve(organizationId);

        assertThrows(
                AccessDeniedException.class,
                () -> unitService.listUnits(
                        organizationId, propertyId, 0, 10
                )
        );

        verifyNoInteractions(propertyRepository, unitRepository);
    }

    // ---------------------------------------------------------
    // List Units with Pagination
    // ---------------------------------------------------------

    @GetMapping
    public ResponseEntity<PageResponse<UnitResponse>> listUnits(
            @PathVariable UUID organizationId,
            @PathVariable UUID propertyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        // Validate pagination parameters.
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Page must be >= 0 and size must be between 1 and 100"
            );
        }

        // Retrieve tenant-scoped, property-scoped units.
        Page<UnitResponse> units = unitService.listUnits(
                organizationId,
                propertyId,
                page,
                size
        );

        // Return the project's standard pagination response.
        return ResponseEntity.ok(PageResponse.from(units));
    }

    
    // ---------------------------------------------------------
    // Retrieve Unit Details: Successful retrieval
    // ---------------------------------------------------------

    @Test
    void getUnitDetails_shouldReturnRequestedUnit() {
        UUID unitId = UUID.randomUUID();

        Unit unit = new Unit(
                property,
                "A-101",
                UnitType.APARTMENT,
                1,
                new BigDecimal("85.50")
        );

        ReflectionTestUtils.setField(unit, "id", unitId);

        when(propertyRepository.existsByIdAndOrganizationId(
                propertyId,
                organizationId
        )).thenReturn(true);

        when(unitRepository.findByIdAndProperty_IdAndProperty_Organization_Id(
                unitId,
                propertyId,
                organizationId
        )).thenReturn(Optional.of(unit));

        UnitResponse response = unitService.getUnitDetails(
                organizationId,
                propertyId,
                unitId
        );

        assertEquals(unitId, response.id());
        assertEquals(propertyId, response.propertyId());
        assertEquals("A-101", response.unitNumber());
        assertEquals(UnitType.APARTMENT, response.unitType());
        assertEquals(1, response.floorNumber());
        assertEquals(
                new BigDecimal("85.50"),
                response.areaSqm()
        );
        assertEquals(
                UnitAvailabilityStatus.AVAILABLE,
                response.availabilityStatus()
        );

        verify(contextResolver).resolve(organizationId);

        verify(unitRepository)
                .findByIdAndProperty_IdAndProperty_Organization_Id(
                        unitId,
                        propertyId,
                        organizationId
                );

        verifyNoInteractions(authorizationService);
    }

    // ---------------------------------------------------------
    // Retrieve Unit Details: Unit not found
    // ---------------------------------------------------------

    @Test
    void getUnitDetails_shouldReturn404WhenUnitDoesNotExist() {
        UUID unitId = UUID.randomUUID();

        when(propertyRepository.existsByIdAndOrganizationId(
                propertyId,
                organizationId
        )).thenReturn(true);

        when(unitRepository.findByIdAndProperty_IdAndProperty_Organization_Id(
                unitId,
                propertyId,
                organizationId
        )).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> unitService.getUnitDetails(
                        organizationId,
                        propertyId,
                        unitId
                )
        );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );

        verify(contextResolver).resolve(organizationId);

        verify(unitRepository)
                .findByIdAndProperty_IdAndProperty_Organization_Id(
                        unitId,
                        propertyId,
                        organizationId
                );

        verifyNoInteractions(authorizationService);
    }

    // ---------------------------------------------------------
    // Retrieve Unit Details: Property outside organization
    // ---------------------------------------------------------

    @Test
    void getUnitDetails_shouldReturn404WhenPropertyOutsideOrganization() {
        UUID unitId = UUID.randomUUID();

        // The property does not belong to the requested organization.
        when(propertyRepository.existsByIdAndOrganizationId(
                propertyId,
                organizationId
        )).thenReturn(false);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> unitService.getUnitDetails(
                        organizationId,
                        propertyId,
                        unitId
                )
        );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );

        // Organization membership must be checked first.
        verify(contextResolver).resolve(organizationId);

        // Property ownership must be verified.
        verify(propertyRepository).existsByIdAndOrganizationId(
                propertyId,
                organizationId
        );

        // The unit repository must never be queried.
        verifyNoInteractions(unitRepository);

        // Read operations must not require management permission.
        verifyNoInteractions(authorizationService);
    }


    // ---------------------------------------------------------
    // Retrieve Unit Details: Unauthorized organization
    // ---------------------------------------------------------

    @Test
    void getUnitDetails_shouldRejectUnauthorizedOrganization() {
        UUID unitId = UUID.randomUUID();

        // Simulate a user without membership in the organization.
        doThrow(new AccessDeniedException(
                "Access to this organization is denied"
        )).when(contextResolver).resolve(organizationId);

        // The service must reject the request.
        assertThrows(
                AccessDeniedException.class,
                () -> unitService.getUnitDetails(
                        organizationId,
                        propertyId,
                        unitId
                )
        );

        // Organization access must be checked.
        verify(contextResolver).resolve(organizationId);

        // No database lookup should happen after access is denied.
        verifyNoInteractions(propertyRepository, unitRepository);

        // Read-only operations do not require management permission.
        verifyNoInteractions(authorizationService);
    }

}
