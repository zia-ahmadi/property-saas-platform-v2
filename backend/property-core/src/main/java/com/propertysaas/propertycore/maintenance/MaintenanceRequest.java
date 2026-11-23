package com.propertysaas.propertycore.maintenance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record MaintenanceRequest(
        UUID id, UUID propertyId, String propertyName, UUID unitId, String unitNumber,
        UUID reportedBy, String title, String description, Category category, Priority priority,
        Status status, String assignedTo, LocalDate dueDate, String resolutionNotes,
        OffsetDateTime resolvedAt, OffsetDateTime createdAt, OffsetDateTime updatedAt, long version
) {
    public enum Category { PLUMBING, ELECTRICAL, HVAC, APPLIANCE, GENERAL, OTHER }
    public enum Priority { LOW, NORMAL, HIGH, URGENT }
    public enum Status { OPEN, IN_PROGRESS, RESOLVED, CANCELLED }

    public record Input(
            @NotNull UUID propertyId, UUID unitId,
            @NotBlank @Size(max = 150) String title,
            @NotBlank @Size(max = 4000) String description,
            @NotNull Category category, @NotNull Priority priority,
            @Size(max = 150) String assignedTo, LocalDate dueDate
    ) {}

    public record Update(
            @NotNull @jakarta.validation.Valid Input request,
            @NotNull Status status,
            @Size(max = 4000) String resolutionNotes,
            @NotNull @PositiveOrZero Long version
    ) {}

    public record PropertyOption(UUID id, String name) {}

    public record Summary(long open, long inProgress, long urgent, long resolved) {}
}
