
package com.propertysaas.propertycore.unit.dto;

import com.propertysaas.propertycore.unit.entity.UnitType;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CreateUnitRequest(

        @NotBlank(message = "Unit number is required")
        @Size(max = 50)
        String unitNumber,

        @NotNull(message = "Unit type is required")
        UnitType unitType,

        Integer floorNumber,

        @DecimalMin(
                value = "0.00",
                inclusive = false,
                message = "Unit area must be greater than zero"
        )
        @Digits(
                integer = 10,
                fraction = 2,
                message = "Unit area must have at most 10 integer digits and 2 decimal places"
        )
        BigDecimal areaSqm

) {
}
