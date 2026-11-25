
package com.propertysaas.propertycore.organization.controller;

import com.propertysaas.propertycore.organization.dto.OrganizationRenameRequest;
import com.propertysaas.propertycore.organization.dto.OrganizationResponse;
import jakarta.validation.Valid;
import com.propertysaas.propertycore.organization.service.OrganizationService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(
            OrganizationService organizationService
    ) {
        this.organizationService = organizationService;
    }

    @GetMapping("/{organizationId}")
    public ResponseEntity<OrganizationResponse> getOrganization(
            @PathVariable UUID organizationId
    ) {
        OrganizationResponse response =
                organizationService.getOrganization(organizationId);

        return ResponseEntity.ok(response);
    }
    @PatchMapping("/{organizationId}")
    public OrganizationResponse rename(@PathVariable UUID organizationId,
                                       @Valid @RequestBody OrganizationRenameRequest request) {
        return organizationService.rename(organizationId, request);
    }
}
