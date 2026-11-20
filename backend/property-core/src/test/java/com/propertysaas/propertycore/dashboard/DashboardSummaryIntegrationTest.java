package com.propertysaas.propertycore.dashboard;

import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import javax.sql.DataSource;
import java.sql.Connection;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class DashboardSummaryIntegrationTest {
    private static final String URL = "/api/v1/organizations/{organizationId}/dashboard/summary";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtEncoder encoder;
    @Autowired DataSource dataSource;
    @Value("${app.jwt.issuer}") String issuer;
    private final List<Fixture> fixtures = new ArrayList<>();
    private record Fixture(UUID org, UUID user, String token) {}

    private Fixture fixture(MembershipRole role) {
        UUID org = UUID.randomUUID(), user = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name,slug) VALUES (?, 'Dashboard test', ?)", org, "f6-" + org);
        jdbc.update("INSERT INTO users(id,email,password_hash,first_name,last_name) VALUES (?,?,'test-hash','F6','Test')", user, user + "@example.test");
        jdbc.update("INSERT INTO organization_memberships(organization_id,user_id,role) VALUES (?,?,?)", org, user, role.name().toLowerCase(Locale.ROOT));
        Instant now = Instant.now();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder().issuer(issuer).subject(user.toString()).issuedAt(now).expiresAt(now.plusSeconds(600)).build())).getTokenValue();
        Fixture fixture = new Fixture(org, user, token);
        fixtures.add(fixture);
        return fixture;
    }

    private UUID property(Fixture fixture, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO properties(id,organization_id,name,property_type,address_line1,city,country_code,status) VALUES (?,?,'F6 property','house','Test street','Kabul','AF',?)", id, fixture.org(), status);
        return id;
    }

    private UUID unit(UUID property, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO units(id,property_id,unit_number,unit_type,availability_status) VALUES (?,?,?,'apartment',?)", id, property, id.toString(), status);
        return id;
    }

    private ResultActions summary(Fixture actor, UUID org) throws Exception {
        return mvc.perform(get(URL, org).header("Authorization", "Bearer " + actor.token()));
    }

    @AfterEach
    void cleanup() {
        for (Fixture f : fixtures) {
            jdbc.update("DELETE FROM units WHERE property_id IN (SELECT id FROM properties WHERE organization_id = ?)", f.org());
            jdbc.update("DELETE FROM properties WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM organization_memberships WHERE organization_id = ?", f.org());
            jdbc.update("DELETE FROM users WHERE id = ?", f.user());
            jdbc.update("DELETE FROM organizations WHERE id = ?", f.org());
        }
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void allExistingRolesCanReadEmptyOrganization(MembershipRole role) throws Exception {
        Fixture f = fixture(role);
        summary(f, f.org()).andExpect(status().isOk()).andExpect(content().json("""
                {"totalProperties":0,"activeProperties":0,"archivedProperties":0,
                 "totalUnits":0,"availableUnits":0,"unavailableUnits":0,"occupiedUnits":0}
                """));
    }

    @Test
    void countsAllStatusesAndArchivedUnitsWithoutJoinMultiplicationOrPageLimits() throws Exception {
        Fixture f = fixture(MembershipRole.OWNER);
        UUID active = property(f, "active"), archived = property(f, "archived");
        property(f, "active"); // A property with zero units still counts.
        for (int i = 0; i < 105; i++) unit(active, "available");
        unit(active, "unavailable"); unit(active, "occupied");
        unit(archived, "available"); unit(archived, "unavailable"); unit(archived, "occupied");
        Fixture other = fixture(MembershipRole.OWNER);
        unit(property(other, "active"), "available");
        summary(f, f.org()).andExpect(status().isOk()).andExpect(content().json("""
                {"totalProperties":3,"activeProperties":2,"archivedProperties":1,
                 "totalUnits":110,"availableUnits":106,"unavailableUnits":2,"occupiedUnits":2}
                """));
    }

    @Test
    void propertiesWithoutUnitsReturnZeroUnitCounts() throws Exception {
        Fixture f = fixture(MembershipRole.STAFF);
        for (int i = 0; i < 105; i++) property(f, "active");
        summary(f, f.org()).andExpect(status().isOk()).andExpect(jsonPath("$.totalProperties").value(105))
                .andExpect(jsonPath("$.totalUnits").value(0)).andExpect(jsonPath("$.availableUnits").value(0));
    }

    @Test
    void unauthenticatedAndNonmembersCannotReadSummary() throws Exception {
        Fixture a = fixture(MembershipRole.OWNER), b = fixture(MembershipRole.OWNER);
        mvc.perform(get(URL, a.org())).andExpect(status().isUnauthorized());
        summary(a, b.org()).andExpect(status().isForbidden());
        summary(a, UUID.randomUUID()).andExpect(status().isForbidden());
    }

    @ParameterizedTest
    @ValueSource(strings = {"suspended", "invited"})
    void inactiveMembershipIsDenied(String state) throws Exception {
        Fixture f = fixture(MembershipRole.OWNER);
        jdbc.update("UPDATE organization_memberships SET status = ? WHERE organization_id = ?", state, f.org());
        summary(f, f.org()).andExpect(status().isForbidden());
    }

    @Test
    void suspendedOrganizationAndUserAreDenied() throws Exception {
        Fixture f = fixture(MembershipRole.OWNER);
        jdbc.update("UPDATE organizations SET status='suspended' WHERE id=?", f.org());
        summary(f, f.org()).andExpect(status().isForbidden());
        jdbc.update("UPDATE organizations SET status='active' WHERE id=?", f.org());
        jdbc.update("UPDATE users SET status='suspended' WHERE id=?", f.user());
        // Authentication may reject a suspended user before the organization resolver.
        int code = summary(f, f.org()).andReturn().getResponse().getStatus();
        org.junit.jupiter.api.Assertions.assertTrue(code == 401 || code == 403);
    }

    @Test
    void endpointDoesNotAcceptWrites() throws Exception {
        Fixture f = fixture(MembershipRole.OWNER);
        mvc.perform(post(URL, f.org()).header("Authorization", "Bearer " + f.token())).andExpect(status().isMethodNotAllowed());
    }

    @Test
    void uncommittedChangesAreInvisibleAndCommittedCountsReconcile() throws Exception {
        Fixture f = fixture(MembershipRole.OWNER);
        UUID p = property(f, "active"), u = unit(p, "available");
        try (Connection writer = dataSource.getConnection()) {
            writer.setAutoCommit(false);
            try (var ps = writer.prepareStatement("UPDATE properties SET status='archived' WHERE id=?")) {
                ps.setObject(1, p); ps.executeUpdate();
            }
            try (var ps = writer.prepareStatement("UPDATE units SET availability_status='unavailable' WHERE id=?")) {
                ps.setObject(1, u); ps.executeUpdate();
            }
            summary(f, f.org()).andExpect(status().isOk()).andExpect(jsonPath("$.activeProperties").value(1))
                    .andExpect(jsonPath("$.availableUnits").value(1)).andExpect(jsonPath("$.unavailableUnits").value(0));
            writer.commit();
        }
        summary(f, f.org()).andExpect(status().isOk()).andExpect(jsonPath("$.archivedProperties").value(1))
                .andExpect(jsonPath("$.totalUnits").value(1)).andExpect(jsonPath("$.availableUnits").value(0))
                .andExpect(jsonPath("$.unavailableUnits").value(1));
    }
}
