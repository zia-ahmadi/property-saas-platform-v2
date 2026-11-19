package com.propertysaas.propertycore.auth.refresh.repository;

import com.propertysaas.propertycore.auth.refresh.entity.RefreshTokenFamily;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenFamilyRepository extends JpaRepository<RefreshTokenFamily, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT family FROM RefreshTokenFamily family WHERE family.id = :id")
    Optional<RefreshTokenFamily> findByIdForUpdate(@Param("id") UUID id);
}
