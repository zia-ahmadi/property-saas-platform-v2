package com.propertysaas.propertycore.user.dto;

import java.util.UUID;

public record AccountProfile(UUID id, String email, String firstName, String lastName) {}
