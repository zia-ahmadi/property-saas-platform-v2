package com.propertysaas.propertycore.user.service;

import com.propertysaas.propertycore.config.security.authentication.AuthenticatedUserService;
import com.propertysaas.propertycore.user.dto.AccountProfile;
import com.propertysaas.propertycore.user.entity.User;
import com.propertysaas.propertycore.user.entity.UserStatus;
import com.propertysaas.propertycore.user.repository.UserRepository;
import java.time.Instant;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountProfileService {
    private final AuthenticatedUserService currentUser;
    private final UserRepository users;

    public AccountProfileService(AuthenticatedUserService currentUser, UserRepository users) {
        this.currentUser = currentUser;
        this.users = users;
    }

    @Transactional
    public AccountProfile update(String firstName, String lastName) {
        if (firstName.indexOf(0) >= 0 || lastName.indexOf(0) >= 0) {
            throw new IllegalArgumentException("Names must contain valid text.");
        }
        var id = currentUser.getCurrentUserId();
        String first = firstName.strip(), last = lastName.strip();
        if (users.updateProfile(id, UserStatus.ACTIVE, first, last, Instant.now()) != 1) {
            throw new AccessDeniedException("The account is unavailable");
        }
        User user = users.findById(id).orElseThrow(() -> new AccessDeniedException("The account is unavailable"));
        return new AccountProfile(id, user.getEmail(), first, last);
    }
}
