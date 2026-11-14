package com.propertysaas.propertycore.user.dto;

import java.util.UUID;

public record UserRegistrationResponse(
        UUID userId,
        UUID organizationId,
        String email,
        String firstName,
        String lastName,
        String organizationName,
        String organizationSlug,
        String role
) {
}