
package com.propertysaas.propertycore.organization.context;

import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;

import java.util.Objects;
import java.util.UUID;

public record AuthenticatedOrganizationContext(
        UUID userId,
        UUID organizationId,
        UUID membershipId,
        MembershipRole role
) {
    public AuthenticatedOrganizationContext {
        Objects.requireNonNull(userId, "userId is required");
        Objects.requireNonNull(organizationId, "organizationId is required");
        Objects.requireNonNull(membershipId, "membershipId is required");
        Objects.requireNonNull(role, "role is required");
    }
}
