CREATE TABLE IF NOT EXISTS custom_endpoint_groups (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    group_type VARCHAR(64) NOT NULL DEFAULT 'Computers',
    category VARCHAR(64) NOT NULL DEFAULT 'Custom Groups',
    description VARCHAR(255),
    match_type VARCHAR(32) NOT NULL DEFAULT 'HOSTNAME_PREFIX',
    match_value VARCHAR(255) NOT NULL,
    color VARCHAR(32) DEFAULT 'indigo',
    created_by VARCHAR(64) DEFAULT 'admin',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

INSERT INTO custom_endpoint_groups (id, name, group_type, category, description, match_type, match_value, color, created_by, created_at, updated_at) VALUES
('cg_ai_lab', 'AI & Machine Learning Lab', 'Computers', 'Custom Groups', 'High-performance GPU computing workstations for Deep Learning & Generative AI', 'HOSTNAME_PREFIX', 'DATASCIENCE', 'violet', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cg_exec_venues', 'Executive Meeting Rooms', 'Computers', 'Custom Groups', 'Conference room podiums, interactive screens & video conferencing terminals', 'HOSTNAME_CONTAINS', 'VENUE', 'emerald', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;
