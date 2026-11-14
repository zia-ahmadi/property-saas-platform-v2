package com.propertysaas.propertycore.auth.dto;

import java.util.UUID;

public record OrganizationMembershipResponse(
        UUID organizationId,
        String organizationName,
        String organizationSlug,
        String role
) {
}