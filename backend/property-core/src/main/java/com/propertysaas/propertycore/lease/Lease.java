package com.propertysaas.propertycore.lease;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record Lease(
        UUID id, UUID propertyId, String propertyName, UUID unitId, String unitNumber,
        UUID renterId, String renterName, LocalDate startsOn, LocalDate endsOn, BigDecimal monthlyRent,
        BigDecimal deposit, String currency, String notes, Status status,
        OffsetDateTime activatedAt, OffsetDateTime closedAt, OffsetDateTime createdAt,
        OffsetDateTime updatedAt, long version
) {
    public enum Status { DRAFT, ACTIVE, ENDED, CANCELLED }
    public enum Action { ACTIVATE, END, CANCEL }

    public record Terms(
            @NotNull UUID unitId,
            @NotNull UUID renterId,
            @NotNull LocalDate startsOn,
            LocalDate endsOn,
            @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal monthlyRent,
            @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal deposit,
            @NotNull @Pattern(regexp = "[A-Z]{3}") String currency,
            @Size(max = 4000) String notes
    ) {}

    public record Update(@NotNull @jakarta.validation.Valid Terms terms, @NotNull @PositiveOrZero Long version) {}
    public record Transition(@NotNull Action action, @NotNull @PositiveOrZero Long version) {}
    public record UnitOption(UUID id, UUID propertyId, String propertyName, String unitNumber, String availabilityStatus) {}
    public record Summary(long drafts, long active, long endingSoon, long ended, LocalDate asOf) {}
}
