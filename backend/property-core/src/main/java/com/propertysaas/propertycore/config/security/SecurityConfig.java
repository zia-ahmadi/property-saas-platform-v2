package com.propertysaas.propertycore.config.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import com.propertysaas.propertycore.config.security.browser.BrowserSecurityFilter;
import com.propertysaas.propertycore.config.security.browser.BrowserSecurity;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, BrowserSecurity browserSecurity,
                                                    CorsConfigurationSource corsConfigurationSource)
            throws Exception {

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf.disable())
                // Run before Spring's CorsFilter: the CORS layer trims trailing
                // slashes and would short-circuit a matching preflight with 200
                // before this filter could reject an inexact Origin.
                .addFilterBefore(new BrowserSecurityFilter(browserSecurity), CorsFilter.class)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/v1/users/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh"
                        ).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/browser-auth/csrf").permitAll()
                        // Container/orchestrator readiness probe. Only the
                        // status is exposed (show-details defaults to never).
                        .requestMatchers(HttpMethod.GET, "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/browser-auth/login", "/api/v1/browser-auth/refresh", "/api/v1/browser-auth/logout").permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .bearerTokenResolver(request -> {
                            if ("POST".equals(request.getMethod()) &&
                                    (request.getContextPath() + "/api/v1/browser-auth/logout").equals(request.getRequestURI())) return null;
                            return new DefaultBearerTokenResolver().resolve(request);
                        })
                        .jwt(jwt -> {})
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
