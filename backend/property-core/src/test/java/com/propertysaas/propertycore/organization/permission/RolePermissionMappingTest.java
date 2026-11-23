
package com.propertysaas.propertycore.organization.permission;

import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class RolePermissionMappingTest {

    @Test
    void ownerShouldHaveAllPermissions() {
        Set<OrganizationPermission> permissions =
                RolePermissionMapping.getPermissions(MembershipRole.OWNER);

        assertEquals(
                Set.of(OrganizationPermission.values()),
                permissions
        );
    }

    @Test
    void adminShouldNotHaveMembershipManagementPermission() {
        assertFalse(
                RolePermissionMapping.hasPermission(
                        MembershipRole.ADMIN,
                        OrganizationPermission.MEMBERSHIP_MANAGE
                )
        );
    }

    @Test
    void onlyOwnerShouldManageMemberships() {
        for (MembershipRole role : MembershipRole.values()) {
            assertEquals(role == MembershipRole.OWNER,
                    RolePermissionMapping.hasPermission(role, OrganizationPermission.MEMBERSHIP_MANAGE));
        }
    }

    @Test
    void managerShouldManagePropertiesButNotBilling() {
        assertTrue(
                RolePermissionMapping.hasPermission(
                        MembershipRole.MANAGER,
                        OrganizationPermission.PROPERTY_MANAGE
                )
        );

        assertFalse(
                RolePermissionMapping.hasPermission(
                        MembershipRole.MANAGER,
                        OrganizationPermission.BILLING_MANAGE
                )
        );
    }

    @Test
    void staffShouldViewPropertiesButNotManageThem() {
        assertTrue(
                RolePermissionMapping.hasPermission(
                        MembershipRole.STAFF,
                        OrganizationPermission.PROPERTY_VIEW
                )
        );

        assertFalse(
                RolePermissionMapping.hasPermission(
                        MembershipRole.STAFF,
                        OrganizationPermission.PROPERTY_MANAGE
                )
        );
    }

    @Test
    void nullRoleShouldHaveNoPermissions() {
        assertTrue(
                RolePermissionMapping.getPermissions(null).isEmpty()
        );
    }

    @Test
    void returnedPermissionsShouldBeImmutable() {
        Set<OrganizationPermission> permissions =
                RolePermissionMapping.getPermissions(MembershipRole.STAFF);

        assertThrows(
                UnsupportedOperationException.class,
                () -> permissions.add(OrganizationPermission.BILLING_MANAGE)
        );
    }
}
