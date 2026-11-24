ALTER TABLE leases ADD CONSTRAINT uq_leases_organization_id UNIQUE (organization_id, id);

CREATE TABLE rent_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    organization_id UUID NOT NULL,
    lease_id UUID NOT NULL,
    renter_name TEXT NOT NULL,
    property_name TEXT NOT NULL,
    unit_number TEXT NOT NULL,
    billing_month DATE NOT NULL CHECK (EXTRACT(DAY FROM billing_month) = 1),
    due_on DATE NOT NULL,
    currency VARCHAR(3) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount BETWEEN 0 AND amount),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    issued_by UUID NOT NULL REFERENCES users(id),
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id),
    void_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 0,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, lease_id) REFERENCES leases (organization_id, id),
    CHECK ((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
        OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL AND paid_amount = 0))
);

CREATE UNIQUE INDEX uq_rent_invoices_live_month
    ON rent_invoices (organization_id, lease_id, billing_month) WHERE voided_at IS NULL;
CREATE INDEX idx_rent_invoices_register ON rent_invoices (organization_id, invoice_number DESC);

CREATE TABLE rent_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    invoice_id UUID NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    received_on DATE NOT NULL,
    method VARCHAR(20) NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER')),
    reference VARCHAR(150),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by UUID NOT NULL REFERENCES users(id),
    FOREIGN KEY (organization_id, invoice_id) REFERENCES rent_invoices (organization_id, id)
);

CREATE INDEX idx_rent_payments_invoice ON rent_payments (organization_id, invoice_id, received_on DESC);
