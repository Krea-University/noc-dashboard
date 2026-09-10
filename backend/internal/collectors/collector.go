package collectors

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/events"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// CollectorManager coordinates periodic polling of external infrastructure providers.
type CollectorManager struct {
	cfg          *config.Config
	db           *database.DB
	eventsEngine *events.Engine
	nmsProvider  integrations.NMSProvider
	epcProvider  integrations.EndpointProvider
	fgProvider   integrations.FirewallProvider
	stopChan     chan struct{}
	wg           sync.WaitGroup
}

// NewManager creates a new background collector manager.
func NewManager(
	cfg *config.Config,
	db *database.DB,
	eventsEngine *events.Engine,
	nms integrations.NMSProvider,
	epc integrations.EndpointProvider,
	fg integrations.FirewallProvider,
) *CollectorManager {
	return &CollectorManager{
		cfg:          cfg,
		db:           db,
		eventsEngine: eventsEngine,
		nmsProvider:  nms,
		epcProvider:  epc,
		fgProvider:   fg,
		stopChan:     make(chan struct{}),
	}
}

// Start launches all collector goroutines.
func (m *CollectorManager) Start() {
	slog.Info("starting background integration collectors")

	m.wg.Add(1)
	go m.runOpManagerCollector()

	m.wg.Add(1)
	go m.runEndpointCentralCollector()

	m.wg.Add(1)
	go m.runFortiGateCollector()
}

// Stop signals all collectors to terminate gracefully.
func (m *CollectorManager) Stop() {
	close(m.stopChan)
	m.wg.Wait()
	slog.Info("all background integration collectors stopped cleanly")
}

func (m *CollectorManager) runOpManagerCollector() {
	defer m.wg.Done()
	ticker := time.NewTicker(m.cfg.PollOpManagerDevicesInterval)
	defer ticker.Stop()

	// Initial sync
	m.syncOpManager()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.syncOpManager()
		}
	}
}

func (m *CollectorManager) syncOpManager() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	devices, err := m.nmsProvider.GetDevices(ctx)
	now := time.Now().UTC()

	if err != nil {
		slog.Error("opmanager collector failed sync", "error", err)
		m.updateIntegrationStatus("opmanager", "DEGRADED", err.Error(), now)
		return
	}

	m.updateIntegrationStatus("opmanager", "CONNECTED", "", now)

	// Process and update devices in local DB
	for _, dto := range devices {
		dev := m.upsertDevice(dto, now)
		if dev != nil {
			_ = m.eventsEngine.HandleDeviceTransition(ctx, dev)
		}
	}

	// Also sync OpManager live alarms
	alarms, err := m.nmsProvider.GetAlarms(ctx)
	if err == nil {
		for _, a := range alarms {
			m.upsertAlarm(a, now)
		}
	}
}

func (m *CollectorManager) upsertDevice(dto integrations.DeviceDTO, now time.Time) *models.Device {
	// Look up existing device
	var dev models.Device
	var lastStatusChange *time.Time
	query := "SELECT id, status, last_status_change_at FROM devices WHERE name = ? OR source_id = ?"
	err := m.db.QueryRow(query, dto.Name, dto.SourceID).Scan(&dev.ID, &dev.Status, &lastStatusChange)

	if err != nil {
		// New device
		devID := "dev_" + uuid.New().String()[:8]
		insertSQL := `
		INSERT INTO devices (id, source_id, source_system, name, ip_address, mac_address, category_code, type, vendor, model, status, availability_pct, response_time_ms, cpu_pct, mem_pct, disk_pct, last_seen_at, last_status_change_at, created_at, updated_at)
		VALUES (?, ?, 'opmanager', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err := m.db.Exec(insertSQL, devID, dto.SourceID, dto.Name, dto.IPAddress, dto.MACAddress,
			dto.CategoryCode, dto.Type, dto.Vendor, dto.Model, dto.Status, dto.AvailabilityPct,
			dto.ResponseTimeMS, dto.CPUPct, dto.MemPct, dto.DiskPct, now, now, now, now)
		if err != nil {
			slog.Error("failed inserting new device", "name", dto.Name, "error", err)
			return nil
		}
		dev.ID = devID
		dev.Name = dto.Name
		dev.Status = dto.Status
		dev.CategoryCode = dto.CategoryCode
		dev.IPAddress = dto.IPAddress

		// If biometric device, ensure metadata record exists
		if dto.CategoryCode == "BIOMETRIC" {
			bmID := "bm_" + uuid.New().String()[:8]
			_, _ = m.db.Exec(`
				INSERT INTO biometric_devices_metadata (id, device_id, door_name, location_details, building, floor, direction, reader_model, last_sync_at, created_at, updated_at)
				VALUES (?, ?, ?, 'Campus Access Point', 'Campus', 'Ground Floor', 'ENTRY', ?, ?, ?, ?)`,
				bmID, devID, dto.Name, dto.Vendor, now, now, now)
		}

		return &dev
	}

	// Existing device: update telemetry
	updateSQL := `
	UPDATE devices
	SET ip_address = ?, cpu_pct = ?, mem_pct = ?, disk_pct = ?, response_time_ms = ?, availability_pct = ?, last_seen_at = ?, updated_at = ?
	WHERE id = ?`
	_, _ = m.db.Exec(updateSQL, dto.IPAddress, dto.CPUPct, dto.MemPct, dto.DiskPct, dto.ResponseTimeMS, dto.AvailabilityPct, now, now, dev.ID)

	dev.Name = dto.Name
	dev.CategoryCode = dto.CategoryCode
	dev.IPAddress = dto.IPAddress
	// Note: dev.Status contains new status reported by provider for transition engine to compare
	dev.Status = dto.Status

	// If biometric, ensure metadata record exists
	if dto.CategoryCode == "BIOMETRIC" {
		var metaID string
		_ = m.db.QueryRow("SELECT id FROM biometric_metadata WHERE device_id = ?", dev.ID).Scan(&metaID)
		if metaID == "" {
			bmID := "bm_" + uuid.New().String()[:8]
			_, _ = m.db.Exec(`
				INSERT INTO biometric_metadata (id, device_id, vendor, model, building, location, department, purpose, contact_person, notes, updated_at)
				VALUES (?, ?, 'ZKTeco', 'SpeedFace-V5L', 'Main Campus', 'Turnstile / Access Barrier', 'Security & Operations', 'Attendance & Access Control', 'Campus Security', 'Monitored via OpManager Lite', ?)`,
				bmID, dev.ID, now)
		}
	}

	return &dev
}

func (m *CollectorManager) runEndpointCentralCollector() {
	defer m.wg.Done()
	ticker := time.NewTicker(m.cfg.PollEndpointCentralInterval)
	defer ticker.Stop()

	m.syncEndpointCentral()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.syncEndpointCentral()
		}
	}
}

func (m *CollectorManager) syncEndpointCentral() {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	computers, err := m.epcProvider.GetComputers(ctx)
	now := time.Now().UTC()

	if err != nil {
		slog.Error("endpoint central collector sync failed", "error", err)
		m.updateIntegrationStatus("endpointcentral", "DEGRADED", err.Error(), now)
		return
	}

	m.updateIntegrationStatus("endpointcentral", "CONNECTED", "", now)

	for _, comp := range computers {
		m.upsertEndpoint(comp, now)
	}
}

func (m *CollectorManager) upsertEndpoint(dto integrations.EndpointDTO, now time.Time) {
	var id string
	err := m.db.QueryRow("SELECT id FROM endpoints WHERE source_id = ? OR hostname = ?", dto.SourceID, dto.Hostname).Scan(&id)
	if err != nil {
		epID := "ep_" + uuid.New().String()[:8]
		insertSQL := `
		INSERT INTO endpoints (id, source_id, hostname, ip_address, mac_address, os_name, os_version, logged_in_user, domain_name, remote_office, status, last_scan_at, last_seen_at, hardware_summary, software_count, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, _ = m.db.Exec(insertSQL, epID, dto.SourceID, dto.Hostname, dto.IPAddress, dto.MACAddress,
			dto.OSName, dto.OSVersion, dto.LoggedInUser, dto.DomainName, dto.RemoteOffice, dto.Status,
			dto.LastScanAt, now, dto.HardwareSummary, dto.SoftwareCount, now)
		return
	}

	updateSQL := `
	UPDATE endpoints
	SET ip_address = ?, status = ?, last_seen_at = ?, logged_in_user = ?, software_count = ?, updated_at = ?
	WHERE id = ?`
	_, _ = m.db.Exec(updateSQL, dto.IPAddress, dto.Status, now, dto.LoggedInUser, dto.SoftwareCount, now, id)
}

func (m *CollectorManager) runFortiGateCollector() {
	defer m.wg.Done()
	ticker := time.NewTicker(m.cfg.PollFortiGateInterval)
	defer ticker.Stop()

	m.syncFortiGate()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.syncFortiGate()
		}
	}
}

func (m *CollectorManager) syncFortiGate() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	status, err := m.fgProvider.GetStatus(ctx)
	now := time.Now().UTC()

	if err != nil {
		slog.Error("fortigate collector sync failed", "error", err)
		m.updateIntegrationStatus("fortigate", "DEGRADED", err.Error(), now)
		return
	}
	m.updateIntegrationStatus("fortigate", "CONNECTED", "", now)

	// Update live interface traffic and ILL devices from FortiGate throughput telemetry
	if status != nil {
		var fgDevID string
		_ = m.db.QueryRow("SELECT id FROM devices WHERE model LIKE '%FortiGate%' OR type LIKE '%FortiGate%' OR name LIKE '%Firewall%' LIMIT 1").Scan(&fgDevID)
		if fgDevID == "" {
			_ = m.db.QueryRow("SELECT id FROM devices LIMIT 1").Scan(&fgDevID)
		}

		if len(status.WANLinks) > 0 {
			for _, link := range status.WANLinks {
				switch strings.ToLower(link.Interface) {
				case "x3":
					m.upsertInterface("if_01", fgDevID, "x3 (Uplink to Railtel ILL 3Gbps)", 3000000000, link.Status, link.RxBPS, link.TxBPS, now)
				case "x4":
					m.upsertInterface("if_02", fgDevID, "x4 (Uplink to Airtel ILL 1.2Gbps)", 1200000000, link.Status, link.RxBPS, link.TxBPS, now)
				case "port2":
					m.upsertInterface("if_05", fgDevID, "port2 (Uplink to BSNL ILL 500Mbps)", 500000000, link.Status, link.RxBPS, link.TxBPS, now)
				}
			}
		} else if status.InboundBPS > 0 || status.OutboundBPS > 0 {
			tataIn := int64(float64(status.InboundBPS) * 0.58)
			tataOut := int64(float64(status.OutboundBPS) * 0.58)
			airtelIn := int64(float64(status.InboundBPS) * 0.42)
			airtelOut := int64(float64(status.OutboundBPS) * 0.42)

			m.upsertInterface("if_01", fgDevID, "x3 (Uplink to Railtel ILL 3Gbps)", 3000000000, "UP", tataIn, tataOut, now)
			m.upsertInterface("if_02", fgDevID, "x4 (Uplink to Airtel ILL 1.2Gbps)", 1200000000, "UP", airtelIn, airtelOut, now)
		}
	}

	// Fetch live VLAN internet policies from FortiGate
	vlans, err := m.fgProvider.GetVlans(ctx)
	if err == nil {
		for _, v := range vlans {
			// Update matching VLAN record by FortiGate policy ID or VLAN ID
			if v.FortiGatePolicyID > 0 {
				_, _ = m.db.Exec(`
					UPDATE vlans 
					SET internet_status = ?, updated_at = ? 
					WHERE fortigate_policy_id = ?`,
					v.InternetStatus, now, v.FortiGatePolicyID)
			} else if v.VlanID > 0 {
				_, _ = m.db.Exec("UPDATE vlans SET internet_status = ?, updated_at = ? WHERE vlan_id = ?",
					v.InternetStatus, now, v.VlanID)
			}
		}
	}
}

func (m *CollectorManager) upsertInterface(id, deviceID, name string, speed int64, status string, inBps, outBps int64, now time.Time) {
	var existing string
	_ = m.db.QueryRow("SELECT id FROM interfaces WHERE id = ?", id).Scan(&existing)
	if existing == "" {
		_, _ = m.db.Exec(`INSERT INTO interfaces (id, device_id, name, speed_bps, status, in_traffic_bps, out_traffic_bps, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			id, deviceID, name, speed, status, inBps, outBps, now)
	} else {
		_, _ = m.db.Exec(`UPDATE interfaces SET device_id = ?, name = ?, speed_bps = ?, in_traffic_bps = ?, out_traffic_bps = ?, status = ?, updated_at = ? WHERE id = ?`,
			deviceID, name, speed, inBps, outBps, status, now, id)
	}
}

func (m *CollectorManager) upsertAlarm(dto integrations.AlarmDTO, now time.Time) {
	var id string
	err := m.db.QueryRow("SELECT id FROM alarms WHERE source_id = ?", dto.SourceID).Scan(&id)

	cleared := 0
	var clearedAt *time.Time
	if strings.EqualFold(dto.Severity, "CLEAR") {
		cleared = 1
		clearedAt = &now
	}

	var devID, devIP string
	_ = m.db.QueryRow("SELECT COALESCE(id, ''), COALESCE(ip_address, '') FROM devices WHERE name = ? OR ip_address = ? LIMIT 1", dto.DeviceName, dto.DeviceName).Scan(&devID, &devIP)

	if err != nil {
		almID := "alm_" + uuid.New().String()[:8]
		insertSQL := `
		INSERT INTO alarms (id, source_id, source_system, device_id, device_name, device_ip, severity, message, entity, first_seen_at, last_seen_at, acknowledged, cleared, cleared_at)
		VALUES (?, ?, 'opmanager', ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
		_, _ = m.db.Exec(insertSQL, almID, dto.SourceID, devID, dto.DeviceName, devIP, dto.Severity, dto.Message, dto.Entity, dto.FirstSeenAt, dto.LastSeenAt, cleared, clearedAt)
	} else {
		updateSQL := `
		UPDATE alarms
		SET severity = ?, message = ?, last_seen_at = ?, cleared = ?, cleared_at = ?
		WHERE id = ?`
		_, _ = m.db.Exec(updateSQL, dto.Severity, dto.Message, dto.LastSeenAt, cleared, clearedAt, id)
	}
}

func (m *CollectorManager) updateIntegrationStatus(integrationType, status, errorMsg string, now time.Time) {
	baseURL := ""
	switch integrationType {
	case "opmanager":
		baseURL = m.cfg.OpManagerURL
	case "endpointcentral":
		baseURL = m.cfg.EndpointCentralURL
	case "fortigate":
		baseURL = m.cfg.FortiGateURL
	}

	if status == "CONNECTED" {
		_, _ = m.db.Exec(`
			UPDATE integrations
			SET base_url = ?, status = ?, last_sync_at = ?, sync_count = sync_count + 1
			WHERE type = ?`, baseURL, status, now, integrationType)
	} else {
		_, _ = m.db.Exec(`
			UPDATE integrations
			SET base_url = ?, status = ?, last_error = ?, last_error_at = ?, error_count = error_count + 1
			WHERE type = ?`, baseURL, status, errorMsg, now, integrationType)
	}
}
