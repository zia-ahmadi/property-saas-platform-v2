package com.example.property_notifications;

import graphql.GraphQLError;
import graphql.schema.DataFetchingEnvironment;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.graphql.data.method.annotation.Argument;
import org.springframework.graphql.data.method.annotation.GraphQlExceptionHandler;
import org.springframework.graphql.data.method.annotation.QueryMapping;
import org.springframework.graphql.data.method.annotation.MutationMapping;
import org.springframework.graphql.data.method.annotation.SubscriptionMapping;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.stereotype.Controller;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import static com.example.property_notifications.CoreNotificationClient.Event;
import static com.example.property_notifications.CoreNotificationClient.Portfolio;
import static com.example.property_notifications.GraphQlSecurity.RequestIdentity;

@Controller
class NotificationQueries {
    private final CoreNotificationClient core;

    NotificationQueries(CoreNotificationClient core) {
        this.core = core;
    }

    @QueryMapping
    Mono<Portfolio> portfolioDashboard(@Argument UUID organizationId, DataFetchingEnvironment env) {
        return core.portfolio(organizationId, identity(env));
    }

    @QueryMapping
    Mono<List<Event>> notifications(@Argument UUID organizationId, @Argument Integer limit, DataFetchingEnvironment env) {
        int pageSize = limit == null ? 20 : limit;
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("Use a limit from 1 to 100.");
        return core.events(organizationId, pageSize, null, identity(env));
    }

    @QueryMapping
    Mono<Long> notificationUnreadCount(@Argument UUID organizationId, DataFetchingEnvironment env) {
        return core.unreadCount(organizationId, identity(env));
    }

    @QueryMapping
    Mono<CoreNotificationClient.SupportFeed> supportNotifications(DataFetchingEnvironment env) {
        return core.support(identity(env));
    }

    @MutationMapping
    Mono<Boolean> markNotificationRead(@Argument UUID organizationId, @Argument String cursor, DataFetchingEnvironment env) {
        validateCursor(cursor);
        return core.markRead(organizationId, cursor, identity(env));
    }

    @SubscriptionMapping
    Flux<Event> notificationEvents(@Argument UUID organizationId, @Argument String after, DataFetchingEnvironment env) {
        if (after != null) validateCursor(after);
        RequestIdentity identity = identity(env);
        Mono<String> start = after == null
                ? core.events(organizationId, 1, null, identity).map(events -> events.isEmpty() ? "0" : events.getFirst().cursor())
                : Mono.just(after);

        return start.flatMapMany(cursor -> {
            var position = new AtomicReference<>(cursor);
            return Flux.defer(() -> core.events(organizationId, 100, position.get(), identity)
                            .flatMapMany(Flux::fromIterable).doOnNext(event -> position.set(event.cursor())))
                    .repeatWhen(polls -> polls.delayElements(Duration.ofSeconds(4)));
        }).take(Duration.ofSeconds(55));
    }

    @GraphQlExceptionHandler
    GraphQLError invalidInput(IllegalArgumentException ex, DataFetchingEnvironment env) {
        return GraphQLError.newError().errorType(ErrorType.BAD_REQUEST).path(env.getExecutionStepInfo().getPath())
                .message("The organization, cursor or result limit is invalid.").build();
    }

    @GraphQlExceptionHandler
    GraphQLError upstream(WebClientResponseException ex, DataFetchingEnvironment env) {
        ErrorType type = switch (ex.getStatusCode().value()) {
            case 401 -> ErrorType.UNAUTHORIZED;
            case 403, 404 -> ErrorType.FORBIDDEN;
            default -> ErrorType.INTERNAL_ERROR;
        };
        String message = type == ErrorType.INTERNAL_ERROR ? "The organization service is unavailable."
                : "Access to this organization data is unavailable.";
        return GraphQLError.newError().errorType(type).path(env.getExecutionStepInfo().getPath()).message(message).build();
    }

    private static void validateCursor(String cursor) {
        if (!cursor.matches("[0-9]{1,19}") || Long.parseLong(cursor) < 0) {
            throw new IllegalArgumentException("Use a valid notification cursor.");
        }
    }

    private static RequestIdentity identity(DataFetchingEnvironment env) {
        return env.getGraphQlContext().get(RequestIdentity.class);
    }
}
