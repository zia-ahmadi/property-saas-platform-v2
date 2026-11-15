
package com.propertysaas.propertycore.auth;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.propertysaas.propertycore.PropertyCoreApplication;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class AuthRefreshEndpointIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void refreshWithBlankTokenShouldReturn400() throws Exception {

        mockMvc.perform(
                post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "refreshToken": ""
                                }
                                """)
        )
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void refreshWithInvalidTokenShouldReturn401() throws Exception {

        mockMvc.perform(
                post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "refreshToken": "invalid-refresh-token"
                                }
                                """)
        )
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.status").value(401))
        .andExpect(
                jsonPath("$.message")
                        .value("Invalid refresh token")
        );
    }

    @Test
    void validRefreshTokenShouldRotateSuccessfully() throws Exception {

        String email = "refresh-http-test-"
                + UUID.randomUUID()
                + "@example.com";

        try {
            // Create and commit a temporary test user.
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

            // Build the JSON request body.
            String requestBody = objectMapper.writeValueAsString(
                    Map.of("refreshToken", originalToken)
            );

            // Send a real HTTP request through MockMvc.
            String responseBody = mockMvc.perform(
                    post("/api/v1/auth/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(requestBody)
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty())
            .andExpect(jsonPath("$.tokenType").value("Bearer"))
            .andReturn()
            .getResponse()
            .getContentAsString();

            // Extract the replacement refresh token.
            JsonNode response = objectMapper.readTree(responseBody);

            String newRefreshToken = response
                    .get("refreshToken")
                    .stringValue();

            assertNotEquals(originalToken, newRefreshToken);

            // Reusing the original token must return HTTP 401.
            mockMvc.perform(
                    post("/api/v1/auth/refresh")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(requestBody)
            )
            .andExpect(status().isUnauthorized());
            // Reusing the old token must revoke the replacement token too.
String replacementRequestBody = objectMapper.writeValueAsString(
        Map.of("refreshToken", newRefreshToken)
);

mockMvc.perform(
        post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(replacementRequestBody)
)
.andExpect(status().isUnauthorized())
.andExpect(jsonPath("$.message").value("Invalid refresh token"));

        } finally {
            // Delete the temporary user and associated refresh tokens.
            transactionTemplate.executeWithoutResult(status -> {
                userRepository.findByEmailIgnoreCase(email)
                        .ifPresent(userRepository::delete);
            });
        }
    }
}
