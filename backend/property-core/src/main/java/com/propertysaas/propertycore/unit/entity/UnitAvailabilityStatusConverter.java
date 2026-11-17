
package com.propertysaas.propertycore.unit.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter(autoApply = false)
public class UnitAvailabilityStatusConverter
        implements AttributeConverter<UnitAvailabilityStatus, String> {

    @Override
    public String convertToDatabaseColumn(
            UnitAvailabilityStatus attribute
    ) {
        if (attribute == null) {
            return null;
        }

        return attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public UnitAvailabilityStatus convertToEntityAttribute(
            String dbData
    ) {
        if (dbData == null) {
            return null;
        }

        return UnitAvailabilityStatus.valueOf(
                dbData.toUpperCase(Locale.ROOT)
        );
    }
}
