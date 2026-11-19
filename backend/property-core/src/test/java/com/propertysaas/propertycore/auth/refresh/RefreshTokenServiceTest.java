
package com.propertysaas.propertycore.auth.refresh;

import com.propertysaas.propertycore.auth.refresh.entity.RefreshToken;
import com.propertysaas.propertycore.auth.refresh.dto.RefreshTokenRotationResult;
import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenRepository;
import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenFamilyRepository;
import com.propertysaas.propertycore.auth.refresh.entity.RefreshTokenFamily;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.entity.UserStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class RefreshTokenServiceTest {

    private RefreshTokenRepository repository;
    private RefreshTokenFamilyRepository familyRepository;
    private RefreshTokenService service;
    private User user;

    @BeforeEach
    void setUp() {
        repository = mock(RefreshTokenRepository.class);
        familyRepository = mock(RefreshTokenFamilyRepository.class);
        service = new RefreshTokenService(repository, familyRepository, 604800);

        user = mock(User.class);
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(repository.findFamilyIdByTokenHash(any())).thenAnswer(invocation -> {
            String hash = invocation.getArgument(0);
            return repository.findByTokenHashForUpdate(hash).map(RefreshToken::getFamilyId);
        });
        when(familyRepository.findByIdForUpdate(any())).thenAnswer(invocation ->
                Optional.of(new RefreshTokenFamily(invocation.getArgument(0), user)));
    }

    @Test
    void generateTokenShouldProduceDifferentTokens() {
        String first = service.generateToken();
        String second = service.generateToken();

        assertNotEquals(first, second);
    }

    @Test
    void hashTokenShouldProduceConsistentSha256Hash() {
        String first = service.hashToken("sample-token");
        String second = service.hashToken("sample-token");

        assertEquals(first, second);
        assertEquals(64, first.length());
    }

    @Test
    void createTokenShouldSaveHashedToken() {
        String rawToken = service.createToken(user);

        ArgumentCaptor<RefreshToken> captor =
                ArgumentCaptor.forClass(RefreshToken.class);

        verify(repository).save(captor.capture());

        RefreshToken saved = captor.getValue();

        assertEquals(service.hashToken(rawToken), saved.getTokenHash());
        assertNotEquals(rawToken, saved.getTokenHash());
        assertEquals(user, saved.getUser());
        assertNotNull(saved.getFamilyId());
    }

    @Test
    void rotateTokenShouldReplaceValidToken() {
        UUID familyId = UUID.randomUUID();

        RefreshToken current = new RefreshToken(
                user,
                familyId,
                service.hashToken("old-token"),
                Instant.now().plusSeconds(3600)
        );

        when(repository.findByTokenHashForUpdate(
                service.hashToken("old-token")
        )).thenReturn(Optional.of(current));

        String newToken = service.rotateToken("old-token");

        ArgumentCaptor<RefreshToken> captor =
                ArgumentCaptor.forClass(RefreshToken.class);

        verify(repository).save(captor.capture());

        RefreshToken replacement = captor.getValue();

        assertEquals(familyId, replacement.getFamilyId());
        assertEquals(service.hashToken(newToken), replacement.getTokenHash());
        assertTrue(current.isRevoked());
        assertSame(replacement, current.getReplacedBy());
    }

    @Test
    void rotateTokenWithUserShouldReturnUserAndReplaceValidToken() {
        UUID familyId = UUID.randomUUID();

        RefreshToken current = new RefreshToken(
                user,
                familyId,
                service.hashToken("old-token"),
                Instant.now().plusSeconds(3600)
        );

        when(repository.findByTokenHashForUpdate(
                service.hashToken("old-token")
        )).thenReturn(Optional.of(current));

        RefreshTokenRotationResult result =
                service.rotateTokenWithUser("old-token");

        ArgumentCaptor<RefreshToken> captor =
                ArgumentCaptor.forClass(RefreshToken.class);

        verify(repository).save(captor.capture());

        RefreshToken replacement = captor.getValue();

        assertSame(user, result.user());
        assertEquals(familyId, replacement.getFamilyId());
        assertEquals(
                service.hashToken(result.refreshToken()),
                replacement.getTokenHash()
        );
        assertTrue(current.isRevoked());
        assertSame(replacement, current.getReplacedBy());
    }

    @Test
    void rotateTokenShouldRejectUnknownToken() {
        when(repository.findByTokenHashForUpdate(any()))
                .thenReturn(Optional.empty());

        assertThrows(
                AuthenticationException.class,
                () -> service.rotateToken("unknown-token")
        );

        verify(repository, never()).save(any());
    }

    @Test
    void rotateTokenShouldRejectExpiredToken() {
        RefreshToken expired = new RefreshToken(
                user,
                UUID.randomUUID(),
                service.hashToken("expired-token"),
                Instant.now().minusSeconds(60)
        );

        when(repository.findByTokenHashForUpdate(any()))
                .thenReturn(Optional.of(expired));

        assertThrows(
                AuthenticationException.class,
                () -> service.rotateToken("expired-token")
        );

        verify(repository, never()).save(any());
    }

    @Test
    void rotateTokenShouldRevokeFamilyOnReuse() {
        UUID familyId = UUID.randomUUID();

        RefreshToken reused = new RefreshToken(
                user,
                familyId,
                service.hashToken("reused-token"),
                Instant.now().plusSeconds(3600)
        );
        reused.revoke(Instant.now());

        RefreshToken active = new RefreshToken(
                user,
                familyId,
                service.hashToken("active-token"),
                Instant.now().plusSeconds(3600)
        );

        when(repository.findByTokenHashForUpdate(any()))
                .thenReturn(Optional.of(reused));

        when(repository.findAllByFamilyId(familyId))
                .thenReturn(List.of(reused, active));

        assertThrows(
                AuthenticationException.class,
                () -> service.rotateToken("reused-token")
        );

        assertTrue(active.isRevoked());
        verify(repository).findAllByFamilyId(familyId);
        verify(repository, never()).save(any());
    }

    @Test
    void rotateTokenShouldRejectSuspendedUser() {
        when(user.getStatus()).thenReturn(UserStatus.SUSPENDED);

        RefreshToken token = new RefreshToken(
                user,
                UUID.randomUUID(),
                service.hashToken("suspended-user-token"),
                Instant.now().plusSeconds(3600)
        );

        when(repository.findByTokenHashForUpdate(any()))
                .thenReturn(Optional.of(token));

        assertThrows(
                AuthenticationException.class,
                () -> service.rotateToken("suspended-user-token")
        );

        verify(repository, never()).save(any());
    }
}
