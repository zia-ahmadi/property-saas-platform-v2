
package com.propertysaas.propertycore.unit.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter(autoApply = false)
public class UnitTypeConverter
        implements AttributeConverter<UnitType, String> {

    @Override
    public String convertToDatabaseColumn(UnitType attribute) {
        if (attribute == null) {
            return null;
        }

        return attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public UnitType convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }

        return UnitType.valueOf(
                dbData.toUpperCase(Locale.ROOT)
        );
    }
}
