
package com.propertysaas.propertycore.property.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter(autoApply = false)
public class PropertyTypeConverter
        implements AttributeConverter<PropertyType, String> {

    @Override
    public String convertToDatabaseColumn(PropertyType attribute) {
        if (attribute == null) {
            return null;
        }

        return attribute.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public PropertyType convertToEntityAttribute(String dbData) {
        if (dbData == null) {
            return null;
        }

        return PropertyType.valueOf(
                dbData.toUpperCase(Locale.ROOT)
        );
    }
}
