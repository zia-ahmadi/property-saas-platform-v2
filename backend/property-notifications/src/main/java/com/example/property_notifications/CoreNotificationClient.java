package com.example.property_notifications;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import static com.example.property_notifications.GraphQlSecurity.RequestIdentity;

@Service
class CoreNotificationClient {
    record Event(String cursor, String kind, UUID resourceId, String maintenanceStatus, String occurredAt, boolean unread) {}
    record SupportReply(UUID messageId, UUID organizationId, String organizationName, String occurredAt, boolean unread) {}
    record SupportFeed(List<SupportReply> replies, long unreadCount) {}
    record Portfolio(long totalProperties, long activeProperties, long archivedProperties, long totalUnits,
                     long availableUnits, long unavailableUnits, long occupiedUnits) {}

    private final WebClient client;

    CoreNotificationClient(WebClient.Builder builder, @Value("${app.core-url}") String coreUrl) {
        client = builder.baseUrl(coreUrl).build();
    }

    Mono<List<Event>> events(UUID org, int limit, String after, RequestIdentity identity) {
        return client.get().uri(uri -> {
            var path = uri.path("/api/v1/organizations/{org}/notification-events").queryParam("limit", limit);
            if (after != null) path.queryParam("after", after);
            return path.build(org);
        }).headers(headers -> authorize(headers, identity)).retrieve().bodyToMono(new ParameterizedTypeReference<List<Event>>() {}).timeout(Duration.ofSeconds(5));
    }

    Mono<Long> unreadCount(UUID org, RequestIdentity identity) {
        return client.get().uri("/api/v1/organizations/{org}/notification-events/unread-count", org)
                .headers(headers -> authorize(headers, identity))
                .retrieve().bodyToMono(Long.class).timeout(Duration.ofSeconds(5));
    }

    Mono<Boolean> markRead(UUID org, String cursor, RequestIdentity identity) {
        return client.post().uri("/api/v1/organizations/{org}/notification-events/{cursor}/read", org, cursor)
                .headers(headers -> authorize(headers, identity))
                .retrieve().toBodilessEntity().timeout(Duration.ofSeconds(5)).thenReturn(true);
    }

    Mono<SupportFeed> support(RequestIdentity identity) {
        return client.get().uri("/api/v1/my-support-notifications")
                .headers(headers -> authorize(headers, identity))
                .retrieve().bodyToMono(SupportFeed.class).timeout(Duration.ofSeconds(5));
    }

    Mono<Portfolio> portfolio(UUID org, RequestIdentity identity) {
        return client.get().uri("/api/v1/organizations/{org}/dashboard/summary", org)
                .headers(headers -> authorize(headers, identity)).retrieve().bodyToMono(Portfolio.class).timeout(Duration.ofSeconds(5));
    }
    private static void authorize(org.springframework.http.HttpHeaders headers, RequestIdentity identity) {
        headers.set("Authorization", identity.authorization());
        headers.set("X-Request-Id", identity.requestId());
    }
}
