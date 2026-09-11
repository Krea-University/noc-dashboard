package events

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/sound"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

// TakeoverPayload provides data for full-screen NOC TV takeover on critical outages.
type TakeoverPayload struct {
	DeviceID        string    `json:"device_id"`
	DeviceName      string    `json:"device_name"`
	IPAddress       string    `json:"ip_address"`
	Location        string    `json:"location"`
	Severity        string    `json:"severity"`
	AffectedCount   int       `json:"affected_count"`
	DetectedAt      time.Time `json:"detected_at"`
	TimeoutSeconds  int       `json:"timeout_seconds"`
}

// RecoveryPayload provides data for the green recovery banner on TV.
type RecoveryPayload struct {
	DeviceID        string `json:"device_id"`
	DeviceName      string `json:"device_name"`
	IPAddress       string `json:"ip_address"`
	DowntimeSeconds int    `json:"downtime_seconds"`
	DowntimeString  string `json:"downtime_string"`
}

// Engine processes device state changes, alarms, TV takeovers, and downtime calculations.
type Engine struct {
	db          *database.DB
	soundEngine *sound.Engine
	wsHub       *websocket.Hub
	mu          sync.RWMutex
	lastState   map[string]string    // deviceID -> status (UP, DOWN, WARNING)
	downStart   map[string]time.Time // deviceID -> time when went down
}

// NewEngine initializes the state transition and event engine.
func NewEngine(db *database.DB, soundEngine *sound.Engine, wsHub *websocket.Hub) *Engine {
	e := &Engine{
		db:          db,
		soundEngine: soundEngine,
		wsHub:       wsHub,
		lastState:   make(map[string]string),
		downStart:   make(map[string]time.Time),
	}
	e.loadInitialStates()
	e.syncActiveIncidentsForDownDevices()
	return e
}

func (e *Engine) loadInitialStates() {
	e.mu.Lock()
	defer e.mu.Unlock()

	rows, err := e.db.Query("SELECT id, status, last_status_change_at FROM devices")
	if err != nil {
		slog.Error("failed loading initial device states", "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, status string
		var changeAt *time.Time
		if err := rows.Scan(&id, &status, &changeAt); err == nil {
			e.lastState[id] = status
			if status == "DOWN" && changeAt != nil {
				e.downStart[id] = *changeAt
			}
		}
	}
}

func (e *Engine) syncActiveIncidentsForDownDevices() {
	now := time.Now().UTC()
	rows, err := e.db.Query(`
		SELECT d.id, d.name, COALESCE(d.ip_address, ''), d.category_code, d.last_status_change_at
		FROM devices d
		WHERE d.status = 'DOWN'
	`)
	if err != nil {
		slog.Error("failed querying down devices for incidents", "error", err)
		return
	}
	defer rows.Close()

	idx := 1
	for rows.Next() {
		var id, name, ip, cat string
		var lastChange *time.Time
		if err := rows.Scan(&id, &name, &ip, &cat, &lastChange); err != nil {
			continue
		}
		var count int
		_ = e.db.QueryRow("SELECT COUNT(*) FROM incidents WHERE primary_device_id = ? AND status IN ('OPEN', 'INVESTIGATING', 'ACKNOWLEDGED')", id).Scan(&count)
		if count == 0 {
			incID := "inc_" + uuid.New().String()[:8]
			incNum := fmt.Sprintf("INC-%d-%03d", now.Year(), idx)
			incTitle := fmt.Sprintf("%s Unreachable / Outage Detected", name)
			alarmMsg := fmt.Sprintf("Infrastructure %s %s (%s) is unreachable (status DOWN)", cat, name, ip)
			ts := now
			if lastChange != nil && !lastChange.IsZero() {
				ts = *lastChange
			}
			_, _ = e.db.Exec(`
				INSERT INTO incidents (id, incident_number, title, description, severity, status, source_system, primary_device_id, affected_devices_count, created_at, updated_at)
				VALUES (?, ?, ?, ?, 'CRITICAL', 'OPEN', 'opmanager', ?, 1, ?, ?)`,
				incID, incNum, incTitle, alarmMsg, id, ts, now)
			idx++
		}
	}
}

// HandleDeviceTransition analyzes a device state report and executes transition actions.
func (e *Engine) HandleDeviceTransition(ctx context.Context, dev *models.Device) error {
	e.mu.Lock()
	previousState, hasPrev := e.lastState[dev.ID]
	newState := dev.Status
	now := time.Now().UTC()

	if !hasPrev {
		// First observation
		e.lastState[dev.ID] = newState
		if newState == "DOWN" {
			e.downStart[dev.ID] = now
		}
		e.mu.Unlock()
		return nil
	}

	// Steady states: UP -> UP, DOWN -> DOWN produce no alert or duplicate event
	if previousState == newState {
		e.mu.Unlock()
		return nil
	}

	// State change occurred! Update in-memory state
	e.lastState[dev.ID] = newState
	downStartTime, hadDownStart := e.downStart[dev.ID]
	if newState == "DOWN" {
		e.downStart[dev.ID] = now
	} else if newState == "UP" {
		delete(e.downStart, dev.ID)
	}
	e.mu.Unlock()

	slog.Warn("device state transition detected",
		"device", dev.Name, "id", dev.ID, "previous", previousState, "new", newState)

	// Persist status change in DB
	_, _ = e.db.Exec("UPDATE devices SET status = ?, last_status_change_at = ?, last_seen_at = ? WHERE id = ?",
		newState, now, now, dev.ID)

	// Case 1: UP -> DOWN or WARNING -> DOWN
	if newState == "DOWN" {
		// 1. Record in device_history
		histID := "dh_" + uuid.New().String()
		_, _ = e.db.Exec(`
			INSERT INTO device_history (id, device_id, previous_status, new_status, duration_seconds, timestamp)
			VALUES (?, ?, ?, ?, 0, ?)`, histID, dev.ID, previousState, newState, now)

		// 2. Trigger sound event (with category mapping and flood protection)
		alertPayload := e.soundEngine.ProcessStateChange(dev.CategoryCode, "DOWN", dev.Name)
		if alertPayload != nil {
			e.wsHub.Broadcast("SOUND_ALERT", alertPayload)
		}

		// 3. Create active alarm
		alarmID := "alm_" + uuid.New().String()
		alarmMsg := fmt.Sprintf("Device %s is unreachable (status DOWN)", dev.Name)
		_, _ = e.db.Exec(`
			INSERT INTO alarms (id, source_id, source_system, device_id, device_name, device_ip, severity, message, entity, first_seen_at, last_seen_at, acknowledged, cleared)
			VALUES (?, ?, 'opmanager', ?, ?, ?, 'CRITICAL', ?, 'ICMP/Telemetry', ?, ?, 0, 0)`,
			alarmID, alarmID, dev.ID, dev.Name, dev.IPAddress, alarmMsg, now, now)

		// 4. Create Incident
		incID := "inc_" + uuid.New().String()
		incNum := fmt.Sprintf("INC-%d-%03d", now.Year(), now.Unix()%1000)
		incTitle := fmt.Sprintf("%s Unreachable / Outage Detected", dev.Name)
		_, _ = e.db.Exec(`
			INSERT INTO incidents (id, incident_number, title, description, severity, status, source_system, primary_device_id, affected_devices_count, created_at, updated_at)
			VALUES (?, ?, ?, ?, 'CRITICAL', 'OPEN', 'opmanager', ?, 1, ?, ?)`,
			incID, incNum, incTitle, alarmMsg, dev.ID, now, now)

		// 5. Critical TV Takeover Check
		if isCriticalDevice(dev) {
			takeover := TakeoverPayload{
				DeviceID:       dev.ID,
				DeviceName:     dev.Name,
				IPAddress:      dev.IPAddress,
				Location:       dev.LocationName,
				Severity:       "CRITICAL",
				AffectedCount:  calculateAffectedCount(dev),
				DetectedAt:     now,
				TimeoutSeconds: 45,
			}
			e.wsHub.Broadcast("CRITICAL_TAKEOVER", takeover)
		}

		// 6. Broadcast state change and alarm creation to all dashboards
		e.wsHub.Broadcast("DEVICE_STATUS_CHANGED", map[string]interface{}{
			"device_id": dev.ID, "name": dev.Name, "status": "DOWN", "previous_status": previousState,
		})
		e.wsHub.Broadcast("ALARM_CREATED", map[string]interface{}{
			"alarm_id": alarmID, "device_name": dev.Name, "severity": "CRITICAL", "message": alarmMsg,
		})
		e.wsHub.Broadcast("INCIDENT_CREATED", map[string]interface{}{
			"incident_id": incID, "incident_number": incNum, "title": incTitle, "severity": "CRITICAL",
		})
	}

	// Case 2: DOWN -> UP (Recovery)
	if previousState == "DOWN" && newState == "UP" {
		downtimeSecs := 0
		if hadDownStart {
			downtimeSecs = int(now.Sub(downStartTime).Seconds())
		}

		// 1. Record recovery in device_history with duration
		histID := "dh_" + uuid.New().String()
		_, _ = e.db.Exec(`
			INSERT INTO device_history (id, device_id, previous_status, new_status, duration_seconds, timestamp)
			VALUES (?, ?, ?, ?, ?, ?)`, histID, dev.ID, previousState, newState, downtimeSecs, now)

		// 2. Trigger recovery sound
		alertPayload := e.soundEngine.ProcessStateChange(dev.CategoryCode, "RECOVERY", dev.Name)
		if alertPayload != nil {
			e.wsHub.Broadcast("SOUND_ALERT", alertPayload)
		}

		// 3. Mark active alarms cleared
		_, _ = e.db.Exec(`
			UPDATE alarms
			SET cleared = 1, cleared_at = ?
			WHERE device_id = ? AND cleared = 0`, now, dev.ID)

		// 3b. Mark open incidents resolved
		_, _ = e.db.Exec(`
			UPDATE incidents
			SET status = 'RESOLVED', updated_at = ?
			WHERE primary_device_id = ? AND status IN ('OPEN', 'INVESTIGATING', 'ACKNOWLEDGED')`, now, dev.ID)

		// 4. Broadcast Recovery Banner
		downtimeStr := formatDuration(downtimeSecs)
		recovery := RecoveryPayload{
			DeviceID:        dev.ID,
			DeviceName:      dev.Name,
			IPAddress:       dev.IPAddress,
			DowntimeSeconds: downtimeSecs,
			DowntimeString:  downtimeStr,
		}
		e.wsHub.Broadcast("DEVICE_RECOVERED", recovery)

		// 5. Broadcast status update
		e.wsHub.Broadcast("DEVICE_STATUS_CHANGED", map[string]interface{}{
			"device_id": dev.ID, "name": dev.Name, "status": "UP", "previous_status": previousState, "downtime": downtimeStr,
		})
		e.wsHub.Broadcast("ALARM_CLEARED", map[string]interface{}{
			"device_id": dev.ID, "device_name": dev.Name,
		})
	}

	return nil
}

func isCriticalDevice(dev *models.Device) bool {
	if dev.CategoryCode == "SWITCH" && (dev.Type == "Core Switch" || dev.Type == "Distribution Switch") {
		return true
	}
	if dev.CategoryCode == "ILL" {
		return true
	}
	if dev.CategoryCode == "SERVER" && (dev.Name == "SRV-ERP-DB01" || dev.Name == "SRV-AD-DC01") {
		return true
	}
	return false
}

func calculateAffectedCount(dev *models.Device) int {
	if dev.Name == "SW-CORE-01" || dev.Name == "SW-CORE-02" {
		return 127
	}
	if dev.CategoryCode == "ILL" {
		return 1138
	}
	if dev.Type == "Distribution Switch" {
		return 42
	}
	return 1
}

func formatDuration(seconds int) string {
	if seconds < 60 {
		return fmt.Sprintf("%ds", seconds)
	}
	mins := seconds / 60
	secs := seconds % 60
	if mins < 60 {
		return fmt.Sprintf("%dm %ds", mins, secs)
	}
	hours := mins / 60
	mins = mins % 60
	return fmt.Sprintf("%dh %dm %ds", hours, mins, secs)
}
