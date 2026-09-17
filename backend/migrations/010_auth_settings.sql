-- KREA IT Operations Command Center
-- Migration 010: Authentication Mode & Password Login Policy Configuration

INSERT INTO system_settings (id, setting_key, setting_value, description, updated_at) VALUES
('set_auth_pass', 'auth_password_login_enabled', 'true', 'Enable or disable operator password-based login', CURRENT_TIMESTAMP),
('set_auth_mode', 'auth_mode', 'all', 'Authentication mode: all (password + google) or google_only', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO NOTHING;
