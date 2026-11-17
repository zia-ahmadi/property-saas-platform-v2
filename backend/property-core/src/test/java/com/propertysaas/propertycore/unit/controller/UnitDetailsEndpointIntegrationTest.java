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
class UnitDetailsEndpointIntegrationTest {

    private static final String ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}/units/{unitId}";

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
    // 1. Successful unit retrieval
    // ---------------------------------------------------------

    @Test
    void getUnitDetailsShouldReturn200() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            UUID unitId = createUnit(fixture.propertyId());

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            fixture.organizationId(),
                            fixture.propertyId(),
                            unitId
                    ).header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(unitId.toString()))
            .andExpect(jsonPath("$.propertyId")
                    .value(fixture.propertyId().toString()))
            .andExpect(jsonPath("$.unitNumber").value("A-101"))
            .andExpect(jsonPath("$.unitType").value("APARTMENT"))
            .andExpect(jsonPath("$.floorNumber").value(1))
            .andExpect(jsonPath("$.availabilityStatus")
                    .value("AVAILABLE"));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // Fixture creation
    // ---------------------------------------------------------

    private TestFixture createFixture(MembershipRole role) {

        String uniqueId = UUID.randomUUID().toString();
        UUID[] ids = new UUID[4];

        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository.save(
                    new Organization(
                            "Unit Details Test Organization",
                            "unit-details-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "unit-details-" + uniqueId + "@example.com",
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
                            "Unit Details Test Property",
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
    // Create a unit for testing
    // ---------------------------------------------------------

    private UUID createUnit(UUID propertyId) {

        UUID[] result = new UUID[1];

        transactionTemplate.executeWithoutResult(status -> {

            Property property = propertyRepository.findById(propertyId)
                    .orElseThrow();

            Unit unit = unitRepository.save(
                    new Unit(
                            property,
                            "A-101",
                            UnitType.APARTMENT,
                            1,
                            new BigDecimal("85.50")
                    )
            );

            result[0] = unit.getId();
        });

        return result[0];
    }

    // ---------------------------------------------------------
    // Create an additional property in the same organization
    // ---------------------------------------------------------

    private UUID createAdditionalProperty(UUID organizationId) {

        UUID[] result = new UUID[1];

        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository
                    .findById(organizationId)
                    .orElseThrow();

            Property property = propertyRepository.save(
                    new Property(
                            organization,
                            "Additional Unit Details Test Property",
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

    // ---------------------------------------------------------
    // JWT helpers
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

    private String bearer(TestFixture fixture) {
        return "Bearer " + fixture.accessToken();
    }

    // ---------------------------------------------------------
    // Database cleanup
    // ---------------------------------------------------------

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
                        unitRepository
                                .findAllByProperty_IdAndProperty_Organization_Id(
                                        property.getId(),
                                        fixture.organizationId(),
                                        Pageable.unpaged()
                                )
                                .getContent()
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
    // 2. Authentication: Missing JWT
    // ---------------------------------------------------------

    @Test
    void getUnitDetailsWithoutJwtShouldReturn401() throws Exception {

        mockMvc.perform(
                get(
                        ENDPOINT,
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        UUID.randomUUID()
                )
        )
        .andExpect(status().isUnauthorized());
    }


    // ---------------------------------------------------------
    // 3. Unit does not exist: 404
    // ---------------------------------------------------------

    @Test
    void nonexistentUnitShouldReturn404() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            UUID nonexistentUnitId = UUID.randomUUID();

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            fixture.organizationId(),
                            fixture.propertyId(),
                            nonexistentUnitId
                    ).header("Authorization", bearer(fixture))
            )
            .andExpect(status().isNotFound());

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 4. Property belongs to another organization: 404
    // ---------------------------------------------------------

    @Test
    void propertyOutsideRequestedOrganizationShouldReturn404()
            throws Exception {

        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = createFixture(MembershipRole.OWNER);

        try {
            UUID unitId = createUnit(organizationB.propertyId());

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            organizationA.organizationId(),
                            organizationB.propertyId(),
                            unitId
                    ).header("Authorization", bearer(organizationA))
            )
            .andExpect(status().isNotFound());

        } finally {
            cleanupFixture(organizationA);
            cleanupFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // 5. Cross-tenant access: 403
    // ---------------------------------------------------------

    @Test
    void userShouldNotRetrieveAnotherOrganizationsUnit()
            throws Exception {

        TestFixture organizationA = createFixture(MembershipRole.OWNER);
        TestFixture organizationB = createFixture(MembershipRole.OWNER);

        try {
            UUID unitId = createUnit(organizationB.propertyId());

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            organizationB.organizationId(),
                            organizationB.propertyId(),
                            unitId
                    ).header("Authorization", bearer(organizationA))
            )
            .andExpect(status().isForbidden());

        } finally {
            cleanupFixture(organizationA);
            cleanupFixture(organizationB);
        }
    }

    // ---------------------------------------------------------
    // 6. STAFF can retrieve unit details: 200
    // ---------------------------------------------------------

    @Test
    void staffShouldRetrieveUnitDetails() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.STAFF);

        try {
            UUID unitId = createUnit(fixture.propertyId());

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            fixture.organizationId(),
                            fixture.propertyId(),
                            unitId
                    ).header("Authorization", bearer(fixture))
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(unitId.toString()))
            .andExpect(jsonPath("$.propertyId")
                    .value(fixture.propertyId().toString()))
            .andExpect(jsonPath("$.unitNumber").value("A-101"));

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 7. Unit belongs to another property: 404
    // ---------------------------------------------------------

    @Test
    void unitOutsideRequestedPropertyShouldReturn404()
            throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            UUID otherPropertyId = createAdditionalProperty(
                    fixture.organizationId()
            );

            UUID unitId = createUnit(otherPropertyId);

            mockMvc.perform(
                    get(
                            ENDPOINT,
                            fixture.organizationId(),
                            fixture.propertyId(),
                            unitId
                    ).header("Authorization", bearer(fixture))
            )
            .andExpect(status().isNotFound());

        } finally {
            cleanupFixture(fixture);
        }
    }

    // ---------------------------------------------------------
    // 8. Property does not exist: 404
    // ---------------------------------------------------------

    @Test
    void nonexistentPropertyShouldReturn404() throws Exception {

        TestFixture fixture = createFixture(MembershipRole.OWNER);

        try {
            mockMvc.perform(
                    get(
                            ENDPOINT,
                            fixture.organizationId(),
                            UUID.randomUUID(),
                            UUID.randomUUID()
                    ).header("Authorization", bearer(fixture))
            )
            .andExpect(status().isNotFound());

        } finally {
            cleanupFixture(fixture);
        }
    }

}