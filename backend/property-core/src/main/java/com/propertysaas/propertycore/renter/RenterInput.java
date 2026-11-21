package com.propertysaas.propertycore.renter;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenterInput(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @Email @Size(max = 254) String email,
        @Size(max = 50) String phone
) {
    public RenterInput {
        firstName = normalize(firstName);
        lastName = normalize(lastName);
        email = normalize(email);
        phone = normalize(phone);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
