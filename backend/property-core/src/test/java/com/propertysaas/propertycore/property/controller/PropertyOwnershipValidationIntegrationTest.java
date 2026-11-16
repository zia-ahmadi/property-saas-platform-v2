package com.propertysaas.propertycore.property.controller;

import com.propertysaas.propertycore.PropertyCoreApplication;
import com.propertysaas.propertycore.common.exception.ConflictException;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.property.entity.Property;
import com.propertysaas.propertycore.property.entity.PropertyStatus;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class PropertyOwnershipValidationIntegrationTest {

    private static final String PROPERTY_ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}";
    private static final String ARCHIVE_ENDPOINT = PROPERTY_ENDPOINT + "/archive";
    private static final String LIST_ENDPOINT =
            "/api/v1/organizations/{organizationId}/properties";

    @Autowired private MockMvc mockMvc;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationMembershipRepository membershipRepository;
    @Autowired private PropertyRepository propertyRepository;
    @Autowired private TransactionTemplate transactionTemplate;
    @Autowired private JwtEncoder jwtEncoder;
    @Value("${app.jwt.issuer}") private String issuer;

    @Test
    void archivedPropertyUpdateReturns409AndPreservesData() throws Exception {
        TestFixture fixture = createFixture();
        try {
            UUID propertyId = createProperty(fixture.organization());
            archive(fixture, propertyId);

            mockMvc.perform(patch(PROPERTY_ENDPOINT, fixture.organization().getId(), propertyId)
                            .header("Authorization", bearer(fixture))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Should Not Persist\",\"city\":\"Herat\"}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409))
                    .andExpect(jsonPath("$.message").value("Archived properties cannot be updated"));

            Property saved = loadProperty(fixture.organization().getId(), propertyId);
            assertEquals(PropertyStatus.ARCHIVED, saved.getStatus());
            assertEquals("Kabul Test Property", saved.getName());
            assertEquals("Kabul", saved.getCity());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void archivedPropertyRemainsReadable() throws Exception {
        TestFixture fixture = createFixture();
        try {
            UUID propertyId = createProperty(fixture.organization());
            archive(fixture, propertyId);

            mockMvc.perform(get(PROPERTY_ENDPOINT, fixture.organization().getId(), propertyId)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ARCHIVED"))
                    .andExpect(jsonPath("$.name").value("Kabul Test Property"));
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void archivedPropertyRemainsInPaginatedListing() throws Exception {
        TestFixture fixture = createFixture();
        try {
            UUID propertyId = createProperty(fixture.organization());
            archive(fixture, propertyId);

            mockMvc.perform(get(LIST_ENDPOINT, fixture.organization().getId())
                            .header("Authorization", bearer(fixture))
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].id").value(propertyId.toString()))
                    .andExpect(jsonPath("$.content[0].status").value("ARCHIVED"));
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void activePropertyStillAllowsUpdates() throws Exception {
        TestFixture fixture = createFixture();
        try {
            UUID propertyId = createProperty(fixture.organization());
            mockMvc.perform(patch(PROPERTY_ENDPOINT, fixture.organization().getId(), propertyId)
                            .header("Authorization", bearer(fixture))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Updated Active Property\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ACTIVE"))
                    .andExpect(jsonPath("$.name").value("Updated Active Property"));
            assertEquals("Updated Active Property",
                    loadProperty(fixture.organization().getId(), propertyId).getName());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void attemptedOwnershipReassignmentReturns400AndPreservesOwner() throws Exception {
        TestFixture fixture = createFixture();
        try {
            UUID propertyId = createProperty(fixture.organization());
            mockMvc.perform(patch(PROPERTY_ENDPOINT, fixture.organization().getId(), propertyId)
                            .header("Authorization", bearer(fixture))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"organizationId\":\"" + UUID.randomUUID() + "\"}"))
                    .andExpect(status().isBadRequest());
            assertEquals(fixture.organization().getId(),
                    loadProperty(fixture.organization().getId(), propertyId)
                            .getOrganization().getId());
        } finally {
            cleanupFixture(fixture);
        }
    }

    @Test
    void entityRejectsDirectUpdatesAfterArchive() {
        TestFixture fixture = createFixture();
        try {
            UUID propertyId = createProperty(fixture.organization());
            transactionTemplate.executeWithoutResult(status -> {
                Property property = propertyRepository
                        .findByIdAndOrganizationId(propertyId, fixture.organization().getId())
                        .orElseThrow();
                property.archive();
                propertyRepository.flush();
            });

            assertThrows(ConflictException.class, () ->
                    transactionTemplate.executeWithoutResult(status -> {
                        Property property = propertyRepository
                                .findByIdAndOrganizationId(propertyId, fixture.organization().getId())
                                .orElseThrow();
                        property.applyUpdates(new ObjectMapper()
                                .readTree("{\"name\":\"Forbidden Direct Update\"}"));
                    }));

            Property saved = loadProperty(fixture.organization().getId(), propertyId);
            assertEquals(PropertyStatus.ARCHIVED, saved.getStatus());
            assertEquals("Kabul Test Property", saved.getName());
        } finally {
            cleanupFixture(fixture);
        }
    }

    private void archive(TestFixture fixture, UUID propertyId) throws Exception {
        mockMvc.perform(patch(ARCHIVE_ENDPOINT, fixture.organization().getId(), propertyId)
                        .header("Authorization", bearer(fixture)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));
    }

    private Property loadProperty(UUID organizationId, UUID propertyId) {
        return transactionTemplate.execute(status -> propertyRepository
                .findByIdAndOrganizationId(propertyId, organizationId).orElseThrow());
    }

    private record TestFixture(
            Organization organization, UUID userId, UUID membershipId, String accessToken) {}

    private TestFixture createFixture() {
        String uniqueId = UUID.randomUUID().toString();
        Organization[] organization = new Organization[1];
        UUID[] ids = new UUID[2];
        transactionTemplate.executeWithoutResult(status -> {
            Organization savedOrganization = organizationRepository.save(
                    new Organization("Ownership Validation Test Organization", "ownership-validation-" + uniqueId));
            User user = userRepository.save(new User(
                    "ownership-validation-" + uniqueId + "@example.com",
                    "test-password-hash", "Property", "Tester"));
            OrganizationMembership membership = membershipRepository.save(
                    new OrganizationMembership(savedOrganization, user, MembershipRole.OWNER));
            organization[0] = savedOrganization;
            ids[0] = user.getId();
            ids[1] = membership.getId();
        });
        return new TestFixture(organization[0], ids[0], ids[1], generateAccessToken(ids[0]));
    }

    private UUID createProperty(Organization organization) {
        return transactionTemplate.execute(status -> propertyRepository.save(
                new Property(organization, "Kabul Test Property", PropertyType.APARTMENT,
                        "Street 3", null, "Kabul", "AF")).getId());
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
