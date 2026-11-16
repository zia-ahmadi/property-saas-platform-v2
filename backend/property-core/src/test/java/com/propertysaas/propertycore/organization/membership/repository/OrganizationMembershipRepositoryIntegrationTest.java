
package com.propertysaas.propertycore.organization.membership.repository;

import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class OrganizationMembershipRepositoryIntegrationTest {

    @Autowired
    private OrganizationMembershipRepository membershipRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private UserRepository userRepository;

    private Organization organizationA;
    private Organization organizationB;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();

        organizationA = organizationRepository.save(
                new Organization("Organization A", "org-a-" + suffix)
        );

        organizationB = organizationRepository.save(
                new Organization("Organization B", "org-b-" + suffix)
        );

        User userA = userRepository.save(
                new User(
                        "user-a-" + suffix + "@example.com",
                        "test-password-hash",
                        "User",
                        "A"
                )
        );

        User userB = userRepository.save(
                new User(
                        "user-b-" + suffix + "@example.com",
                        "test-password-hash",
                        "User",
                        "B"
                )
        );

        membershipRepository.save(
                new OrganizationMembership(
                        organizationA,
                        userA,
                        MembershipRole.OWNER
                )
        );

        membershipRepository.save(
                new OrganizationMembership(
                        organizationB,
                        userB,
                        MembershipRole.OWNER
                )
        );
    }

    @Test
    void shouldReturnOnlyMembershipsOfOrganizationA() {
        List<OrganizationMembership> memberships =
                membershipRepository.findAllByOrganizationId(
                        organizationA.getId()
                );

        assertEquals(1, memberships.size());

        assertEquals(
                organizationA.getId(),
                memberships.get(0).getOrganization().getId()
        );
    }

    @Test
    void shouldReturnOnlyMembershipsOfOrganizationB() {
        List<OrganizationMembership> memberships =
                membershipRepository.findAllByOrganizationId(
                        organizationB.getId()
                );

        assertEquals(1, memberships.size());

        assertEquals(
                organizationB.getId(),
                memberships.get(0).getOrganization().getId()
        );
    }

    @Test
    void shouldReturnEmptyListForUnknownOrganization() {
        List<OrganizationMembership> memberships =
                membershipRepository.findAllByOrganizationId(
                        UUID.randomUUID()
                );

        assertTrue(memberships.isEmpty());
    }
}
