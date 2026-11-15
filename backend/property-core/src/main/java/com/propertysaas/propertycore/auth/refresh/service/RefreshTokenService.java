
package com.propertysaas.propertycore.auth.refresh.service;

import com.propertysaas.propertycore.auth.refresh.dto.RefreshTokenRotationResult;
import com.propertysaas.propertycore.auth.refresh.entity.RefreshToken;
import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenRepository;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.entity.UserStatus;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final SecureRandom secureRandom = new SecureRandom();
    private final long refreshTokenExpiration;

    public RefreshTokenService(
            RefreshTokenRepository refreshTokenRepository,
            @Value("${app.jwt.refresh-token-expiration}")
            long refreshTokenExpiration
    ) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTokenExpiration = refreshTokenExpiration;
    }

    public String generateToken() {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(StandardCharsets.UTF_8)
            );

            return HexFormat.of().formatHex(hash);

        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(
                    "SHA-256 algorithm is unavailable",
                    exception
            );
        }
    }

    @Transactional
    public String createToken(User user) {
        return createToken(user, UUID.randomUUID());
    }

    @Transactional
    public String createToken(User user, UUID familyId) {
        String rawToken = generateToken();
        String tokenHash = hashToken(rawToken);

        Instant expiresAt = Instant.now()
                .plusSeconds(refreshTokenExpiration);

        RefreshToken refreshToken = new RefreshToken(
                user,
                familyId,
                tokenHash,
                expiresAt
        );

        refreshTokenRepository.save(refreshToken);

        return rawToken;
    }

    @Transactional(readOnly = true)
    public Optional<RefreshToken> findByRawToken(String rawToken) {
        String tokenHash = hashToken(rawToken);

        return refreshTokenRepository.findByTokenHash(tokenHash);
    }

    @Transactional
    public Optional<RefreshToken> findByRawTokenForUpdate(String rawToken) {
        String tokenHash = hashToken(rawToken);

        return refreshTokenRepository.findByTokenHashForUpdate(tokenHash);
    }

    @Transactional(readOnly = true)
    public boolean isValid(RefreshToken token) {
        Instant now = Instant.now();

        return !token.isExpired(now)
                && !token.isRevoked()
                && token.getUser().getStatus() == UserStatus.ACTIVE;
    }

    /**
     * Backward-compatible method for existing callers and tests.
     *
     * Delegates rotation to rotateTokenWithUser().
     */
    @Transactional(noRollbackFor = AuthenticationException.class)
    public String rotateToken(String rawToken) {
        return rotateTokenWithUser(rawToken).refreshToken();
    }

    /**
     * Rotates a refresh token and returns both the user and
     * the replacement refresh token.
     *
     * The original token is locked during rotation.
     *
     * If a revoked token is reused, all tokens in its family
     * are revoked. AuthenticationException does not roll back
     * that revocation.
     */
    @Transactional(noRollbackFor = AuthenticationException.class)
    public RefreshTokenRotationResult rotateTokenWithUser(String rawToken) {

        RefreshToken currentToken = refreshTokenRepository
                .findByTokenHashForUpdate(hashToken(rawToken))
                .orElseThrow(() ->
                        new AuthenticationException("Invalid refresh token")
                );

        Instant now = Instant.now();

        // Detect reuse and revoke the entire token family.
        if (currentToken.isRevoked()) {
            refreshTokenRepository
                    .findAllByFamilyId(currentToken.getFamilyId())
                    .forEach(token -> token.revoke(now));

            throw new AuthenticationException("Invalid refresh token");
        }

        // Reject expired tokens or inactive users.
        if (currentToken.isExpired(now)
                || currentToken.getUser().getStatus() != UserStatus.ACTIVE) {

            throw new AuthenticationException("Invalid refresh token");
        }

        User user = currentToken.getUser();

        // Generate the replacement token.
        String newRawToken = generateToken();

        RefreshToken replacement = new RefreshToken(
                user,
                currentToken.getFamilyId(),
                hashToken(newRawToken),
                now.plusSeconds(refreshTokenExpiration)
        );

        // Persist the replacement before linking it.
        refreshTokenRepository.save(replacement);

        // Revoke the original token and record its replacement.
        currentToken.replaceWith(replacement);

        return new RefreshTokenRotationResult(
                user,
                newRawToken
        );
    }
}
