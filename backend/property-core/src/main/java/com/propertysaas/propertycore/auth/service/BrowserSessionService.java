package com.propertysaas.propertycore.auth.service;

import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.entity.UserStatus;
import com.propertysaas.propertycore.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class BrowserSessionService {
    private final AuthenticatedUserService currentUser;
    private final UserRepository users;
    private final OrganizationMembershipRepository memberships;

    public BrowserSessionService(AuthenticatedUserService currentUser, UserRepository users, OrganizationMembershipRepository memberships) {
        this.currentUser = currentUser;
        this.users = users;
        this.memberships = memberships;
    }

    public record UserResponse(UUID id, String email, String firstName, String lastName) { }
    public record MembershipResponse(UUID organizationId, String organizationName, String organizationSlug, MembershipRole role) { }
    public record SessionResponse(UserResponse user, List<MembershipResponse> organizations) { }

    @Transactional(readOnly = true)
    public SessionResponse currentSession() {
        UUID userId;
        try {
            userId = currentUser.getCurrentUserId();
        } catch (AccessDeniedException exception) {
            throw new AuthenticationException("Invalid session");
        }
        var user = users.findById(userId).filter(value -> value.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new AuthenticationException("Invalid session"));
        var organizations = memberships.findAllByUserIdAndStatus(userId, MembershipStatus.ACTIVE).stream()
                .filter(membership -> membership.getOrganization().getStatus() == OrganizationStatus.ACTIVE)
                .map(membership -> new MembershipResponse(membership.getOrganization().getId(),
                        membership.getOrganization().getName(), membership.getOrganization().getSlug(), membership.getRole()))
                .toList();
        return new SessionResponse(new UserResponse(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName()), organizations);
    }
}
