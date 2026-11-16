
package com.propertysaas.propertycore.property.entity;

import com.propertysaas.propertycore.organization.entity.Organization;

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

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "properties")
public class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "organization_id",
            nullable = false,
            foreignKey = @ForeignKey(
                    name = "fk_properties_organization"
            )
    )
    private Organization organization;

    @Column(nullable = false, length = 150)
    private String name;

    @Convert(converter = PropertyTypeConverter.class)
    @Column(name = "property_type", nullable = false, length = 30)
    private PropertyType propertyType;

    @Column(name = "address_line1", nullable = false, length = 255)
    private String addressLine1;

    @Column(name = "address_line2", length = 255)
    private String addressLine2;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(name = "country_code", nullable = false, length = 2)
    private String countryCode;

    @Convert(converter = PropertyStatusConverter.class)
    @Column(nullable = false, length = 20)
    private PropertyStatus status = PropertyStatus.ACTIVE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Property() {
    }

    public Property(
            Organization organization,
            String name,
            PropertyType propertyType,
            String addressLine1,
            String addressLine2,
            String city,
            String countryCode
    ) {
        this.organization = organization;
        this.name = name;
        this.propertyType = propertyType;
        this.addressLine1 = addressLine1;
        this.addressLine2 = addressLine2;
        this.city = city;
        this.countryCode = countryCode;
        this.status = PropertyStatus.ACTIVE;
    }

    public UUID getId() {
        return id;
    }

    public Organization getOrganization() {
        return organization;
    }

    public String getName() {
        return name;
    }

    public PropertyType getPropertyType() {
        return propertyType;
    }

    public String getAddressLine1() {
        return addressLine1;
    }

    public String getAddressLine2() {
        return addressLine2;
    }

    public String getCity() {
        return city;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public PropertyStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
