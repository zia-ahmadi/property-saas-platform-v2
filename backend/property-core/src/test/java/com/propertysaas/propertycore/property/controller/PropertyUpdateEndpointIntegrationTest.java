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
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class PropertyUpdateEndpointIntegrationTest {

    private static final String ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationMembershipRepository membershipRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JwtEncoder jwtEncoder;
    @Value("${app.jwt.issuer}") private String issuer;

    @Test
    void ownerShouldUpdatePropertyAndPersistChanges() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID propertyId = createProperty(fixture.organization());
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), propertyId)
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"name":"Updated Kabul Property","city":"Herat"}
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(propertyId.toString()))
                    .andExpect(jsonPath("$.organizationId").value(fixture.organization().getId().toString()))
                    .andExpect(jsonPath("$.name").value("Updated Kabul Property"))
                    .andExpect(jsonPath("$.city").value("Herat"))
                    .andExpect(jsonPath("$.propertyType").value("APARTMENT"))
                    .andExpect(jsonPath("$.addressLine1").value("Street 3"))
                    .andExpect(jsonPath("$.countryCode").value("AF"))
                    .andExpect(jsonPath("$.status").value("ACTIVE"));
            Property saved = loadProperty(fixture.organization().getId(), propertyId);
            assertEquals("Updated Kabul Property", saved.getName());
            assertEquals("Herat", saved.getCity());
            assertEquals(PropertyType.APARTMENT, saved.getPropertyType());
            assertEquals("Street 3", saved.getAddressLine1());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void ownerShouldClearAddressLine2WithExplicitNull() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID propertyId = createProperty(fixture.organization());
            transactionTemplate.executeWithoutResult(status -> {
                Property property = propertyRepository.findByIdAndOrganizationId(
                        propertyId, fixture.organization().getId()).orElseThrow();
                property.applyUpdates(new ObjectMapper().readTree("{\"addressLine2\":\"Floor 2\"}"));
            });
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), propertyId)
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"addressLine2\":null}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.addressLine2").value(nullValue()))
                    .andExpect(jsonPath("$.name").value("Kabul Test Property"))
                    .andExpect(jsonPath("$.city").value("Kabul"));
            assertNull(loadProperty(fixture.organization().getId(), propertyId).getAddressLine2());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void ownerShouldUpdateAllEditableFields() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID propertyId = createProperty(fixture.organization());
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), propertyId)
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"name":"New Building","propertyType":"COMMERCIAL",
                             "addressLine1":"Main Road","addressLine2":"Unit 8",
                             "city":"Mazar","countryCode":"AF"}
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("New Building"))
                    .andExpect(jsonPath("$.propertyType").value("COMMERCIAL"))
                    .andExpect(jsonPath("$.addressLine1").value("Main Road"))
                    .andExpect(jsonPath("$.addressLine2").value("Unit 8"))
                    .andExpect(jsonPath("$.city").value("Mazar"));
            Property saved = loadProperty(fixture.organization().getId(), propertyId);
            assertEquals("New Building", saved.getName());
            assertEquals(PropertyType.COMMERCIAL, saved.getPropertyType());
            assertEquals("Main Road", saved.getAddressLine1());
            assertEquals("Unit 8", saved.getAddressLine2());
            assertEquals("Mazar", saved.getCity());
            assertEquals("AF", saved.getCountryCode());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void emptyUpdatePayloadShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{}");
    }

    @Test
    void updatingOrganizationIdShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty(
                "{\"organizationId\":\"" + UUID.randomUUID() + "\",\"name\":\"Unauthorized Update\"}");
    }

    @Test
    void updatingStatusShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"status\":\"ARCHIVED\"}");
    }

    @Test
    void unknownFieldShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"unknownField\":\"value\"}");
    }

    @Test
    void blankNameShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"name\":\"   \"}");
    }

    @Test
    void nullRequiredFieldShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"city\":null}");
    }

    @Test
    void wrongFieldTypeShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"name\":123}");
    }

    @Test
    void invalidPropertyTypeShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"propertyType\":\"INVALID\"}");
    }

    @Test
    void invalidCountryCodeShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("{\"countryCode\":\"af\"}");
    }

    @Test
    void overlyLongNameShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty(
                "{\"name\":\"" + "A".repeat(151) + "\"}");
    }

    @Test
    void arrayPayloadShouldReturn400() throws Exception {
        assertInvalidPayloadDoesNotChangeProperty("[]");
    }

    @Test
    void missingPropertyShouldReturn404() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);
        try {
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), UUID.randomUUID())
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Updated\"}"))
                    .andExpect(status().isNotFound());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void staffShouldNotUpdateProperty() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.STAFF);
        try {
            UUID propertyId = createProperty(fixture.organization());
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), propertyId)
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Unauthorized Update\"}"))
                    .andExpect(status().isForbidden());
            assertEquals("Kabul Test Property",
                    loadProperty(fixture.organization().getId(), propertyId).getName());
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
            mockMvc.perform(patch(ENDPOINT, organizationA.organization().getId(), propertyId)
                    .header("Authorization", bearer(organizationA))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Cross Tenant Update\"}"))
                    .andExpect(status().isNotFound());
            assertEquals("Kabul Test Property",
                    loadProperty(organizationB.organization().getId(), propertyId).getName());
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
            mockMvc.perform(patch(ENDPOINT, organizationB.organization().getId(), propertyId)
                    .header("Authorization", bearer(organizationA))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Cross Tenant Update\"}"))
                    .andExpect(status().isForbidden());
            assertEquals("Kabul Test Property",
                    loadProperty(organizationB.organization().getId(), propertyId).getName());
        } finally {
            cleanupFixture(organizationB);
            cleanupFixture(organizationA);
        }
    }

    @Test
    void requestWithoutJwtShouldReturn401() throws Exception {
        mockMvc.perform(patch(ENDPOINT, UUID.randomUUID(), UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Updated\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void malformedPropertyIdShouldReturn400() throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);
        try {
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), "invalid-uuid")
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Updated\"}"))
                    .andExpect(status().isBadRequest());
        } finally {
            cleanupFixture(fixture);
        }
    }

    private void assertInvalidPayloadDoesNotChangeProperty(String payload) throws Exception {
        TestFixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID propertyId = createProperty(fixture.organization());
            mockMvc.perform(patch(ENDPOINT, fixture.organization().getId(), propertyId)
                    .header("Authorization", bearer(fixture))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(payload))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400));
            Property saved = loadProperty(fixture.organization().getId(), propertyId);
            assertEquals("Kabul Test Property", saved.getName());
            assertEquals("Kabul", saved.getCity());
            assertEquals(PropertyType.APARTMENT, saved.getPropertyType());
            assertEquals("AF", saved.getCountryCode());
        } finally {
            cleanupFixture(fixture);
        }
    }

    private Property loadProperty(UUID organizationId, UUID propertyId) {
        return transactionTemplate.execute(status -> propertyRepository
                .findByIdAndOrganizationId(propertyId, organizationId).orElseThrow());
    }

    private record TestFixture(
            Organization organization, UUID userId, UUID membershipId, String accessToken) {}

    private TestFixture createFixture(MembershipRole role) {
        String uniqueId = UUID.randomUUID().toString();
        Organization[] organization = new Organization[1];
        UUID[] ids = new UUID[2];
        transactionTemplate.executeWithoutResult(status -> {
            Organization savedOrganization = organizationRepository.save(
                    new Organization("Property Update Test Organization", "property-update-" + uniqueId));
            User user = userRepository.save(new User(
                    "property-update-" + uniqueId + "@example.com",
                    "test-password-hash", "Property", "Tester"));
            OrganizationMembership membership = membershipRepository.save(
                    new OrganizationMembership(savedOrganization, user, role));
            organization[0] = savedOrganization;
            ids[0] = user.getId();
            ids[1] = membership.getId();
        });
        return new TestFixture(organization[0], ids[0], ids[1], generateAccessToken(ids[0]));
    }

    private UUID createProperty(Organization organization) {
        return transactionTemplate.execute(status -> {
            Property property = new Property(
                    organization, "Kabul Test Property", PropertyType.APARTMENT,
                    "Street 3", null, "Kabul", "AF");
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
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    private void cleanupFixture(TestFixture fixture) {
        if (fixture == null) return;
        transactionTemplate.executeWithoutResult(status -> {
            propertyRepository.deleteAll(propertyRepository.findAllByOrganizationId(
                    fixture.organization().getId(),
                    org.springframework.data.domain.Pageable.unpaged()).getContent());
            membershipRepository.deleteById(fixture.membershipId());
            userRepository.deleteById(fixture.userId());
            organizationRepository.deleteById(fixture.organization().getId());
        });
    }
}