package com.propertysaas.propertycore.user.repository;

import com.propertysaas.propertycore.user.entity.User;

import com.propertysaas.propertycore.user.entity.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE User u SET u.firstName = :first, u.lastName = :last, u.updatedAt = :updatedAt
            WHERE u.id = :id AND u.status = :active
            """)
    int updateProfile(UUID id, UserStatus active, String first, String last, Instant updatedAt);
}