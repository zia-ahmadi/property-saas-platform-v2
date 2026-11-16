package com.propertysaas.propertycore.organization.membership.repository;

import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationMembershipRepository
        extends JpaRepository<OrganizationMembership, UUID> {

        List<OrganizationMembership> findAllByUserIdAndStatus(
        UUID userId,
        MembershipStatus status
);

    List<OrganizationMembership> findAllByUserId(UUID userId);

    Optional<OrganizationMembership> findByOrganizationIdAndUserId(
            UUID organizationId,
            UUID userId
    );

    boolean existsByOrganizationIdAndUserId(
            UUID organizationId,
            UUID userId
    );

List<OrganizationMembership> findAllByOrganizationId(
        UUID organizationId
);

}