package displays

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// Service coordinates NOC TV wall displays and their heartbeats.
type Service struct {
	db *database.DB
}

// NewService creates a new displays service.
func NewService(db *database.DB) *Service {
	return &Service{db: db}
}

// Heartbeat records a live ping from a NOC TV display client.
func (s *Service) Heartbeat(ctx context.Context, d *models.DisplayDevice) error {
	now := time.Now().UTC()
	d.LastSeenAt = now
	d.Status = "ONLINE"

	// Upsert display record
	var existingID string
	err := s.db.QueryRowContext(ctx, "SELECT id FROM display_devices WHERE display_uid = ?", d.DisplayUID).Scan(&existingID)
	if err != nil {
		d.ID = "disp_" + uuid.New().String()[:8]
		d.CreatedAt = now
		d.UpdatedAt = now
		insertSQL := `
		INSERT INTO display_devices (id, display_uid, name, ip_address, resolution, browser_info, current_page, sound_enabled, last_seen_at, status, settings_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err = s.db.ExecContext(ctx, insertSQL,
			d.ID, d.DisplayUID, d.Name, d.IPAddress, d.Resolution, d.BrowserInfo,
			d.CurrentPage, d.SoundEnabled, d.LastSeenAt, d.Status, d.SettingsJSON, d.CreatedAt, d.UpdatedAt)
		return err
	}

	updateSQL := `
	UPDATE display_devices
	SET name = ?, ip_address = ?, resolution = ?, browser_info = ?, current_page = ?, sound_enabled = ?, last_seen_at = ?, status = 'ONLINE', updated_at = ?
	WHERE display_uid = ?`
	_, err = s.db.ExecContext(ctx, updateSQL,
		d.Name, d.IPAddress, d.Resolution, d.BrowserInfo, d.CurrentPage, d.SoundEnabled, d.LastSeenAt, now, d.DisplayUID)
	return err
}

// ListDisplays returns all registered displays and updates stale states.
func (s *Service) ListDisplays(ctx context.Context) ([]models.DisplayDevice, error) {
	now := time.Now().UTC()
	staleThreshold := now.Add(-90 * time.Second)
	offlineThreshold := now.Add(-5 * time.Minute)

	// Update stale and offline statuses
	_, _ = s.db.ExecContext(ctx, "UPDATE display_devices SET status = 'STALE' WHERE last_seen_at < ? AND last_seen_at >= ?", staleThreshold, offlineThreshold)
	_, _ = s.db.ExecContext(ctx, "UPDATE display_devices SET status = 'OFFLINE' WHERE last_seen_at < ?", offlineThreshold)

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, display_uid, name, ip_address, resolution, browser_info, current_page, sound_enabled, last_seen_at, status, settings_json, created_at, updated_at
		FROM display_devices
		ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed querying displays: %w", err)
	}
	defer rows.Close()

	var displays []models.DisplayDevice
	for rows.Next() {
		var d models.DisplayDevice
		var ip, res, browser, page, settings *string
		err := rows.Scan(
			&d.ID, &d.DisplayUID, &d.Name, &ip, &res, &browser, &page,
			&d.SoundEnabled, &d.LastSeenAt, &d.Status, &settings, &d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if ip != nil {
			d.IPAddress = *ip
		}
		if res != nil {
			d.Resolution = *res
		}
		if browser != nil {
			d.BrowserInfo = *browser
		}
		if page != nil {
			d.CurrentPage = *page
		}
		if settings != nil {
			d.SettingsJSON = *settings
		}
		displays = append(displays, d)
	}

	return displays, nil
}
