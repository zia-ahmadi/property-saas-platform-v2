package com.propertysaas.propertycore.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OrganizationRenameRequest(
        @NotBlank @Size(max = 150) String name,
        @NotBlank @Size(max = 150) String expectedName
) {}
