
package com.propertysaas.propertycore.user.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import jakarta.validation.ConstraintViolation;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class UserRegistrationRequestTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    void shouldRejectInvalidRegistrationData() {
        UserRegistrationRequest request =
                new UserRegistrationRequest(
                        "invalid-email",
                        " ",
                        "A".repeat(101)
                );

        Set<ConstraintViolation<UserRegistrationRequest>> violations =
                validator.validate(request);

        assertFalse(violations.isEmpty());

        assertTrue(violations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().equals("email")));

        assertTrue(violations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().equals("firstName")));

        assertTrue(violations.stream()
                .anyMatch(v -> v.getPropertyPath().toString().equals("lastName")));
    }

    @Test
    void shouldAcceptValidRegistrationData() {
        UserRegistrationRequest request =
                new UserRegistrationRequest(
                        "user@example.com",
                        "Mohammad",
                        "Ahmadi"
                );

        Set<ConstraintViolation<UserRegistrationRequest>> violations =
                validator.validate(request);

        assertTrue(violations.isEmpty());
    }
}
