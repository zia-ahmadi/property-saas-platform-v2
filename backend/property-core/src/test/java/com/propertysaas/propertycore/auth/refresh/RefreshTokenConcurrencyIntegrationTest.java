
package com.propertysaas.propertycore.auth.refresh;

import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RefreshTokenConcurrencyIntegrationTest {

    @Autowired
    private RefreshTokenService refreshTokenService;



    @Autowired
    private UserRepository userRepository;

    @Test
    void concurrentRotationAllowsAtMostOneSuccess() throws Exception {

        User user = new User(
                "concurrent-" + UUID.randomUUID() + "@example.com",
                "test-password-hash",
                "Concurrency",
                "Test"
        );

        user = userRepository.save(user);

        UUID userId = user.getId();

        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            String originalToken = refreshTokenService.createToken(user);

            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);

            Callable<String> task = () -> {
                ready.countDown();

                if (!start.await(10, TimeUnit.SECONDS)) {
                    throw new IllegalStateException(
                            "Timed out waiting to start"
                    );
                }

                try {
                    return refreshTokenService.rotateToken(originalToken);
                } catch (AuthenticationException exception) {
                    return null;
                }
            };

            Future<String> first = executor.submit(task);
            Future<String> second = executor.submit(task);

            assertTrue(
                    ready.await(10, TimeUnit.SECONDS),
                    "Both requests should be ready"
            );

            start.countDown();

            String firstResult = first.get(20, TimeUnit.SECONDS);
            String secondResult = second.get(20, TimeUnit.SECONDS);

            long successes = 0;

            if (firstResult != null) {
                successes++;
            }

            if (secondResult != null) {
                successes++;
            }

            assertEquals(
                    1,
                    successes,
                    "Exactly one concurrent rotation should succeed"
            );

            String replacementToken =
                    firstResult != null ? firstResult : secondResult;

            assertNotNull(replacementToken);

            // The second request reused the original token.
            // That must invalidate the replacement token's family.
            assertThrows(
                    AuthenticationException.class,
                    () -> refreshTokenService.rotateToken(replacementToken),
                    "Replacement token must be rejected after reuse detection"
            );

        } finally {
            executor.shutdownNow();

            assertTrue(
                    executor.awaitTermination(10, TimeUnit.SECONDS),
                    "Executor should terminate"
            );

            userRepository.deleteById(userId);
        }
    }
}
