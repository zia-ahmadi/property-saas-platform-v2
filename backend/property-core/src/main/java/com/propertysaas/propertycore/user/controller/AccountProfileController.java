package com.propertysaas.propertycore.user.controller;

import com.propertysaas.propertycore.user.dto.AccountProfile;
import com.propertysaas.propertycore.user.service.AccountProfileService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/me/profile")
public class AccountProfileController {
    public record Update(@NotBlank @Size(max = 100) String firstName, @NotBlank @Size(max = 100) String lastName) {}

    private final AccountProfileService profiles;

    public AccountProfileController(AccountProfileService profiles) {
        this.profiles = profiles;
    }

    @PutMapping
    public AccountProfile update(@Valid @RequestBody Update update) {
        return profiles.update(update.firstName(), update.lastName());
    }
}
