
package com.propertysaas.propertycore.user.service;

import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.dto.UserRegistrationRequest;
import com.propertysaas.propertycore.user.dto.UserRegistrationResponse;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;
import com.propertysaas.propertycore.common.exception.ConflictException;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Service
public class UserRegistrationService {

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;

    public UserRegistrationService(
            UserRepository userRepository,
            OrganizationRepository organizationRepository,
            OrganizationMembershipRepository membershipRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserRegistrationResponse register(
            UserRegistrationRequest request
    ) {
        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        String slug = request.organizationSlug()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmailIgnoreCase(email)) {
    throw new ConflictException(
            "An account with this email already exists."
    );
}
 if (organizationRepository.existsBySlug(slug)) {
    throw new ConflictException(
            "This organization slug is already taken."
    );
}

        int passwordBytes = request.password()
                .getBytes(StandardCharsets.UTF_8).length;

        if (passwordBytes > 72) {
            throw new IllegalArgumentException(
                    "Password must not exceed 72 UTF-8 bytes."
            );
        }

        String passwordHash = passwordEncoder.encode(request.password());

        User user = new User(
                email,
                passwordHash,
                request.firstName().trim(),
                request.lastName().trim()
        );

        Organization organization = new Organization(
                request.organizationName().trim(),
                slug
        );

        userRepository.save(user);
        organizationRepository.save(organization);

        OrganizationMembership membership =
                new OrganizationMembership(
                        organization,
                        user,
                        MembershipRole.OWNER
                );

        membershipRepository.save(membership);

        return new UserRegistrationResponse(
                user.getId(),
                organization.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                organization.getName(),
                organization.getSlug(),
                membership.getRole().name()
        );
    }
}
