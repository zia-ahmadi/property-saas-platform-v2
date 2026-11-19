package com.propertysaas.propertycore.auth;

import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "app.browser.allowed-origins=https://app.example.test",
        "app.browser.csrf-secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
})
@AutoConfigureMockMvc
class BrowserAuthIntegrationTest {
    private static final String ORIGIN = "https://app.example.test";
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper mapper;

    @Test
    void loginRefreshAndReplayUseSecureCookiesWithoutJsonRefreshToken() throws Exception {
        User user = users.save(new User(UUID.randomUUID() + "@example.com", passwords.encode("password-for-test"), "Test", "User"));
        try {
            MvcResult bootstrap = mvc.perform(get("/api/v1/browser-auth/csrf").header("Origin", ORIGIN))
                    .andExpect(status().isOk()).andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store"))).andReturn();
            Cookie csrfCookie = bootstrap.getResponse().getCookie("__Host-csrf");
            assertNotNull(csrfCookie);
            String csrf = mapper.readTree(bootstrap.getResponse().getContentAsString()).get("csrfToken").stringValue();
            String loginBody = mapper.writeValueAsString(java.util.Map.of("email", user.getEmail(), "password", "password-for-test"));
            MvcResult login = mvc.perform(post("/api/v1/browser-auth/login").header("Origin", ORIGIN)
                            .header("X-CSRF-TOKEN", csrf).cookie(csrfCookie).contentType(MediaType.APPLICATION_JSON).content(loginBody))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.tokenType").value("Bearer")).andExpect(jsonPath("$.refreshToken").doesNotExist()).andReturn();
            String setCookie = login.getResponse().getHeader("Set-Cookie");
            assertNotNull(setCookie);
            assertTrue(setCookie.contains("__Host-refresh=")); assertTrue(setCookie.contains("HttpOnly"));
            assertTrue(setCookie.contains("Secure")); assertTrue(setCookie.contains("SameSite=Strict"));
            assertTrue(setCookie.contains("Path=/")); assertTrue(setCookie.contains("Max-Age=604800"));
            assertFalse(setCookie.contains("Domain="));
            Cookie old = login.getResponse().getCookie("__Host-refresh");
            MvcResult refresh = mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN)
                            .header("X-CSRF-TOKEN", csrf).cookie(csrfCookie, old))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").doesNotExist()).andReturn();
            Cookie replacement = refresh.getResponse().getCookie("__Host-refresh");
            assertNotEquals(old.getValue(), replacement.getValue());
            for (Cookie token : new Cookie[]{old, replacement}) {
                mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN)
                                .header("X-CSRF-TOKEN", csrf).cookie(csrfCookie, token))
                        .andExpect(status().isUnauthorized());
            }
        } finally { users.deleteById(user.getId()); }
    }

    @Test
    void csrfAndOriginFailuresAreRejected() throws Exception {
        MvcResult bootstrap = mvc.perform(get("/api/v1/browser-auth/csrf")).andReturn();
        Cookie cookie = bootstrap.getResponse().getCookie("__Host-csrf");
        String token = mapper.readTree(bootstrap.getResponse().getContentAsString()).get("csrfToken").stringValue();
        for (String origin : new String[]{"null", "https://evil.example", ""}) {
            mvc.perform(post("/api/v1/browser-auth/login").header("Origin", origin).header("X-CSRF-TOKEN", token).cookie(cookie))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/browser-auth/login").header("X-CSRF-TOKEN", token).cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/login").header("Origin", "https://evil.example")
                        .header("Forwarded", "host=app.example.test;proto=https").header("X-Forwarded-Host", "app.example.test")
                        .header("X-CSRF-TOKEN", token).cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/login").header("Origin", ORIGIN).cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN).header("X-CSRF-TOKEN", token)).andExpect(status().isForbidden());
        for (String invalid : new String[]{"invalid", token + "x", expiredToken()}) {
            mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN).header("X-CSRF-TOKEN", invalid)
                            .cookie(new Cookie("__Host-csrf", invalid)))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN).header("X-CSRF-TOKEN", token).cookie(cookie))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN).header("X-CSRF-TOKEN", token)
                        .cookie(cookie, new Cookie("__Host-refresh", "invalid"))).andExpect(status().isUnauthorized());
    }

    @Test
    void corsPreflightAllowsOnlyConfiguredOrigin() throws Exception {
        mvc.perform(options("/api/v1/browser-auth/login").header("Origin", ORIGIN)
                        .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type,x-csrf-token"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", ORIGIN))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/v1/browser-auth/login").header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden());
    }

    @Test
    void rejectsDuplicateOriginsAndAmbiguousOrMismatchedCsrfCookies() throws Exception {
        MvcResult first = mvc.perform(get("/api/v1/browser-auth/csrf")).andExpect(status().isOk()).andReturn();
        MvcResult second = mvc.perform(get("/api/v1/browser-auth/csrf")).andExpect(status().isOk()).andReturn();
        String token = mapper.readTree(first.getResponse().getContentAsString()).get("csrfToken").stringValue();
        Cookie firstCookie = first.getResponse().getCookie("__Host-csrf");
        Cookie secondCookie = second.getResponse().getCookie("__Host-csrf");
        assertNotNull(firstCookie);
        assertNotNull(secondCookie);
        assertNotEquals(firstCookie.getValue(), secondCookie.getValue());
        mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN, ORIGIN)
                        .header("X-CSRF-TOKEN", token).cookie(firstCookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN)
                        .header("X-CSRF-TOKEN", token).cookie(firstCookie, secondCookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/browser-auth/refresh").header("Origin", ORIGIN)
                        .header("X-CSRF-TOKEN", token).cookie(secondCookie)).andExpect(status().isForbidden());
    }

    @Test
    void unsafeMethodsOnFutureBrowserAuthPathsRequireProtection() throws Exception {
        for (String method : new String[]{"POST", "PUT", "PATCH", "DELETE", "OPTIONS"}) {
            mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method), "/api/v1/browser-auth/future")
                            .header("Origin", ORIGIN))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Request rejected"));
        }
        mvc.perform(get("/api/v1/browser-auth/csrf")).andExpect(status().isOk());
        mvc.perform(head("/api/v1/browser-auth/csrf")).andExpect(status().isUnauthorized());
    }

    private String expiredToken() throws Exception {
        String payload = (Instant.now().getEpochSecond() - 7200) + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(Base64.getDecoder().decode("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="), "HmacSHA256"));
        return payload + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.US_ASCII)));
    }
}
