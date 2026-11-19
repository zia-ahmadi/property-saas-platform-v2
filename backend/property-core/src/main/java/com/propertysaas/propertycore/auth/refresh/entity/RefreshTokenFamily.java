package com.propertysaas.propertycore.auth.refresh.entity;

import com.propertysaas.propertycore.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_token_families")
public class RefreshTokenFamily {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected RefreshTokenFamily() { }

    public RefreshTokenFamily(UUID id, User user) {
        this.id = id;
        this.user = user;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public boolean isRevoked() { return revokedAt != null; }
    public void revoke(Instant now) { if (revokedAt == null) revokedAt = now; }
}
