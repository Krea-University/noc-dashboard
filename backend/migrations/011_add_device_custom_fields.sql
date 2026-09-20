-- KREA IT Operations Command Center
-- Migration 011: Add Building & Floor to Devices and Biometric Metadata

ALTER TABLE devices ADD COLUMN building VARCHAR(64) DEFAULT NULL;
ALTER TABLE devices ADD COLUMN floor VARCHAR(64) DEFAULT NULL;
ALTER TABLE biometric_metadata ADD COLUMN floor VARCHAR(64) DEFAULT NULL;

-- Clear previous prototype/guessed building and location strings from biometric_metadata
-- so authentic Zoho OpManager custom fields take immediate precedence
UPDATE biometric_metadata 
SET building = NULL, floor = NULL, location = NULL, department = NULL, purpose = NULL
WHERE building IN (
    'Main Academic Block',
    'Boys Hostel Wing',
    'Girls Hostel Wing',
    'Dining Hall & Kitchen',
    'Admin & Security Complex',
    'Campus Facility',
    'Main Campus',
    'Campus Main'
);
