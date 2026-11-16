
package com.propertysaas.propertycore.property.validation;

import com.propertysaas.propertycore.property.dto.UpdatePropertyRequest;
import com.propertysaas.propertycore.property.entity.PropertyType;

import tools.jackson.databind.JsonNode;

import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class UpdatePropertyRequestValidator {

    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "name",
            "propertyType",
            "addressLine1",
            "addressLine2",
            "city",
            "countryCode"
    );

    public void validate(UpdatePropertyRequest request) {

        if (request == null || request.changes() == null) {
            throw new IllegalArgumentException(
                    "Update payload is required"
            );
        }

        JsonNode changes = request.changes();

        if (!changes.isObject() || changes.isEmpty()) {
            throw new IllegalArgumentException(
                    "Update payload must be a non-empty JSON object"
            );
        }

        for (var entry : changes.properties()) {

            String field = entry.getKey();
            JsonNode value = entry.getValue();

            if (!ALLOWED_FIELDS.contains(field)) {
                throw new IllegalArgumentException(
                        "Field cannot be updated: " + field
                );
            }

            switch (field) {

                case "name" ->
                        validateRequiredString(value, field, 150);

                case "addressLine1" ->
                        validateRequiredString(value, field, 255);

                case "city" ->
                        validateRequiredString(value, field, 100);

                case "addressLine2" -> {
                    if (!value.isNull()) {
                        validateString(value, field, 255);
                    }
                }

                case "countryCode" -> {
                    validateRequiredString(value, field, 2);

                    if (!value.stringValue().matches("^[A-Z]{2}$")) {
                        throw new IllegalArgumentException(
                                "Country code must contain exactly two uppercase letters"
                        );
                    }
                }

                case "propertyType" -> {
                    if (!value.isString()) {
                        throw new IllegalArgumentException(
                                "propertyType must be a string"
                        );
                    }

                    String type = value.stringValue();

                    try {
                        PropertyType.valueOf(type);
                    } catch (IllegalArgumentException exception) {
                        throw new IllegalArgumentException(
                                "Invalid propertyType: " + type
                        );
                    }
                }

                default -> throw new IllegalArgumentException(
                        "Unsupported property field: " + field
                );
            }
        }
    }

    private void validateRequiredString(
            JsonNode value,
            String field,
            int maxLength
    ) {
        validateString(value, field, maxLength);

        if (value.stringValue().isBlank()) {
            throw new IllegalArgumentException(
                    field + " must not be blank"
            );
        }
    }

    private void validateString(
            JsonNode value,
            String field,
            int maxLength
    ) {
        if (!value.isString()) {
            throw new IllegalArgumentException(
                    field + " must be a string"
            );
        }

        if (value.stringValue().length() > maxLength) {
            throw new IllegalArgumentException(
                    field + " must not exceed " + maxLength + " characters"
            );
        }
    }
}
