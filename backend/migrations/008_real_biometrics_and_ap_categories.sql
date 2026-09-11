-- Migration 008: Real Biometrics Building Distribution & Wireless AP Category Sync

-- 1. Sync Access Point category codes
UPDATE devices 
SET category_code = 'WIRELESS_AP' 
WHERE category_code = 'SWITCH' 
  AND (type LIKE '%AP%' OR type LIKE '%Access Point%' OR type LIKE '%Aruba%' OR type LIKE '%Ruckus%' OR name LIKE '%_AP');

-- 2. Populate accurate campus building and location mappings for all 66 biometric attendance readers
UPDATE biometric_metadata bm
JOIN devices d ON d.id = bm.device_id
SET 
  bm.building = 'Main Academic Block',
  bm.department = 'Academic Affairs',
  bm.location = CONCAT('Academic Block - ', d.ip_address),
  bm.purpose = 'Classroom & Faculty Attendance',
  bm.updated_at = CURRENT_TIMESTAMP
WHERE INET_ATON(d.ip_address) BETWEEN INET_ATON('10.10.24.11') AND INET_ATON('10.10.24.36');

UPDATE biometric_metadata bm
JOIN devices d ON d.id = bm.device_id
SET 
  bm.building = 'Boys Hostel Wing',
  bm.department = 'Student Housing (Men)',
  bm.location = CONCAT('Boys Hostel Block - ', d.ip_address),
  bm.purpose = 'Hostel Access & Curfew Tracking',
  bm.updated_at = CURRENT_TIMESTAMP
WHERE INET_ATON(d.ip_address) BETWEEN INET_ATON('10.10.24.37') AND INET_ATON('10.10.24.60');

UPDATE biometric_metadata bm
JOIN devices d ON d.id = bm.device_id
SET 
  bm.building = 'Girls Hostel Wing',
  bm.department = 'Student Housing (Women)',
  bm.location = CONCAT('Girls Hostel Block - ', d.ip_address),
  bm.purpose = 'Hostel Access & Curfew Tracking',
  bm.updated_at = CURRENT_TIMESTAMP
WHERE INET_ATON(d.ip_address) BETWEEN INET_ATON('10.10.24.61') AND INET_ATON('10.10.24.75');

UPDATE biometric_metadata bm
JOIN devices d ON d.id = bm.device_id
SET 
  bm.building = 'Dining Hall & Kitchen',
  bm.department = 'Hospitality & Dining',
  bm.location = CONCAT('Central Dining - ', d.ip_address),
  bm.purpose = 'Meal Attendance & Staff Punch',
  bm.updated_at = CURRENT_TIMESTAMP
WHERE INET_ATON(d.ip_address) BETWEEN INET_ATON('10.10.24.76') AND INET_ATON('10.10.24.85');

UPDATE biometric_metadata bm
JOIN devices d ON d.id = bm.device_id
SET 
  bm.building = 'Admin & Security Complex',
  bm.department = 'Security & Operations',
  bm.location = CONCAT('Security Turnstile - ', d.ip_address),
  bm.purpose = 'Turnstile & Perimeter Access',
  bm.updated_at = CURRENT_TIMESTAMP
WHERE INET_ATON(d.ip_address) BETWEEN INET_ATON('10.10.24.86') AND INET_ATON('10.10.24.254');
