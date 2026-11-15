
package com.propertysaas.propertycore.auth.service;

import com.propertysaas.propertycore.auth.dto.LoginRequest;
import com.propertysaas.propertycore.auth.dto.LoginResponse;
import com.propertysaas.propertycore.auth.dto.OrganizationMembershipResponse;
import com.propertysaas.propertycore.auth.dto.RefreshTokenRequest;
import com.propertysaas.propertycore.auth.dto.RefreshTokenResponse;
import com.propertysaas.propertycore.auth.refresh.service.RefreshTokenService;
import com.propertysaas.propertycore.common.exception.AuthenticationException;
import com.propertysaas.propertycore.organization.entity.Organization;
import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import com.propertysaas.propertycore.organization.membership.entity.MembershipStatus;
import com.propertysaas.propertycore.organization.membership.entity.OrganizationMembership;
import com.propertysaas.propertycore.organization.membership.repository.OrganizationMembershipRepository;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.entity.UserStatus;
import com.propertysaas.propertycore.auth.refresh.dto.RefreshTokenRotationResult;
import com.propertysaas.propertycore.user.repository.UserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class AuthenticationService {

    private final UserRepository userRepository;
    private final OrganizationMembershipRepository membershipRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final RefreshTokenService refreshTokenService;

    private final String issuer;
    private final long accessTokenExpiration;

    public AuthenticationService(
            UserRepository userRepository,
            OrganizationMembershipRepository membershipRepository,
            PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder,
            RefreshTokenService refreshTokenService,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.access-token-expiration}") long accessTokenExpiration
    ) {
        this.userRepository = userRepository;
        this.membershipRepository = membershipRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.refreshTokenService = refreshTokenService;
        this.issuer = issuer;
        this.accessTokenExpiration = accessTokenExpiration;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {

        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new AuthenticationException("Invalid email or password")
                );

        if (user.getStatus() != UserStatus.ACTIVE
                || !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )) {
            throw new AuthenticationException("Invalid email or password");
        }

        // Generate JWT access token.
        String accessToken = generateAccessToken(user);

        // Retrieve active organization memberships.
        List<OrganizationMembershipResponse> organizations =
                membershipRepository.findAllByUserIdAndStatus(
                                user.getId(),
                                MembershipStatus.ACTIVE
                        )
                        .stream()
                        .filter(membership ->
                                membership.getOrganization().getStatus()
                                        == OrganizationStatus.ACTIVE
                        )
                        .map(this::toMembershipResponse)
                        .toList();

        // Create and persist refresh token.
        String refreshToken = refreshTokenService.createToken(user);

        return new LoginResponse(
                accessToken,
                refreshToken,
                "Bearer",
                accessTokenExpiration,
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                organizations
        );
    }
public RefreshTokenResponse refresh(RefreshTokenRequest request) {

    // Validate and rotate the refresh token in one transaction.
    RefreshTokenRotationResult result =
            refreshTokenService.rotateTokenWithUser(
                    request.refreshToken()
            );

    // Generate a new JWT access token for the authenticated user.
    String accessToken = generateAccessToken(result.user());

    return new RefreshTokenResponse(
            accessToken,
            result.refreshToken(),
            "Bearer",
            accessTokenExpiration
    );
}
    private OrganizationMembershipResponse toMembershipResponse(
            OrganizationMembership membership
    ) {
        Organization organization = membership.getOrganization();

        return new OrganizationMembershipResponse(
                organization.getId(),
                organization.getName(),
                organization.getSlug(),
                membership.getRole().name().toLowerCase(Locale.ROOT)
        );
    }

    private String generateAccessToken(User user) {

        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(accessTokenExpiration);

        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(user.getId().toString())
                .id(UUID.randomUUID().toString())
                .build();

        JwsHeader header = JwsHeader
                .with(MacAlgorithm.HS256)
                .build();

        return jwtEncoder.encode(
                JwtEncoderParameters.from(header, claims)
        ).getTokenValue();
    }
}
