
-- Refresh tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    family_id UUID NOT NULL,

    -- SHA-256 hash of the original refresh token
    token_hash CHAR(64) NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    -- Links the old token to its replacement
    replaced_by_token_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_refresh_tokens_replacement
        FOREIGN KEY (replaced_by_token_id)
        REFERENCES refresh_tokens (id)
        ON DELETE SET NULL,

    CONSTRAINT uq_refresh_tokens_hash
        UNIQUE (token_hash),

    CONSTRAINT uq_refresh_tokens_replacement
        UNIQUE (replaced_by_token_id),

    CONSTRAINT ck_refresh_tokens_expiration
        CHECK (expires_at > created_at)
);

-- Find refresh tokens belonging to a user
CREATE INDEX idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);

-- Find all tokens belonging to a token family
CREATE INDEX idx_refresh_tokens_family_id
    ON refresh_tokens (family_id);

-- Support expiration and revocation checks
CREATE INDEX idx_refresh_tokens_expires_at
    ON refresh_tokens (expires_at);
