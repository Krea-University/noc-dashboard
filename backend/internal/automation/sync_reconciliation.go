package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

// SyncDeviceItem represents an individual device evaluated during reconciliation.
type SyncDeviceItem struct {
	ID           string   `json:"id"`
	SourceID     string   `json:"source_id"`
	SourceSystem string   `json:"source_system"`
	Name         string   `json:"name"`
	IPAddress    string   `json:"ip_address"`
	CategoryCode string   `json:"category_code"`
	Building     string   `json:"building,omitempty"`
	Floor        string   `json:"floor,omitempty"`
	Type         string   `json:"type"`
	Vendor       string   `json:"vendor"`
	Model        string   `json:"model"`
	Status       string   `json:"status"`
	Reason       string   `json:"reason,omitempty"`
	DiffFields   []string `json:"diff_fields,omitempty"`
}

// SyncPreviewResult contains the pre-execution reconciliation plan.
type SyncPreviewResult struct {
	GeneratedAt     time.Time `json:"generated_at"`
	UpstreamSummary struct {
		OpManagerDevices  int `json:"opmanager_devices"`
		EndpointComputers int `json:"endpoint_computers"`
		FortiGateVlans    int `json:"fortigate_vlans"`
	} `json:"upstream_summary"`
	LocalSummary struct {
		TotalDevices   int `json:"total_devices"`
		TotalEndpoints int `json:"total_endpoints"`
		TotalVLANs     int `json:"total_vlans"`
	} `json:"local_summary"`
	ToAdd    []SyncDeviceItem `json:"to_add"`
	ToUpdate []SyncDeviceItem `json:"to_update"`
	ToRemove []SyncDeviceItem `json:"to_remove"`
	Counts   struct {
		AddCount    int `json:"add_count"`
		UpdateCount int `json:"update_count"`
		RemoveCount int `json:"remove_count"`
	} `json:"counts"`
}

// SyncExecuteRequest parameters supplied by operator to execute reconciliation.
type SyncExecuteRequest struct {
	RemoveMode        string   `json:"remove_mode"` // "decommission" (default) or "purge"
	SelectedAddIDs    []string `json:"selected_add_ids,omitempty"`
	SelectedRemoveIDs []string `json:"selected_remove_ids,omitempty"`
	Reason            string   `json:"reason"`
}

// SyncExecuteResult summaries the execution report.
type SyncExecuteResult struct {
	JobID        string    `json:"job_id"`
	StartedAt    time.Time `json:"started_at"`
	CompletedAt  time.Time `json:"completed_at"`
	DurationMs   int64     `json:"duration_ms"`
	Status       string    `json:"status"`
	AddedCount   int       `json:"added_count"`
	UpdatedCount int       `json:"updated_count"`
	RemovedCount int       `json:"removed_count"`
	RemoveMode   string    `json:"remove_mode"`
	AuditLogID   string    `json:"audit_log_id,omitempty"`
	Message      string    `json:"message"`
}

// SyncReconciliationEngine manages full discovery and reconciliation with external systems.
type SyncReconciliationEngine struct {
	db          *database.DB
	nmsProvider integrations.NMSProvider
	epcProvider integrations.EndpointProvider
	fgProvider  integrations.FirewallProvider
	auditSvc    *audit.Service
	wsHub       *websocket.Hub
	mu          sync.Mutex
}

// NewSyncReconciliationEngine creates a new reconciliation engine.
func NewSyncReconciliationEngine(
	db *database.DB,
	nms integrations.NMSProvider,
	epc integrations.EndpointProvider,
	fg integrations.FirewallProvider,
	auditSvc *audit.Service,
	wsHub *websocket.Hub,
) *SyncReconciliationEngine {
	return &SyncReconciliationEngine{
		db:          db,
		nmsProvider: nms,
		epcProvider: epc,
		fgProvider:  fg,
		auditSvc:    auditSvc,
		wsHub:       wsHub,
	}
}

// PreviewSync analyzes upstream vs local state without modifying any data.
func (e *SyncReconciliationEngine) PreviewSync(ctx context.Context) (*SyncPreviewResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.previewSyncUnlocked(ctx)
}

func (e *SyncReconciliationEngine) previewSyncUnlocked(ctx context.Context) (*SyncPreviewResult, error) {
	res := &SyncPreviewResult{
		GeneratedAt: time.Now().UTC(),
		ToAdd:       make([]SyncDeviceItem, 0),
		ToUpdate:    make([]SyncDeviceItem, 0),
		ToRemove:    make([]SyncDeviceItem, 0),
	}

	// 1. Fetch live upstream devices from OpManager
	upstreamDevices, err := e.nmsProvider.GetDevices(ctx)
	if err != nil {
		slog.Warn("sync reconciliation preview: opmanager fetch warning", "error", err)
	}
	res.UpstreamSummary.OpManagerDevices = len(upstreamDevices)

	// Fetch upstream endpoints & VLANs for summary stats
	if e.epcProvider != nil {
		if computers, epcErr := e.epcProvider.GetComputers(ctx); epcErr == nil {
			res.UpstreamSummary.EndpointComputers = len(computers)
		}
	}
	if e.fgProvider != nil {
		if vlans, fgErr := e.fgProvider.GetVlans(ctx); fgErr == nil {
			res.UpstreamSummary.FortiGateVlans = len(vlans)
		}
	}

	// 2. Fetch local devices from DB
	localRows, err := e.db.QueryContext(ctx, `
		SELECT id, source_id, source_system, name, ip_address, category_code, COALESCE(building, '-'), COALESCE(floor, '-'), type, vendor, model, status
		FROM devices`)
	if err != nil {
		return nil, fmt.Errorf("failed querying local devices: %w", err)
	}
	defer localRows.Close()

	type localDev struct {
		id           string
		sourceID     string
		sourceSystem string
		name         string
		ipAddress    string
		categoryCode string
		building     string
		floor        string
		devType      string
		vendor       string
		model        string
		status       string
	}

	localByName := make(map[string]localDev)
	localBySourceID := make(map[string]localDev)
	allLocal := make([]localDev, 0)

	for localRows.Next() {
		var ld localDev
		var srcID, vendor, model *string
		_ = localRows.Scan(&ld.id, &srcID, &ld.sourceSystem, &ld.name, &ld.ipAddress, &ld.categoryCode, &ld.building, &ld.floor, &ld.devType, &vendor, &model, &ld.status)
		if srcID != nil {
			ld.sourceID = *srcID
		}
		if vendor != nil {
			ld.vendor = *vendor
		}
		if model != nil {
			ld.model = *model
		}

		cleanName := strings.ToLower(strings.TrimSpace(ld.name))
		localByName[cleanName] = ld
		if ld.sourceID != "" {
			localBySourceID[ld.sourceID] = ld
		}
		allLocal = append(allLocal, ld)
	}

	res.LocalSummary.TotalDevices = len(allLocal)
	_ = e.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM endpoints").Scan(&res.LocalSummary.TotalEndpoints)
	_ = e.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM vlans").Scan(&res.LocalSummary.TotalVLANs)

	// 3. Compute Additions and Updates
	matchedLocalIDs := make(map[string]bool)

	for _, up := range upstreamDevices {
		cleanUpName := strings.ToLower(strings.TrimSpace(up.Name))
		existing, found := localByName[cleanUpName]
		if !found && up.SourceID != "" {
			existing, found = localBySourceID[up.SourceID]
		}

		if !found {
			// Newly discovered device to add
			res.ToAdd = append(res.ToAdd, SyncDeviceItem{
				ID:           "upstream_" + up.SourceID,
				SourceID:     up.SourceID,
				SourceSystem: "opmanager",
				Name:         up.Name,
				IPAddress:    up.IPAddress,
				CategoryCode: up.CategoryCode,
				Building:     up.Building,
				Floor:        up.Floor,
				Type:         up.Type,
				Vendor:       up.Vendor,
				Model:        up.Model,
				Status:       up.Status,
				Reason:       "New device discovered in OpManager inventory",
			})
		} else {
			matchedLocalIDs[existing.id] = true
			diffs := make([]string, 0)
			if existing.ipAddress != up.IPAddress && up.IPAddress != "" {
				diffs = append(diffs, fmt.Sprintf("IP: %s → %s", existing.ipAddress, up.IPAddress))
			}
			if existing.status != up.Status && up.Status != "" {
				diffs = append(diffs, fmt.Sprintf("Status: %s → %s", existing.status, up.Status))
			}
			if existing.categoryCode != up.CategoryCode && up.CategoryCode != "" {
				diffs = append(diffs, fmt.Sprintf("Category: %s → %s", existing.categoryCode, up.CategoryCode))
			}
			if up.Building != "" && up.Building != "-" && existing.building != up.Building {
				diffs = append(diffs, fmt.Sprintf("Building: %s → %s", existing.building, up.Building))
			}
			if up.Floor != "" && up.Floor != "-" && existing.floor != up.Floor {
				diffs = append(diffs, fmt.Sprintf("Floor: %s → %s", existing.floor, up.Floor))
			}

			if len(diffs) > 0 {
				res.ToUpdate = append(res.ToUpdate, SyncDeviceItem{
					ID:           existing.id,
					SourceID:     up.SourceID,
					SourceSystem: existing.sourceSystem,
					Name:         existing.name,
					IPAddress:    up.IPAddress,
					CategoryCode: up.CategoryCode,
					Building:     up.Building,
					Floor:        up.Floor,
					Type:         up.Type,
					Vendor:       up.Vendor,
					Model:        up.Model,
					Status:       up.Status,
					DiffFields:   diffs,
					Reason:       strings.Join(diffs, ", "),
				})
			}
		}
	}

	// 4. Compute Removals (Devices in NOC whose source_system is OpManager but missing in upstream scan)
	for _, ld := range allLocal {
		if ld.sourceSystem == "opmanager" && !matchedLocalIDs[ld.id] && ld.status != "DECOMMISSIONED" {
			res.ToRemove = append(res.ToRemove, SyncDeviceItem{
				ID:           ld.id,
				SourceID:     ld.sourceID,
				SourceSystem: ld.sourceSystem,
				Name:         ld.name,
				IPAddress:    ld.ipAddress,
				CategoryCode: ld.categoryCode,
				Type:         ld.devType,
				Vendor:       ld.vendor,
				Model:        ld.model,
				Status:       ld.status,
				Reason:       "No longer reported by OpManager (decommissioned or retired)",
			})
		}
	}

	res.Counts.AddCount = len(res.ToAdd)
	res.Counts.UpdateCount = len(res.ToUpdate)
	res.Counts.RemoveCount = len(res.ToRemove)

	return res, nil
}

// ExecuteSync executes confirmed reconciliation adjustments.
func (e *SyncReconciliationEngine) ExecuteSync(
	ctx context.Context,
	req *SyncExecuteRequest,
	actorName, actorID, ip, ua string,
) (*SyncExecuteResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	startTime := time.Now().UTC()
	jobID := "SYNC-" + startTime.Format("20060102-150405") + "-" + uuid.New().String()[:4]

	cleanReason := strings.TrimSpace(req.Reason)
	if cleanReason == "" {
		cleanReason = "Scheduled infrastructure full sync & reconciliation"
	}

	removeMode := strings.ToLower(strings.TrimSpace(req.RemoveMode))
	if removeMode != "purge" {
		removeMode = "decommission"
	}

	// Preview first to gather diffs
	preview, err := e.previewSyncUnlocked(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed generating reconciliation preview: %w", err)
	}

	selectedAddMap := make(map[string]bool)
	for _, id := range req.SelectedAddIDs {
		selectedAddMap[id] = true
	}

	selectedRemoveMap := make(map[string]bool)
	for _, id := range req.SelectedRemoveIDs {
		selectedRemoveMap[id] = true
	}

	tx, err := e.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed beginning transaction: %w", err)
	}
	defer tx.Rollback()

	addedCount := 0
	updatedCount := 0
	removedCount := 0
	now := time.Now().UTC()

	// 1. Process Additions
	for _, item := range preview.ToAdd {
		if len(req.SelectedAddIDs) > 0 && !selectedAddMap[item.ID] && !selectedAddMap[item.Name] {
			continue
		}

		newID := "dev_" + uuid.New().String()[:8]
		bldg := item.Building
		if bldg == "" {
			bldg = "-"
		}
		flr := item.Floor
		if flr == "" {
			flr = "-"
		}
		insertSQL := `
			INSERT INTO devices (
				id, source_id, source_system, name, ip_address, category_code, 
				building, floor, type, vendor, model, status, availability_pct, response_time_ms, 
				cpu_pct, mem_pct, disk_pct, last_seen_at, last_status_change_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100.0, 5, 0.0, 0.0, 0.0, ?, ?, ?, ?)`
		_, err := tx.ExecContext(ctx, insertSQL,
			newID, item.SourceID, "opmanager", item.Name, item.IPAddress, item.CategoryCode,
			bldg, flr, item.Type, item.Vendor, item.Model, item.Status, now, now, now, now,
		)
		if err != nil {
			slog.Error("failed inserting discovered device during sync", "name", item.Name, "error", err)
			continue
		}

		// If biometric, create biometric_metadata entry with real building & floor
		if item.CategoryCode == "BIOMETRIC" {
			bmID := "bm_" + uuid.New().String()[:8]
			_, _ = tx.ExecContext(ctx, `
				INSERT INTO biometric_metadata (id, device_id, vendor, model, building, floor, location, department, purpose, contact_person, notes, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, '-', '-', 'Biometric Attendance', '-', 'Auto-discovered via Full Sync', ?)`,
				bmID, newID, item.Vendor, item.Model, bldg, flr, now)
		}

		addedCount++
	}

	// 2. Process Updates
	for _, item := range preview.ToUpdate {
		bldg := item.Building
		if bldg == "" {
			bldg = "-"
		}
		flr := item.Floor
		if flr == "" {
			flr = "-"
		}
		updateSQL := `
			UPDATE devices
			SET ip_address = ?, category_code = ?, building = CASE WHEN ? != '-' THEN ? ELSE building END, floor = CASE WHEN ? != '-' THEN ? ELSE floor END, type = ?, status = ?, last_seen_at = ?, updated_at = ?
			WHERE id = ?`
		_, err := tx.ExecContext(ctx, updateSQL, item.IPAddress, item.CategoryCode, bldg, bldg, flr, flr, item.Type, item.Status, now, now, item.ID)
		if err == nil {
			if item.CategoryCode == "BIOMETRIC" && (bldg != "-" || flr != "-") {
				_, _ = tx.ExecContext(ctx, `
					UPDATE biometric_metadata
					SET building = CASE WHEN ? != '-' THEN ? ELSE building END,
					    floor = CASE WHEN ? != '-' THEN ? ELSE floor END,
					    updated_at = ?
					WHERE device_id = ?`,
					bldg, bldg, flr, flr, now, item.ID)
			}
			updatedCount++
		}
	}

	// 3. Process Removals / Decommissioning
	for _, item := range preview.ToRemove {
		if len(req.SelectedRemoveIDs) > 0 && !selectedRemoveMap[item.ID] && !selectedRemoveMap[item.Name] {
			continue
		}

		if removeMode == "purge" {
			// Hard delete: remove alarms, telemetry, interfaces, then device
			_, _ = tx.ExecContext(ctx, "DELETE FROM alarms WHERE device_id = ? OR device_name = ?", item.ID, item.Name)
			_, _ = tx.ExecContext(ctx, "DELETE FROM biometric_metadata WHERE device_id = ?", item.ID)
			_, _ = tx.ExecContext(ctx, "DELETE FROM interfaces WHERE device_id = ?", item.ID)
			_, _ = tx.ExecContext(ctx, "DELETE FROM device_telemetry WHERE device_id = ?", item.ID)
			_, _ = tx.ExecContext(ctx, "DELETE FROM device_history WHERE device_id = ?", item.ID)
			res, err := tx.ExecContext(ctx, "DELETE FROM devices WHERE id = ?", item.ID)
			if err == nil {
				aff, _ := res.RowsAffected()
				if aff > 0 {
					removedCount++
				}
			}
		} else {
			// Decommission mode (safe): mark status DECOMMISSIONED and clear active alerts
			_, err := tx.ExecContext(ctx, "UPDATE devices SET status = 'DECOMMISSIONED', updated_at = ? WHERE id = ?", now, item.ID)
			if err == nil {
				// Clear active alarms for decommissioned device
				_, _ = tx.ExecContext(ctx, "UPDATE alarms SET cleared = 1, updated_at = ? WHERE (device_id = ? OR device_name = ?) AND cleared = 0", now, item.ID, item.Name)
				// Record state transition
				histID := "dh_" + uuid.New().String()[:8]
				_, _ = tx.ExecContext(ctx, `
					INSERT INTO device_history (id, device_id, previous_status, new_status, duration_seconds, timestamp)
					VALUES (?, ?, ?, 'DECOMMISSIONED', 0, ?)`,
					histID, item.ID, item.Status, now)
				removedCount++
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed committing sync transaction: %w", err)
	}

	completedTime := time.Now().UTC()
	durationMs := completedTime.Sub(startTime).Milliseconds()

	summaryMsg := fmt.Sprintf("Infrastructure reconciliation completed: +%d added, ~%d updated, -%d %s",
		addedCount, updatedCount, removedCount, removeMode)

	// Audit Log
	auditRecord := &models.AuditLog{
		UserID:     actorID,
		Username:   actorName,
		Action:     "FULL_INFRASTRUCTURE_SYNC",
		TargetType: "INFRASTRUCTURE",
		TargetID:   jobID,
		Reason:     cleanReason,
		Result:     "SUCCESS",
		IPAddress:  ip,
		UserAgent:  ua,
	}
	_ = e.auditSvc.Log(ctx, auditRecord)

	// Broadcast over WebSockets
	if e.wsHub != nil {
		e.wsHub.Broadcast("INFRASTRUCTURE_SYNC_COMPLETED", map[string]interface{}{
			"job_id":        jobID,
			"added_count":   addedCount,
			"updated_count": updatedCount,
			"removed_count": removedCount,
			"remove_mode":   removeMode,
			"operator":      actorName,
			"timestamp":     completedTime.Format(time.RFC3339),
		})
	}

	return &SyncExecuteResult{
		JobID:        jobID,
		StartedAt:    startTime,
		CompletedAt:  completedTime,
		DurationMs:   durationMs,
		Status:       "SUCCESS",
		AddedCount:   addedCount,
		UpdatedCount: updatedCount,
		RemovedCount: removedCount,
		RemoveMode:   removeMode,
		AuditLogID:   auditRecord.ID,
		Message:      summaryMsg,
	}, nil
}

// BackfillDeviceCustomFields synchronizes Building, Floor, and custom notes from OpManager for all database devices.
func (e *SyncReconciliationEngine) BackfillDeviceCustomFields(ctx context.Context) (int, error) {
	if e.nmsProvider == nil {
		return 0, nil
	}

	rows, err := e.db.QueryContext(ctx, `
		SELECT id, name, ip_address, category_code, COALESCE(building, '-'), COALESCE(floor, '-')
		FROM devices
		ORDER BY (CASE WHEN category_code = 'BIOMETRIC' THEN 1 WHEN category_code = 'SWITCH' THEN 2 WHEN category_code = 'SERVER' THEN 3 ELSE 4 END)`)
	if err != nil {
		return 0, fmt.Errorf("failed querying devices for custom field backfill: %w", err)
	}
	defer rows.Close()

	type devInfo struct {
		id       string
		name     string
		ip       string
		category string
		bldg     string
		floor    string
	}
	var devList []devInfo
	for rows.Next() {
		var d devInfo
		if err := rows.Scan(&d.id, &d.name, &d.ip, &d.category, &d.bldg, &d.floor); err == nil {
			devList = append(devList, d)
		}
	}

	if len(devList) == 0 {
		return 0, nil
	}

	tasks := make(chan devInfo, len(devList))
	for _, d := range devList {
		tasks <- d
	}
	close(tasks)

	// Controlled concurrency: 3 workers with pacing to avoid OpManager API throttling
	numWorkers := 3
	if len(devList) < numWorkers {
		numWorkers = len(devList)
	}

	var wg sync.WaitGroup
	now := time.Now().UTC()
	updatedTotal := 0
	var updateMu sync.Mutex

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for d := range tasks {
				select {
				case <-ctx.Done():
					return
				default:
				}

				// Pacing: 150ms between requests per worker to stay well within limits
				time.Sleep(150 * time.Millisecond)

				lookupKey := d.ip
				if lookupKey == "" {
					lookupKey = d.name
				}
				notes, err := e.nmsProvider.GetDeviceNotes(ctx, lookupKey)
				if err != nil {
					if strings.Contains(err.Error(), "rate limit") {
						time.Sleep(5 * time.Second)
					}
					// If lookup by IP failed and name is available, try name only if name does not contain spaces
					if d.name != "" && d.name != lookupKey && !strings.Contains(d.name, " ") {
						n2, e2 := e.nmsProvider.GetDeviceNotes(ctx, d.name)
						if e2 == nil {
							notes = n2
							err = nil
						}
					}
				}

				// CRITICAL: On error or rate-limit, do NOT overwrite database with '-'
				if err != nil {
					continue
				}

				bldg := "-"
				if val, ok := notes["Building"]; ok && strings.TrimSpace(val) != "" {
					bldg = strings.TrimSpace(val)
				}
				floor := "-"
				if val, ok := notes["Floor"]; ok && strings.TrimSpace(val) != "" {
					floor = strings.TrimSpace(val)
				}

				var metaJSON string
				if len(notes) > 0 {
					if b, mErr := json.Marshal(notes); mErr == nil {
						metaJSON = string(b)
					}
				}

				// Update devices
				_, uErr := e.db.ExecContext(ctx, `
					UPDATE devices
					SET building = ?, floor = ?, metadata_json = COALESCE(NULLIF(?, ''), metadata_json), updated_at = ?
					WHERE id = ?`,
					bldg, floor, metaJSON, now, d.id)

				if uErr == nil {
					updateMu.Lock()
					updatedTotal++
					updateMu.Unlock()
				}

				if uErr == nil && d.category == "BIOMETRIC" {
					var metaID string
					_ = e.db.QueryRowContext(ctx, "SELECT id FROM biometric_metadata WHERE device_id = ?", d.id).Scan(&metaID)
					if metaID == "" {
						bmID := "bm_" + uuid.New().String()[:8]
						_, _ = e.db.ExecContext(ctx, `
							INSERT INTO biometric_metadata (id, device_id, vendor, model, building, floor, location, department, purpose, contact_person, notes, updated_at)
							VALUES (?, ?, 'ZKTeco', 'SpeedFace', ?, ?, '-', '-', 'Biometric Attendance', '-', 'OpManager Monitored', ?)`,
							bmID, d.id, bldg, floor, now)
					} else {
						_, _ = e.db.ExecContext(ctx, `
							UPDATE biometric_metadata
							SET building = ?, floor = ?, updated_at = ?
							WHERE device_id = ?`,
							bldg, floor, now, d.id)
					}
				}
			}
		}()
	}
	wg.Wait()

	slog.Info("opmanager custom fields backfill finished", "devices_processed", len(devList), "devices_updated", updatedTotal)
	return updatedTotal, nil
}
