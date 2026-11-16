
package com.propertysaas.propertycore.property.dto;

import tools.jackson.databind.JsonNode;

import java.util.Objects;

public record UpdatePropertyRequest(JsonNode changes) {

    public UpdatePropertyRequest {
        Objects.requireNonNull(
                changes,
                "Update payload is required"
        );
    }
}
