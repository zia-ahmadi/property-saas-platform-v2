
package com.propertysaas.propertycore.organization.permission.service;

import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.organization.permission.RolePermissionMapping;
import com.propertysaas.propertycore.user.entity.UserStatus;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class OrganizationAuthorizationService {

    private final OrganizationMembershipRepository membershipRepository;

    public OrganizationAuthorizationService(
            OrganizationMembershipRepository membershipRepository
    ) {
        this.membershipRepository = membershipRepository;
    }

    @Transactional(readOnly = true)
    public boolean hasPermission(
            UUID userId,
            UUID organizationId,
            OrganizationPermission permission
    ) {
        if (userId == null || organizationId == null || permission == null) {
            return false;
        }

        return membershipRepository
                .findByOrganizationIdAndUserId(organizationId, userId)
                .filter(membership ->
                        membership.getStatus() == MembershipStatus.ACTIVE
                )
                .filter(membership ->
                        membership.getUser().getStatus() == UserStatus.ACTIVE
                )
                .filter(membership ->
                        membership.getOrganization().getStatus()
                                == OrganizationStatus.ACTIVE
                )
                .map(membership ->
                        RolePermissionMapping.hasPermission(
                                membership.getRole(),
                                permission
                        )
                )
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public void requirePermission(
            UUID userId,
            UUID organizationId,
            OrganizationPermission permission
    ) {
        if (!hasPermission(userId, organizationId, permission)) {
            throw new AccessDeniedException(
                    "You do not have permission to perform this action"
            );
        }
    }
}
