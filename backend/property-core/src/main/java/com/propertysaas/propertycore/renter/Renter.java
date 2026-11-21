package com.propertysaas.propertycore.renter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Entity
@Table(name = "renters")
public class Renter {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, updatable = false)
    private UUID organizationId;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
    private Instant updatedAt;
    private Instant archivedAt;

    protected Renter() {}

    Renter(UUID organizationId, RenterInput input) {
        this.organizationId = organizationId;
        update(input);
        createdAt = updatedAt;
    }

    void update(RenterInput input) {
        firstName = input.firstName();
        lastName = input.lastName();
        email = input.email();
        phone = input.phone();
        updatedAt = now();
    }

    void archive() {
        archivedAt = now();
        updatedAt = archivedAt;
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    RenterResponse response() {
        return new RenterResponse(id, organizationId, firstName, lastName, email, phone,
                createdAt, updatedAt, archivedAt);
    }
}
