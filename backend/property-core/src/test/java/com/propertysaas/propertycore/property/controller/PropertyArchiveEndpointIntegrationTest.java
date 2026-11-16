package com.propertysaas.propertycore.property.controller;

import com.propertysaas.propertycore.PropertyCoreApplication;
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
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class PropertyArchiveEndpointIntegrationTest {

    private static final String ARCHIVE =
            "/api/v1/organizations/{organizationId}/properties/{propertyId}/archive";
    private static final String DETAILS =
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
    void ownerCanArchivePropertyAndPersistStatus() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(id.toString()))
                    .andExpect(jsonPath("$.organizationId")
                            .value(fixture.organization().getId().toString()))
                    .andExpect(jsonPath("$.status").value("ARCHIVED"))
                    .andExpect(jsonPath("$.name").value("Kabul Test Property"));
            assertEquals(PropertyStatus.ARCHIVED, load(fixture.organization().getId(), id).getStatus());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void archivePreservesPropertyDetails() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Kabul Test Property"))
                    .andExpect(jsonPath("$.propertyType").value("APARTMENT"))
                    .andExpect(jsonPath("$.addressLine1").value("Street 3"))
                    .andExpect(jsonPath("$.city").value("Kabul"))
                    .andExpect(jsonPath("$.countryCode").value("AF"));
            Property saved = load(fixture.organization().getId(), id);
            assertEquals("Kabul Test Property", saved.getName());
            assertEquals(PropertyType.APARTMENT, saved.getPropertyType());
            assertEquals("Street 3", saved.getAddressLine1());
            assertEquals("Kabul", saved.getCity());
            assertEquals("AF", saved.getCountryCode());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void archivingTwiceIsIdempotent() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk());
            Instant firstUpdatedAt = load(fixture.organization().getId(), id).getUpdatedAt();
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ARCHIVED"));
            Property saved = load(fixture.organization().getId(), id);
            assertEquals(PropertyStatus.ARCHIVED, saved.getStatus());
            assertEquals(firstUpdatedAt, saved.getUpdatedAt());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void archivedPropertyRemainsRetrievable() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk());
            mockMvc.perform(get(DETAILS, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(id.toString()))
                    .andExpect(jsonPath("$.status").value("ARCHIVED"));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void managerCanArchiveProperty() throws Exception {
        Fixture fixture = createFixture(MembershipRole.MANAGER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("ARCHIVED"));
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void staffCannotArchiveProperty() throws Exception {
        Fixture fixture = createFixture(MembershipRole.STAFF);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isForbidden());
            assertEquals(PropertyStatus.ACTIVE, load(fixture.organization().getId(), id).getStatus());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void missingBearerTokenReturns401() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id))
                    .andExpect(status().isUnauthorized());
            assertEquals(PropertyStatus.ACTIVE, load(fixture.organization().getId(), id).getStatus());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void invalidBearerTokenReturns401() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            UUID id = createProperty(fixture.organization());
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), id)
                            .header("Authorization", "Bearer invalid-token"))
                    .andExpect(status().isUnauthorized());
            assertEquals(PropertyStatus.ACTIVE, load(fixture.organization().getId(), id).getStatus());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void nonexistentPropertyReturns404() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), UUID.randomUUID())
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isNotFound());
        } finally {
            cleanup(fixture);
        }
    }

    @Test
    void otherTenantsPropertyCannotBeArchived() throws Exception {
        Fixture owner = createFixture(MembershipRole.OWNER);
        Fixture outsider = null;
        try {
            outsider = createFixture(MembershipRole.OWNER);
            UUID propertyId = createProperty(owner.organization());
            mockMvc.perform(patch(ARCHIVE, outsider.organization().getId(), propertyId)
                            .header("Authorization", bearer(outsider)))
                    .andExpect(status().isNotFound());
            assertEquals(PropertyStatus.ACTIVE,
                    load(owner.organization().getId(), propertyId).getStatus());
        } finally {
            cleanup(outsider);
            cleanup(owner);
        }
    }

    @Test
    void otherTenantsOrganizationContextIsForbidden() throws Exception {
        Fixture owner = createFixture(MembershipRole.OWNER);
        Fixture outsider = null;
        try {
            outsider = createFixture(MembershipRole.OWNER);
            UUID propertyId = createProperty(owner.organization());
            mockMvc.perform(patch(ARCHIVE, owner.organization().getId(), propertyId)
                            .header("Authorization", bearer(outsider)))
                    .andExpect(status().isForbidden());
            assertEquals(PropertyStatus.ACTIVE,
                    load(owner.organization().getId(), propertyId).getStatus());
        } finally {
            cleanup(outsider);
            cleanup(owner);
        }
    }

    @Test
    void malformedPropertyIdReturns400() throws Exception {
        Fixture fixture = createFixture(MembershipRole.OWNER);
        try {
            mockMvc.perform(patch(ARCHIVE, fixture.organization().getId(), "not-a-uuid")
                            .header("Authorization", bearer(fixture)))
                    .andExpect(status().isBadRequest());
        } finally {
            cleanup(fixture);
        }
    }

    private Property load(UUID organizationId, UUID propertyId) {
        return transactionTemplate.execute(status -> propertyRepository
                .findByIdAndOrganizationId(propertyId, organizationId).orElseThrow());
    }

    private record Fixture(Organization organization, UUID userId, UUID membershipId, String token) {}

    private Fixture createFixture(MembershipRole role) {
        String unique = UUID.randomUUID().toString();
        Organization[] organization = new Organization[1];
        UUID[] ids = new UUID[2];
        transactionTemplate.executeWithoutResult(status -> {
            Organization savedOrg = organizationRepository.save(
                    new Organization("Archive Test Organization", "property-archive-" + unique));
            User user = userRepository.save(new User(
                    "property-archive-" + unique + "@example.com",
                    "test-password-hash", "Archive", "Tester"));
            OrganizationMembership membership = membershipRepository.save(
                    new OrganizationMembership(savedOrg, user, role));
            organization[0] = savedOrg;
            ids[0] = user.getId();
            ids[1] = membership.getId();
        });
        return new Fixture(organization[0], ids[0], ids[1], generateToken(ids[0]));
    }

    private UUID createProperty(Organization organization) {
        return transactionTemplate.execute(status -> propertyRepository.save(new Property(
                organization, "Kabul Test Property", PropertyType.APARTMENT,
                "Street 3", null, "Kabul", "AF")).getId());
    }

    private String bearer(Fixture fixture) {
        return "Bearer " + fixture.token();
    }

    private String generateToken(UUID userId) {
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

    private void cleanup(Fixture fixture) {
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