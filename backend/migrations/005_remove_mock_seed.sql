-- KREA IT Operations Command Center
-- Migration 005: Purge Legacy Mock and Dump Seeding Data

-- 1. Remove mock biometric metadata
DELETE FROM biometric_metadata WHERE id IN ('bmd_01', 'bmd_03', 'bmd_20') OR device_id LIKE 'dev_bio_%';

-- 2. Remove mock alarms
DELETE FROM alarms WHERE id IN ('alm_01', 'alm_02', 'alm_03', 'alm_04') OR source_id LIKE 'opm_alm_%' OR device_name LIKE 'BIO-003-LIB-ENTRY' OR device_name LIKE 'BIO-020-SECURITY-GATE2' OR device_name LIKE 'SRV-ERP-DB01';

-- 3. Remove mock incidents
DELETE FROM incidents WHERE id IN ('inc_01', 'inc_02') OR primary_device_id LIKE 'dev_bio_%';

-- 4. Remove mock endpoints
DELETE FROM endpoints WHERE source_id IN ('epc_01', 'epc_02', 'epc_03', 'epc_04', 'epc_05', 'epc_06') OR id IN ('ep_01', 'ep_02', 'ep_03', 'ep_04', 'ep_05', 'ep_06');

-- 5. Remove mock interfaces attached to fake core switches
DELETE FROM interfaces WHERE id IN ('if_01', 'if_02', 'if_03', 'if_04') OR device_id LIKE 'dev_core_%';

-- 6. Remove all mock devices
DELETE FROM devices WHERE source_id LIKE 'opm_%' OR id LIKE 'dev_core_%' OR id LIKE 'dev_dist_%' OR id LIKE 'dev_acc_%' OR id LIKE 'dev_srv_%' OR id LIKE 'dev_bio_%' OR id LIKE 'dev_ill_%';
