package com.propertysaas.propertycore.platform;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PlatformAdministrationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate db;
    @jakarta.persistence.PersistenceContext jakarta.persistence.EntityManager entityManager;
    @Test void reviewAndLiveTenantAccess() throws Exception {
        UUID owner=UUID.randomUUID(), platform=UUID.randomUUID(), org=UUID.randomUUID(), other=UUID.randomUUID();
        for (UUID u : new UUID[]{owner,platform}) db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','User')",u,u+"@example.test");
        for (UUID o : new UUID[]{org,other}) db.update("insert into organizations(id,name,slug) values (?, 'Test',?)",o,o.toString());
        for (UUID o : new UUID[]{org,other}) db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner')",UUID.randomUUID(),o,owner);
        db.update("insert into platform_authorities(user_id,authority) values (?,'PLATFORM_OWNER')",platform);
        var ownerJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(owner.toString()));
        var platformJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(platform.toString()));
        mvc.perform(get("/api/v1/platform/organizations").with(ownerJwt)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/platform/organizations").with(platformJwt)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/platform/organizations/{id}/decisions",org).with(platformJwt).contentType("application/json").content("{\"action\":\"suspend\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/platform/organizations/{id}/decisions",org).with(platformJwt).contentType("application/json").content("{\"action\":\"suspend\",\"reason\":\"review\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/organizations/{id}/renters",org).with(ownerJwt)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/organizations/{id}/renters",other).with(ownerJwt)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/platform/organizations/{id}/decisions",org).with(platformJwt).contentType("application/json").content("{\"action\":\"approve\"}")).andExpect(status().isConflict());
        mvc.perform(post("/api/v1/platform/organizations/{id}/decisions",org).with(platformJwt).contentType("application/json").content("{\"action\":\"reinstate\"}")).andExpect(status().isOk());
        entityManager.clear();
        mvc.perform(get("/api/v1/organizations/{id}/renters",org).with(ownerJwt)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/platform/organizations/{id}/messages",org).with(platformJwt).contentType("application/json").content("{\"body\":\"private\"}")).andExpect(status().isCreated());
        mvc.perform(get("/api/v1/organizations/{id}/inbox",org).with(ownerJwt)).andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("private"));
        mvc.perform(get("/api/v1/organizations/{id}/inbox",other).with(ownerJwt)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void bannedOrganizationCanBeReinstatedWithoutRemovingTenantData() throws Exception {
        UUID owner=UUID.randomUUID(), platform=UUID.randomUUID(), org=UUID.randomUUID();
        for (UUID u : new UUID[]{owner,platform}) db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','User')",u,u+"@example.test");
        db.update("insert into organizations(id,name,slug,status) values (?, 'Retained organization',?,'banned')",org,org.toString());
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner')",UUID.randomUUID(),org,owner);
        db.update("insert into properties(organization_id,name,property_type,address_line1,city,country_code) values (?,'Retained property','apartment','1 Main St','Test City','US')",org);
        db.update("insert into platform_authorities(user_id,authority) values (?,'PLATFORM_OWNER')",platform);
        var platformJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(platform.toString()));

        mvc.perform(post("/api/v1/platform/organizations/{id}/decisions",org).with(platformJwt).contentType("application/json").content("{\"action\":\"reinstate\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("active"));

        assertEquals("active", db.queryForObject("select status from organizations where id=?",String.class,org));
        assertEquals(1, db.queryForObject("select count(*) from organization_memberships where organization_id=?",Integer.class,org));
        assertEquals(1, db.queryForObject("select count(*) from properties where organization_id=?",Integer.class,org));
        assertEquals("banned", db.queryForObject("select previous_status from organization_status_audit where organization_id=? order by created_at desc limit 1",String.class,org));
        assertEquals("active", db.queryForObject("select new_status from organization_status_audit where organization_id=? order by created_at desc limit 1",String.class,org));
    }
    @Test void platformDirectoryIncludesOrganizationContextAndSummaryCounts() throws Exception {
        UUID owner=UUID.randomUUID(), member=UUID.randomUUID(), platform=UUID.randomUUID(), org=UUID.randomUUID();
        for (UUID u : new UUID[]{owner,member,platform}) db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash',?,?)",u,u+"@example.test",u.equals(owner)?"Owner":"Test",u.equals(owner)?"Person":"User");
        db.update("insert into organizations(id,name,slug) values (?, 'Directory test','directory-test')",org);
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner'), (?,?,?,'staff')",UUID.randomUUID(),org,owner,UUID.randomUUID(),org,member);
        db.update("insert into properties(organization_id,name,property_type,address_line1,city,country_code) values (?,'Test property','apartment','1 Main St','Test City','US')",org);
        db.update("insert into platform_authorities(user_id,authority) values (?,'PLATFORM_OWNER')",platform);
        db.update("insert into organization_messages(id,organization_id,sender_user_id,body,direction) values (?,?,?,'Need help','organization_to_platform')",UUID.randomUUID(),org,owner);
        var platformJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(platform.toString()));
        mvc.perform(get("/api/v1/platform/organizations").with(platformJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].owner_first_name").value("Owner"))
                .andExpect(jsonPath("$.content[0].owner_email").value(owner+"@example.test"))
                .andExpect(jsonPath("$.content[0].member_count").value(2))
                .andExpect(jsonPath("$.content[0].property_count").value(1))
                .andExpect(jsonPath("$.content[0].unread_message_count").value(1));
        mvc.perform(get("/api/v1/platform/organizations").param("unreadOnly","true").with(platformJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.content[0].id").value(org.toString()));
        mvc.perform(get("/api/v1/platform/organizations/{id}",org).with(platformJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.member_count").value(2))
                .andExpect(jsonPath("$.property_count").value(1));
        mvc.perform(get("/api/v1/platform/summary").with(platformJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total_organizations").value(1))
                .andExpect(jsonPath("$.active_organizations").value(1))
                .andExpect(jsonPath("$.unread_messages").value(1));
    }
    @Test void invitationsAndLiveRoleChanges() throws Exception {
        UUID owner=UUID.randomUUID(), invited=UUID.randomUUID(), org=UUID.randomUUID();
        for (UUID u : new UUID[]{owner,invited}) db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','User')",u,u+"@example.test");
        db.update("insert into organizations(id,name,slug) values (?, 'Test',?)",org,org.toString());
        UUID membership=UUID.randomUUID();
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner')",membership,org,owner);
        var ownerJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(owner.toString()));
        var invitedJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(invited.toString()));
        String response=mvc.perform(post("/api/v1/organizations/{id}/invitations",org).with(ownerJwt).contentType("application/json").content("{\"email\":\""+invited+"@example.test\",\"role\":\"MANAGER\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String token=response.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
        mvc.perform(post("/api/v1/invitations/accept").with(invitedJwt).contentType("application/json").content("{\"token\":\""+token+"\"}")).andExpect(status().isOk());
        mvc.perform(post("/api/v1/invitations/accept").with(invitedJwt).contentType("application/json").content("{\"token\":\""+token+"\"}")).andExpect(status().isConflict());
        UUID member=db.queryForObject("select id from organization_memberships where organization_id=? and user_id=?",UUID.class,org,invited);
        mvc.perform(post("/api/v1/organizations/{id}/renters",org).with(invitedJwt).contentType("application/json").content("{\"firstName\":\"Test\",\"lastName\":\"Renter\"}")).andExpect(status().isCreated());
        mvc.perform(patch("/api/v1/organizations/{id}/members/{member}",org,member).with(ownerJwt).contentType("application/json").content("{\"role\":\"STAFF\"}")).andExpect(status().isOk());
        entityManager.clear();
        mvc.perform(post("/api/v1/organizations/{id}/renters",org).with(invitedJwt).contentType("application/json").content("{\"firstName\":\"Test\",\"lastName\":\"Renter\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/organizations/{id}/members/{member}",org,membership).with(ownerJwt)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/organizations/{id}/members/{member}",org,member).with(ownerJwt)).andExpect(status().isNoContent());
        entityManager.clear();
        mvc.perform(get("/api/v1/organizations/{id}/renters",org).with(invitedJwt)).andExpect(status().isForbidden());
    }

    @Test void newInvitedAccountJoinsOnlyTheIntendedOrganization() throws Exception {
        UUID owner=UUID.randomUUID(), org=UUID.randomUUID(); String email=UUID.randomUUID()+"@example.test";
        db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','User')",owner,owner+"@example.test");
        db.update("insert into organizations(id,name,slug) values (?, 'Test',?)",org,org.toString());
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner')",UUID.randomUUID(),org,owner);
        var ownerJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(owner.toString()));
        String response=mvc.perform(post("/api/v1/organizations/{id}/invitations",org).with(ownerJwt).contentType("application/json").content("{\"email\":\""+email+"\",\"role\":\"STAFF\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String token=response.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
        Integer before=db.queryForObject("select count(*) from organizations",Integer.class);
        mvc.perform(post("/api/v1/invitations/accept-new").contentType("application/json").content("{\"token\":\""+token+"\",\"email\":\""+email+"\",\"password\":\"secure-password-123\",\"firstName\":\"New\",\"lastName\":\"User\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.organizationId").value(org.toString()));
        assertEquals(before, db.queryForObject("select count(*) from organizations",Integer.class));
        assertEquals(1, db.queryForObject("select count(*) from organization_memberships m join users u on u.id=m.user_id where m.organization_id=? and u.email=? and m.role='staff'",Integer.class,org,email));
        db.update("update organizations set status='suspended' where id=?",org);
        mvc.perform(get("/api/v1/my-organizations/status").with(ownerJwt)).andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("suspended"));
    }

    @Test void restrictedOwnersCanExchangeMessagesWithoutOperationalAccess() throws Exception {
        UUID owner=UUID.randomUUID(), staff=UUID.randomUUID(), platform=UUID.randomUUID(), org=UUID.randomUUID(), other=UUID.randomUUID();
        for (UUID u : new UUID[]{owner,staff,platform}) db.update("insert into users(id,email,password_hash,first_name,last_name) values (?,?, 'hash','Test','User')",u,u+"@example.test");
        for (UUID o : new UUID[]{org,other}) db.update("insert into organizations(id,name,slug) values (?, 'Test',?)",o,o.toString());
        db.update("insert into organization_memberships(id,organization_id,user_id,role) values (?,?,?,'owner'), (?,?,?,'staff')",UUID.randomUUID(),org,owner,UUID.randomUUID(),org,staff);
        db.update("insert into platform_authorities(user_id,authority) values (?,'PLATFORM_OWNER')",platform);
        var ownerJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(owner.toString()));
        var staffJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(staff.toString()));
        var platformJwt=SecurityMockMvcRequestPostProcessors.jwt().jwt(j -> j.subject(platform.toString()));
        for (String status : new String[]{"suspended","banned"}) {
            db.update("update organizations set status=? where id=?",status,org); entityManager.clear();
            String sent=mvc.perform(post("/api/v1/platform/organizations/{id}/messages",org).with(platformJwt).contentType("application/json").content("{\"body\":\"hello\"}")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
            UUID incoming=UUID.fromString(sent.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1"));
            mvc.perform(post("/api/v1/my-organizations/{id}/messages/{message}/read",org,incoming).with(ownerJwt)).andExpect(status().isNoContent());
            mvc.perform(post("/api/v1/my-organizations/{id}/messages/{message}/read",other,incoming).with(ownerJwt)).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/my-organizations/{id}/messages",org).with(ownerJwt)).andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("hello"));
            String reply=mvc.perform(post("/api/v1/my-organizations/{id}/messages",org).with(ownerJwt).contentType("application/json").content("{\"body\":\"please review\"}")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
            UUID outgoing=UUID.fromString(reply.replaceAll(".*\"id\":\"([^\"]+)\".*", "$1"));
            mvc.perform(post("/api/v1/platform/organizations/{id}/messages/{message}/read",org,outgoing).with(platformJwt)).andExpect(status().isNoContent());
            mvc.perform(get("/api/v1/platform/organizations/{id}/messages",org).with(platformJwt)).andExpect(status().isOk()).andExpect(jsonPath("$[*].body", hasItem("please review")));
            mvc.perform(get("/api/v1/organizations/{id}/renters",org).with(ownerJwt)).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/my-organizations/{id}/messages",org).with(staffJwt)).andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/my-organizations/{id}/messages",other).with(ownerJwt)).andExpect(status().isForbidden());
            db.update("delete from organization_messages where organization_id=?",org);
        }
    }

}
