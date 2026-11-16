
package com.propertysaas.propertycore.organization.permission.service;

import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.organization.permission.OrganizationPermission;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.entity.UserStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import org.springframework.security.access.AccessDeniedException;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrganizationAuthorizationServiceTest {

    @Mock
    private OrganizationMembershipRepository membershipRepository;

    private OrganizationAuthorizationService authorizationService;

    private UUID userId;
    private UUID organizationId;

    private User user;
    private Organization organization;

    @BeforeEach
    void setUp() {
        authorizationService =
                new OrganizationAuthorizationService(membershipRepository);

        userId = UUID.randomUUID();
        organizationId = UUID.randomUUID();

        user = new User(
                "authorization@example.com",
                "hashed-password",
                "Authorization",
                "Test"
        );

        organization = new Organization(
                "Test Organization",
                "test-organization"
        );
    }

    @Test
    void ownerShouldManageMemberships() {
        mockMembership(MembershipRole.OWNER, MembershipStatus.ACTIVE);

        assertTrue(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.MEMBERSHIP_MANAGE
        ));
    }

    @Test
    void staffShouldNotManageBilling() {
        mockMembership(MembershipRole.STAFF, MembershipStatus.ACTIVE);

        assertFalse(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.BILLING_MANAGE
        ));
    }

    @Test
    void suspendedMembershipShouldBeDenied() {
        mockMembership(MembershipRole.OWNER, MembershipStatus.SUSPENDED);

        assertFalse(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.MEMBERSHIP_MANAGE
        ));
    }

    @Test
    void suspendedUserShouldBeDenied() throws Exception {
        setField(user, "status", UserStatus.SUSPENDED);

        mockMembership(MembershipRole.OWNER, MembershipStatus.ACTIVE);

        assertFalse(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.MEMBERSHIP_MANAGE
        ));
    }

    @Test
    void suspendedOrganizationShouldBeDenied() throws Exception {
        setField(
                organization,
                "status",
                OrganizationStatus.SUSPENDED
        );

        mockMembership(MembershipRole.OWNER, MembershipStatus.ACTIVE);

        assertFalse(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.MEMBERSHIP_MANAGE
        ));
    }

    @Test
    void missingMembershipShouldBeDenied() {
        when(membershipRepository.findByOrganizationIdAndUserId(
                organizationId, userId
        )).thenReturn(Optional.empty());

        assertFalse(authorizationService.hasPermission(
                userId,
                organizationId,
                OrganizationPermission.PROPERTY_VIEW
        ));
    }

    @Test
    void nullArgumentsShouldBeDenied() {
        assertFalse(authorizationService.hasPermission(
                null,
                organizationId,
                OrganizationPermission.PROPERTY_VIEW
        ));

        assertFalse(authorizationService.hasPermission(
                userId,
                null,
                OrganizationPermission.PROPERTY_VIEW
        ));

        assertFalse(authorizationService.hasPermission(
                userId,
                organizationId,
                null
        ));

        verifyNoInteractions(membershipRepository);
    }

    @Test
    void requirePermissionShouldThrowWhenUnauthorized() {
        when(membershipRepository.findByOrganizationIdAndUserId(
                organizationId, userId
        )).thenReturn(Optional.empty());

        assertThrows(
                AccessDeniedException.class,
                () -> authorizationService.requirePermission(
                        userId,
                        organizationId,
                        OrganizationPermission.MEMBERSHIP_MANAGE
                )
        );
    }


@Test
void staffWithoutBillingPermissionShouldBeDenied() {
    mockMembership(
            MembershipRole.STAFF,
            MembershipStatus.ACTIVE
    );

    assertThrows(
            AccessDeniedException.class,
            () -> authorizationService.requirePermission(
                    userId,
                    organizationId,
                    OrganizationPermission.BILLING_MANAGE
            )
    );

    verify(membershipRepository).findByOrganizationIdAndUserId(
            organizationId,
            userId
    );
}


    private void mockMembership(
            MembershipRole role,
            MembershipStatus status
    ) {
        OrganizationMembership membership =
                new OrganizationMembership(organization, user, role);

        try {
            setField(membership, "status", status);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }

        when(membershipRepository.findByOrganizationIdAndUserId(
                organizationId, userId
        )).thenReturn(Optional.of(membership));
    }

    private void setField(
            Object target,
            String fieldName,
            Object value
    ) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
