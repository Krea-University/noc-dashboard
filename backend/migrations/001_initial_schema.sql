-- KREA IT Operations Command Center
-- Migration 001: Initial Core Schema

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    description VARCHAR(255),
    module VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    must_change_password BOOLEAN NOT NULL DEFAULT 0,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    scope VARCHAR(64) NOT NULL DEFAULT 'noc:full',
    expires_at DATETIME NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32) UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(36) PRIMARY KEY,
    site_id VARCHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    building VARCHAR(64),
    floor VARCHAR(32),
    room VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS device_categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    code VARCHAR(32) UNIQUE NOT NULL,
    icon VARCHAR(32),
    sound_channel VARCHAR(32)
);

CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(36) PRIMARY KEY,
    source_id VARCHAR(128),
    source_system VARCHAR(32) NOT NULL DEFAULT 'opmanager',
    name VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    mac_address VARCHAR(32),
    category_code VARCHAR(32) NOT NULL,
    site_id VARCHAR(36),
    location_id VARCHAR(36),
    type VARCHAR(64),
    vendor VARCHAR(64),
    model VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'UP',
    availability_pct DECIMAL(5,2) DEFAULT 100.00,
    response_time_ms INTEGER DEFAULT 0,
    cpu_pct DECIMAL(5,2) DEFAULT 0.00,
    mem_pct DECIMAL(5,2) DEFAULT 0.00,
    disk_pct DECIMAL(5,2) DEFAULT 0.00,
    last_seen_at DATETIME,
    last_status_change_at DATETIME,
    metadata_json TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_category ON devices(category_code);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_ip ON devices(ip_address);

CREATE TABLE IF NOT EXISTS device_history (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    timestamp DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dev_hist_dev ON device_history(device_id);
CREATE INDEX IF NOT EXISTS idx_dev_hist_time ON device_history(timestamp);

CREATE TABLE IF NOT EXISTS interfaces (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) NOT NULL,
    name VARCHAR(128) NOT NULL,
    index_num INTEGER,
    speed_bps BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'UP',
    in_traffic_bps BIGINT DEFAULT 0,
    out_traffic_bps BIGINT DEFAULT 0,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interfaces_device ON interfaces(device_id);

CREATE TABLE IF NOT EXISTS endpoints (
    id VARCHAR(36) PRIMARY KEY,
    source_id VARCHAR(128),
    hostname VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45),
    mac_address VARCHAR(32),
    os_name VARCHAR(64),
    os_version VARCHAR(64),
    logged_in_user VARCHAR(64),
    domain_name VARCHAR(64),
    remote_office VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    last_scan_at DATETIME,
    last_seen_at DATETIME,
    hardware_summary VARCHAR(255),
    software_count INTEGER DEFAULT 0,
    metadata_json TEXT,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_endpoints_status ON endpoints(status);
CREATE INDEX IF NOT EXISTS idx_endpoints_hostname ON endpoints(hostname);

CREATE TABLE IF NOT EXISTS biometric_metadata (
    id VARCHAR(36) PRIMARY KEY,
    device_id VARCHAR(36) UNIQUE NOT NULL,
    vendor VARCHAR(64),
    model VARCHAR(64),
    building VARCHAR(64),
    location VARCHAR(128),
    department VARCHAR(64),
    purpose VARCHAR(64),
    contact_person VARCHAR(128),
    notes TEXT,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS alarms (
    id VARCHAR(36) PRIMARY KEY,
    source_id VARCHAR(128),
    source_system VARCHAR(32) NOT NULL,
    device_id VARCHAR(36),
    device_name VARCHAR(128),
    device_ip VARCHAR(45),
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    entity VARCHAR(128),
    first_seen_at DATETIME NOT NULL,
    last_seen_at DATETIME NOT NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT 0,
    acknowledged_by VARCHAR(64),
    acknowledged_at DATETIME,
    cleared BOOLEAN NOT NULL DEFAULT 0,
    cleared_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_alarms_severity ON alarms(severity);
CREATE INDEX IF NOT EXISTS idx_alarms_cleared ON alarms(cleared);
CREATE INDEX IF NOT EXISTS idx_alarms_first_seen ON alarms(first_seen_at);

CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(36) PRIMARY KEY,
    incident_number VARCHAR(32) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    source_system VARCHAR(32),
    primary_device_id VARCHAR(36),
    affected_devices_count INTEGER DEFAULT 1,
    assigned_to_user_id VARCHAR(36),
    assigned_to_username VARCHAR(64),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    resolved_at DATETIME,
    resolved_by VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

CREATE TABLE IF NOT EXISTS incident_events (
    id VARCHAR(36) PRIMARY KEY,
    incident_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36),
    username VARCHAR(64),
    event_type VARCHAR(32) NOT NULL,
    notes TEXT,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS vlans (
    id VARCHAR(36) PRIMARY KEY,
    vlan_id INTEGER UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255),
    subnet VARCHAR(64) NOT NULL,
    gateway VARCHAR(45) NOT NULL,
    internet_status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
    fortigate_policy_id INTEGER,
    expected_endpoints INTEGER DEFAULT 0,
    expected_aps INTEGER DEFAULT 0,
    expected_classrooms INTEGER DEFAULT 0,
    last_state_change_at DATETIME,
    last_action_job_id VARCHAR(36),
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS action_jobs (
    id VARCHAR(36) PRIMARY KEY,
    job_number VARCHAR(32) UNIQUE NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    username VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    previous_state_json TEXT,
    new_state_json TEXT,
    api_request_json TEXT,
    api_response_json TEXT,
    verification_result_json TEXT,
    error_message TEXT,
    requested_at DATETIME NOT NULL,
    started_at DATETIME,
    completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_action_jobs_state ON action_jobs(state);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    username VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_type VARCHAR(32),
    target_id VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    previous_state_json TEXT,
    new_state_json TEXT,
    result VARCHAR(20) NOT NULL,
    reason TEXT,
    metadata_json TEXT,
    timestamp DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

CREATE TABLE IF NOT EXISTS sound_profiles (
    id VARCHAR(36) PRIMARY KEY,
    category_code VARCHAR(32) UNIQUE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    down_sound VARCHAR(128) NOT NULL,
    recovery_sound VARCHAR(128) NOT NULL,
    volume INTEGER NOT NULL DEFAULT 80,
    cooldown_seconds INTEGER NOT NULL DEFAULT 30,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sound_events (
    id VARCHAR(36) PRIMARY KEY,
    category_code VARCHAR(32) NOT NULL,
    event_type VARCHAR(20) NOT NULL,
    device_id VARCHAR(36),
    device_name VARCHAR(128),
    played_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS display_devices (
    id VARCHAR(36) PRIMARY KEY,
    display_uid VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45),
    resolution VARCHAR(32),
    browser_info VARCHAR(128),
    current_page VARCHAR(64),
    sound_enabled BOOLEAN NOT NULL DEFAULT 0,
    last_seen_at DATETIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    settings_json TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(64) UNIQUE NOT NULL,
    type VARCHAR(32) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONNECTED',
    last_sync_at DATETIME,
    last_error TEXT,
    last_error_at DATETIME,
    sync_count BIGINT DEFAULT 0,
    error_count BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(36) PRIMARY KEY,
    setting_key VARCHAR(64) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at DATETIME NOT NULL
);
