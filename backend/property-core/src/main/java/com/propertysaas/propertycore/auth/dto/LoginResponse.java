
package com.propertysaas.propertycore.auth.dto;

import java.util.List;
import java.util.UUID;

public record LoginResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        List<OrganizationMembershipResponse> organizations
) {
}
