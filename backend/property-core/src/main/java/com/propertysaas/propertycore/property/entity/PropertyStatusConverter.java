
package com.propertysaas.propertycore.property.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter(autoApply = false)
public class PropertyStatusConverter
        implements AttributeConverter<PropertyStatus, String> {

    @Override
    public String convertToDatabaseColumn(PropertyStatus attribute) {
        if (attribute == null) {
            return null;
        }

        return attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public PropertyStatus convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }

        return PropertyStatus.valueOf(
                dbData.toUpperCase(Locale.ROOT)
        );
    }
}
