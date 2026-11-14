package com.propertysaas.propertycore.organization.membership.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter
public class MembershipStatusConverter
        implements AttributeConverter<MembershipStatus, String> {

    @Override
    public String convertToDatabaseColumn(MembershipStatus status) {
        return status == null
                ? null
                : status.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public MembershipStatus convertToEntityAttribute(String value) {
        return value == null
                ? null
                : MembershipStatus.valueOf(value.toUpperCase(Locale.ROOT));
    }
}