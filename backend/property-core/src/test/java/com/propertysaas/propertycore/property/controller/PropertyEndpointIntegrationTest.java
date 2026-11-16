
package com.propertysaas.propertycore.property.controller;

import com.propertysaas.propertycore.PropertyCoreApplication;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
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
class PropertyEndpointIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrganizationMembershipRepository membershipRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Value("${app.jwt.issuer}")
    private String issuer;

    // ---------------------------------------------------------
    // Test 1: Authentication is required
    // ---------------------------------------------------------

    @Test
    void createPropertyWithoutJwtShouldReturn401() throws Exception {

        UUID organizationId = UUID.randomUUID();

        String requestBody = """
                {
                    "name": "Kabul Residential Complex",
                    "propertyType": "APARTMENT",
                    "addressLine1": "Street 3, Karte Seh",
                    "city": "Kabul",
                    "countryCode": "AF"
                }
                """;

        mockMvc.perform(
                post(
                        "/api/v1/organizations/{organizationId}/properties",
                        organizationId
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
        .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------
    // Test 2: OWNER can create a property
    // ---------------------------------------------------------

    @Test
    void ownerShouldCreatePropertySuccessfully() throws Exception {

        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.OWNER);

            String requestBody = """
                    {
                        "name": "Kabul Residential Complex",
                        "propertyType": "APARTMENT",
                        "addressLine1": "Street 3, Karte Seh",
                        "city": "Kabul",
                        "countryCode": "AF"
                    }
                    """;

            mockMvc.perform(
                    post(
                            "/api/v1/organizations/{organizationId}/properties",
                            fixture.organizationId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(requestBody)
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").isNotEmpty())
            .andExpect(
                    jsonPath("$.organizationId")
                            .value(fixture.organizationId().toString())
            )
            .andExpect(
                    jsonPath("$.name")
                            .value("Kabul Residential Complex")
            )
            .andExpect(
                    jsonPath("$.propertyType")
                            .value("APARTMENT")
            )
            .andExpect(
                    jsonPath("$.status")
                            .value("ACTIVE")
            )
            .andExpect(header().exists("Location"));

            Integer propertyCount = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*)
                    FROM properties
                    WHERE organization_id = ?
                      AND name = ?
                      AND status = 'active'
                    """,
                    Integer.class,
                    fixture.organizationId(),
                    "Kabul Residential Complex"
            );

            assertEquals(1, propertyCount);

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Test 3: Unauthenticated invalid data still returns 401
    // ---------------------------------------------------------

    @Test
    void createPropertyWithInvalidDataWithoutJwtShouldReturn401()
            throws Exception {

        String requestBody = """
                {
                    "name": "",
                    "propertyType": "APARTMENT",
                    "addressLine1": "",
                    "city": "",
                    "countryCode": "AFG"
                }
                """;

        mockMvc.perform(
                post(
                        "/api/v1/organizations/{organizationId}/properties",
                        UUID.randomUUID()
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
        .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------
    // Test 4: Authenticated invalid data returns 400
    // ---------------------------------------------------------

    @Test
    void authenticatedOwnerWithInvalidPropertyDataShouldReturn400()
            throws Exception {

        TestFixture fixture = null;

        try {
            fixture = createTestFixture(MembershipRole.OWNER);

            String requestBody = """
                    {
                        "name": "",
                        "propertyType": "APARTMENT",
                        "addressLine1": "",
                        "city": "",
                        "countryCode": "AFG"
                    }
                    """;

            mockMvc.perform(
                    post(
                            "/api/v1/organizations/{organizationId}/properties",
                            fixture.organizationId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + fixture.accessToken()
                    )
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(requestBody)
            )
            .andExpect(status().isBadRequest());

            Integer propertyCount = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*)
                    FROM properties
                    WHERE organization_id = ?
                    """,
                    Integer.class,
                    fixture.organizationId()
            );

            assertEquals(0, propertyCount);

        } finally {
            cleanupTestFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Reusable test fixture
    // ---------------------------------------------------------

    private record TestFixture(
            UUID organizationId,
            UUID userId,
            UUID membershipId,
            String accessToken
    ) {}

    private TestFixture createTestFixture(MembershipRole role) {

        String uniqueId = UUID.randomUUID().toString();
        UUID[] ids = new UUID[3];

        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository.save(
                    new Organization(
                            "Property Test Organization",
                            "property-fixture-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "property-test-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Property",
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

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
        });

        return new TestFixture(
                ids[0],
                ids[1],
                ids[2],
                generateAccessToken(ids[1])
        );
    }

    // ---------------------------------------------------------
    // Reusable JWT generation
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
    // Database cleanup
    // ---------------------------------------------------------

    private void cleanupTestFixture(TestFixture fixture) {

        if (fixture == null) {
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {

            jdbcTemplate.update(
                    "DELETE FROM properties WHERE organization_id = ?",
                    fixture.organizationId()
            );

            membershipRepository.deleteById(
                    fixture.membershipId()
            );

            userRepository.deleteById(
                    fixture.userId()
            );

            organizationRepository.deleteById(
                    fixture.organizationId()
            );
        });
    }


@Test
void staffShouldNotCreateProperty() throws Exception {

    TestFixture fixture = null;

    try {
        fixture = createTestFixture(MembershipRole.STAFF);

        String requestBody = """
                {
                    "name": "Unauthorized Staff Property",
                    "propertyType": "APARTMENT",
                    "addressLine1": "Street 5, Kabul",
                    "city": "Kabul",
                    "countryCode": "AF"
                }
                """;

        mockMvc.perform(
                post(
                        "/api/v1/organizations/{organizationId}/properties",
                        fixture.organizationId()
                )
                .header(
                        "Authorization",
                        "Bearer " + fixture.accessToken()
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
        .andExpect(status().isForbidden());

        Integer propertyCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM properties
                WHERE organization_id = ?
                """,
                Integer.class,
                fixture.organizationId()
        );

        assertEquals(0, propertyCount);

    } finally {
        cleanupTestFixture(fixture);
    }
}

@Test
void ownerShouldNotCreatePropertyInAnotherOrganization()
        throws Exception {

    TestFixture organizationA = null;
    TestFixture organizationB = null;

    try {
        organizationA = createTestFixture(MembershipRole.OWNER);
        organizationB = createTestFixture(MembershipRole.OWNER);

        String requestBody = """
                {
                    "name": "Cross Tenant Property",
                    "propertyType": "APARTMENT",
                    "addressLine1": "Street 10, Kabul",
                    "city": "Kabul",
                    "countryCode": "AF"
                }
                """;

        // Organization A's user attempts to create
        // a property under Organization B.
        mockMvc.perform(
                post(
                        "/api/v1/organizations/{organizationId}/properties",
                        organizationB.organizationId()
                )
                .header(
                        "Authorization",
                        "Bearer " + organizationA.accessToken()
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody)
        )
        .andExpect(status().isForbidden());

        // Verify Organization B received no property.
        Integer propertyCount = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM properties
                WHERE organization_id = ?
                """,
                Integer.class,
                organizationB.organizationId()
        );

        assertEquals(0, propertyCount);

    } finally {
        cleanupTestFixture(organizationA);
        cleanupTestFixture(organizationB);
    }
}


}
