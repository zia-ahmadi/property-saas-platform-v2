
package com.propertysaas.propertycore.auth;

import com.propertysaas.propertycore.auth.controller.AuthController;
import com.propertysaas.propertycore.auth.dto.RefreshTokenRequest;
import com.propertysaas.propertycore.auth.dto.RefreshTokenResponse;
import com.propertysaas.propertycore.auth.service.AuthenticationService;

import com.propertysaas.propertycore.common.exception.AuthenticationException;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

class AuthControllerTest {

    @Test
    void refreshShouldReturnNewTokens() {
        AuthenticationService authenticationService =
                mock(AuthenticationService.class);

        AuthController controller =
                new AuthController(authenticationService);

        RefreshTokenRequest request =
                new RefreshTokenRequest("old-refresh-token");

        RefreshTokenResponse expectedResponse =
                new RefreshTokenResponse(
                        "new-access-token",
                        "new-refresh-token",
                        "Bearer",
                        900L
                );

        when(authenticationService.refresh(request))
                .thenReturn(expectedResponse);

        ResponseEntity<RefreshTokenResponse> response =
                controller.refresh(request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(expectedResponse, response.getBody());

        verify(authenticationService).refresh(request);
    }


@Test
void refreshShouldRejectInvalidToken() {
    AuthenticationService authenticationService =
            mock(AuthenticationService.class);

    AuthController controller =
            new AuthController(authenticationService);

    RefreshTokenRequest request =
            new RefreshTokenRequest("invalid-refresh-token");

    when(authenticationService.refresh(request))
            .thenThrow(
                    new AuthenticationException("Invalid refresh token")
            );

    org.junit.jupiter.api.Assertions.assertThrows(
            AuthenticationException.class,
            () -> controller.refresh(request)
    );

    verify(authenticationService).refresh(request);
}

}
