
package com.propertysaas.propertycore.organization.controller;

import com.propertysaas.propertycore.PropertyCoreApplication;

import org.junit.jupiter.api.Test;

import org.springframework.jdbc.core.JdbcTemplate;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.repository.OrganizationRepository;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PropertyCoreApplication.class)
@AutoConfigureMockMvc
class OrganizationEndpointIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
private JdbcTemplate jdbcTemplate;


@Autowired
private OrganizationRepository organizationRepository;

@Autowired
private UserRepository userRepository;

@Autowired
private OrganizationMembershipRepository membershipRepository;

@Autowired
private TransactionTemplate transactionTemplate;

@Autowired
private JwtEncoder jwtEncoder;

@Value("${app.jwt.issuer}")
private String issuer;


    @Test
    void getOrganizationWithoutJwtShouldReturn401() throws Exception {

        UUID organizationId = UUID.randomUUID();

        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", organizationId)
        )
        .andExpect(status().isUnauthorized());
    }


@Test
void activeOwnerShouldRetrieveOwnOrganization() throws Exception {

    String uniqueId = UUID.randomUUID().toString();

    String email = "org-http-test-" + uniqueId + "@example.com";
    String slug = "org-http-test-" + uniqueId;

    UUID[] ids = new UUID[3];

    try {
        // Create and commit the test organization, user, and membership.
        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository.save(
                    new Organization("Test Property Company", slug)
            );

            User user = userRepository.save(
                    new User(
                            email,
                            "test-password-hash",
                            "Test",
                            "Owner"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organization,
                                    user,
                                    MembershipRole.OWNER
                            )
                    );

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
        });

        // Generate a real HS256 access token.
        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(ids[1].toString())
                .id(UUID.randomUUID().toString())
                .build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();

        // Execute the request through Spring MVC and Spring Security.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[0])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ids[0].toString()))
        .andExpect(jsonPath("$.name").value("Test Property Company"))
        .andExpect(jsonPath("$.slug").value(slug))
        .andExpect(jsonPath("$.status").value("active"));

    } finally {
        // Remove the test records in foreign-key dependency order.
        transactionTemplate.executeWithoutResult(status -> {

            if (ids[2] != null) {
                membershipRepository.deleteById(ids[2]);
            }

            if (ids[1] != null) {
                userRepository.deleteById(ids[1]);
            }

            if (ids[0] != null) {
                organizationRepository.deleteById(ids[0]);
            }
        });
    }
}

@Test
void ownerCannotAccessAnotherOrganization() throws Exception {

    String uniqueId = UUID.randomUUID().toString();

    UUID[] ids = new UUID[4];

    try {
        transactionTemplate.executeWithoutResult(status -> {

            // Organization A: the user's own organization.
            Organization organizationA = organizationRepository.save(
                    new Organization(
                            "Organization A",
                            "organization-a-" + uniqueId
                    )
            );

            // Organization B: a different tenant.
            Organization organizationB = organizationRepository.save(
                    new Organization(
                            "Organization B",
                            "organization-b-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "cross-tenant-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Test",
                            "Owner"
                    )
            );

            // The user belongs ONLY to Organization A.
            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organizationA,
                                    user,
                                    MembershipRole.OWNER
                            )
                    );

            ids[0] = organizationA.getId();
            ids[1] = organizationB.getId();
            ids[2] = user.getId();
            ids[3] = membership.getId();
        });

        // Generate a valid JWT for the user.
        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(ids[2].toString())
                .id(UUID.randomUUID().toString())
                .build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();

        // Attempt to access Organization B.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[1])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isForbidden());

    } finally {
        // Clean up in foreign-key dependency order.
        transactionTemplate.executeWithoutResult(status -> {

            if (ids[3] != null) {
                membershipRepository.deleteById(ids[3]);
            }

            if (ids[2] != null) {
                userRepository.deleteById(ids[2]);
            }

            if (ids[0] != null) {
                organizationRepository.deleteById(ids[0]);
            }

            if (ids[1] != null) {
                organizationRepository.deleteById(ids[1]);
            }
        });
    }
}

@Test
void suspendedMembershipShouldReturn403() throws Exception {

    String uniqueId = UUID.randomUUID().toString();

    UUID[] ids = new UUID[3];

    try {
        // Create an organization, user, and active membership.
        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository.save(
                    new Organization(
                            "Suspended Membership Test",
                            "suspended-membership-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "suspended-member-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Test",
                            "Member"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organization,
                                    user,
                                    MembershipRole.STAFF
                            )
                    );

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
        });

        // Suspend the membership in PostgreSQL.
        jdbcTemplate.update(
                """
                UPDATE organization_memberships
                SET status = 'suspended'
                WHERE id = ?
                """,
                ids[2]
        );

        // Generate a valid JWT for the user.
        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(ids[1].toString())
                .id(UUID.randomUUID().toString())
                .build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();

        // A suspended member must not access the organization.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[0])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isForbidden());

    } finally {
        // Clean up test records in dependency order.
        transactionTemplate.executeWithoutResult(status -> {

            if (ids[2] != null) {
                membershipRepository.deleteById(ids[2]);
            }

            if (ids[1] != null) {
                userRepository.deleteById(ids[1]);
            }

            if (ids[0] != null) {
                organizationRepository.deleteById(ids[0]);
            }
        });
    }
}

@Test
void getOrganizationWithInvalidJwtShouldReturn401()
        throws Exception {

    UUID organizationId = UUID.randomUUID();

    mockMvc.perform(
            get(
                    "/api/v1/organizations/{organizationId}",
                    organizationId
            )
            .header(
                    "Authorization",
                    "Bearer invalid.jwt.token"
            )
    )
    .andExpect(status().isUnauthorized());
}


@Test
void getOrganizationWithExpiredJwtShouldReturn401()
        throws Exception {

    UUID organizationId = UUID.randomUUID();
    UUID userId = UUID.randomUUID();

    // Create a token that expired one hour ago.
    Instant now = Instant.now();

    JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer(issuer)
            .issuedAt(now.minusSeconds(7200))
            .expiresAt(now.minusSeconds(3600))
            .subject(userId.toString())
            .id(UUID.randomUUID().toString())
            .build();

    // Sign the expired token with the application's real JWT encoder.
    String expiredToken = jwtEncoder.encode(
            JwtEncoderParameters.from(
                    JwsHeader.with(MacAlgorithm.HS256).build(),
                    claims
            )
    ).getTokenValue();

    // Spring Security must reject the expired token.
    mockMvc.perform(
            get(
                    "/api/v1/organizations/{organizationId}",
                    organizationId
            )
            .header(
                    "Authorization",
                    "Bearer " + expiredToken
            )
    )
    .andExpect(status().isUnauthorized());
}

@Test
void userWithTwoMembershipsShouldAccessBothOrganizations()
        throws Exception {

    String uniqueId = UUID.randomUUID().toString();
    UUID[] ids = new UUID[5];

    try {
        transactionTemplate.executeWithoutResult(status -> {
            Organization organizationA = organizationRepository.save(
                    new Organization(
                            "Organization A",
                            "multi-org-a-" + uniqueId
                    )
            );

            Organization organizationB = organizationRepository.save(
                    new Organization(
                            "Organization B",
                            "multi-org-b-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "multi-org-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Multi",
                            "Member"
                    )
            );

            OrganizationMembership membershipA =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organizationA,
                                    user,
                                    MembershipRole.OWNER
                            )
                    );

            OrganizationMembership membershipB =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organizationB,
                                    user,
                                    MembershipRole.STAFF
                            )
                    );

            ids[0] = organizationA.getId();
            ids[1] = organizationB.getId();
            ids[2] = user.getId();
            ids[3] = membershipA.getId();
            ids[4] = membershipB.getId();
        });

        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(ids[2].toString())
                .id(UUID.randomUUID().toString())
                .build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();

        // OWNER can access Organization A.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[0])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ids[0].toString()));

        // STAFF can also view Organization B.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[1])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(ids[1].toString()));

    } finally {
        transactionTemplate.executeWithoutResult(status -> {
            if (ids[3] != null) {
                membershipRepository.deleteById(ids[3]);
            }

            if (ids[4] != null) {
                membershipRepository.deleteById(ids[4]);
            }

            if (ids[2] != null) {
                userRepository.deleteById(ids[2]);
            }

            if (ids[0] != null) {
                organizationRepository.deleteById(ids[0]);
            }

            if (ids[1] != null) {
                organizationRepository.deleteById(ids[1]);
            }
        });
    }
}

@Test
void suspendedUserWithValidJwtShouldReturn403()
        throws Exception {

    String uniqueId = UUID.randomUUID().toString();
    UUID[] ids = new UUID[3];

    try {
        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository.save(
                    new Organization(
                            "Suspended User Organization",
                            "suspended-user-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "suspended-user-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Suspended",
                            "User"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organization,
                                    user,
                                    MembershipRole.OWNER
                            )
                    );

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
        });

        // Generate JWT while the user is active.
        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(ids[1].toString())
                .id(UUID.randomUUID().toString())
                .build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();

        // Suspend the user after JWT issuance.
        jdbcTemplate.update(
                """
                UPDATE users
                SET status = 'suspended'
                WHERE id = ?
                """,
                ids[1]
        );

        // The valid JWT must not bypass account suspension.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[0])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isForbidden());

    } finally {
        transactionTemplate.executeWithoutResult(status -> {

            if (ids[2] != null) {
                membershipRepository.deleteById(ids[2]);
            }

            if (ids[1] != null) {
                userRepository.deleteById(ids[1]);
            }

            if (ids[0] != null) {
                organizationRepository.deleteById(ids[0]);
            }
        });
    }
}

@Test
void suspendedOrganizationShouldReturn403()
        throws Exception {

    String uniqueId = UUID.randomUUID().toString();
    UUID[] ids = new UUID[3];

    try {
        transactionTemplate.executeWithoutResult(status -> {

            Organization organization = organizationRepository.save(
                    new Organization(
                            "Suspended Organization Test",
                            "suspended-org-" + uniqueId
                    )
            );

            User user = userRepository.save(
                    new User(
                            "suspended-org-owner-" + uniqueId + "@example.com",
                            "test-password-hash",
                            "Organization",
                            "Owner"
                    )
            );

            OrganizationMembership membership =
                    membershipRepository.save(
                            new OrganizationMembership(
                                    organization,
                                    user,
                                    MembershipRole.OWNER
                            )
                    );

            ids[0] = organization.getId();
            ids[1] = user.getId();
            ids[2] = membership.getId();
        });

        // Generate a valid JWT while the organization is active.
        Instant now = Instant.now();

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .subject(ids[1].toString())
                .id(UUID.randomUUID().toString())
                .build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims
                )
        ).getTokenValue();

        // Suspend the organization after JWT issuance.
        jdbcTemplate.update(
                """
                UPDATE organizations
                SET status = 'suspended'
                WHERE id = ?
                """,
                ids[0]
        );

        // Even an OWNER must not access a suspended organization.
        mockMvc.perform(
                get("/api/v1/organizations/{organizationId}", ids[0])
                        .header("Authorization", "Bearer " + accessToken)
        )
        .andExpect(status().isForbidden());

    } finally {
        transactionTemplate.executeWithoutResult(status -> {

            if (ids[2] != null) {
                membershipRepository.deleteById(ids[2]);
            }

            if (ids[1] != null) {
                userRepository.deleteById(ids[1]);
            }

            if (ids[0] != null) {
                organizationRepository.deleteById(ids[0]);
            }
        });
    }
}


}
