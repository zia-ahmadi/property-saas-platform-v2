CREATE TABLE organization_notification_sequences (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    last_sequence BIGINT NOT NULL
);

CREATE TABLE organization_notifications (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    kind VARCHAR(30) NOT NULL CHECK (kind IN ('MAINTENANCE_CREATED', 'MAINTENANCE_STATUS_CHANGED', 'PAYMENT_RECORDED')),
    resource_id UUID NOT NULL,
    maintenance_status VARCHAR(20),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (organization_id, sequence)
);

-- The per-organization counter remains locked until commit. A subscriber can
-- advance past a visible event without skipping an earlier uncommitted event.
CREATE FUNCTION append_organization_notification(org UUID, event_kind VARCHAR, resource UUID, event_status VARCHAR)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE next_sequence BIGINT;
BEGIN
    INSERT INTO organization_notification_sequences (organization_id, last_sequence)
    VALUES (org, 1)
    ON CONFLICT (organization_id) DO UPDATE
        SET last_sequence = organization_notification_sequences.last_sequence + 1
    RETURNING last_sequence INTO next_sequence;

    INSERT INTO organization_notifications (organization_id, sequence, kind, resource_id, maintenance_status)
    VALUES (org, next_sequence, event_kind, resource, event_status);
END;
$$;

CREATE FUNCTION notify_maintenance_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM append_organization_notification(NEW.organization_id, 'MAINTENANCE_CREATED', NEW.id, NEW.status);
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM append_organization_notification(NEW.organization_id, 'MAINTENANCE_STATUS_CHANGED', NEW.id, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER maintenance_notifications
AFTER INSERT OR UPDATE OF status ON maintenance_requests
FOR EACH ROW EXECUTE FUNCTION notify_maintenance_change();

CREATE FUNCTION notify_rent_payment() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM append_organization_notification(NEW.organization_id, 'PAYMENT_RECORDED', NEW.invoice_id, NULL);
    RETURN NEW;
END;
$$;

CREATE TRIGGER rent_payment_notifications
AFTER INSERT ON rent_payments
FOR EACH ROW EXECUTE FUNCTION notify_rent_payment();
