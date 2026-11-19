-- KREA IT Operations Command Center
-- Migration 012: Krea OneERP biometric feed integration status row
-- The collector updates this row (type 'erp') on every poll of the ERP NOC API.

INSERT INTO integrations (id, name, type, base_url, status, sync_count, error_count) VALUES
('int_erp', 'Krea OneERP Biometrics', 'erp', 'https://api.oneerp.krea.edu.in', 'OFFLINE', 0, 0)
ON CONFLICT(id) DO NOTHING;
