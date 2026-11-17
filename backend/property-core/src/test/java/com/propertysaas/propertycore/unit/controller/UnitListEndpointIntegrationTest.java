
package com.propertysaas.propertycore.unit.controller;

import com.propertysaas.propertycore.PropertyCoreApplication;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyType;
import com.propertysaas.propertycore.property.repository.PropertyRepository;
import com.propertysaas.propertycore.unit.entity.Unit;
import com.propertysaas.propertycore.unit.entity.UnitType;
import com.propertysaas.propertycore.unit.repository.UnitRepository;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class UnitListEndpointIntegrationTest {

    private static final String ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}/units";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationMembershipRepository membershipRepository;

    @Autowired
    private PropertyRepository propertyRepository;

    @Autowired
    private UnitRepository unitRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Value("${app.jwt.issuer}")
    private String issuer;

    private record TestFixture(
            UUID organizationId,
            UUID userId,
            UUID membershipId,
            UUID propertyId,
            String accessToken
    ) {}

    // ---------------------------------------------------------
    // 1. Authentication
    // ---------------------------------------------------------

    @Test
    void listUnitsWithoutJwtShouldReturn401() throws Exception {
        mockMvc.perform(
                get(ENDPOINT, UUID.randomUUID(), UUID.randomUUID())
        ).andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------
    // 2. Default pagination
    // ---------------------------------------------------------

    @Test
    void defaultPaginationShouldReturnPageZeroAndSizeTen()
            throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            createUnits(fixture.propertyId(), 3);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(10))
            .andExpect(jsonPath("$.totalElements").value(3))
            .andExpect(jsonPath("$.content.length()").value(3));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 3. Multiple pages
    // ---------------------------------------------------------

    @Test
    void paginationShouldReturnCorrectPages() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            createUnits(fixture.propertyId(), 5);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .param("page", "0")
                            .param("size", "2")
                            .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(2))
            .andExpect(jsonPath("$.totalElements").value(5))
            .andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.content.length()").value(2));

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .param("page", "2")
                            .param("size", "2")
                            .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(2))
            .andExpect(jsonPath("$.content.length()").value(1));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 4. Empty property
    // ---------------------------------------------------------

    @Test
    void emptyPropertyShouldReturnEmptyPage() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(0))
            .andExpect(jsonPath("$.content.length()").value(0));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 5. Invalid pagination
    // ---------------------------------------------------------

    @Test
    void invalidPaginationShouldReturn400() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .param("page", "-1")
                            .header("Authorization", bearer(fixture))
            ).andExpect(status().isBadRequest());

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .param("size", "0")
                            .header("Authorization", bearer(fixture))
            ).andExpect(status().isBadRequest());

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .param("size", "101")
                            .header("Authorization", bearer(fixture))
            ).andExpect(status().isBadRequest());

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 6. STAFF read access
    // ---------------------------------------------------------

    @Test
    void staffShouldListUnits() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.STAFF);

        try {
            createUnits(fixture.propertyId(), 2);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 7. Cross-tenant access
    // ---------------------------------------------------------

    @Test
    void userShouldNotListAnotherOrganizationsUnits()
            throws Exception {

        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = createFixture(MembershipRole.OWNER);

        try {
            createUnits(organizationB.propertyId(), 2);

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            organizationB.organizationId(),
                            organizationB.propertyId()
                    ).header("Authorization", bearer(organizationA))
            )
            .andExpect(status().isForbidden());

        } finally {
            cleanupFixture(organizationA);
            cleanupFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // 8. Property ownership
    // ---------------------------------------------------------

    @Test
    void propertyOutsideRequestedOrganizationShouldReturn404()
            throws Exception {

        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = createFixture(MembershipRole.OWNER);

        try {
            createUnits(organizationB.propertyId(), 2);

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            organizationA.organizationId(),
                            organizationB.propertyId()
                    ).header("Authorization", bearer(organizationA))
            )
            .andExpect(status().isNotFound());

        } finally {
            cleanupFixture(organizationA);
            cleanupFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // 9. Property-specific filtering
    // ---------------------------------------------------------

    @Test
    void listingShouldOnlyReturnUnitsFromRequestedProperty()
            throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            UUID otherPropertyId = createAdditionalProperty(fixture.organizationId());

            createUnits(fixture.propertyId(), 2);
            createUnits(otherPropertyId, 3);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organizationId(), fixture.propertyId())
                            .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(
                    jsonPath("$.content[0].propertyId")
                            .value(fixture.propertyId().toString())
            )
            .andExpect(
                    jsonPath("$.content[1].propertyId")
                            .value(fixture.propertyId().toString())
            );

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Fixture helpers
    // ---------------------------------------------------------

    private TestFixture createFixture(MembershipRole role) {

        String uniqueId = UUID.randomUUID().toString();

        UUID[] ids = new UUID[4];

        transactionTemplate.executeWithoutResult(status -> {
            Organization organization = organizationRepository.save(
                    new Organization(
                            "Unit Listing Test Organization",
                            "unit-list-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "unit-list-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Unit",
                            "Tester"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(organization, user, role)
                    );

            Property property = propertyRepository.save(
                    new Property(
                            organization,
                            "Unit Listing Test Property",
                            PropertyType.APARTMENT,
                            "Street 1",
                            null,
                            "Kabul",
                            "AF"
                    )
            );

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
            ids[3] = property.getId();
        });

        return new TestFixture(
                ids[0],
                ids[1],
                ids[2],
                ids[3],
                generateAccessToken(ids[1])
        );
    }

    private UUID createAdditionalProperty(UUID organizationId) {

        UUID[] result = new UUID[1];

        transactionTemplate.executeWithoutResult(status -> {
            Organization organization = organizationRepository
                    .findById(organizationId)
                    .orElseThrow();

            Property property = propertyRepository.save(
                    new Property(
                            organization,
                            "Additional Unit Test Property",
                            PropertyType.APARTMENT,
                            "Street 2",
                            null,
                            "Kabul",
                            "AF"
                    )
            );

            result[0] = property.getId();
        });

        return result[0];
    }

    private void createUnits(UUID propertyId, int count) {

        transactionTemplate.executeWithoutResult(status -> {

            Property property = propertyRepository
                    .findById(propertyId)
                    .orElseThrow();

            for (int i = 1; i <= count; i++) {
                unitRepository.save(
                        new Unit(
                                property,
                                "UNIT-" + i,
                                UnitType.APARTMENT,
                                i,
                                new BigDecimal("85.50")
                        )
                );
            }
        });
    }

    private String generateAccessToken(UUID userId) {

        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(userId.toString())
                .id(UUID.randomUUID().toString())
                .build();

        return jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();
    }

    private String bearer(TestFixture fixture) {
        return "Bearer " + fixture.accessToken();
    }

    private void cleanupFixture(TestFixture fixture) {

        if (fixture == null) {
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {

            var properties = propertyRepository.findAllByOrganizationId(
                    fixture.organizationId(),
                    Pageable.unpaged()
            ).getContent();

            for (Property property : properties) {
                unitRepository.deleteAll(
                        unitRepository.findAllByProperty_IdAndProperty_Organization_Id(
                                property.getId(),
                                fixture.organizationId(),
                                Pageable.unpaged()
                        ).getContent()
                );
            }

            unitRepository.flush();

            propertyRepository.deleteAll(properties);
            propertyRepository.flush();

            membershipRepository.deleteById(fixture.membershipId());
            userRepository.deleteById(fixture.userId());
            organizationRepository.deleteById(fixture.organizationId());
        });
    }

    // ---------------------------------------------------------
    // 10. Deterministic sorting
    // ---------------------------------------------------------

    @Test
    void listingShouldReturnUnitsInDescendingCreationOrder()
            throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            createUnits(fixture.propertyId(), 3);

            var savedUnits = unitRepository
                    .findAllByProperty_IdAndProperty_Organization_Id(
                            fixture.propertyId(),
                            fixture.organizationId(),
                            Pageable.unpaged()
                    )
                    .getContent();

            
var expectedOrder = savedUnits.stream()
        .sorted((first, second) -> {
            int createdAtComparison = second.getCreatedAt()
                    .compareTo(first.getCreatedAt());

            if (createdAtComparison != 0) {
                return createdAtComparison;
            }

            return second.getId().compareTo(first.getId());
        })
        .map(unit -> unit.getId())
        .toList();


            mockMvc.perform(
                    get(
                            ENDPOINT,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(
                    jsonPath("$.content[0].id")
                            .value(expectedOrder.get(0).toString())
            )
            .andExpect(
                    jsonPath("$.content[1].id")
                            .value(expectedOrder.get(1).toString())
            )
            .andExpect(
                    jsonPath("$.content[2].id")
                            .value(expectedOrder.get(2).toString())
            );

        } finally {
            cleanupFixture(fixture);
        }
    }

}
