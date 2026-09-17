package automation

import (
	"context"
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
		SELECT id, source_id, source_system, name, ip_address, category_code, type, vendor, model, status
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
		_ = localRows.Scan(&ld.id, &srcID, &ld.sourceSystem, &ld.name, &ld.ipAddress, &ld.categoryCode, &ld.devType, &vendor, &model, &ld.status)
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

			if len(diffs) > 0 {
				res.ToUpdate = append(res.ToUpdate, SyncDeviceItem{
					ID:           existing.id,
					SourceID:     up.SourceID,
					SourceSystem: existing.sourceSystem,
					Name:         existing.name,
					IPAddress:    up.IPAddress,
					CategoryCode: up.CategoryCode,
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
		insertSQL := `
			INSERT INTO devices (
				id, source_id, source_system, name, ip_address, category_code, 
				type, vendor, model, status, availability_pct, response_time_ms, 
				cpu_pct, mem_pct, disk_pct, last_seen_at, last_status_change_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100.0, 5, 0.0, 0.0, 0.0, ?, ?, ?, ?)`
		_, err := tx.ExecContext(ctx, insertSQL,
			newID, item.SourceID, "opmanager", item.Name, item.IPAddress, item.CategoryCode,
			item.Type, item.Vendor, item.Model, item.Status, now, now, now, now,
		)
		if err != nil {
			slog.Error("failed inserting discovered device during sync", "name", item.Name, "error", err)
			continue
		}

		// If biometric, create biometric_metadata entry
		if item.CategoryCode == "BIOMETRIC" {
			bmID := "bm_" + uuid.New().String()[:8]
			_, _ = tx.ExecContext(ctx, `
				INSERT INTO biometric_metadata (id, device_id, vendor, model, building, location, department, purpose, contact_person, notes, updated_at)
				VALUES (?, ?, ?, ?, 'Campus Main', 'Access Control Point', 'Operations', 'Biometric Attendance', 'NOC Administrator', 'Auto-discovered via Full Sync', ?)`,
				bmID, newID, item.Vendor, item.Model, now)
		}

		addedCount++
	}

	// 2. Process Updates
	for _, item := range preview.ToUpdate {
		updateSQL := `
			UPDATE devices
			SET ip_address = ?, category_code = ?, type = ?, status = ?, last_seen_at = ?, updated_at = ?
			WHERE id = ?`
		_, err := tx.ExecContext(ctx, updateSQL, item.IPAddress, item.CategoryCode, item.Type, item.Status, now, now, item.ID)
		if err == nil {
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
