package com.propertysaas.propertycore.billing;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record Invoice(UUID id, long invoiceNumber, UUID leaseId, String renterName, String propertyName,
                      String unitNumber, LocalDate billingMonth, LocalDate dueOn, String currency,
                      BigDecimal amount, BigDecimal paidAmount, BigDecimal balance, Status status,
                      OffsetDateTime issuedAt, OffsetDateTime voidedAt, String voidReason, long version) {
    public enum Status { OPEN, PARTIALLY_PAID, OVERDUE, PAID, VOID }
    public enum Method { CASH, BANK_TRANSFER, CHECK, OTHER }

    public record Issue(@NotNull UUID leaseId, @NotNull LocalDate billingMonth, @NotNull LocalDate dueOn) {}

    public record RecordPayment(@NotNull @Positive @Digits(integer = 10, fraction = 2) BigDecimal amount,
                                @NotNull LocalDate receivedOn, @NotNull Method method, @Size(max = 150) String reference,
                                @NotNull @PositiveOrZero Long version) {}

    public record VoidInvoice(@NotBlank @Size(max = 500) String reason, @NotNull @PositiveOrZero Long version) {}

    public record Payment(UUID id, BigDecimal amount, LocalDate receivedOn, Method method, String reference,
                          OffsetDateTime recordedAt) {}

    public record Details(Invoice invoice, List<Payment> payments, LocalDate asOf) {}

    public record Totals(String currency, BigDecimal outstanding, BigDecimal overdue, BigDecimal collected) {}

    public record Summary(long open, long overdue, long paid, List<Totals> totals, LocalDate asOf) {}
}
