package com.propertysaas.propertycore.organization.membership.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

@Converter
public class MembershipRoleConverter
        implements AttributeConverter<MembershipRole, String> {

    @Override
    public String convertToDatabaseColumn(MembershipRole role) {
        return role == null
                ? null
                : role.name().toLowerCase(Locale.ROOT);
    }

    @Override
    public MembershipRole convertToEntityAttribute(String value) {
        return value == null
                ? null
                : MembershipRole.valueOf(value.toUpperCase(Locale.ROOT));
    }
}