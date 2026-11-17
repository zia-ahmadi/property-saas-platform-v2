
package com.propertysaas.propertycore.unit.repository;

import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyType;
import com.propertysaas.propertycore.property.repository.PropertyRepository;
import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.entity.UnitAvailabilityStatus;
import com.propertysaas.propertycore.unit.entity.UnitType;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class UnitRepositoryIntegrationTest {

    @Autowired
    private UnitRepository unitRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    private Organization organizationA;
    private Organization organizationB;

    private Property propertyA;
    private Property propertyB;
    private Property propertyA2;

    private Unit unitA;
    private Unit unitB;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();

        organizationA = organizationRepository.save(
                new Organization(
                        "Organization A",
                        "unit-org-a-" + suffix
                )
        );

        organizationB = organizationRepository.save(
                new Organization(
                        "Organization B",
                        "unit-org-b-" + suffix
                )
        );

        propertyA = propertyRepository.save(
                new Property(
                        organizationA,
                        "Property A",
                        PropertyType.APARTMENT,
                        "Street A",
                        null,
                        "Kabul",
                        "AF"
                )
        );

        propertyA2 = propertyRepository.save(
                new Property(
                        organizationA,
                        "Property A2",
                        PropertyType.APARTMENT,
                        "Street A2",
                        null,
                        "Kabul",
                        "AF"
                )
        );

        propertyB = propertyRepository.save(
                new Property(
                        organizationB,
                        "Property B",
                        PropertyType.COMMERCIAL,
                        "Street B",
                        null,
                        "Kabul",
                        "AF"
                )
        );

        unitA = unitRepository.save(
                new Unit(
                        propertyA,
                        "A-101",
                        UnitType.APARTMENT,
                        1,
                        new BigDecimal("85.50")
                )
        );

        unitB = unitRepository.save(
                new Unit(
                        propertyB,
                        "B-101",
                        UnitType.OFFICE,
                        1,
                        new BigDecimal("120.00")
                )
        );
    }

    @Test
    void shouldFindUnitWithinCorrectPropertyAndOrganization() {
        var result =
                unitRepository
                        .findByIdAndProperty_IdAndProperty_Organization_Id(
                                unitA.getId(),
                                propertyA.getId(),
                                organizationA.getId()
                        );

        assertTrue(result.isPresent());
        assertEquals(unitA.getId(), result.get().getId());
    }

    @Test
    void shouldNotFindUnitFromAnotherOrganization() {
        var result =
                unitRepository
                        .findByIdAndProperty_IdAndProperty_Organization_Id(
                                unitA.getId(),
                                propertyA.getId(),
                                organizationB.getId()
                        );

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldNotFindUnitThroughAnotherProperty() {
        var result =
                unitRepository
                        .findByIdAndProperty_IdAndProperty_Organization_Id(
                                unitA.getId(),
                                propertyA2.getId(),
                                organizationA.getId()
                        );

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldListOnlyUnitsOfRequestedProperty() {
        Page<Unit> result =
                unitRepository
                        .findAllByProperty_IdAndProperty_Organization_Id(
                                propertyA.getId(),
                                organizationA.getId(),
                                PageRequest.of(0, 10)
                        );

        assertEquals(1, result.getTotalElements());
        assertEquals(unitA.getId(), result.getContent().get(0).getId());
    }

    @Test
    void shouldNotListUnitsUsingWrongOrganization() {
        Page<Unit> result =
                unitRepository
                        .findAllByProperty_IdAndProperty_Organization_Id(
                                propertyA.getId(),
                                organizationB.getId(),
                                PageRequest.of(0, 10)
                        );

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldDetectDuplicateUnitNumberWithinProperty() {
        assertTrue(
                unitRepository.existsByProperty_IdAndUnitNumber(
                        propertyA.getId(),
                        "A-101"
                )
        );

        assertFalse(
                unitRepository.existsByProperty_IdAndUnitNumber(
                        propertyA.getId(),
                        "A-102"
                )
        );

        assertFalse(
                unitRepository.existsByProperty_IdAndUnitNumber(
                        propertyA2.getId(),
                        "A-101"
                )
        );
    }

    @Test
    void shouldFilterAvailableUnitsWithinOrganization() {
        Page<Unit> result =
                unitRepository
                        .findAllByProperty_IdAndProperty_Organization_IdAndAvailabilityStatus(
                                propertyA.getId(),
                                organizationA.getId(),
                                UnitAvailabilityStatus.AVAILABLE,
                                PageRequest.of(0, 10)
                        );

        assertEquals(1, result.getTotalElements());
        assertEquals(unitA.getId(), result.getContent().get(0).getId());
    }

    @Test
    void shouldReturnEmptyWhenAvailabilityDoesNotMatch() {
        Page<Unit> result =
                unitRepository
                        .findAllByProperty_IdAndProperty_Organization_IdAndAvailabilityStatus(
                                propertyA.getId(),
                                organizationA.getId(),
                                UnitAvailabilityStatus.OCCUPIED,
                                PageRequest.of(0, 10)
                        );

        assertTrue(result.isEmpty());
    }

    @Test
    void shouldNotExposeAvailabilityAcrossOrganizations() {
        Page<Unit> result =
                unitRepository
                        .findAllByProperty_IdAndProperty_Organization_IdAndAvailabilityStatus(
                                propertyB.getId(),
                                organizationA.getId(),
                                UnitAvailabilityStatus.AVAILABLE,
                                PageRequest.of(0, 10)
                        );

        assertTrue(result.isEmpty());

        assertNotNull(unitB.getId());
    }
}
