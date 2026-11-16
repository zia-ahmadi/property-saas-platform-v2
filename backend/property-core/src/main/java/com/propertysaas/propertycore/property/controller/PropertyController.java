
package com.propertysaas.propertycore.property.controller;

import com.propertysaas.propertycore.common.response.PageResponse;
import com.propertysaas.propertycore.property.dto.CreatePropertyRequest;
import com.propertysaas.propertycore.property.dto.PropertyResponse;
import com.propertysaas.propertycore.property.service.PropertyService;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations/{organizationId}/properties")
public class PropertyController {

    private final PropertyService propertyService;

    public PropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    // ---------------------------------------------------------
    // Create Property
    // ---------------------------------------------------------

    @PostMapping
    public ResponseEntity<PropertyResponse> createProperty(
            @PathVariable UUID organizationId,
            @Valid @RequestBody CreatePropertyRequest request
    ) {
        PropertyResponse response = propertyService.createProperty(
                organizationId,
                request
        );

        URI location = URI.create(
                "/api/v1/organizations/"
                        + organizationId
                        + "/properties/"
                        + response.id()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .location(location)
                .body(response);
    }

    // ---------------------------------------------------------
    // List Properties with Pagination
    // ---------------------------------------------------------

    @GetMapping
    public ResponseEntity<PageResponse<PropertyResponse>> listProperties(
            @PathVariable UUID organizationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Page must be >= 0 and size must be between 1 and 100"
            );
        }

        Page<PropertyResponse> properties = propertyService.listProperties(
                organizationId,
                page,
                size
        );

        return ResponseEntity.ok(PageResponse.from(properties));
    }
    // ---------------------------------------------------------
// Retrieve Property Details
// ---------------------------------------------------------

@GetMapping("/{propertyId}")
public ResponseEntity<PropertyResponse> getProperty(
        @PathVariable UUID organizationId,
        @PathVariable UUID propertyId
) {
    PropertyResponse response = propertyService.getProperty(
            organizationId,
            propertyId
    );

    return ResponseEntity.ok(response);
}
}
