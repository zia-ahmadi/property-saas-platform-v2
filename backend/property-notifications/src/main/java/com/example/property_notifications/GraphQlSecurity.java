package com.example.property_notifications;

import graphql.analysis.MaxQueryComplexityInstrumentation;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.server.WebGraphQlInterceptor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.web.server.context.NoOpServerSecurityContextRepository;
import reactor.core.publisher.Mono;

@Configuration
@EnableWebFluxSecurity
class GraphQlSecurity {
    record RequestIdentity(String authorization, String requestId) {}

    @Bean
    SecurityWebFilterChain notificationSecurity(ServerHttpSecurity http,
            @Value("${app.jwt.secret}") String secret, @Value("${app.jwt.issuer}") String issuer) {
        byte[] key = Base64.getDecoder().decode(secret);
        if (key.length < 32) throw new IllegalArgumentException("JWT secret must contain at least 32 bytes");
        var decoder = NimbusReactiveJwtDecoder.withSecretKey(new SecretKeySpec(key, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
        return http.csrf(ServerHttpSecurity.CsrfSpec::disable)
                .securityContextRepository(NoOpServerSecurityContextRepository.getInstance())
                .authorizeExchange(routes -> routes.pathMatchers("/actuator/health").permitAll()
                        .pathMatchers("/actuator/metrics", "/actuator/metrics/**").access((authentication, context) -> {
                            var remote = context.getExchange().getRequest().getRemoteAddress();
                            return Mono.just(new AuthorizationDecision(remote != null && remote.getAddress() != null
                                    && remote.getAddress().isLoopbackAddress()));
                        }).pathMatchers("/api/graphql").authenticated().anyExchange().denyAll())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtDecoder(decoder)))
                .build();
    }

    @Bean
    WebGraphQlInterceptor requestIdentity() {
        return (request, chain) -> {
            String requestId = UUID.randomUUID().toString();
            var identity = new RequestIdentity(request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION), requestId);
            request.configureExecutionInput((input, builder) -> builder.graphQLContext(context ->
                    context.put(RequestIdentity.class, identity)).build());
            return chain.next(request).doOnNext(response -> response.getResponseHeaders().set("X-Request-Id", requestId));
        };
    }

    @Bean
    MaxQueryComplexityInstrumentation queryComplexity() {
        return new MaxQueryComplexityInstrumentation(100);
    }
}
