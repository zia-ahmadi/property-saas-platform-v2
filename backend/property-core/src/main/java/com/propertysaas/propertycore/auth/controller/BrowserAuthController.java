package com.propertysaas.propertycore.auth.controller;

import com.propertysaas.propertycore.auth.dto.LoginRequest;
import com.propertysaas.propertycore.auth.dto.RefreshTokenRequest;
import com.propertysaas.propertycore.auth.service.AuthenticationService;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.config.security.browser.BrowserSecurity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/browser-auth")
public class BrowserAuthController {
    private final AuthenticationService auth;
    private final BrowserSecurity security;
    public BrowserAuthController(AuthenticationService auth, BrowserSecurity security) { this.auth = auth; this.security = security; }
    public record CsrfResponse(String csrfToken) { }
    public record AccessResponse(String accessToken, String tokenType, long expiresIn) { }

    @GetMapping("/csrf")
    public ResponseEntity<CsrfResponse> csrf() {
        String token = security.newCsrfToken();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, security.csrfCookie(token).toString()).body(new CsrfResponse(token));
    }

    @PostMapping("/login")
    public ResponseEntity<AccessResponse> login(@Valid @RequestBody LoginRequest request) {
        var result = auth.login(request);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, security.refreshCookie(result.refreshToken()).toString())
                .body(new AccessResponse(result.accessToken(), result.tokenType(), result.expiresIn()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AccessResponse> refresh(HttpServletRequest request) {
        String token = security.uniqueCookie(request, security.refreshCookieName());
        if (token == null || token.isBlank()) throw new AuthenticationException("Invalid refresh token");
        var result = auth.refresh(new RefreshTokenRequest(token));
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, security.refreshCookie(result.refreshToken()).toString())
                .body(new AccessResponse(result.accessToken(), result.tokenType(), result.expiresIn()));
    }
}
