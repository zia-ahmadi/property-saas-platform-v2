
package com.propertysaas.propertycore.unit.service;

import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.organization.context.AuthenticatedOrganizationContextResolver;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.service.CurrentUserAuthorizationService;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyType;
import com.propertysaas.propertycore.property.repository.PropertyRepository;
import com.propertysaas.propertycore.unit.dto.UpdateUnitAvailabilityRequest;
import com.propertysaas.propertycore.unit.dto.UnitResponse;
import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.entity.UnitAvailabilityStatus;
import com.propertysaas.propertycore.unit.entity.UnitType;
import com.propertysaas.propertycore.unit.repository.UnitRepository;
import com.propertysaas.propertycore.unit.validation.UpdateUnitRequestValidator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UnitAvailabilityServiceTest {

    @Mock
    private UnitRepository unitRepository;

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private AuthenticatedOrganizationContextResolver contextResolver;

    @Mock
    private CurrentUserAuthorizationService authorizationService;

    @Mock
    private UpdateUnitRequestValidator updateUnitRequestValidator;

    @InjectMocks
    private UnitService unitService;

    private UUID organizationId;
    private UUID propertyId;
    private UUID unitId;
    private Property property;
    private Unit unit;

    @BeforeEach
    void setUp() {
        organizationId = UUID.randomUUID();
        propertyId = UUID.randomUUID();
        unitId = UUID.randomUUID();

        Organization organization = new Organization(
                "Test Organization",
                "availability-test"
        );

        ReflectionTestUtils.setField(
                organization, "id", organizationId
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
                property, "id", propertyId
        );

        unit = new Unit(
                property,
                "A-101",
                UnitType.APARTMENT,
                1,
                new BigDecimal("85.50")
        );

        ReflectionTestUtils.setField(unit, "id", unitId);
    }

    private void mockPropertyAndUnit() {
        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        when(unitRepository.findByIdAndProperty_IdAndProperty_Organization_Id(
                unitId, propertyId, organizationId
        )).thenReturn(Optional.of(unit));
    }

    private UnitResponse update(UnitAvailabilityStatus status) {
        return unitService.updateUnitAvailability(
                organizationId,
                propertyId,
                unitId,
                new UpdateUnitAvailabilityRequest(status)
        );
    }

    @Test
    void shouldChangeAvailableToUnavailable() {
        mockPropertyAndUnit();

        UnitResponse response = update(
                UnitAvailabilityStatus.UNAVAILABLE
        );

        assertEquals(
                UnitAvailabilityStatus.UNAVAILABLE,
                response.availabilityStatus()
        );

        verify(contextResolver).resolve(organizationId);
        verify(authorizationService).requirePermission(
                organizationId,
                OrganizationPermission.PROPERTY_MANAGE
        );
        verify(unitRepository).flush();
    }

    @Test
    void shouldChangeUnavailableToAvailable() {
        unit.changeAvailability(UnitAvailabilityStatus.UNAVAILABLE);
        mockPropertyAndUnit();

        UnitResponse response = update(
                UnitAvailabilityStatus.AVAILABLE
        );

        assertEquals(
                UnitAvailabilityStatus.AVAILABLE,
                response.availabilityStatus()
        );

        verify(unitRepository).flush();
    }

    @Test
    void shouldAllowIdempotentStatusUpdate() {
        mockPropertyAndUnit();

        UnitResponse response = update(
                UnitAvailabilityStatus.AVAILABLE
        );

        assertEquals(
                UnitAvailabilityStatus.AVAILABLE,
                response.availabilityStatus()
        );

        verify(unitRepository).flush();
    }

    @Test
    void shouldRejectManualTransitionToOccupied() {
        mockPropertyAndUnit();

        assertThrows(
                ConflictException.class,
                () -> update(UnitAvailabilityStatus.OCCUPIED)
        );

        assertEquals(
                UnitAvailabilityStatus.AVAILABLE,
                unit.getAvailabilityStatus()
        );

        verify(unitRepository, never()).flush();
    }

    @Test
    void shouldRejectManualTransitionFromOccupied() {
        ReflectionTestUtils.setField(
                unit,
                "availabilityStatus",
                UnitAvailabilityStatus.OCCUPIED
        );
        mockPropertyAndUnit();

        assertThrows(
                ConflictException.class,
                () -> update(UnitAvailabilityStatus.AVAILABLE)
        );

        assertEquals(
                UnitAvailabilityStatus.OCCUPIED,
                unit.getAvailabilityStatus()
        );

        verify(unitRepository, never()).flush();
    }

    @Test
    void shouldRejectArchivedProperty() {
        property.archive();

        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        assertThrows(
                ConflictException.class,
                () -> update(UnitAvailabilityStatus.UNAVAILABLE)
        );

        verifyNoInteractions(unitRepository);
    }

    @Test
    void shouldReturn404ForPropertyOutsideOrganization() {
        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> update(UnitAvailabilityStatus.UNAVAILABLE)
        );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );

        verifyNoInteractions(unitRepository);
    }

    @Test
    void shouldReturn404ForUnitOutsidePropertyOrOrganization() {
        when(propertyRepository.findByIdAndOrganizationId(
                propertyId, organizationId
        )).thenReturn(Optional.of(property));

        when(unitRepository.findByIdAndProperty_IdAndProperty_Organization_Id(
                unitId, propertyId, organizationId
        )).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> update(UnitAvailabilityStatus.UNAVAILABLE)
        );

        assertEquals(
                HttpStatus.NOT_FOUND,
                exception.getStatusCode()
        );

        verify(unitRepository, never()).flush();
    }

    @Test
    void shouldRejectMissingAvailabilityStatus() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> update(null)
        );

        assertEquals(
                HttpStatus.BAD_REQUEST,
                exception.getStatusCode()
        );

        verifyNoInteractions(propertyRepository, unitRepository);
    }

    @Test
    void shouldRejectMissingRequest() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> unitService.updateUnitAvailability(
                        organizationId, propertyId, unitId, null
                )
        );

        assertEquals(
                HttpStatus.BAD_REQUEST,
                exception.getStatusCode()
        );

        verifyNoInteractions(propertyRepository, unitRepository);
    }

    @Test
    void shouldRejectUserWithoutManagePermission() {
        doThrow(new AccessDeniedException("Insufficient permissions"))
                .when(authorizationService)
                .requirePermission(
                        organizationId,
                        OrganizationPermission.PROPERTY_MANAGE
                );

        assertThrows(
                AccessDeniedException.class,
                () -> update(UnitAvailabilityStatus.UNAVAILABLE)
        );

        verifyNoInteractions(propertyRepository, unitRepository);
    }

    @Test
    void shouldRejectUnauthorizedOrganizationContext() {
        doThrow(new AccessDeniedException("Access denied"))
                .when(contextResolver)
                .resolve(organizationId);

        assertThrows(
                AccessDeniedException.class,
                () -> update(UnitAvailabilityStatus.UNAVAILABLE)
        );

        verifyNoInteractions(
                authorizationService,
                propertyRepository,
                unitRepository
        );
    }
}
