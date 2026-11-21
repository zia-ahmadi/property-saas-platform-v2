package com.propertysaas.propertycore.renter;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class RenterEndpointIntegrationTest {
    private static final String LIST = "/api/v1/organizations/{org}/renters";
    private static final String ITEM = LIST + "/{id}";
    private static final String INPUT = """
            {"firstName":" Ada ","lastName":"Lovelace","email":"ada@example.test","phone":"+1 555 0100"}
            """;

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    private final List<Member> members = new ArrayList<>();

    @AfterEach
    void cleanup() {
        for (var member : members) {
            jdbc.update("delete from renter_audit_events where organization_id = ?", member.org());
            jdbc.update("delete from renters where organization_id = ?", member.org());
            jdbc.update("delete from organizations where id = ?", member.org());
            jdbc.update("delete from users where id = ?", member.user());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "admin", "manager"})
    void managesRentersAndAuditsChanges(String role) throws Exception {
        var member = member(role);
        var id = create(member, INPUT);
        create(member, """
                {"firstName":"Grace","lastName":"Hopper"}
                """);

        mvc.perform(get(LIST, member.org()).param("size", "1").param("page", "1").with(member.jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(id));
        for (String search : List.of(" ADA love ", "ADA@EXAMPLE", "555")) {
            mvc.perform(get(LIST, member.org()).param("search", search).with(member.jwt()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].firstName").value("Ada"));
        }
        mvc.perform(get(ITEM, member.org(), id).with(member.jwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lastName").value("Lovelace"));
        mvc.perform(patch(ITEM, member.org(), id).with(member.jwt()).contentType("application/json")
                        .content("""
                                {"lastName":"Byron","email":null}
                                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lastName").value("Byron"))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.phone").value("+1 555 0100"));
        for (int attempt = 0; attempt < 2; attempt++) {
            mvc.perform(patch(ITEM + "/archive", member.org(), id).with(member.jwt()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.archivedAt").isNotEmpty());
        }
        mvc.perform(get(ITEM, member.org(), id).with(member.jwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archivedAt").isNotEmpty());
        mvc.perform(get(LIST, member.org()).param("search", "Ada").with(member.jwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(patch(ITEM, member.org(), id).with(member.jwt()).contentType("application/json")
                        .content("{\"lastName\":\"New\"}"))
                .andExpect(status().isConflict());

        assertEquals(List.of("CREATE", "UPDATE", "ARCHIVE"), jdbc.queryForList("""
                select action from renter_audit_events where organization_id = ?
                and renter_id = ? and actor_user_id = ? order by id
                """, String.class, member.org(), UUID.fromString(id), member.user()));
    }

    @Test
    void rejectsInvalidInput() throws Exception {
        var member = member("owner");
        for (String body : List.of("{}", "{\"firstName\":\" \",\"lastName\":\"Doe\"}",
                "{\"firstName\":\"A\",\"lastName\":\"B\",\"email\":\"invalid\"}")) {
            mvc.perform(post(LIST, member.org()).with(member.jwt()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        var id = create(member, INPUT);
        for (String body : List.of("{}", "{\"firstName\":null}", "{\"phone\":123}",
                "{\"email\":\"invalid\"}", "{\"organizationId\":\"foreign\"}",
                "{\"phone\":\"" + "1".repeat(51) + "\"}")) {
            mvc.perform(patch(ITEM, member.org(), id).with(member.jwt())
                            .contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(get(LIST, member.org()).param("size", "101").with(member.jwt()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void limitsStaffToReadAndRequiresAuthentication() throws Exception {
        var member = member("owner");
        var id = create(member, INPUT);
        jdbc.update("update organization_memberships set role = 'staff' where user_id = ?", member.user());

        mvc.perform(get(LIST, member.org())).andExpect(status().isUnauthorized());
        mvc.perform(get(LIST, member.org()).with(member.jwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(ITEM, member.org(), id).with(member.jwt())).andExpect(status().isOk());
        mvc.perform(post(LIST, member.org()).with(member.jwt()).contentType("application/json").content(INPUT))
                .andExpect(status().isForbidden());
        mvc.perform(patch(ITEM, member.org(), id).with(member.jwt()).contentType("application/json").content(INPUT))
                .andExpect(status().isForbidden());
        mvc.perform(patch(ITEM + "/archive", member.org(), id).with(member.jwt()))
                .andExpect(status().isForbidden());
    }

    @Test
    void isolatesOrganizationsForReadsAndWrites() throws Exception {
        var owner = member("owner");
        var other = member("owner");
        var id = create(owner, INPUT);

        mvc.perform(get(LIST, other.org()).with(other.jwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(LIST, owner.org()).with(other.jwt())).andExpect(status().isForbidden());
        mvc.perform(get(ITEM, owner.org(), id).with(other.jwt())).andExpect(status().isForbidden());
        mvc.perform(post(LIST, owner.org()).with(other.jwt()).contentType("application/json").content(INPUT))
                .andExpect(status().isForbidden());
        mvc.perform(get(ITEM, other.org(), id).with(other.jwt())).andExpect(status().isNotFound());
        mvc.perform(patch(ITEM, other.org(), id).with(other.jwt()).contentType("application/json").content(INPUT))
                .andExpect(status().isNotFound());
        mvc.perform(patch(ITEM + "/archive", other.org(), id).with(other.jwt()))
                .andExpect(status().isNotFound());
    }

    private String create(Member member, String input) throws Exception {
        String location = mvc.perform(post(LIST, member.org()).with(member.jwt())
                        .contentType("application/json").content(input))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.organizationId").value(member.org().toString()))
                .andReturn().getResponse().getHeader("Location");
        return location.substring(location.lastIndexOf('/') + 1);
    }

    private Member member(String role) {
        var member = new Member(UUID.randomUUID(), UUID.randomUUID());
        members.add(member);
        jdbc.update("insert into organizations (id, name, slug) values (?, 'Renter test', ?)",
                member.org(), "renter-" + member.org());
        jdbc.update("""
                insert into users (id, email, password_hash, first_name, last_name)
                values (?, ?, 'unused', 'Renter', 'Tester')
                """, member.user(), member.user() + "@example.test");
        jdbc.update("insert into organization_memberships (organization_id, user_id, role) values (?, ?, ?)",
                member.org(), member.user(), role);
        return member;
    }

    private record Member(UUID org, UUID user) {
        RequestPostProcessor jwt() {
            return SecurityMockMvcRequestPostProcessors.jwt().jwt(token -> token.subject(user.toString()));
        }
    }
}
