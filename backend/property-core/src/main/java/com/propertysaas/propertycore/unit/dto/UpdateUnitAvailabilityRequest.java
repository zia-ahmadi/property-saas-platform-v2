package com.propertysaas.propertycore.unit.dto;

import com.propertysaas.propertycore.unit.entity.UnitAvailabilityStatus;

import jakarta.validation.constraints.NotNull;

public record UpdateUnitAvailabilityRequest(

        @NotNull(message = "Availability status is required")
        UnitAvailabilityStatus availabilityStatus

) {
}