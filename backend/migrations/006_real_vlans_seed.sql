-- KREA IT Operations Command Center
-- Migration 006: Purge Legacy Mock VLANs & Seed Real Krea Infrastructure VLANs

-- 1. Remove legacy mock VLAN records
DELETE FROM vlans WHERE id IN ('vlan_110', 'vlan_120', 'vlan_130', 'vlan_140', 'vlan_150');

-- 2. Insert real Krea University VLAN segments mapped directly to FortiGate firewall policies
INSERT INTO vlans (
    id, vlan_id, name, description, subnet, gateway, internet_status, 
    fortigate_policy_id, expected_endpoints, expected_aps, expected_classrooms, 
    last_state_change_at, updated_at
) VALUES
('vlan_160', 160, 'Student Wi-Fi', 'Student personal devices & hostel/academic Wi-Fi', '10.10.160.0/20', '10.10.160.1', 'ENABLED', 38, 850, 58, 24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_72', 72, 'Staff Wi-Fi', 'Administrative and operational staff wireless access', '10.10.72.0/22', '10.10.72.1', 'ENABLED', 37, 120, 26, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_76', 76, 'Faculty Wi-Fi', 'Academic faculty & research cabin wireless access', '10.10.76.0/22', '10.10.76.1', 'ENABLED', 33, 95, 20, 14, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_68', 68, 'Guest Wi-Fi', 'Visitor & event guest portal wireless access', '10.10.68.0/23', '10.10.68.1', 'ENABLED', 36, 50, 18, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_17', 17, 'Main Block DS Lab', 'Main Block 1st Floor Data Science research laboratory', '10.10.17.0/24', '10.10.17.1', 'ENABLED', 24, 29, 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_16', 16, 'MB Trading Lab', 'Financial trading lab & economics computer systems', '10.10.16.0/24', '10.10.16.1', 'ENABLED', 70, 60, 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_18', 18, 'Library Systems', 'Central Library digital commons and catalog workstations', '10.10.18.0/23', '10.10.18.1', 'ENABLED', 26, 14, 8, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_24', 24, 'Campus Biometrics', 'Campus biometric attendance readers & access control', '10.10.24.0/24', '10.10.24.1', 'ENABLED', 29, 66, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_64', 64, 'Events Wi-Fi', 'Auditorium, seminar halls and special campus events', '10.10.64.0/22', '10.10.64.1', 'ENABLED', 35, 150, 14, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_88', 88, 'Exam Wi-Fi', 'Dedicated academic examination and testing network', '10.10.88.0/21', '10.10.88.1', 'ENABLED', 34, 300, 22, 16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_14', 14, 'Main Block LAN', 'Main academic block wired ethernet workstations', '10.10.14.0/23', '10.10.14.1', 'ENABLED', 25, 37, 0, 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_20', 20, 'New Academic LAN', 'New academic building wired ethernet workstations', '10.10.20.0/23', '10.10.20.1', 'ENABLED', 22, 34, 0, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
