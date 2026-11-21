package com.propertysaas.propertycore.renter;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

interface RenterRepository extends JpaRepository<Renter, UUID> {
    Optional<Renter> findByIdAndOrganizationId(UUID id, UUID organizationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Renter r where r.id = :id and r.organizationId = :organizationId")
    Optional<Renter> findForUpdate(UUID id, UUID organizationId);

    @Query("""
            select r from Renter r
            where r.organizationId = :organizationId and r.archivedAt is null
              and (:search = '' or locate(lower(:search), lower(concat(r.firstName, ' ', r.lastName))) > 0
                   or locate(lower(:search), lower(r.email)) > 0
                   or locate(:search, r.phone) > 0)
            """)
    Page<Renter> searchActive(UUID organizationId, String search, Pageable pageable);
}
