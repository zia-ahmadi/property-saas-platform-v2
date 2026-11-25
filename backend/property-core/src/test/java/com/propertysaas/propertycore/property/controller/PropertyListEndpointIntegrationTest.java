
package com.propertysaas.propertycore.property.controller;

import com.propertysaas.propertycore.PropertyCoreApplication;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
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
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class PropertyListEndpointIntegrationTest {

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
    private TransactionTemplate transactionTemplate;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Value("${app.jwt.issuer}")
    private String issuer;

    private static final String ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties";

    // ---------------------------------------------------------
    // 1. Authentication
    // ---------------------------------------------------------

    @Test
    void listPropertiesWithoutJwtShouldReturn401() throws Exception {

        mockMvc.perform(
                get(ENDPOINT, UUID.randomUUID())
        )
        .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------
    // 2. Default pagination
    // ---------------------------------------------------------

    @Test
    void defaultPaginationShouldReturnPageZeroAndSizeTen()
            throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            createProperties(fixture.organization(), 3);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organization().getId())
                            .header(
                                    "Authorization",
                                    "Bearer " + fixture.accessToken()
                            )
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
            createProperties(fixture.organization(), 5);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organization().getId())
                            .param("page", "0")
                            .param("size", "2")
                            .header(
                                    "Authorization",
                                    "Bearer " + fixture.accessToken()
                            )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(2))
            .andExpect(jsonPath("$.totalElements").value(5))
            .andExpect(jsonPath("$.totalPages").value(3))
            .andExpect(jsonPath("$.content.length()").value(2));

            mockMvc.perform(
                    get(ENDPOINT, fixture.organization().getId())
                            .param("page", "2")
                            .param("size", "2")
                            .header(
                                    "Authorization",
                                    "Bearer " + fixture.accessToken()
                            )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.page").value(2))
            .andExpect(jsonPath("$.content.length()").value(1));

        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void filtersByAddressStatusAndTypeBeforePaginatingWithinTheOrganization() throws Exception {
        TestFixture owner = createFixture(MembershipRole.OWNER);
        TestFixture other = createFixture(MembershipRole.OWNER);
        try {
            createProperties(owner.organization(), 3);
            createProperties(other.organization(), 1);
            mockMvc.perform(get(ENDPOINT, owner.organization().getId())
                            .header("Authorization", "Bearer " + owner.accessToken())
                            .param("search", "STREET 1").param("status", "ACTIVE")
                            .param("type", "APARTMENT").param("size", "1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].name").value("Test Property 1"));

            mockMvc.perform(get(ENDPOINT, owner.organization().getId())
                            .header("Authorization", "Bearer " + owner.accessToken())
                            .param("search", "kabul").param("status", "ARCHIVED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(0));

            mockMvc.perform(get(ENDPOINT, owner.organization().getId())
                            .header("Authorization", "Bearer " + owner.accessToken())
                            .param("type", "HOUSE"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(0));
        } finally {
            cleanupFixture(owner);
            cleanupFixture(other);
        }
    }

    // ---------------------------------------------------------
    // 4. Invalid pagination parameters
    // ---------------------------------------------------------

    @Test
    void invalidPaginationShouldReturn400() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            String token = "Bearer " + fixture.accessToken();
            UUID organizationId = fixture.organization().getId();

            mockMvc.perform(
                    get(ENDPOINT, organizationId)
                            .param("page", "-1")
                            .header("Authorization", token)
            )
            .andExpect(status().isBadRequest());

            mockMvc.perform(
                    get(ENDPOINT, organizationId)
                            .param("size", "0")
                            .header("Authorization", token)
            )
            .andExpect(status().isBadRequest());

            mockMvc.perform(
                    get(ENDPOINT, organizationId)
                            .param("size", "101")
                            .header("Authorization", token)
            )
            .andExpect(status().isBadRequest());

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 5. STAFF can list properties
    // ---------------------------------------------------------

    @Test
    void staffShouldListOwnOrganizationProperties()
            throws Exception {

        TestFixture fixture = createFixture(MembershipRole.STAFF);

        try {
            createProperties(fixture.organization(), 2);

            mockMvc.perform(
                    get(ENDPOINT, fixture.organization().getId())
                            .header(
                                    "Authorization",
                                    "Bearer " + fixture.accessToken()
                            )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(2))
            .andExpect(jsonPath("$.content.length()").value(2));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 6. Cross-tenant access must be denied
    // ---------------------------------------------------------

    @Test
    void userShouldNotListAnotherOrganizationsProperties()
            throws Exception {

        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = createFixture(MembershipRole.OWNER);

        try {
            createProperties(organizationB.organization(), 2);

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            organizationB.organization().getId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + organizationA.accessToken()
                    )
            )
            .andExpect(status().isForbidden());

        } finally {
            cleanupFixture(organizationA);
            cleanupFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // 7. Tenant filtering
    // ---------------------------------------------------------

    @Test
    void listingShouldOnlyReturnOwnOrganizationProperties()
            throws Exception {

        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = createFixture(MembershipRole.OWNER);

        try {
            createProperties(organizationA.organization(), 3);
            createProperties(organizationB.organization(), 4);

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            organizationA.organization().getId()
                    )
                    .header(
                            "Authorization",
                            "Bearer " + organizationA.accessToken()
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(3))
            .andExpect(jsonPath("$.content.length()").value(3))
            .andExpect(
                    jsonPath(
                            "$.content[0].organizationId"
                    ).value(organizationA.organization().getId().toString())
            )
            .andExpect(
                    jsonPath(
                            "$.content[1].organizationId"
                    ).value(organizationA.organization().getId().toString())
            )
            .andExpect(
                    jsonPath(
                            "$.content[2].organizationId"
                    ).value(organizationA.organization().getId().toString())
            );

        } finally {
            cleanupFixture(organizationA);
            cleanupFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // Fixture model
    // ---------------------------------------------------------

    private record TestFixture(
            Organization organization,
            UUID userId,
            UUID membershipId,
            String accessToken
    ) {}

    // ---------------------------------------------------------
    // Create fixture
    // ---------------------------------------------------------

    private TestFixture createFixture(MembershipRole role) {

        String uniqueId = UUID.randomUUID().toString();
        Organization[] organization = new Organization[1];
        UUID[] ids = new UUID[2];

        transactionTemplate.executeWithoutResult(status -> {

            Organization savedOrganization =
                    organizationRepository.save(
                            new Organization(
                                    "Property Listing Test Organization",
                                    "property-list-" + uniqueId
                            )
                    );

            User user = userRepository.save(
                    new User(
                            "property-list-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Property",
                            "Tester"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    savedOrganization,
                                    user,
                                    role
                            )
                    );

            organization[0] = savedOrganization;
            ids[0] = user.getId();
            ids[1] = membership.getId();
        });

        return new TestFixture(
                organization[0],
                ids[0],
                ids[1],
                generateAccessToken(ids[0])
        );
    }

    // ---------------------------------------------------------
    // Create sample properties
    // ---------------------------------------------------------

    private void createProperties(
            Organization organization,
            int count
    ) {
        transactionTemplate.executeWithoutResult(status -> {

            for (int i = 1; i <= count; i++) {

                Property property = new Property(
                        organization,
                        "Test Property " + i,
                        PropertyType.APARTMENT,
                        "Street " + i,
                        null,
                        "Kabul",
                        "AF"
                );

                propertyRepository.save(property);
            }
        });
    }

    // ---------------------------------------------------------
    // Generate signed JWT
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
    // Cleanup fixture
    // ---------------------------------------------------------

    private void cleanupFixture(TestFixture fixture) {

        if (fixture == null) {
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {

            // Delete tenant properties first.
            propertyRepository.deleteAll(
                    propertyRepository.findAllByOrganizationId(
                            fixture.organization().getId(),
                            org.springframework.data.domain.Pageable.unpaged()
                    ).getContent()
            );

            membershipRepository.deleteById(fixture.membershipId());
            userRepository.deleteById(fixture.userId());
            organizationRepository.deleteById(
                    fixture.organization().getId()
            );
        });
    }
}
