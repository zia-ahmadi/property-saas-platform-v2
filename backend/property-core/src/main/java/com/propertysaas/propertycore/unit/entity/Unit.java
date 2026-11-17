
package com.propertysaas.propertycore.unit.entity;

import com.propertysaas.propertycore.property.entity.Property;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import tools.jackson.databind.JsonNode;

@Entity
@Table(
        name = "units",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uq_units_property_number",
                        columnNames = {
                                "property_id",
                                "unit_number"
                        }
                )
        }
)
public class Unit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "property_id",
            nullable = false,
            updatable = false,
            foreignKey = @ForeignKey(
                    name = "fk_units_property"
            )
    )
    private Property property;

    @Column(
            name = "unit_number",
            nullable = false,
            length = 50
    )
    private String unitNumber;

    @Convert(converter = UnitTypeConverter.class)
    @Column(
            name = "unit_type",
            nullable = false,
            length = 30
    )
    private UnitType unitType;

    @Column(name = "floor_number")
    private Integer floorNumber;

    @Column(
            name = "area_sqm",
            precision = 12,
            scale = 2
    )
    private BigDecimal areaSqm;

    @Convert(converter = UnitAvailabilityStatusConverter.class)
    @Column(
            name = "availability_status",
            nullable = false,
            length = 20
    )
    private UnitAvailabilityStatus availabilityStatus =
            UnitAvailabilityStatus.AVAILABLE;

    @CreationTimestamp
    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private Instant createdAt;

    @UpdateTimestamp
    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    protected Unit() {
    }

    public Unit(
            Property property,
            String unitNumber,
            UnitType unitType,
            Integer floorNumber,
            BigDecimal areaSqm
    ) {
        this.property = Objects.requireNonNull(
                property,
                "Property must not be null"
        );

        this.unitNumber = Objects.requireNonNull(
                unitNumber,
                "Unit number must not be null"
        );

        this.unitType = Objects.requireNonNull(
                unitType,
                "Unit type must not be null"
        );

        this.floorNumber = floorNumber;
        this.areaSqm = areaSqm;

        this.availabilityStatus =
                UnitAvailabilityStatus.AVAILABLE;
    }


    /**
     * Applies validated partial updates to the unit.
     *
     * The request must be validated by
     * UpdateUnitRequestValidator before calling this method.
     */
    public void applyUpdates(JsonNode changes) {

        for (var entry : changes.properties()) {

            String field = entry.getKey();
            JsonNode value = entry.getValue();

            switch (field) {

                case "unitNumber" ->
                        this.unitNumber =
                                value.stringValue().trim();

                case "unitType" ->
                        this.unitType = UnitType.valueOf(
                                value.stringValue()
                        );

                case "floorNumber" ->
                        this.floorNumber = value.isNull()
                                ? null
                                : value.intValue();

                case "areaSqm" ->
                        this.areaSqm = value.isNull()
                                ? null
                                : new BigDecimal(value.toString());

                default -> throw new IllegalArgumentException(
                        "Field cannot be updated: " + field
                );
            }
        }
    }


    public UUID getId() {
        return id;
    }

    public Property getProperty() {
        return property;
    }

    public String getUnitNumber() {
        return unitNumber;
    }

    public UnitType getUnitType() {
        return unitType;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    public BigDecimal getAreaSqm() {
        return areaSqm;
    }

    public UnitAvailabilityStatus getAvailabilityStatus() {
        return availabilityStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
