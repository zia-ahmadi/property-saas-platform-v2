
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
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class UnitEndpointIntegrationTest {

    private static final String UNIT_URL =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}/units";

    private static final String VALID_REQUEST = """
            {
                "unitNumber": "A-101",
                "unitType": "APARTMENT",
                "floorNumber": 1,
                "areaSqm": 85.50
            }
            """;

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
    private JdbcTemplate jdbcTemplate;

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
    // Test 1: Authentication required
    // ---------------------------------------------------------

    @Test
    void createUnitWithoutJwtShouldReturn401() throws Exception {
        mockMvc.perform(
                post(
                        UNIT_URL,
                        UUID.randomUUID(),
                        UUID.randomUUID()
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content(VALID_REQUEST)
        )
        .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------
    // Test 2: Owner creates a unit successfully
    // ---------------------------------------------------------

    @Test
    void ownerShouldCreateUnitSuccessfully() throws Exception {
        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.OWNER);

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andExpect(jsonPath("$.propertyId")
                    .value(fixture.propertyId().toString()))
            .andExpect(jsonPath("$.unitNumber").value("A-101"))
            .andExpect(jsonPath("$.unitType").value("APARTMENT"))
            .andExpect(jsonPath("$.floorNumber").value(1))
            .andExpect(jsonPath("$.areaSqm").value(85.50))
            .andExpect(jsonPath("$.availabilityStatus")
                    .value("AVAILABLE"))
            .andExpect(header().exists("Location"));

            assertEquals(
                    1,
                    countUnits(fixture.propertyId(), "A-101")
            );

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Test 3: Invalid input
    // ---------------------------------------------------------

    @Test
    void invalidUnitDataShouldReturn400() throws Exception {
        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.OWNER);

            String invalidRequest = """
                    {
                        "unitNumber": "",
                        "unitType": "APARTMENT",
                        "areaSqm": -10
                    }
                    """;

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(invalidRequest)
            )
            .andExpect(status().isBadRequest());

            assertEquals(0, countAllUnits(fixture.propertyId()));

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Test 4: Duplicate unit number
    // ---------------------------------------------------------

    @Test
    void duplicateUnitNumberShouldReturn409() throws Exception {
        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.OWNER);

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isCreated());

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isConflict());

            assertEquals(
                    1,
                    countUnits(fixture.propertyId(), "A-101")
            );

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Test 5: Archived property
    // ---------------------------------------------------------

    @Test
    void archivedPropertyShouldRejectUnitCreation() throws Exception {
        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.OWNER);

            jdbcTemplate.update(
                    "UPDATE properties SET status = 'archived' WHERE id = ?",
                    fixture.propertyId()
            );

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isConflict());

            assertEquals(0, countAllUnits(fixture.propertyId()));

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Test 6: STAFF cannot create units
    // ---------------------------------------------------------

    @Test
    void staffShouldNotCreateUnit() throws Exception {
        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.STAFF);

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            fixture.organizationId(),
                            fixture.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isForbidden());

            assertEquals(0, countAllUnits(fixture.propertyId()));

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Test 7: Cross-tenant organization access
    // ---------------------------------------------------------

    @Test
    void ownerCannotCreateUnitInAnotherOrganization()
            throws Exception {

        TestFixture organizationA = null;
        TestFixture organizationB = null;

        try {
            organizationA = createTestFixture(MembershipRole.OWNER);
            organizationB = createTestFixture(MembershipRole.OWNER);

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            organizationB.organizationId(),
                            organizationB.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + organizationA.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isForbidden());

            assertEquals(
                    0,
                    countAllUnits(organizationB.propertyId())
            );

        } finally {
            cleanupTestFixture(organizationA);
            cleanupTestFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // Test 8: Property belongs to another tenant
    // ---------------------------------------------------------

    @Test
    void propertyOutsideRequestedOrganizationShouldReturn404()
            throws Exception {

        TestFixture organizationA = null;
        TestFixture organizationB = null;

        try {
            organizationA = createTestFixture(MembershipRole.OWNER);
            organizationB = createTestFixture(MembershipRole.OWNER);

            mockMvc.perform(
                    post(
                            UNIT_URL,
                            organizationA.organizationId(),
                            organizationB.propertyId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + organizationA.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(VALID_REQUEST)
            )
            .andExpect(status().isNotFound());

            assertEquals(
                    0,
                    countAllUnits(organizationB.propertyId())
            );

        } finally {
            cleanupTestFixture(organizationA);
            cleanupTestFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // Fixture setup
    // ---------------------------------------------------------

    private TestFixture createTestFixture(MembershipRole role) {
        String uniqueId = UUID.randomUUID().toString();
        UUID[] ids = new UUID[4];

        transactionTemplate.executeWithoutResult(status -> {
            Organization organization = organizationRepository.save(
                    new Organization(
                            "Unit Test Organization",
                            "unit-fixture-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "unit-test-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Unit",
                            "Tester"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organization,
                                    user,
                                    role
                            )
                    );

            Property property = propertyRepository.save(
                    new Property(
                            organization,
                            "Unit Test Property",
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

    // ---------------------------------------------------------
    // JWT generation
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // Database assertions
    // ---------------------------------------------------------

    private int countUnits(UUID propertyId, String unitNumber) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM units
                WHERE property_id = ?
                  AND unit_number = ?
                """,
                Integer.class,
                propertyId,
                unitNumber
        );

        return count;
    }

    private int countAllUnits(UUID propertyId) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM units
                WHERE property_id = ?
                """,
                Integer.class,
                propertyId
        );

        return count;
    }

    // ---------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------

    private void cleanupTestFixture(TestFixture fixture) {
        if (fixture == null) {
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {
            jdbcTemplate.update(
                    "DELETE FROM units WHERE property_id = ?",
                    fixture.propertyId()
            );

            propertyRepository.deleteById(fixture.propertyId());
            membershipRepository.deleteById(fixture.membershipId());
            userRepository.deleteById(fixture.userId());
            organizationRepository.deleteById(fixture.organizationId());
        });
    }
}
