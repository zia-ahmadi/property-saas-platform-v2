
package com.propertysaas.propertycore.auth.dto;

public record RefreshTokenResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn
) {
}
