
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class UnitAvailabilityEndpointIntegrationTest {

    private static final String AVAILABILITY_URL =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}/units/{unitId}/availability";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationMembershipRepository membershipRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private UnitRepository unitRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JwtEncoder jwtEncoder;

    @Value("${app.jwt.issuer}")
    private String issuer;

    private record TestFixture(
            UUID organizationId,
            UUID userId,
            UUID membershipId,
            UUID propertyId,
            UUID unitId,
            String accessToken
    ) {}

    @Test
    void requestWithoutJwtShouldReturn401() throws Exception {
        mockMvc.perform(patch(
                        AVAILABILITY_URL,
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        UUID.randomUUID()
                )
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"availabilityStatus\":\"UNAVAILABLE\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ownerShouldMarkUnitUnavailableAndPersistChange() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id")
                            .value(fixture.unitId().toString()))
                    .andExpect(jsonPath("$.propertyId")
                            .value(fixture.propertyId().toString()))
                    .andExpect(jsonPath("$.availabilityStatus")
                            .value("UNAVAILABLE"));

            assertEquals("unavailable", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void ownerShouldRestoreUnavailableUnitToAvailable() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            setAvailability(fixture.unitId(), "unavailable");

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"AVAILABLE\"}"
            )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.availabilityStatus")
                            .value("AVAILABLE"));

            assertEquals("available", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void repeatedStatusUpdateShouldBeAccepted() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"AVAILABLE\"}"
            )
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.availabilityStatus")
                            .value("AVAILABLE"));

            assertEquals("available", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void manuallySettingOccupiedShouldReturn409() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"OCCUPIED\"}"
            )
                    .andExpect(status().isConflict());

            assertEquals("available", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void manuallyChangingOccupiedUnitShouldReturn409() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            setAvailability(fixture.unitId(), "occupied");

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"AVAILABLE\"}"
            )
                    .andExpect(status().isConflict());

            assertEquals("occupied", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void archivedPropertyShouldReturn409() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);

            jdbcTemplate.update(
                    "UPDATE properties SET status = 'archived' WHERE id = ?",
                    fixture.propertyId()
            );

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isConflict());

            assertEquals("available", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void staffShouldNotChangeAvailability() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.STAFF);

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    fixture.unitId(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isForbidden());

            assertEquals("available", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void ownerCannotChangeAvailabilityInAnotherOrganization() throws Exception {
        TestFixture a = null;
        TestFixture b = null;
        try {
            a = createFixture(MembershipRole.OWNER);
            b = createFixture(MembershipRole.OWNER);

            performPatch(
                    a,
                    b.organizationId(),
                    b.propertyId(),
                    b.unitId(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isForbidden());

            assertEquals("available", availabilityStatus(b.unitId()));
        } finally {
            cleanup(a);
            cleanup(b);
        }
    }

    @Test
    void propertyOutsideRequestedOrganizationShouldReturn404() throws Exception {
        TestFixture a = null;
        TestFixture b = null;
        try {
            a = createFixture(MembershipRole.OWNER);
            b = createFixture(MembershipRole.OWNER);

            performPatch(
                    a,
                    a.organizationId(),
                    b.propertyId(),
                    b.unitId(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isNotFound());

            assertEquals("available", availabilityStatus(b.unitId()));
        } finally {
            cleanup(a);
            cleanup(b);
        }
    }

    @Test
    void unitOutsideRequestedPropertyShouldReturn404() throws Exception {
        TestFixture a = null;
        TestFixture b = null;
        try {
            a = createFixture(MembershipRole.OWNER);
            b = createFixture(MembershipRole.OWNER);

            performPatch(
                    a,
                    a.organizationId(),
                    a.propertyId(),
                    b.unitId(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isNotFound());

            assertEquals("available", availabilityStatus(b.unitId()));
        } finally {
            cleanup(a);
            cleanup(b);
        }
    }

    @Test
    void missingUnitShouldReturn404() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);

            performPatch(
                    fixture,
                    fixture.organizationId(),
                    fixture.propertyId(),
                    UUID.randomUUID(),
                    "{\"availabilityStatus\":\"UNAVAILABLE\"}"
            )
                    .andExpect(status().isNotFound());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void invalidPayloadsShouldReturn400WithoutChangingStatus() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);

            String[] invalidBodies = {
                    "{}",
                    "{\"availabilityStatus\":null}",
                    "{\"availabilityStatus\":\"INVALID\"}",
                    "{\"availabilityStatus\":123}",
                    "[]",
                    "{invalid-json}"
            };

            for (String body : invalidBodies) {
                performPatch(
                        fixture,
                        fixture.organizationId(),
                        fixture.propertyId(),
                        fixture.unitId(),
                        body
                ).andExpect(status().isBadRequest());
            }

            assertEquals("available", availabilityStatus(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    private ResultActions performPatch(
            TestFixture actor,
            UUID organizationId,
            UUID propertyId,
            UUID unitId,
            String body
    ) throws Exception {
        return mockMvc.perform(
                patch(AVAILABILITY_URL, organizationId, propertyId, unitId)
                        .header("Authorization", "Bearer " + actor.accessToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
        );
    }

    private TestFixture createFixture(MembershipRole role) {
        String unique = UUID.randomUUID().toString();
        UUID[] ids = new UUID[5];

        transactionTemplate.executeWithoutResult(status -> {
            Organization organization = organizationRepository.save(
                    new Organization(
                            "Unit Availability Test Organization",
                            "unit-availability-" + unique
                    )
            );

            User user = userRepository.save(
                    new User(
                            "unit-availability-" + unique + "@example.com",
                            "test-password-hash",
                            "Unit",
                            "Tester"
                    )
            );

            OrganizationMembership membership = membershipRepository.save(
                    new OrganizationMembership(organization, user, role)
            );

            Property property = propertyRepository.save(
                    new Property(
                            organization,
                            "Unit Availability Property",
                            PropertyType.APARTMENT,
                            "Street 1",
                            null,
                            "Kabul",
                            "AF"
                    )
            );

            Unit unit = unitRepository.save(
                    new Unit(
                            property,
                            "A-101",
                            UnitType.APARTMENT,
                            1,
                            new BigDecimal("85.50")
                    )
            );

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
            ids[3] = property.getId();
            ids[4] = unit.getId();
        });

        return new TestFixture(
                ids[0],
                ids[1],
                ids[2],
                ids[3],
                ids[4],
                generateAccessToken(ids[1])
        );
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

    private void setAvailability(UUID unitId, String status) {
        jdbcTemplate.update(
                "UPDATE units SET availability_status = ? WHERE id = ?",
                status,
                unitId
        );
    }

    private String availabilityStatus(UUID unitId) {
        return jdbcTemplate.queryForObject(
                "SELECT availability_status FROM units WHERE id = ?",
                String.class,
                unitId
        );
    }

    private void cleanup(TestFixture fixture) {
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
