-- KREA IT Operations Command Center
-- Migration 009: Purge Mock & Seeded VLAN Audit Logs for Production Cleanliness
DELETE FROM audit_logs WHERE id LIKE 'aud_vlan_%' OR id LIKE 'aud_mock_%';
