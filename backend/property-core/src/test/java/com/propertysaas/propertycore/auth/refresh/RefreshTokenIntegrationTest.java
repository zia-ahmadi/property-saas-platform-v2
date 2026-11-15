
package com.propertysaas.propertycore.auth.refresh;

import com.propertysaas.propertycore.auth.refresh.entity.RefreshToken;
import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenRepository;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class RefreshTokenIntegrationTest {

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

@Test
void rotateTokenShouldRevokeOldTokenAndPersistReplacement() {
    User user = userRepository.save(
            new User(
                    "rotation-test-" + UUID.randomUUID() + "@example.com",
                    "test-password-hash",
                    "Test",
                    "User"
            )
    );

    String oldRawToken = refreshTokenService.createToken(user);

    String newRawToken = refreshTokenService.rotateToken(oldRawToken);

    assertNotEquals(oldRawToken, newRawToken);

    RefreshToken oldToken = refreshTokenRepository
            .findByTokenHash(refreshTokenService.hashToken(oldRawToken))
            .orElseThrow();

    RefreshToken newToken = refreshTokenRepository
            .findByTokenHash(refreshTokenService.hashToken(newRawToken))
            .orElseThrow();

    assertTrue(oldToken.isRevoked());
    assertFalse(newToken.isRevoked());
    assertEquals(oldToken.getFamilyId(), newToken.getFamilyId());
    assertEquals(newToken.getId(), oldToken.getReplacedBy().getId());

    refreshTokenRepository.flush();
}

    @Test
    void createTokenShouldPersistOnlyItsHash() {
        String uniqueEmail = "refresh-test-" + UUID.randomUUID()
                + "@example.com";

        User user = userRepository.save(
                new User(
                        uniqueEmail,
                        "test-password-hash",
                        "Test",
                        "User"
                )
        );

        String rawToken = refreshTokenService.createToken(user);
        String tokenHash = refreshTokenService.hashToken(rawToken);

        Optional<RefreshToken> savedToken =
                refreshTokenRepository.findByTokenHash(tokenHash);

        assertTrue(savedToken.isPresent());
        assertEquals(tokenHash, savedToken.get().getTokenHash());
        assertNotEquals(rawToken, savedToken.get().getTokenHash());
        assertEquals(user.getId(), savedToken.get().getUser().getId());
    }
}
