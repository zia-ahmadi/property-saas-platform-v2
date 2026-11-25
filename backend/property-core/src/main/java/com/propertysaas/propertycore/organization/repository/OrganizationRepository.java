package com.propertysaas.propertycore.organization.repository;

import com.propertysaas.propertycore.organization.entity.Organization;

import com.propertysaas.propertycore.organization.entity.OrganizationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationRepository
        extends JpaRepository<Organization, UUID> {

    Optional<Organization> findBySlug(String slug);

    boolean existsBySlug(String slug);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE Organization o SET o.name = :name, o.updatedAt = :updatedAt
            WHERE o.id = :id AND o.status = :active AND o.name = :expectedName
            """)
    int rename(UUID id, OrganizationStatus active, String expectedName, String name, Instant updatedAt);
}