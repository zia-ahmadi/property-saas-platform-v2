package com.propertysaas.propertycore.config.security.browser;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Component
public class BrowserSecurity {
    private static final long CSRF_LIFETIME = 3600;
    private final byte[] key;
    private final Set<String> origins;
    private final boolean development;
    private final long refreshLifetime;
    private final SecureRandom random = new SecureRandom();

    public BrowserSecurity(@Value("${app.browser.csrf-secret}") String secret,
                           @Value("${app.browser.allowed-origins}") String allowedOrigins,
                           @Value("${app.browser.cookie-mode:production}") String mode,
                           @Value("${app.jwt.refresh-token-expiration}") long refreshLifetime,
                           Environment environment) {
        try { key = Base64.getDecoder().decode(secret); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Invalid CSRF signing key encoding"); }
        if (key.length < 32) throw new IllegalArgumentException("CSRF signing key must contain at least 32 bytes");
        if (!mode.equals("production") && !mode.equals("development")) throw new IllegalArgumentException("Invalid browser cookie mode");
        development = mode.equals("development");
        if (development && !Arrays.asList(environment.getActiveProfiles()).contains("development"))
            throw new IllegalArgumentException("Development cookie mode requires the development profile");
        if (refreshLifetime <= 0) throw new IllegalArgumentException("Invalid refresh token lifetime");
        this.refreshLifetime = refreshLifetime;
        Set<String> validated = new HashSet<>();
        for (String origin : allowedOrigins.split(",")) {
            origin = origin.trim();
            try {
                URI uri = URI.create(origin);
                boolean secure = "https".equals(uri.getScheme());
                boolean local = development && "http".equals(uri.getScheme()) &&
                        ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()) || "[::1]".equals(uri.getHost()));
                if ((!secure && !local) || uri.getHost() == null || uri.getUserInfo() != null ||
                        uri.getRawPath() == null || !uri.getRawPath().isEmpty() || uri.getQuery() != null || uri.getFragment() != null ||
                        uri.getPort() > 65535 || origin.contains("*")) throw new IllegalArgumentException();
                validated.add(origin);
            } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Invalid browser allowed origin"); }
        }
        if (validated.isEmpty()) throw new IllegalArgumentException("Browser allowed origins are required");
        origins = Set.copyOf(validated);
    }

    public Set<String> origins() { return origins; }
    public String refreshCookieName() { return development ? "dev-refresh" : "__Host-refresh"; }
    private String csrfCookieName() { return development ? "dev-csrf" : "__Host-csrf"; }

    public ResponseCookie refreshCookie(String token) { return cookie(refreshCookieName(), token, refreshLifetime); }
    public ResponseCookie csrfCookie(String token) { return cookie(csrfCookieName(), token, CSRF_LIFETIME); }
    private ResponseCookie cookie(String name, String value, long age) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(!development).sameSite("Strict")
                .path("/").maxAge(Duration.ofSeconds(age)).build();
    }

    public String newCsrfToken() {
        byte[] nonce = new byte[32]; random.nextBytes(nonce);
        String payload = Instant.now().getEpochSecond() + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);
        return payload + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(sign(payload));
    }

    public boolean validCsrf(HttpServletRequest request) {
        String header = request.getHeader("X-CSRF-TOKEN");
        String cookie = uniqueCookie(request, csrfCookieName());
        if (header == null || cookie == null || header.length() > 256 || cookie.length() > 256 ||
                !MessageDigest.isEqual(header.getBytes(StandardCharsets.UTF_8), cookie.getBytes(StandardCharsets.UTF_8))) return false;
        String[] parts = header.split("\\.", -1);
        if (parts.length != 3) return false;
        try {
            long issued = Long.parseLong(parts[0]);
            long now = Instant.now().getEpochSecond();
            byte[] nonce = Base64.getUrlDecoder().decode(parts[1]);
            byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
            return issued <= now && issued > now - CSRF_LIFETIME && nonce.length == 32 && signature.length == 32 &&
                    MessageDigest.isEqual(sign(parts[0] + "." + parts[1]), signature);
        } catch (IllegalArgumentException e) { return false; }
    }

    private byte[] sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.US_ASCII));
        } catch (java.security.GeneralSecurityException e) { throw new IllegalStateException("CSRF signing unavailable", e); }
    }

    public String uniqueCookie(HttpServletRequest request, String name) {
        String value = null;
        if (request.getCookies() != null) for (Cookie cookie : request.getCookies()) {
            if (name.equals(cookie.getName())) {
                if (value != null) return null;
                value = cookie.getValue();
            }
        }
        return value;
    }
}
