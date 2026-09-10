package sound

import (
	"log/slog"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// AlertPayload represents a sound event broadcast over WebSocket.
type AlertPayload struct {
	Channel      string `json:"channel"` // SWITCH, SERVER, BIOMETRIC, ILL
	Action       string `json:"action"`  // DOWN, RECOVERY
	SoundFile    string `json:"sound_file"`
	Volume       int    `json:"volume"`
	DeviceName   string `json:"device_name"`
	CategoryCode string `json:"category_code"`
	IsGrouped    bool   `json:"is_grouped"`
	GroupCount   int    `json:"group_count"`
}

// Engine manages 4-channel audio alert dispatching with flood protection.
type Engine struct {
	db          *database.DB
	mu          sync.Mutex
	lastPlayed  map[string]time.Time // channel+action -> timestamp
	cooldowns   map[string]time.Duration
	surgeCounts map[string]int
}

// NewEngine initializes the sound alert engine.
func NewEngine(db *database.DB) *Engine {
	e := &Engine{
		db:          db,
		lastPlayed:  make(map[string]time.Time),
		cooldowns:   make(map[string]time.Duration),
		surgeCounts: make(map[string]int),
	}
	e.loadProfiles()
	return e
}

// loadProfiles queries current sound profiles from the database.
func (e *Engine) loadProfiles() {
	e.mu.Lock()
	defer e.mu.Unlock()

	rows, err := e.db.Query("SELECT category_code, cooldown_seconds FROM sound_profiles")
	if err != nil {
		slog.Error("failed loading sound profiles for cooldowns", "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cat string
		var cd int
		if err := rows.Scan(&cat, &cd); err == nil {
			if cd <= 0 {
				cd = 30
			}
			e.cooldowns[cat] = time.Duration(cd) * time.Second
		}
	}
}

// ProcessStateChange evaluates if a sound should play based on category, state change, and flood cooldown.
// Returns an AlertPayload if sound should play, or nil if muted or suppressed by flood protection.
func (e *Engine) ProcessStateChange(categoryCode, action, deviceName string) *AlertPayload {
	e.mu.Lock()
	defer e.mu.Unlock()

	// 1. Check if category is classroom (strictly muted)
	if categoryCode == "CLASSROOM" {
		return nil
	}

	// 2. Query profile from DB
	var profile models.SoundProfile
	var enabledInt int
	query := `
	SELECT category_code, enabled, down_sound, recovery_sound, volume, cooldown_seconds
	FROM sound_profiles
	WHERE category_code = ?`
	err := e.db.QueryRow(query, categoryCode).Scan(
		&profile.CategoryCode, &enabledInt, &profile.DownSound, &profile.RecoverySound,
		&profile.Volume, &profile.CooldownSeconds,
	)
	if err != nil {
		// Fallback for unconfigured categories: map to SWITCH
		query = `
		SELECT category_code, enabled, down_sound, recovery_sound, volume, cooldown_seconds
		FROM sound_profiles
		WHERE category_code = 'SWITCH'`
		_ = e.db.QueryRow(query).Scan(
			&profile.CategoryCode, &enabledInt, &profile.DownSound, &profile.RecoverySound,
			&profile.Volume, &profile.CooldownSeconds,
		)
	}
	profile.Enabled = enabledInt == 1

	if !profile.Enabled {
		return nil
	}

	// 3. Flood Protection: Check cooldown for category + action
	key := categoryCode + "_" + action
	cooldown := time.Duration(profile.CooldownSeconds) * time.Second
	if cooldown <= 0 {
		cooldown = 30 * time.Second
	}

	lastTime, exists := e.lastPlayed[key]
	now := time.Now().UTC()

	if exists && now.Sub(lastTime) < cooldown {
		// Surge / Flood detected within cooldown window: increment suppressed count
		e.surgeCounts[key]++
		slog.Debug("sound alert suppressed by flood protection",
			"category", categoryCode, "action", action, "device", deviceName,
			"surge_count", e.surgeCounts[key], "cooldown_remaining", (cooldown - now.Sub(lastTime)).String())
		return nil
	}

	// Cooldown expired or first alert: reset surge count and update timestamp
	count := e.surgeCounts[key]
	e.surgeCounts[key] = 0
	e.lastPlayed[key] = now

	soundFile := profile.DownSound
	if action == "RECOVERY" {
		soundFile = profile.RecoverySound
	}

	slog.Info("dispatching sound alert",
		"channel", categoryCode, "action", action, "device", deviceName, "volume", profile.Volume)

	return &AlertPayload{
		Channel:      categoryCode,
		Action:       action,
		SoundFile:    soundFile,
		Volume:       profile.Volume,
		DeviceName:   deviceName,
		CategoryCode: categoryCode,
		IsGrouped:    count > 0,
		GroupCount:   count + 1,
	}
}

// ResetCooldowns clears the surge and cooldown states (useful for tests).
func (e *Engine) ResetCooldowns() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.lastPlayed = make(map[string]time.Time)
	e.surgeCounts = make(map[string]int)
}
