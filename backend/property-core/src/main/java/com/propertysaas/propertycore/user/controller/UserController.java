package com.propertysaas.propertycore.user.controller;

import com.propertysaas.propertycore.user.dto.UserRegistrationRequest;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    @PostMapping("/validate")
    public ResponseEntity<String> validateRegistration(
            @Valid @RequestBody UserRegistrationRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.OK)
                .body("Registration request is valid.");
    }
}