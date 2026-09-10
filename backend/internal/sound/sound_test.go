package sound_test

import (
	"fmt"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/sound"
)

func setupTestDB(t *testing.T) *database.DB {
	cfg := &config.Config{
		DBDriver: "sqlite",
		DBName:   ":memory:",
	}
	db, err := database.Connect(cfg)
	if err != nil {
		t.Fatalf("failed connecting test db: %v", err)
	}

	createSQL := `
	CREATE TABLE sound_profiles (
		id VARCHAR(36) PRIMARY KEY,
		category_code VARCHAR(32) UNIQUE NOT NULL,
		enabled BOOLEAN NOT NULL DEFAULT 1,
		down_sound VARCHAR(128) NOT NULL,
		recovery_sound VARCHAR(128) NOT NULL,
		volume INTEGER NOT NULL DEFAULT 80,
		cooldown_seconds INTEGER NOT NULL DEFAULT 30,
		updated_at DATETIME NOT NULL
	);
	INSERT INTO sound_profiles VALUES
	('1', 'SWITCH', 1, 'switch-down.mp3', 'switch-recovered.mp3', 80, 30, CURRENT_TIMESTAMP),
	('2', 'SERVER', 1, 'server-down.mp3', 'server-recovered.mp3', 80, 30, CURRENT_TIMESTAMP),
	('3', 'BIOMETRIC', 1, 'biometric-down.mp3', 'biometric-recovered.mp3', 75, 30, CURRENT_TIMESTAMP),
	('4', 'ILL', 1, 'ill-down.mp3', 'ill-recovered.mp3', 80, 30, CURRENT_TIMESTAMP),
	('5', 'CLASSROOM', 0, 'none', 'none', 0, 30, CURRENT_TIMESTAMP);`

	_, err = db.Exec(createSQL)
	if err != nil {
		t.Fatalf("failed seeding sound profiles: %v", err)
	}

	return db
}

func TestSoundChannelsAndMuting(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	engine := sound.NewEngine(db)

	// 1. SWITCH down
	alert := engine.ProcessStateChange("SWITCH", "DOWN", "SW-CORE-01")
	if alert == nil {
		t.Fatal("expected SWITCH alert to be non-nil")
	}
	if alert.Channel != "SWITCH" || alert.Action != "DOWN" || alert.Volume != 80 {
		t.Errorf("unexpected alert payload: %+v", alert)
	}

	// 2. SERVER down
	serverAlert := engine.ProcessStateChange("SERVER", "DOWN", "SRV-ERP-DB01")
	if serverAlert == nil {
		t.Fatal("expected SERVER alert to be non-nil")
	}
	if serverAlert.Channel != "SERVER" || serverAlert.SoundFile != "server-down.mp3" {
		t.Errorf("unexpected server alert payload: %+v", serverAlert)
	}

	// 3. BIOMETRIC down
	bioAlert := engine.ProcessStateChange("BIOMETRIC", "DOWN", "BIO-003-LIB-ENTRY")
	if bioAlert == nil {
		t.Fatal("expected BIOMETRIC alert to be non-nil")
	}
	if bioAlert.Channel != "BIOMETRIC" || bioAlert.Volume != 75 {
		t.Errorf("unexpected biometric alert: %+v", bioAlert)
	}

	// 4. ILL down
	illAlert := engine.ProcessStateChange("ILL", "DOWN", "ILL-TATA-PRIMARY-1Gbps")
	if illAlert == nil {
		t.Fatal("expected ILL alert to be non-nil")
	}
	if illAlert.Channel != "ILL" {
		t.Errorf("unexpected ILL alert: %+v", illAlert)
	}

	// 5. CLASSROOM must be strictly MUTED
	classAlert := engine.ProcessStateChange("CLASSROOM", "DOWN", "SW-CLASS-201")
	if classAlert != nil {
		t.Errorf("CLASSROOM must be muted by default, got: %+v", classAlert)
	}
}

func TestFloodProtection(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	engine := sound.NewEngine(db)

	// Simulate 40 switches failing simultaneously (e.g. upstream core switch power failure)
	var alertedCount = 0
	for i := 1; i <= 40; i++ {
		devName := fmt.Sprintf("SW-ACC-%02d", i)
		alert := engine.ProcessStateChange("SWITCH", "DOWN", devName)
		if alert != nil {
			alertedCount++
		}
	}

	// Flood protection MUST ensure only 1 sound alert plays within the 30s cooldown window!
	if alertedCount != 1 {
		t.Fatalf("expected flood protection to allow exactly 1 alert for 40 failing switches, got %d", alertedCount)
	}
}
