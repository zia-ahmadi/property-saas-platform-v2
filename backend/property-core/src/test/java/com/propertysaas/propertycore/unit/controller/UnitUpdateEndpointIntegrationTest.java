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
class UnitUpdateEndpointIntegrationTest {

    private static final String UNIT_URL =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}/units/{unitId}";

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

    private record TestFixture(UUID organizationId, UUID userId, UUID membershipId,
                               UUID propertyId, UUID unitId, String accessToken) {}

    @Test
    void updateWithoutJwtShouldReturn401() throws Exception {
        mockMvc.perform(patch(UNIT_URL, UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"unitNumber\":\"B-202\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void ownerShouldUpdateEditableFieldsAndPersistChanges() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    """
                    {"unitNumber":" B-202 ","unitType":"OFFICE","floorNumber":2,"areaSqm":95.50}
                    """)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(fixture.unitId().toString()))
                    .andExpect(jsonPath("$.propertyId").value(fixture.propertyId().toString()))
                    .andExpect(jsonPath("$.unitNumber").value("B-202"))
                    .andExpect(jsonPath("$.unitType").value("OFFICE"))
                    .andExpect(jsonPath("$.floorNumber").value(2))
                    .andExpect(jsonPath("$.areaSqm").value(95.50))
                    .andExpect(jsonPath("$.availabilityStatus").value("AVAILABLE"));
            assertEquals("B-202", unitNumber(fixture.unitId()));
            assertEquals("office", unitType(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void partialUpdateShouldPreserveUnspecifiedFields() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    "{\"unitNumber\":\"A-102\"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.unitNumber").value("A-102"))
                    .andExpect(jsonPath("$.unitType").value("APARTMENT"))
                    .andExpect(jsonPath("$.floorNumber").value(1))
                    .andExpect(jsonPath("$.areaSqm").value(85.50));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void explicitNullShouldClearOptionalFields() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    "{\"floorNumber\":null,\"areaSqm\":null}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.floorNumber").value(org.hamcrest.Matchers.nullValue()))
                    .andExpect(jsonPath("$.areaSqm").value(org.hamcrest.Matchers.nullValue()));
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM units WHERE id = ? AND floor_number IS NULL AND area_sqm IS NULL",
                    Integer.class, fixture.unitId());
            assertEquals(1, count);
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void unchangedUnitNumberShouldBeAccepted() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    "{\"unitNumber\":\" A-101 \"}")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.unitNumber").value("A-101"));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void duplicateUnitNumberShouldReturn409WithoutChangingOriginal() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            createAdditionalUnit(fixture.propertyId(), "B-202");
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isConflict());
            assertEquals("A-101", unitNumber(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void archivedPropertyShouldReturn409() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            jdbcTemplate.update("UPDATE properties SET status = 'archived' WHERE id = ?", fixture.propertyId());
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isConflict());
            assertEquals("A-101", unitNumber(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void staffShouldNotUpdateUnit() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.STAFF);
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isForbidden());
            assertEquals("A-101", unitNumber(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void ownerCannotUpdateUnitInAnotherOrganization() throws Exception {
        TestFixture a = null, b = null;
        try {
            a = createFixture(MembershipRole.OWNER);
            b = createFixture(MembershipRole.OWNER);
            performPatch(a, b.organizationId(), b.propertyId(), b.unitId(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isForbidden());
            assertEquals("A-101", unitNumber(b.unitId()));
        } finally {
            cleanup(a);
            cleanup(b);
        }
    }

    @Test
    void propertyOutsideRequestedOrganizationShouldReturn404() throws Exception {
        TestFixture a = null, b = null;
        try {
            a = createFixture(MembershipRole.OWNER);
            b = createFixture(MembershipRole.OWNER);
            performPatch(a, a.organizationId(), b.propertyId(), b.unitId(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isNotFound());
            assertEquals("A-101", unitNumber(b.unitId()));
        } finally {
            cleanup(a);
            cleanup(b);
        }
    }

    @Test
    void unitOutsideRequestedPropertyShouldReturn404() throws Exception {
        TestFixture a = null, b = null;
        try {
            a = createFixture(MembershipRole.OWNER);
            b = createFixture(MembershipRole.OWNER);
            performPatch(a, a.organizationId(), a.propertyId(), b.unitId(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isNotFound());
            assertEquals("A-101", unitNumber(b.unitId()));
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
            performPatch(fixture, fixture.organizationId(), fixture.propertyId(), UUID.randomUUID(),
                    "{\"unitNumber\":\"B-202\"}")
                    .andExpect(status().isNotFound());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void invalidPayloadsShouldReturn400AndNotModifyUnit() throws Exception {
        TestFixture fixture = null;
        try {
            fixture = createFixture(MembershipRole.OWNER);
            String[] invalidBodies = {
                    "{}",
                    "[]",
                    "{\"unitNumber\":\"   \"}",
                    "{\"unitNumber\":null}",
                    "{\"unitType\":\"INVALID\"}",
                    "{\"unitType\":null}",
                    "{\"floorNumber\":1.5}",
                    "{\"floorNumber\":2147483648}",
                    "{\"areaSqm\":0}",
                    "{\"areaSqm\":-1}",
                    "{\"areaSqm\":\"100\"}",
                    "{\"areaSqm\":1.234}",
                    "{\"availabilityStatus\":\"OCCUPIED\"}",
                    "{\"propertyId\":\"" + UUID.randomUUID() + "\"}"
            };
            for (String body : invalidBodies) {
                performPatch(fixture, fixture.organizationId(), fixture.propertyId(), fixture.unitId(), body)
                        .andExpect(status().isBadRequest());
            }
            assertEquals("A-101", unitNumber(fixture.unitId()));
        } finally {
            cleanup(fixture);
        }
    }

    private org.springframework.test.web.servlet.ResultActions performPatch(
            TestFixture actor, UUID organizationId, UUID propertyId, UUID unitId, String body)
            throws Exception {
        return mockMvc.perform(patch(UNIT_URL, organizationId, propertyId, unitId)
                .header("Authorization", "Bearer " + actor.accessToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private TestFixture createFixture(MembershipRole role) {
        String unique = UUID.randomUUID().toString();
        UUID[] ids = new UUID[5];
        transactionTemplate.executeWithoutResult(status -> {
            Organization organization = organizationRepository.save(
                    new Organization("Unit Update Test Organization", "unit-update-" + unique));
            User user = userRepository.save(
                    new User("unit-update-" + unique + "@example.com", "test-password-hash", "Unit", "Tester"));
            OrganizationMembership membership = membershipRepository.save(
                    new OrganizationMembership(organization, user, role));
            Property property = propertyRepository.save(new Property(
                    organization, "Unit Update Property", PropertyType.APARTMENT,
                    "Street 1", null, "Kabul", "AF"));
            Unit unit = unitRepository.save(new Unit(property, "A-101", UnitType.APARTMENT,
                    1, new BigDecimal("85.50")));
            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
            ids[3] = property.getId();
            ids[4] = unit.getId();
        });
        return new TestFixture(ids[0], ids[1], ids[2], ids[3], ids[4], generateAccessToken(ids[1]));
    }

    private void createAdditionalUnit(UUID propertyId, String number) {
        transactionTemplate.executeWithoutResult(status -> {
            Property property = propertyRepository.findById(propertyId).orElseThrow();
            unitRepository.save(new Unit(property, number, UnitType.APARTMENT, 2, new BigDecimal("60.00")));
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
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    private String unitNumber(UUID unitId) {
        return jdbcTemplate.queryForObject(
                "SELECT unit_number FROM units WHERE id = ?", String.class, unitId);
    }

    private String unitType(UUID unitId) {
        return jdbcTemplate.queryForObject(
                "SELECT unit_type FROM units WHERE id = ?", String.class, unitId);
    }

    private void cleanup(TestFixture fixture) {
        if (fixture == null) return;
        transactionTemplate.executeWithoutResult(status -> {
            jdbcTemplate.update("DELETE FROM units WHERE property_id = ?", fixture.propertyId());
            propertyRepository.deleteById(fixture.propertyId());
            membershipRepository.deleteById(fixture.membershipId());
            userRepository.deleteById(fixture.userId());
            organizationRepository.deleteById(fixture.organizationId());
        });
    }
}
