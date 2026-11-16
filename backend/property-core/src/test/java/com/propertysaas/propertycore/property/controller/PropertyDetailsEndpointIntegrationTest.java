
package com.propertysaas.propertycore.property.controller;

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
class PropertyDetailsEndpointIntegrationTest {

    private static final String ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}";

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

    @Test
    void requestWithoutJwtShouldReturn401() throws Exception {
        mockMvc.perform(get(
                ENDPOINT,
                UUID.randomUUID(),
                UUID.randomUUID()
        )).andExpect(status().isUnauthorized());
    }

    @Test
    void ownerShouldRetrievePropertyDetails() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            UUID propertyId = createProperty(fixture.organization());

            mockMvc.perform(get(
                    ENDPOINT,
                    fixture.organization().getId(),
                    propertyId
            ).header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(propertyId.toString()))
                    .andExpect(jsonPath("$.organizationId")
                            .value(fixture.organization().getId().toString()))
                    .andExpect(jsonPath("$.name").value("Kabul Test Property"))
                    .andExpect(jsonPath("$.propertyType").value("APARTMENT"))
                    .andExpect(jsonPath("$.addressLine1").value("Street 3"))
                    .andExpect(jsonPath("$.city").value("Kabul"))
                    .andExpect(jsonPath("$.countryCode").value("AF"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.createdAt").isNotEmpty())
                    .andExpect(jsonPath("$.updatedAt").isNotEmpty());

        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void staffShouldRetrievePropertyDetails() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.STAFF);

        try {
            UUID propertyId = createProperty(fixture.organization());

            mockMvc.perform(get(
                    ENDPOINT,
                    fixture.organization().getId(),
                    propertyId
            ).header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(propertyId.toString()));

        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void missingPropertyShouldReturn404() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            mockMvc.perform(get(
                    ENDPOINT,
                    fixture.organization().getId(),
                    UUID.randomUUID()
            ).header("Authorization", bearer(fixture)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));

        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void propertyFromAnotherTenantShouldReturn404() throws Exception {
        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = null;

        try {
            organizationB = createFixture(MembershipRole.OWNER);
            UUID propertyId = createProperty(organizationB.organization());

            mockMvc.perform(get(
                    ENDPOINT,
                    organizationA.organization().getId(),
                    propertyId
            ).header("Authorization", bearer(organizationA)))
                    .andExpect(status().isNotFound());

        } finally {
            cleanupFixture(organizationB);
            cleanupFixture(organizationA);
        }
    }

    @Test
    void unauthorizedOrganizationShouldReturn403() throws Exception {
        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = null;

        try {
            organizationB = createFixture(MembershipRole.OWNER);
            UUID propertyId = createProperty(organizationB.organization());

            mockMvc.perform(get(
                    ENDPOINT,
                    organizationB.organization().getId(),
                    propertyId
            ).header("Authorization", bearer(organizationA)))
                    .andExpect(status().isForbidden());

        } finally {
            cleanupFixture(organizationB);
            cleanupFixture(organizationA);
        }
    }

    @Test
    void malformedPropertyIdShouldReturn400() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            mockMvc.perform(get(
                    ENDPOINT,
                    fixture.organization().getId(),
                    "invalid-uuid"
            ).header("Authorization", bearer(fixture)))
                    .andExpect(status().isBadRequest());

        } finally {
            cleanupFixture(fixture);
        }
    }

    private record TestFixture(
            Organization organization,
            UUID userId,
            UUID membershipId,
            String accessToken
    ) {}

    private TestFixture createFixture(MembershipRole role) {
        String uniqueId = UUID.randomUUID().toString();
        Organization[] organization = new Organization[1];
        UUID[] ids = new UUID[2];

        transactionTemplate.executeWithoutResult(status -> {
            Organization savedOrganization = organizationRepository.save(
                    new Organization(
                            "Property Details Test Organization",
                            "property-details-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "property-details-" + uniqueId + "@example.com",
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

    private UUID createProperty(Organization organization) {
        return transactionTemplate.execute(status -> {
            Property property = new Property(
                    organization,
                    "Kabul Test Property",
                    PropertyType.APARTMENT,
                    "Street 3",
                    null,
                    "Kabul",
                    "AF"
            );

            return propertyRepository.save(property).getId();
        });
    }

    private String bearer(TestFixture fixture) {
        return "Bearer " + fixture.accessToken();
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

    private void cleanupFixture(TestFixture fixture) {
        if (fixture == null) {
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {
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
