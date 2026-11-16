
package com.propertysaas.propertycore.organization.context;

import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.entity.UserStatus;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthenticatedOrganizationContextResolver {

    private final AuthenticatedUserService authenticatedUserService;
    private final OrganizationMembershipRepository membershipRepository;

    public AuthenticatedOrganizationContextResolver(
            AuthenticatedUserService authenticatedUserService,
            OrganizationMembershipRepository membershipRepository
    ) {
        this.authenticatedUserService = authenticatedUserService;
        this.membershipRepository = membershipRepository;
    }

    @Transactional(readOnly = true)
    public AuthenticatedOrganizationContext resolve(UUID organizationId) {

        if (organizationId == null) {
            throw new AccessDeniedException(
                    "A valid organization is required"
            );
        }

        UUID userId = authenticatedUserService.getCurrentUserId();

        OrganizationMembership membership = membershipRepository
                .findByOrganizationIdAndUserId(organizationId, userId)
                .orElseThrow(() -> new AccessDeniedException(
                        "Access to this organization is denied"
                ));

        if (membership.getStatus() != MembershipStatus.ACTIVE
                || membership.getUser().getStatus() != UserStatus.ACTIVE
                || membership.getOrganization().getStatus()
                        != OrganizationStatus.ACTIVE) {

            throw new AccessDeniedException(
                    "Access to this organization is denied"
            );
        }

        return new AuthenticatedOrganizationContext(
                userId,
                organizationId,
                membership.getId(),
                membership.getRole()
        );
    }
}
