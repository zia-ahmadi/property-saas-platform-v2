
package com.propertysaas.propertycore.organization.permission;

import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;

import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public final class RolePermissionMapping {

    private static final Map<MembershipRole, Set<OrganizationPermission>>
            ROLE_PERMISSIONS = new EnumMap<>(MembershipRole.class);

    static {
        ROLE_PERMISSIONS.put(
                MembershipRole.OWNER,
                EnumSet.allOf(OrganizationPermission.class)
        );

        ROLE_PERMISSIONS.put(
                MembershipRole.ADMIN,
                EnumSet.of(
                        OrganizationPermission.ORGANIZATION_VIEW,
                        OrganizationPermission.ORGANIZATION_MANAGE,
                        OrganizationPermission.PROPERTY_VIEW,
                        OrganizationPermission.PROPERTY_MANAGE,
                        OrganizationPermission.LEASE_MANAGE,
                        OrganizationPermission.BILLING_MANAGE,
                        OrganizationPermission.MAINTENANCE_MANAGE
                )
        );

        ROLE_PERMISSIONS.put(
                MembershipRole.MANAGER,
                EnumSet.of(
                        OrganizationPermission.ORGANIZATION_VIEW,
                        OrganizationPermission.PROPERTY_VIEW,
                        OrganizationPermission.PROPERTY_MANAGE,
                        OrganizationPermission.LEASE_MANAGE,
                        OrganizationPermission.MAINTENANCE_MANAGE
                )
        );

        ROLE_PERMISSIONS.put(
                MembershipRole.STAFF,
                EnumSet.of(
                        OrganizationPermission.ORGANIZATION_VIEW,
                        OrganizationPermission.PROPERTY_VIEW,
                        OrganizationPermission.MAINTENANCE_MANAGE
                )
        );
    }

    private RolePermissionMapping() {
    }

    public static Set<OrganizationPermission> getPermissions(
            MembershipRole role
    ) {
        Set<OrganizationPermission> permissions = ROLE_PERMISSIONS.get(role);

        if (permissions == null) {
            return Set.of();
        }

        return Set.copyOf(permissions);
    }

    public static boolean hasPermission(
            MembershipRole role,
            OrganizationPermission permission
    ) {
        return getPermissions(role).contains(permission);
    }
}
