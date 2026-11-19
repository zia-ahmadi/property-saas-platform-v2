package com.propertysaas.propertycore.auth;

import com.propertysaas.propertycore.config.security.browser.BrowserSecurity;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.junit.jupiter.api.Assertions.*;

class BrowserSecurityTest {
    private static final String KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

    @Test
    void developmentCookiesRequireExplicitProfile() {
        MockEnvironment env = new MockEnvironment();
        assertThrows(IllegalArgumentException.class, () -> new BrowserSecurity(KEY, "http://localhost:5173", "development", 604800, env));
        env.setActiveProfiles("production");
        assertThrows(IllegalArgumentException.class, () -> new BrowserSecurity(KEY, "http://localhost:5173", "development", 604800, env));
        env.setActiveProfiles("development");
        BrowserSecurity security = new BrowserSecurity(KEY, "http://localhost:5173", "development", 604800, env);
        String cookie = security.refreshCookie("test").toString();
        assertTrue(cookie.startsWith("dev-refresh="));
        assertTrue(cookie.contains("HttpOnly")); assertTrue(cookie.contains("SameSite=Strict"));
        assertFalse(cookie.contains("Secure")); assertTrue(cookie.contains("Path=/"));
        String cleared = security.clearRefreshCookie().toString();
        assertTrue(cleared.startsWith("dev-refresh=")); assertTrue(cleared.contains("Max-Age=0"));
        assertTrue(cleared.contains("HttpOnly")); assertTrue(cleared.contains("SameSite=Strict"));
        assertTrue(cleared.contains("Path=/")); assertFalse(cleared.contains("Secure"));
    }

    @Test
    void productionRejectsUnsafeConfiguration() {
        MockEnvironment env = new MockEnvironment();
        assertThrows(IllegalArgumentException.class, () -> new BrowserSecurity(KEY, "http://localhost:5173", "production", 604800, env));
        assertThrows(IllegalArgumentException.class, () -> new BrowserSecurity(KEY, "https://*.example.com", "production", 604800, env));
        assertThrows(IllegalArgumentException.class, () -> new BrowserSecurity("dGVzdA==", "https://app.example.com", "production", 604800, env));
    }
}
