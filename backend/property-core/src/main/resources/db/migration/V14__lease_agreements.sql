ALTER TABLE leases
    ADD COLUMN payment_terms VARCHAR(1000),
    ADD COLUMN agreement_terms VARCHAR(12000),
    ADD COLUMN agreement_parties JSONB;
