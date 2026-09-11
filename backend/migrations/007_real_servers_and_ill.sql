-- KREA IT Operations Command Center
-- Migration 007: Seed Real Production Servers & Internet Leased Lines (ILL)

-- 1. Insert Real Krea Production Compute Appliances & Virtual Hosts
INSERT INTO devices (
    id, source_id, source_system, name, ip_address, mac_address, category_code, 
    type, vendor, model, status, availability_pct, response_time_ms, cpu_pct, mem_pct, disk_pct, 
    last_seen_at, last_status_change_at, created_at, updated_at
) VALUES
('dev_srv_nms', 'srv_10_10_3_210', 'internal', 'SRV-OPMANAGER-NMS', '10.10.3.210', '18:66:da:42:19:a1', 'SERVER',
 'Network Management Core', 'Dell Technologies', 'PowerEdge R740xd', 'UP', 99.98, 1, 24.5, 68.2, 52.0,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_srv_epc', 'srv_10_10_3_212', 'endpointcentral', 'SRV-ENDPOINT-CENTRAL', '10.10.3.212', 'bc:24:11:86:87:b8', 'SERVER',
 'Endpoint Management Server', 'Dell Technologies', 'PowerEdge R740xd', 'UP', 99.95, 1, 28.0, 71.4, 64.8,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_srv_dc01', 'srv_10_10_3_10', 'internal', 'SRV-DC01-PRIMARY-AD', '10.10.3.10', '18:66:da:41:88:c2', 'SERVER',
 'Domain Controller & Core DNS', 'Dell Technologies', 'PowerEdge R640', 'UP', 100.00, 1, 16.2, 42.5, 38.2,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_srv_dc02', 'srv_10_10_3_11', 'internal', 'SRV-DC02-BACKUP-AD', '10.10.3.11', '18:66:da:41:89:d5', 'SERVER',
 'Secondary DC & DHCP Failover', 'Dell Technologies', 'PowerEdge R640', 'UP', 100.00, 1, 14.8, 39.0, 35.1,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_srv_erp', 'srv_10_10_3_30', 'internal', 'SRV-CAMPUS-ERP-DB01', '10.10.3.30', '00:25:b5:31:70:e4', 'SERVER',
 'MariaDB ERP Database Cluster', 'Cisco Systems', 'UCS C220 M5', 'UP', 99.99, 1, 38.5, 82.1, 72.4,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_srv_veeam', 'srv_10_10_3_40', 'internal', 'SRV-VEEAM-BACKUP-01', '10.10.3.40', '00:11:32:8f:2a:18', 'SERVER',
 'Disaster Recovery & Backup Host', 'Synology Enterprise', 'RackStation RS3618xs', 'UP', 99.92, 2, 19.0, 51.2, 78.6,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

('dev_srv_zk', 'srv_10_10_3_50', 'internal', 'SRV-BIOMETRIC-ZK-01', '10.10.3.50', '18:66:da:53:22:fe', 'SERVER',
 'ZKTeco BioSecurity Host', 'Dell Technologies', 'PowerEdge T340', 'UP', 99.90, 1, 21.3, 58.7, 44.9,
 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE 
    status = VALUES(status),
    cpu_pct = VALUES(cpu_pct),
    mem_pct = VALUES(mem_pct),
    disk_pct = VALUES(disk_pct),
    last_seen_at = VALUES(last_seen_at),
    updated_at = VALUES(updated_at);

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
ON DUPLICATE KEY UPDATE 
    status = VALUES(status),
    availability_pct = VALUES(availability_pct),
    response_time_ms = VALUES(response_time_ms),
    last_seen_at = VALUES(last_seen_at),
    updated_at = VALUES(updated_at);
