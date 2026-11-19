package com.propertysaas.propertycore.auth.refresh;

import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenFamilyRepository;
import com.propertysaas.propertycore.auth.refresh.repository.RefreshTokenRepository;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RefreshTokenFamilyIntegrationTest {
    @Autowired RefreshTokenService service;
    @Autowired RefreshTokenRepository tokens;
    @Autowired RefreshTokenFamilyRepository families;
    @Autowired UserRepository users;
    @Autowired DataSource dataSource;

    @Test
    void issuanceRotationReplayAndRevocationArePersisted() throws Exception {
        User user = user();
        try {
            String first = service.createToken(user);
            UUID family = tokens.findFamilyIdByTokenHash(service.hashToken(first)).orElseThrow();
            assertFalse(families.findById(family).orElseThrow().isRevoked());
            String second = service.rotateToken(first);
            assertEquals(family, tokens.findFamilyIdByTokenHash(service.hashToken(second)).orElseThrow());
            assertThrows(AuthenticationException.class, () -> service.rotateToken(first));
            assertPersistedRevocation(family, 2);
            assertThrows(AuthenticationException.class, () -> service.rotateToken(second));
            assertPersistedRevocation(family, 2);
        } finally { users.deleteById(user.getId()); }
    }

    @Test
    void oldReplayRacingNewRotationAlwaysRevokesFamily() throws Exception {
        User user = user();
        try {
            String old = service.createToken(user);
            String current = service.rotateToken(old);
            UUID id = tokens.findFamilyIdByTokenHash(service.hashToken(current)).orElseThrow();
            String replacement = race(() -> attemptRotate(old), () -> attemptRotate(current));
            assertPersistedRevocation(id, replacement == null ? 2 : 3);
            if (replacement != null) assertThrows(AuthenticationException.class, () -> service.rotateToken(replacement));
            assertThrows(AuthenticationException.class, () -> service.rotateToken(current));
            assertPersistedRevocation(id, replacement == null ? 2 : 3);
        } finally { users.deleteById(user.getId()); }
    }

    @Test
    void explicitRevocationRacingRotationAlwaysRevokesFamily() throws Exception {
        User user = user();
        try {
            String current = service.createToken(user);
            UUID id = tokens.findFamilyIdByTokenHash(service.hashToken(current)).orElseThrow();
            String replacement = race(() -> { service.revokeFamily(current); return null; }, () -> attemptRotate(current));
            assertPersistedRevocation(id, replacement == null ? 1 : 2);
            if (replacement != null) assertThrows(AuthenticationException.class, () -> service.rotateToken(replacement));
            assertThrows(AuthenticationException.class, () -> service.rotateToken(current));
            assertPersistedRevocation(id, replacement == null ? 1 : 2);
        } finally { users.deleteById(user.getId()); }
    }

    private User user() {
        return users.save(new User(UUID.randomUUID() + "@example.com", "hash", "Test", "User"));
    }

    // JDBC uses a new transaction and cannot return entities from a JPA persistence context.
    private void assertPersistedRevocation(UUID familyId, int expectedTokens) throws Exception {
        try (Connection c = dataSource.getConnection();
             PreparedStatement s = c.prepareStatement("SELECT f.revoked_at, COUNT(t.id), COUNT(t.revoked_at) FROM refresh_token_families f JOIN refresh_tokens t ON t.family_id = f.id WHERE f.id = ? GROUP BY f.id, f.revoked_at")) {
            s.setObject(1, familyId);
            try (ResultSet rs = s.executeQuery()) {
                assertTrue(rs.next());
                assertNotNull(rs.getObject(1));
                assertEquals(expectedTokens, rs.getInt(2));
                assertEquals(expectedTokens, rs.getInt(3));
                assertFalse(rs.next());
            }
        }
    }

    private String attemptRotate(String token) {
        try { return service.rotateToken(token); } catch (AuthenticationException e) { return null; }
    }

    private String race(Callable<String> first, Callable<String> second) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
        try {
            Future<String> a = executor.submit(() -> { ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); return first.call(); });
            Future<String> b = executor.submit(() -> { ready.countDown(); assertTrue(start.await(10, TimeUnit.SECONDS)); return second.call(); });
            assertTrue(ready.await(10, TimeUnit.SECONDS));
            start.countDown();
            assertNull(a.get(20, TimeUnit.SECONDS));
            return b.get(20, TimeUnit.SECONDS);
        } finally {
            executor.shutdownNow();
            assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS));
        }
    }
}
