
package com.propertysaas.propertycore.property.dto;

import com.propertysaas.propertycore.property.entity.PropertyType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreatePropertyRequest(

        @NotBlank(message = "Property name is required")
        @Size(max = 150)
        String name,

        @NotNull(message = "Property type is required")
        PropertyType propertyType,

        @NotBlank(message = "Address line 1 is required")
        @Size(max = 255)
        String addressLine1,

        @Size(max = 255)
        String addressLine2,

        @NotBlank(message = "City is required")
        @Size(max = 100)
        String city,

        @NotNull(message = "Country code is required")
        @Pattern(
                regexp = "^[A-Z]{2}$",
                message = "Country code must contain exactly two uppercase letters"
        )
        String countryCode

) {
}
