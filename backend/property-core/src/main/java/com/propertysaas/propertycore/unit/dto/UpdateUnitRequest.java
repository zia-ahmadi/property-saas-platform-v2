
package com.propertysaas.propertycore.unit.dto;

import tools.jackson.databind.JsonNode;

import java.util.Objects;

public record UpdateUnitRequest(JsonNode changes) {

    public UpdateUnitRequest {
        Objects.requireNonNull(
                changes,
                "Update payload is required"
        );
    }
}