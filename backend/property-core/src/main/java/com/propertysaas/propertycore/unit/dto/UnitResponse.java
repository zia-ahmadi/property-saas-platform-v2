
package com.propertysaas.propertycore.unit.dto;

import com.propertysaas.propertycore.unit.entity.UnitAvailabilityStatus;
import com.propertysaas.propertycore.unit.entity.UnitType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record UnitResponse(

        UUID id,

        UUID propertyId,

        String unitNumber,

        UnitType unitType,

        Integer floorNumber,

        BigDecimal areaSqm,

        UnitAvailabilityStatus availabilityStatus,

        Instant createdAt,

        Instant updatedAt

) {
}
