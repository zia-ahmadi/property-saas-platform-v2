
package com.propertysaas.propertycore.config.security.authentication;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AuthenticatedUserServiceTest {

    private final AuthenticatedUserService service =
            new AuthenticatedUserService();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void validJwtShouldReturnUserId() {
        UUID userId = UUID.randomUUID();

        setJwtAuthentication(userId.toString());

        assertEquals(userId, service.getCurrentUserId());
    }

    @Test
    void missingAuthenticationShouldBeDenied() {
        SecurityContextHolder.clearContext();

        assertThrows(
                AccessDeniedException.class,
                service::getCurrentUserId
        );
    }

    @Test
    void invalidUuidSubjectShouldBeDenied() {
        setJwtAuthentication("invalid-user-id");

        assertThrows(
                AccessDeniedException.class,
                service::getCurrentUserId
        );
    }

    @Test
    void nonJwtAuthenticationShouldBeDenied() {
        var authentication =
                new UsernamePasswordAuthenticationToken(
                        "test-user",
                        null,
                        List.of()
                );

        SecurityContextHolder.getContext()
                .setAuthentication(authentication);

        assertThrows(
                AccessDeniedException.class,
                service::getCurrentUserId
        );
    }

    
private void setJwtAuthentication(String subject) {
    Instant now = Instant.now();

    Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "HS256")
            .subject(subject)
            .issuedAt(now)
            .expiresAt(now.plusSeconds(3600))
            .build();

    JwtAuthenticationToken authentication =
            new JwtAuthenticationToken(
                    jwt,
                    List.of(),
                    subject
            );

    authentication.setAuthenticated(true);

    SecurityContextHolder.getContext()
            .setAuthentication(authentication);
}

}
