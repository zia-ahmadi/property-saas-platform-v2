
package com.propertysaas.propertycore.organization.context;

import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.entity.UserStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticatedOrganizationContextResolverTest {

    @Mock
    private AuthenticatedUserService authenticatedUserService;

    @Mock
    private OrganizationMembershipRepository membershipRepository;

    @InjectMocks
    private AuthenticatedOrganizationContextResolver resolver;

    private UUID userId;
    private UUID organizationId;
    private UUID membershipId;

    private User user;
    private Organization organization;
    private OrganizationMembership membership;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        organizationId = UUID.randomUUID();
        membershipId = UUID.randomUUID();

        user = new User(
                "employee@example.com",
                "hashed-password",
                "Test",
                "Employee"
        );

        organization = new Organization(
                "Example Property Company",
                "example-property-company"
        );

        membership = new OrganizationMembership(
                organization,
                user,
                MembershipRole.STAFF
        );

        ReflectionTestUtils.setField(user, "id", userId);
        ReflectionTestUtils.setField(
                organization, "id", organizationId
        );
        ReflectionTestUtils.setField(
                membership, "id", membershipId
        );
    }

    @Test
    void shouldResolveContextForActiveMembership() {
        mockAuthenticatedUser();
        mockMembershipLookup();

        AuthenticatedOrganizationContext context =
                resolver.resolve(organizationId);

        assertEquals(userId, context.userId());
        assertEquals(organizationId, context.organizationId());
        assertEquals(membershipId, context.membershipId());
        assertEquals(MembershipRole.STAFF, context.role());
    }

    @Test
    void shouldRejectMissingMembership() {
        mockAuthenticatedUser();

        when(membershipRepository.findByOrganizationIdAndUserId(
                organizationId, userId
        )).thenReturn(Optional.empty());

        assertThrows(
                AccessDeniedException.class,
                () -> resolver.resolve(organizationId)
        );
    }

    @Test
    void shouldRejectSuspendedMembership() {
        mockAuthenticatedUser();

        ReflectionTestUtils.setField(
                membership, "status", MembershipStatus.SUSPENDED
        );
        mockMembershipLookup();

        assertThrows(
                AccessDeniedException.class,
                () -> resolver.resolve(organizationId)
        );
    }

    @Test
    void shouldRejectInactiveUser() {
        mockAuthenticatedUser();

        ReflectionTestUtils.setField(
                user, "status", UserStatus.SUSPENDED
        );
        mockMembershipLookup();

        assertThrows(
                AccessDeniedException.class,
                () -> resolver.resolve(organizationId)
        );
    }

    @Test
    void shouldRejectInactiveOrganization() {
        mockAuthenticatedUser();

        ReflectionTestUtils.setField(
                organization, "status", OrganizationStatus.SUSPENDED
        );
        mockMembershipLookup();

        assertThrows(
                AccessDeniedException.class,
                () -> resolver.resolve(organizationId)
        );
    }

    @Test
    void shouldRejectNullOrganizationId() {
        assertThrows(
                AccessDeniedException.class,
                () -> resolver.resolve(null)
        );

        verifyNoInteractions(
                authenticatedUserService,
                membershipRepository
        );
    }

    @Test
    void shouldRejectMembershipFromAnotherOrganization() {
        UUID anotherOrganizationId = UUID.randomUUID();

        mockAuthenticatedUser();

        when(membershipRepository.findByOrganizationIdAndUserId(
                anotherOrganizationId, userId
        )).thenReturn(Optional.empty());

        assertThrows(
                AccessDeniedException.class,
                () -> resolver.resolve(anotherOrganizationId)
        );
    }

    private void mockAuthenticatedUser() {
        when(authenticatedUserService.getCurrentUserId())
                .thenReturn(userId);
    }

    private void mockMembershipLookup() {
        when(membershipRepository.findByOrganizationIdAndUserId(
                organizationId, userId
        )).thenReturn(Optional.of(membership));
    }
}
