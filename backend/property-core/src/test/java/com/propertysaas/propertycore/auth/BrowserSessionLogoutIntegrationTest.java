package com.propertysaas.propertycore.auth;

import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.browser.allowed-origins=https://app.example.test", "app.browser.csrf-secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="})
@AutoConfigureMockMvc
class BrowserSessionLogoutIntegrationTest {
    private static final String ORIGIN = "https://app.example.test";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired OrganizationMembershipRepository memberships;
    @Autowired RefreshTokenService refreshTokens;
    @Autowired JwtEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Value("${app.jwt.issuer}") String issuer;

    @Test
    void sessionUsesJwtSubjectAndFiltersMembershipsAndOrganizations() throws Exception {
        User user = user(); User other = user();
        Organization active = org(); Organization inactiveMembership = org(); Organization suspended = org(); Organization otherOrg = org();
        try {
            memberships.save(new OrganizationMembership(active, user, MembershipRole.OWNER));
            OrganizationMembership suspendedMembership = memberships.save(new OrganizationMembership(inactiveMembership, user, MembershipRole.ADMIN));
            memberships.save(new OrganizationMembership(suspended, user, MembershipRole.STAFF));
            memberships.save(new OrganizationMembership(otherOrg, other, MembershipRole.MANAGER));
            jdbc.update("UPDATE organization_memberships SET status='suspended' WHERE id=?", suspendedMembership.getId());
            jdbc.update("UPDATE organizations SET status='suspended' WHERE id=?", suspended.getId());
            mvc.perform(get("/api/v1/browser-auth/session").header("Authorization", "Bearer " + jwt(user.getId(), false))
                            .param("userId", other.getId().toString()))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(user.getId().toString()))
                    .andExpect(jsonPath("$.user.email").value(user.getEmail())).andExpect(jsonPath("$.user.firstName").value("First"))
                    .andExpect(jsonPath("$.user.lastName").value("Last")).andExpect(jsonPath("$.organizations.length()").value(1))
                    .andExpect(jsonPath("$.organizations[0].organizationId").value(active.getId().toString()))
                    .andExpect(jsonPath("$.organizations[0].organizationName").value(active.getName()))
                    .andExpect(jsonPath("$.organizations[0].organizationSlug").value(active.getSlug()))
                    .andExpect(jsonPath("$.organizations[0].role").value("OWNER"))
                    .andExpect(jsonPath("$.user.passwordHash").doesNotExist()).andExpect(jsonPath("$.refreshToken").doesNotExist());
            jdbc.update("UPDATE organization_memberships SET status='suspended' WHERE user_id=?", user.getId());
            mvc.perform(get("/api/v1/browser-auth/session").header("Authorization", "Bearer " + jwt(user.getId(), false)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.organizations.length()").value(0));
            jdbc.update("UPDATE users SET status='suspended' WHERE id=?", user.getId());
            mvc.perform(get("/api/v1/browser-auth/session").header("Authorization", "Bearer " + jwt(user.getId(), false)))
                    .andExpect(status().isUnauthorized());
        } finally {
            users.deleteById(user.getId()); users.deleteById(other.getId());
            organizations.deleteById(active.getId()); organizations.deleteById(inactiveMembership.getId());
            organizations.deleteById(suspended.getId()); organizations.deleteById(otherOrg.getId());
        }
    }

    @Test
    void sessionRejectsMissingInvalidAndDeletedUserTokens() throws Exception {
        mvc.perform(get("/api/v1/browser-auth/session")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/browser-auth/session").header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/browser-auth/session").header("Authorization", "Bearer " + jwt(UUID.randomUUID(), false))).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesOnlyItsFamilyAndClearsCookieEvenWithExpiredBearer() throws Exception {
        User user = user();
        try {
            String token = refreshTokens.createToken(user); String other = refreshTokens.createToken(user);
            var csrf = csrf();
            MvcResult result = mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", ORIGIN)
                            .header("Authorization", "Bearer " + jwt(user.getId(), true)).header("X-CSRF-TOKEN", csrf.token())
                            .cookie(csrf.cookie(), new Cookie("__Host-refresh", token)))
                    .andExpect(status().isNoContent()).andExpect(content().string("")).andReturn();
            String cleared = result.getResponse().getHeader("Set-Cookie");
            assertNotNull(cleared); assertTrue(cleared.startsWith("__Host-refresh="));
            assertTrue(cleared.contains("Max-Age=0")); assertTrue(cleared.contains("Path=/"));
            assertTrue(cleared.contains("Secure")); assertTrue(cleared.contains("HttpOnly"));
            assertTrue(cleared.contains("SameSite=Strict")); assertFalse(cleared.contains("Domain="));
            mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN).header("X-CSRF-TOKEN", csrf.token())
                            .cookie(csrf.cookie(), new Cookie("__Host-refresh", token))).andExpect(status().isUnauthorized());
            mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN).header("X-CSRF-TOKEN", csrf.token())
                            .cookie(csrf.cookie(), new Cookie("__Host-refresh", other))).andExpect(status().isOk());
        } finally { users.deleteById(user.getId()); }
    }

    @Test
    void logoutIsIdempotentAndRequiresOriginAndCsrf() throws Exception {
        var csrf = csrf();
        mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", ORIGIN).header("X-CSRF-TOKEN", csrf.token()).cookie(csrf.cookie()))
                .andExpect(status().isNoContent()).andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("Max-Age=0")));
        mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", ORIGIN).header("X-CSRF-TOKEN", csrf.token())
                        .cookie(csrf.cookie(), new Cookie("__Host-refresh", "invalid"))).andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", ORIGIN).cookie(csrf.cookie())).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", ORIGIN).header("X-CSRF-TOKEN", "invalid").cookie(csrf.cookie())).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/logout").header("X-CSRF-TOKEN", csrf.token()).cookie(csrf.cookie())).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/logout").header("Origin", "https://evil.example").header("X-CSRF-TOKEN", csrf.token()).cookie(csrf.cookie())).andExpect(status().isForbidden());
    }

    private record Csrf(Cookie cookie, String token) { }
    private Csrf csrf() throws Exception {
        var result = mvc.perform(get("/api/v1/browser-auth/csrf")).andExpect(status().isOk()).andReturn();
        return new Csrf(result.getResponse().getCookie("__Host-csrf"), mapper.readTree(result.getResponse().getContentAsString()).get("csrfToken").stringValue());
    }
    private User user() { return users.save(new User(UUID.randomUUID() + "@example.com", "hash", "First", "Last")); }
    private Organization org() { return organizations.save(new Organization("Example", "test-" + UUID.randomUUID())); }
    private String jwt(UUID user, boolean expired) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(issuer).subject(user.toString())
                .issuedAt(now.minusSeconds(expired ? 300 : 1)).expiresAt(now.plusSeconds(expired ? -120 : 600)).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}
