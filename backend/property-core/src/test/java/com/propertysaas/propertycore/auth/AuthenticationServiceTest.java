
package com.propertysaas.propertycore.auth;

import com.propertysaas.propertycore.auth.dto.LoginRequest;
import com.propertysaas.propertycore.auth.dto.LoginResponse;
import com.propertysaas.propertycore.auth.dto.OrganizationMembershipResponse;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.auth.service.AuthenticationService;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.repository.UserRepository;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import org.mockito.ArgumentCaptor;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;


import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.membership.entity.MembershipRole;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;

import com.propertysaas.propertycore.user.entity.UserStatus;

import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;


import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AuthenticationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OrganizationMembershipRepository membershipRepository;


    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
        private RefreshTokenService refreshTokenService;

    @Mock
    private JwtEncoder jwtEncoder;

    private AuthenticationService authenticationService;

    private AutoCloseable mocks;


        @BeforeEach
        void setUp() {
        // Initialize all @Mock fields first.
        mocks = MockitoAnnotations.openMocks(this);

        // Configure the refresh-token mock.
        when(refreshTokenService.createToken(any(User.class)))
                .thenReturn("test-refresh-token");

        // Create the service with initialized dependencies.
        authenticationService = new AuthenticationService(
                userRepository,
                membershipRepository,
                passwordEncoder,
                jwtEncoder,
                refreshTokenService,
                "property-core",
                900
        );
        }

@AfterEach
void tearDown() throws Exception {
    mocks.close();
}



    @Test
    void loginShouldReturnAccessTokenWhenCredentialsAreValid() {

        UUID userId = UUID.randomUUID();

        User user = new User(
                "zia.test@example.com",
                "hashed-password",
                "Zia",
                "Ahmadi"
        );

        ReflectionTestUtils.setField(user, "id", userId);

        when(userRepository.findByEmailIgnoreCase("zia.test@example.com"))
                .thenReturn(Optional.of(user));

        when(passwordEncoder.matches(
                "correct-password",
                "hashed-password"
        )).thenReturn(true);

        when(membershipRepository.findAllByUserIdAndStatus(
                userId,
                MembershipStatus.ACTIVE
        )).thenReturn(List.of());

        Jwt jwt = mock(Jwt.class);

        when(jwtEncoder.encode(any(JwtEncoderParameters.class)))
                .thenReturn(jwt);

        when(jwt.getTokenValue())
                .thenReturn("test-access-token");

        LoginResponse response = authenticationService.login(
                new LoginRequest(
                        "ZIA.TEST@example.com",
                        "correct-password"
                )
        );

        assertEquals("test-access-token", response.accessToken());
        assertEquals("test-refresh-token", response.refreshToken());

verify(refreshTokenService).createToken(user);
        assertEquals("Bearer", response.tokenType());
        assertEquals(900, response.expiresIn());
        assertEquals(userId, response.userId());
        assertEquals("zia.test@example.com", response.email());
        assertTrue(response.organizations().isEmpty());

        verify(passwordEncoder).matches(
                "correct-password",
                "hashed-password"
        );

        ArgumentCaptor<JwtEncoderParameters> captor =
        ArgumentCaptor.forClass(JwtEncoderParameters.class);

verify(jwtEncoder).encode(captor.capture());

JwtClaimsSet claims = captor.getValue().getClaims();

assertEquals("property-core", claims.getClaims().get("iss"));
assertEquals(userId.toString(), claims.getSubject());

assertNotNull(claims.getIssuedAt());
assertEquals(
        claims.getIssuedAt().plusSeconds(900),
        claims.getExpiresAt()
);

assertNotNull(claims.getId());
    }
    @Test
void loginShouldReturnActiveOrganizationMemberships() {

    UUID userId = UUID.randomUUID();
    UUID organizationId = UUID.randomUUID();

    User user = new User(
            "zia.test@example.com",
            "hashed-password",
            "Zia",
            "Ahmadi"
    );

    ReflectionTestUtils.setField(user, "id", userId);

    Organization organization = new Organization(
            "Test Property Group",
            "test-property-group"
    );

    ReflectionTestUtils.setField(
            organization,
            "id",
            organizationId
    );

    OrganizationMembership membership = new OrganizationMembership(
            organization,
            user,
            MembershipRole.OWNER
    );

    when(userRepository.findByEmailIgnoreCase("zia.test@example.com"))
            .thenReturn(Optional.of(user));

    when(passwordEncoder.matches(
            "correct-password",
            "hashed-password"
    )).thenReturn(true);

    when(membershipRepository.findAllByUserIdAndStatus(
            userId,
            MembershipStatus.ACTIVE
    )).thenReturn(List.of(membership));

    Jwt jwt = mock(Jwt.class);

    when(jwtEncoder.encode(any(JwtEncoderParameters.class)))
            .thenReturn(jwt);

    when(jwt.getTokenValue())
            .thenReturn("test-access-token");

    LoginResponse response = authenticationService.login(
            new LoginRequest(
                    "zia.test@example.com",
                    "correct-password"
            )
    );

    assertEquals(1, response.organizations().size());

    OrganizationMembershipResponse organizationResponse =
            response.organizations().get(0);

    assertEquals(organizationId, organizationResponse.organizationId());
    assertEquals("Test Property Group", organizationResponse.organizationName());
    assertEquals("test-property-group", organizationResponse.organizationSlug());
    assertEquals("owner", organizationResponse.role());
}
    @Test
void loginShouldExcludeMembershipsOfSuspendedOrganizations() {

    UUID userId = UUID.randomUUID();

    User user = new User(
            "zia.test@example.com",
            "hashed-password",
            "Zia",
            "Ahmadi"
    );

    ReflectionTestUtils.setField(user, "id", userId);

    Organization organization = new Organization(
            "Suspended Property Group",
            "suspended-property-group"
    );

    ReflectionTestUtils.setField(
            organization,
            "status",
            OrganizationStatus.SUSPENDED
    );

    OrganizationMembership membership = new OrganizationMembership(
            organization,
            user,
            MembershipRole.OWNER
    );

    when(userRepository.findByEmailIgnoreCase("zia.test@example.com"))
            .thenReturn(Optional.of(user));

    when(passwordEncoder.matches(
            "correct-password",
            "hashed-password"
    )).thenReturn(true);

    when(membershipRepository.findAllByUserIdAndStatus(
            userId,
            MembershipStatus.ACTIVE
    )).thenReturn(List.of(membership));

    Jwt jwt = mock(Jwt.class);

    when(jwtEncoder.encode(any(JwtEncoderParameters.class)))
            .thenReturn(jwt);

    when(jwt.getTokenValue())
            .thenReturn("test-access-token");

    LoginResponse response = authenticationService.login(
            new LoginRequest(
                    "zia.test@example.com",
                    "correct-password"
            )
    );

    assertTrue(response.organizations().isEmpty());
}
    @Test
void loginShouldThrowExceptionWhenPasswordIsIncorrect() {

    User user = new User(
            "zia.test@example.com",
            "hashed-password",
            "Zia",
            "Ahmadi"
    );

    when(userRepository.findByEmailIgnoreCase("zia.test@example.com"))
            .thenReturn(Optional.of(user));

    when(passwordEncoder.matches(
            "wrong-password",
            "hashed-password"
    )).thenReturn(false);

    assertThrows(
            AuthenticationException.class,
            () -> authenticationService.login(
                    new LoginRequest(
                            "zia.test@example.com",
                            "wrong-password"
                    )
            )
    );

    verify(jwtEncoder, never()).encode(any());
    verify(membershipRepository, never())
            .findAllByUserIdAndStatus(any(), any());
}
@Test
void loginShouldThrowExceptionWhenEmailDoesNotExist() {

    when(userRepository.findByEmailIgnoreCase("unknown@example.com"))
            .thenReturn(Optional.empty());

    assertThrows(
            AuthenticationException.class,
            () -> authenticationService.login(
                    new LoginRequest(
                            "unknown@example.com",
                            "any-password"
                    )
            )
    );

    verify(passwordEncoder, never()).matches(anyString(), anyString());
    verify(jwtEncoder, never()).encode(any());
    verify(membershipRepository, never())
            .findAllByUserIdAndStatus(any(), any());
}
@Test
void loginShouldThrowExceptionWhenUserIsSuspended() {

    User user = new User(
            "zia.test@example.com",
            "hashed-password",
            "Zia",
            "Ahmadi"
    );

    ReflectionTestUtils.setField(
            user,
            "status",
            UserStatus.SUSPENDED
    );

    when(userRepository.findByEmailIgnoreCase("zia.test@example.com"))
            .thenReturn(Optional.of(user));

    assertThrows(
            AuthenticationException.class,
            () -> authenticationService.login(
                    new LoginRequest(
                            "zia.test@example.com",
                            "correct-password"
                    )
            )
    );

    verify(passwordEncoder, never()).matches(anyString(), anyString());
    verify(jwtEncoder, never()).encode(any());
    verify(membershipRepository, never())
            .findAllByUserIdAndStatus(any(), any());
}
}
