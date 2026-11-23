package com.propertysaas.propertycore.maintenance;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class MaintenanceIntegrationTest {
    private static final String URL = "/api/v1/organizations/{organizationId}/maintenance";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtEncoder encoder;
    @Value("${app.jwt.issuer}") String issuer;
    private final List<Fixture> fixtures = new ArrayList<>();
    private final JsonMapper json = new JsonMapper();

    @Test
    void staffCanCreateFindAndResolveRequestsWithVersionChecks() throws Exception {
        var staff = fixture();
        String input = input(staff.property(), staff.unit());
        var created = mvc.perform(post(URL, staff.organization()).header("Authorization", staff.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(input))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.unitNumber").value("1A"))
                .andExpect(jsonPath("$.dueDate").value("2030-06-12"))
                .andExpect(jsonPath("$.reportedBy").value(staff.user().toString()))
                .andReturn().getResponse();
        String id = json.readTree(created.getContentAsString()).get("id").asString();
        mvc.perform(get(URL, staff.organization()).header("Authorization", staff.bearer())
                        .param("search", "SINK").param("priority", "URGENT").param("status", "OPEN")
                        .param("propertyId", staff.property().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(id));
        mvc.perform(get(URL + "/summary", staff.organization()).header("Authorization", staff.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.urgent").value(1));

        String update = """
                {"request":%s,"status":"RESOLVED","resolutionNotes":"Replaced the seal","version":0}
                """.formatted(input);
        mvc.perform(put(URL + "/{id}", staff.organization(), id).header("Authorization", staff.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isOk()).andExpect(jsonPath("$.resolvedAt").isNotEmpty())
                .andExpect(jsonPath("$.version").value(1));
        mvc.perform(put(URL + "/{id}", staff.organization(), id).header("Authorization", staff.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(update))
                .andExpect(status().isConflict());
        mvc.perform(get(URL + "/summary", staff.organization()).header("Authorization", staff.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.urgent").value(0))
                .andExpect(jsonPath("$.resolved").value(1));
    }

    @Test
    void organizationsCannotReadOrUseEachOthersLocationsAndRequests() throws Exception {
        var staff = fixture();
        var other = fixture();
        mvc.perform(get(URL, staff.organization())).andExpect(status().isUnauthorized());
        mvc.perform(get(URL, other.organization()).header("Authorization", staff.bearer()))
                .andExpect(status().isForbidden());
        mvc.perform(post(URL, staff.organization()).header("Authorization", staff.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(input(other.property(), null)))
                .andExpect(status().isBadRequest());
        mvc.perform(post(URL, staff.organization()).header("Authorization", staff.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(input(staff.property(), other.unit())))
                .andExpect(status().isBadRequest());
        var location = mvc.perform(post(URL, other.organization()).header("Authorization", other.bearer())
                        .contentType(MediaType.APPLICATION_JSON).content(input(other.property(), null)))
                .andExpect(status().isCreated()).andReturn().getResponse().getHeader("Location");
        String id = location.substring(location.lastIndexOf('/') + 1);
        mvc.perform(get(URL + "/{id}", staff.organization(), id).header("Authorization", staff.bearer()))
                .andExpect(status().isNotFound());
        mvc.perform(get(URL, staff.organization()).header("Authorization", staff.bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    private String input(UUID property, UUID unit) {
        return """
                {"propertyId":"%s","unitId":%s,"title":"Kitchen sink","description":"Water leaking",
                 "category":"PLUMBING","priority":"URGENT","assignedTo":"Sam","dueDate":"2030-06-12"}
                """.formatted(property, json.writeValueAsString(unit));
    }

    private Fixture fixture() {
        UUID org = UUID.randomUUID(), user = UUID.randomUUID(), property = UUID.randomUUID(), unit = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations(id,name,slug) VALUES (?, 'Maintenance test', ?)", org, "maintenance-" + org);
        jdbc.update("INSERT INTO users(id,email,password_hash,first_name,last_name) VALUES (?,?,'test-hash','Test','Staff')", user, user + "@example.test");
        jdbc.update("INSERT INTO organization_memberships(organization_id,user_id,role) VALUES (?,?,'staff')", org, user);
        jdbc.update("""
                INSERT INTO properties(id,organization_id,name,property_type,address_line1,city,country_code)
                VALUES (?,?,'Test property','house','Test street','Kabul','AF')
                """, property, org);
        jdbc.update("INSERT INTO units(id,property_id,unit_number,unit_type) VALUES (?,?,'1A','apartment')", unit, property);
        Instant now = Instant.now();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),
                JwtClaimsSet.builder().issuer(issuer).subject(user.toString()).issuedAt(now)
                        .expiresAt(now.plusSeconds(600)).build())).getTokenValue();
        var fixture = new Fixture(org, user, property, unit, "Bearer " + token);
        fixtures.add(fixture);
        return fixture;
    }

    @AfterEach
    void cleanup() {
        for (var f : fixtures) {
            jdbc.update("DELETE FROM maintenance_requests WHERE organization_id = ?", f.organization());
            jdbc.update("DELETE FROM units WHERE id = ?", f.unit());
            jdbc.update("DELETE FROM properties WHERE id = ?", f.property());
            jdbc.update("DELETE FROM organization_memberships WHERE organization_id = ?", f.organization());
            jdbc.update("DELETE FROM users WHERE id = ?", f.user());
            jdbc.update("DELETE FROM organizations WHERE id = ?", f.organization());
        }
    }

    private record Fixture(UUID organization, UUID user, UUID property, UUID unit, String bearer) {}
}
