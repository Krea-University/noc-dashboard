-- KREA IT Operations Command Center
-- Migration 007: Seed Real Production Internet Leased Lines (ILL)


-- 2. Insert Real Krea Internet Leased Line Links (ILL)
INSERT INTO devices (
    id, source_id, source_system, name, ip_address, mac_address, category_code, 
    type, vendor, model, status, availability_pct, response_time_ms, cpu_pct, mem_pct, disk_pct, 
    last_seen_at, last_status_change_at, created_at, updated_at
) VALUES
('dev_ill_railtel', 'ill_x3', 'fortigate', 'ILL-RAILTEL-PRIMARY', '103.119.112.1', '70:4c:a5:88:14:03', 'ILL',
 'Primary Leased Line (3 Gbps)', 'Railtel Corporation of India', 'Direct Optical Fiber (x3)', 'UP', 99.98, 2, 0.0, 0.0, 0.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_ill_airtel', 'ill_x4', 'fortigate', 'ILL-AIRTEL-SECONDARY', '122.185.120.1', '70:4c:a5:88:14:04', 'ILL',
 'Secondary Leased Line (1.2 Gbps)', 'Bharti Airtel Enterprise', 'Direct Optical Fiber (x4)', 'UP', 99.95, 4, 0.0, 0.0, 0.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_ill_bsnl', 'ill_port2', 'fortigate', 'ILL-BSNL-BACKUP', '117.218.44.1', '70:4c:a5:88:14:02', 'ILL',
 'Failover Leased Line (500 Mbps)', 'BSNL Broadband', 'Gigabit Ethernet (port2)', 'UP', 99.80, 7, 0.0, 0.0, 0.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
