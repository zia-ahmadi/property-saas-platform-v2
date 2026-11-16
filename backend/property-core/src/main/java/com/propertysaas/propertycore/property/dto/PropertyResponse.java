
package com.propertysaas.propertycore.property.dto;

import com.propertysaas.propertycore.property.entity.PropertyStatus;
import com.propertysaas.propertycore.property.entity.PropertyType;

import java.time.Instant;
import java.util.UUID;

public record PropertyResponse(

        UUID id,

        UUID organizationId,

        String name,

        PropertyType propertyType,

        String addressLine1,

        String addressLine2,

        String city,

        String countryCode,

        PropertyStatus status,

        Instant createdAt,

        Instant updatedAt

) {
}
