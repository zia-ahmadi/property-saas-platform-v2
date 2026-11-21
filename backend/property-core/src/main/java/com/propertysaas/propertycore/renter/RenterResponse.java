package com.propertysaas.propertycore.renter;

import java.time.Instant;
import java.util.UUID;

public record RenterResponse(
        UUID id, UUID organizationId, String firstName, String lastName,
        String email, String phone, Instant createdAt, Instant updatedAt, Instant archivedAt
) {}
