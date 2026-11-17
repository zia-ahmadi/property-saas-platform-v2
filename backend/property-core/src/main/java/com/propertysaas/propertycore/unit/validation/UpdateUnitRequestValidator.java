
package com.propertysaas.propertycore.unit.validation;

import com.propertysaas.propertycore.unit.dto.UpdateUnitRequest;
import com.propertysaas.propertycore.unit.entity.UnitType;

import org.springframework.stereotype.Component;

import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.util.Set;

@Component
public class UpdateUnitRequestValidator {

    private static final Set<String> ALLOWED_FIELDS = Set.of(
            "unitNumber",
            "unitType",
            "floorNumber",
            "areaSqm"
    );

    public void validate(UpdateUnitRequest request) {

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

                case "unitNumber" -> {
                    if (!value.isString()) {
                        throw new IllegalArgumentException(
                                "unitNumber must be a string"
                        );
                    }

                    String number = value.stringValue().trim();

                    if (number.isEmpty() || number.length() > 50) {
                        throw new IllegalArgumentException(
                                "unitNumber must contain between 1 and 50 characters"
                        );
                    }
                }

                case "unitType" -> {
                    if (!value.isString()) {
                        throw new IllegalArgumentException(
                                "unitType must be a string"
                        );
                    }

                    try {
                        UnitType.valueOf(value.stringValue());
                    } catch (IllegalArgumentException exception) {
                        throw new IllegalArgumentException(
                                "Invalid unitType: " + value.stringValue()
                        );
                    }
                }

                case "floorNumber" -> {
                    if (!value.isNull()) {
                        if (!value.isIntegralNumber()
                                || !value.canConvertToInt()) {
                            throw new IllegalArgumentException(
                                    "floorNumber must be an integer or null"
                            );
                        }
                    }
                }

                case "areaSqm" -> {
                    if (!value.isNull()) {

                        if (!value.isNumber()) {
                            throw new IllegalArgumentException(
                                    "areaSqm must be a number or null"
                            );
                        }

                        BigDecimal area =
                                new BigDecimal(value.toString());

                        if (area.compareTo(BigDecimal.ZERO) <= 0) {
                            throw new IllegalArgumentException(
                                    "areaSqm must be greater than zero"
                            );
                        }

                        if (area.scale() > 2
                                || area.precision() - area.scale() > 10) {
                            throw new IllegalArgumentException(
                                    "areaSqm must have at most 10 integer digits and 2 decimal places"
                            );
                        }
                    }
                }

                default -> throw new IllegalArgumentException(
                        "Unsupported unit field: " + field
                );
            }
        }
    }
}
