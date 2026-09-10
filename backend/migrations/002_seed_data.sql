-- KREA IT Operations Command Center
-- Migration 002: Seed Data

-- Roles
INSERT INTO roles (id, name, description, created_at) VALUES
('role_viewer', 'VIEWER', 'Read-only access to dashboards, devices, alarms, incidents and history', CURRENT_TIMESTAMP),
('role_operator', 'OPERATOR', 'Operator access: Viewer + acknowledge alarms, manage incidents, add notes', CURRENT_TIMESTAMP),
('role_net_op', 'NETWORK_OPERATOR', 'Network Operator: Operator + VLAN Internet disable/enable, network actions', CURRENT_TIMESTAMP),
('role_admin', 'ADMINISTRATOR', 'Full system access: all operations, user management, settings, integrations', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

-- Permissions
INSERT INTO permissions (id, code, description, module) VALUES
('perm_01', 'dashboard.view', 'View NOC dashboards and metrics', 'dashboard'),
('perm_02', 'devices.view', 'View network devices and telemetry', 'devices'),
('perm_03', 'devices.edit_metadata', 'Edit local device metadata and notes', 'devices'),
('perm_04', 'alarms.view', 'View active alarms and historical alerts', 'alarms'),
('perm_05', 'alarms.acknowledge', 'Acknowledge and clear active alarms', 'alarms'),
('perm_06', 'incidents.view', 'View incidents and outages', 'incidents'),
('perm_07', 'incidents.manage', 'Create, assign, update and resolve incidents', 'incidents'),
('perm_08', 'vlan.view', 'View VLANs, subnets, and internet statuses', 'vlan'),
('perm_09', 'vlan.internet.disable', 'Disable internet access for target VLAN', 'vlan'),
('perm_10', 'vlan.internet.enable', 'Enable internet access for target VLAN', 'vlan'),
('perm_11', 'fortigate.view', 'View firewall rules, policies and interfaces', 'firewall'),
('perm_12', 'fortigate.manage', 'Manage firewall rules and policies', 'firewall'),
('perm_13', 'reports.view', 'View and export availability and SLA reports', 'reports'),
('perm_14', 'audit.view', 'View immutable audit trails', 'audit'),
('perm_15', 'users.manage', 'Create, update, disable users and roles', 'users'),
('perm_16', 'settings.manage', 'Manage system settings, integrations and sound profiles', 'settings'),
('perm_17', 'displays.manage', 'Manage NOC display monitors and heartbeats', 'displays')
ON CONFLICT(id) DO NOTHING;

-- Role Permissions Mapping
-- VIEWER
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_viewer', 'perm_01'),
('role_viewer', 'perm_02'),
('role_viewer', 'perm_04'),
('role_viewer', 'perm_06'),
('role_viewer', 'perm_08'),
('role_viewer', 'perm_11'),
('role_viewer', 'perm_13'),
('role_viewer', 'perm_14')
ON CONFLICT(role_id, permission_id) DO NOTHING;

-- OPERATOR
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_operator', 'perm_01'),
('role_operator', 'perm_02'),
('role_operator', 'perm_03'),
('role_operator', 'perm_04'),
('role_operator', 'perm_05'),
('role_operator', 'perm_06'),
('role_operator', 'perm_07'),
('role_operator', 'perm_08'),
('role_operator', 'perm_11'),
('role_operator', 'perm_13'),
('role_operator', 'perm_14')
ON CONFLICT(role_id, permission_id) DO NOTHING;

-- NETWORK_OPERATOR
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_net_op', 'perm_01'),
('role_net_op', 'perm_02'),
('role_net_op', 'perm_03'),
('role_net_op', 'perm_04'),
('role_net_op', 'perm_05'),
('role_net_op', 'perm_06'),
('role_net_op', 'perm_07'),
('role_net_op', 'perm_08'),
('role_net_op', 'perm_09'),
('role_net_op', 'perm_10'),
('role_net_op', 'perm_11'),
('role_net_op', 'perm_12'),
('role_net_op', 'perm_13'),
('role_net_op', 'perm_14')
ON CONFLICT(role_id, permission_id) DO NOTHING;

-- ADMINISTRATOR (all permissions)
INSERT INTO role_permissions (role_id, permission_id) VALUES
('role_admin', 'perm_01'),
('role_admin', 'perm_02'),
('role_admin', 'perm_03'),
('role_admin', 'perm_04'),
('role_admin', 'perm_05'),
('role_admin', 'perm_06'),
('role_admin', 'perm_07'),
('role_admin', 'perm_08'),
('role_admin', 'perm_09'),
('role_admin', 'perm_10'),
('role_admin', 'perm_11'),
('role_admin', 'perm_12'),
('role_admin', 'perm_13'),
('role_admin', 'perm_14'),
('role_admin', 'perm_15'),
('role_admin', 'perm_16'),
('role_admin', 'perm_17')
ON CONFLICT(role_id, permission_id) DO NOTHING;

-- Device Categories
INSERT INTO device_categories (id, name, code, icon, sound_channel) VALUES
('cat_switch', 'Switch', 'SWITCH', 'Network', 'SWITCH'),
('cat_server', 'Server', 'SERVER', 'Server', 'SERVER'),
('cat_biometric', 'Biometric Device', 'BIOMETRIC', 'Fingerprint', 'BIOMETRIC'),
('cat_ill', 'Internet Leased Line', 'ILL', 'Globe', 'ILL'),
('cat_classroom', 'Classroom Switch/AP', 'CLASSROOM', 'GraduationCap', 'NONE'),
('cat_router', 'Router', 'ROUTER', 'Router', 'SWITCH'),
('cat_ap', 'Wireless Access Point', 'WIRELESS_AP', 'Wifi', 'SWITCH'),
('cat_other', 'Other Device', 'OTHER', 'Cpu', 'SWITCH')
ON CONFLICT(id) DO NOTHING;

-- Sound Profiles (4 Channels + Classroom Muted)
INSERT INTO sound_profiles (id, category_code, enabled, down_sound, recovery_sound, volume, cooldown_seconds, updated_at) VALUES
('snd_switch', 'SWITCH', 1, 'switch-down.mp3', 'switch-recovered.mp3', 80, 30, CURRENT_TIMESTAMP),
('snd_server', 'SERVER', 1, 'server-down.mp3', 'server-recovered.mp3', 80, 30, CURRENT_TIMESTAMP),
('snd_biometric', 'BIOMETRIC', 1, 'biometric-down.mp3', 'biometric-recovered.mp3', 75, 30, CURRENT_TIMESTAMP),
('snd_ill', 'ILL', 1, 'ill-down.mp3', 'ill-recovered.mp3', 80, 30, CURRENT_TIMESTAMP),
('snd_classroom', 'CLASSROOM', 0, 'none', 'none', 0, 30, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

-- Sites
INSERT INTO sites (id, name, code, description, created_at) VALUES
('site_main', 'KREA University Main Campus', 'MAIN_CAMPUS', 'Sri City Main Campus Infrastructure', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;

-- Locations
INSERT INTO locations (id, site_id, name, building, floor, room) VALUES
('loc_dc', 'site_main', 'Main Data Center', 'Academic Block A', 'Ground', 'Server Room A-01'),
('loc_lib', 'site_main', 'University Library', 'Learning Centre', '1st Floor', 'IT Hub'),
('loc_adm', 'site_main', 'Administration Office', 'Admin Block', 'Ground', 'Server Rack B'),
('loc_hostel_a', 'site_main', 'Hostel Block 1', 'Hostel Zone A', 'Ground', 'Switch Closet 1A'),
('loc_hostel_b', 'site_main', 'Hostel Block 2', 'Hostel Zone B', 'Ground', 'Switch Closet 2A'),
('loc_lab1', 'site_main', 'Computer Lab 1', 'Lab Complex', '2nd Floor', 'Lab-201'),
('loc_lab2', 'site_main', 'Computer Lab 2', 'Lab Complex', '2nd Floor', 'Lab-202'),
('loc_cafeteria', 'site_main', 'Dining & Cafeteria', 'Student Centre', 'Ground', 'Entrance Rack')
ON CONFLICT(id) DO NOTHING;

-- Integrations
INSERT INTO integrations (id, name, type, base_url, status, last_sync_at, sync_count, error_count) VALUES
('int_opm', 'ManageEngine OpManager', 'opmanager', 'https://nms.krea.edu.in', 'CONNECTED', CURRENT_TIMESTAMP, 1, 0),
('int_epc', 'ManageEngine Endpoint Central', 'endpointcentral', 'https://endpointcentral.krea.edu.in:8383', 'CONNECTED', CURRENT_TIMESTAMP, 1, 0),
('int_fg', 'FortiGate Firewall', 'fortigate', 'https://fortigate.internal', 'CONNECTED', CURRENT_TIMESTAMP, 1, 0)
ON CONFLICT(id) DO NOTHING;

-- System Settings
INSERT INTO system_settings (id, setting_key, setting_value, description, updated_at) VALUES
('set_tz', 'timezone', 'Asia/Kolkata', 'Display timezone for NOC users', CURRENT_TIMESTAMP),
('set_tv_rot', 'tv_rotation_seconds', '30', 'Auto-rotation interval for NOC TV display', CURRENT_TIMESTAMP),
('set_idle', 'display_idle_timeout_minutes', '30', 'Display idle timeout to switch to dim power-saving UI', CURRENT_TIMESTAMP),
('set_master_snd', 'master_sound_enabled', 'true', 'Global sound alert toggle', CURRENT_TIMESTAMP),
('set_master_vol', 'master_sound_volume', '80', 'Global master alert sound volume (0-100)', CURRENT_TIMESTAMP),
('set_ret_alarm', 'retention_alarms_days', '180', 'Retention duration for alarms', CURRENT_TIMESTAMP),
('set_ret_audit', 'retention_audit_days', '365', 'Retention duration for audit logs', CURRENT_TIMESTAMP),
('set_ret_metrics', 'retention_metrics_days', '90', 'Retention duration for interface metrics', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
