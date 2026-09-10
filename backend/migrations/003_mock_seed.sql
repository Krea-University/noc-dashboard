-- KREA IT Operations Command Center
-- Migration 003: Campus VLAN Infrastructure Seed Data

-- VLANs
INSERT INTO vlans (id, vlan_id, name, description, subnet, gateway, internet_status, fortigate_policy_id, expected_endpoints, expected_aps, expected_classrooms, last_state_change_at, updated_at) VALUES
('vlan_110', 110, 'Faculty & Staff', 'Academic and administrative staff workstations & secure Wi-Fi', '10.110.0.0/20', '10.110.0.1', 'ENABLED', 1101, 420, 24, 18, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_120', 120, 'Students', 'Hostel and classroom student personal devices & BYOD', '10.120.0.0/19', '10.120.0.1', 'ENABLED', 1201, 850, 48, 24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_130', 130, 'Computer Labs', 'Academic computer science & research laboratory systems', '10.130.0.0/22', '10.130.0.1', 'ENABLED', 1301, 160, 4, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_140', 140, 'Campus Guests', 'Visitor self-registered wireless internet access', '10.140.0.0/22', '10.140.0.1', 'ENABLED', 1401, 85, 16, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('vlan_150', 150, 'IoT & Biometrics', 'Campus biometric readers, IP cameras and environmental sensors', '10.150.0.0/23', '10.150.0.1', 'ENABLED', 1501, 65, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
