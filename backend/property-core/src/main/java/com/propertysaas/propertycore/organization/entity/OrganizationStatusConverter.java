package com.propertysaas.propertycore.organization.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter
public class OrganizationStatusConverter
        implements AttributeConverter<OrganizationStatus, String> {

    @Override
    public String convertToDatabaseColumn(OrganizationStatus status) {
        return status == null
                ? null
                : status.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public OrganizationStatus convertToEntityAttribute(String value) {
        return value == null
                ? null
                : OrganizationStatus.valueOf(value.toUpperCase(Locale.ROOT));
    }
}