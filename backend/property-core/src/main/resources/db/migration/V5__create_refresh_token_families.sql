-- Refuse inconsistent legacy data rather than assigning a family to the wrong user.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM refresh_tokens GROUP BY family_id HAVING COUNT(DISTINCT user_id) <> 1) THEN
        RAISE EXCEPTION 'Refresh token family has multiple owners';
    END IF;
END $$;

CREATE TABLE refresh_token_families (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT uq_refresh_token_families_id_user UNIQUE (id, user_id)
);

INSERT INTO refresh_token_families (id, user_id, created_at)
SELECT family_id, (array_agg(user_id))[1], MIN(created_at)
FROM refresh_tokens GROUP BY family_id;

CREATE INDEX idx_refresh_token_families_user_id ON refresh_token_families(user_id);

ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_family_owner
    FOREIGN KEY (family_id, user_id) REFERENCES refresh_token_families(id, user_id)
    ON DELETE CASCADE;
