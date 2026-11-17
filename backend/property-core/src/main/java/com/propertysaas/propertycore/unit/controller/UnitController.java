
package com.propertysaas.propertycore.unit.controller;

import com.propertysaas.propertycore.unit.dto.CreateUnitRequest;
import com.propertysaas.propertycore.unit.dto.UnitResponse;
import com.propertysaas.propertycore.unit.service.UnitService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.propertysaas.propertycore.common.response.PageResponse;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

import com.propertysaas.propertycore.unit.dto.UpdateUnitRequest;
import org.springframework.web.bind.annotation.PatchMapping;
import tools.jackson.databind.JsonNode;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping(
        "/api/v1/organizations/{organizationId}/properties/{propertyId}/units"
)
public class UnitController {

    private final UnitService unitService;

    public UnitController(UnitService unitService) {
        this.unitService = unitService;
    }

    // ---------------------------------------------------------
    // Create Unit
    // ---------------------------------------------------------

    @PostMapping
    public ResponseEntity<UnitResponse> createUnit(
            @PathVariable UUID organizationId,
            @PathVariable UUID propertyId,
            @Valid @RequestBody CreateUnitRequest request
    ) {
        UnitResponse response = unitService.createUnit(
                organizationId,
                propertyId,
                request
        );

        URI location = URI.create(
                "/api/v1/organizations/"
                        + organizationId
                        + "/properties/"
                        + propertyId
                        + "/units/"
                        + response.id()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .location(location)
                .body(response);
    }

    // ---------------------------------------------------------
    // List Units with Pagination
    // ---------------------------------------------------------

    @GetMapping
    public ResponseEntity<PageResponse<UnitResponse>> listUnits(
            @PathVariable UUID organizationId,
            @PathVariable UUID propertyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Page must be >= 0 and size must be between 1 and 100"
            );
        }

        Page<UnitResponse> units = unitService.listUnits(
                organizationId,
                propertyId,
                page,
                size
        );

        return ResponseEntity.ok(PageResponse.from(units));
    }

    // ---------------------------------------------------------
    // Retrieve Unit Details
    // ---------------------------------------------------------

    @GetMapping("/{unitId}")
    public ResponseEntity<UnitResponse> getUnitDetails(
            @PathVariable UUID organizationId,
            @PathVariable UUID propertyId,
            @PathVariable UUID unitId
    ) {
        UnitResponse response = unitService.getUnitDetails(
                organizationId,
                propertyId,
                unitId
        );

        return ResponseEntity.ok(response);
    }


    // ---------------------------------------------------------
    // Update Unit
    // ---------------------------------------------------------

    @PatchMapping("/{unitId}")
    public ResponseEntity<UnitResponse> updateUnit(
            @PathVariable UUID organizationId,
            @PathVariable UUID propertyId,
            @PathVariable UUID unitId,
            @RequestBody JsonNode changes
    ) {
        UnitResponse response = unitService.updateUnit(
                organizationId,
                propertyId,
                unitId,
                new UpdateUnitRequest(changes)
        );

        return ResponseEntity.ok(response);
    }



}
