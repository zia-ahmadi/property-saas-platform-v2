
package com.propertysaas.propertycore.auth.refresh;

import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenRepository;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.support.TransactionTemplate;

import com.propertysaas.propertycore.auth.refresh.entity.RefreshToken;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.user.entity.User;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RefreshTokenReuseIntegrationTest {

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;


@Test
void reusedTokenShouldRevokeEntireFamily() {
    UUID testId = UUID.randomUUID();
    String email = "reuse-test-" + testId + "@example.com";

    try {
        // Create a user and commit the transaction.
        String originalToken = transactionTemplate.execute(status -> {
            User user = userRepository.save(
                    new User(
                            email,
                            "test-password-hash",
                            "Test",
                            "User"
                    )
            );

            return refreshTokenService.createToken(user);
        });

        assertNotNull(originalToken);

        // Rotate the token in a separate transaction.
        String replacementToken =
                refreshTokenService.rotateToken(originalToken);

        assertNotNull(replacementToken);

        // Reusing the original token must fail.
        assertThrows(
                AuthenticationException.class,
                () -> refreshTokenService.rotateToken(originalToken)
        );

        // Check the database in a new transaction.
        transactionTemplate.executeWithoutResult(status -> {
            RefreshToken replacement = refreshTokenRepository
                    .findByTokenHash(
                            refreshTokenService.hashToken(replacementToken)
                    )
                    .orElseThrow();

            assertTrue(
                    replacement.isRevoked(),
                    "Replacement token must be revoked after reuse detection"
            );
        });

    } finally {
    transactionTemplate.executeWithoutResult(status -> {
        userRepository.findByEmailIgnoreCase(email)
                .ifPresent(userRepository::delete);
    });
}
}

}
