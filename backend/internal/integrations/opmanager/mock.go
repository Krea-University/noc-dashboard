package opmanager

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// MockProvider provides realistic simulated OpManager telemetry.
type MockProvider struct {
	mu            sync.RWMutex
	devices       []integrations.DeviceDTO
	alarms        []integrations.AlarmDTO
	simulatedDown map[string]bool
}

// NewMockProvider initializes realistic test data for 1,138 campus devices and 24 biometrics.
func NewMockProvider() *MockProvider {
	mp := &MockProvider{
		simulatedDown: make(map[string]bool),
	}
	mp.initializeSeedData()
	return mp
}

func (m *MockProvider) Name() string {
	return "OpManager (Mock)"
}

func (m *MockProvider) TestConnection(ctx context.Context) error {
	return nil
}

func (m *MockProvider) initializeSeedData() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()

	// 1. Core and Distribution Switches
	m.devices = append(m.devices,
		integrations.DeviceDTO{
			SourceID: "opm_sw_01", Name: "SW-CORE-01", IPAddress: "10.0.1.1", CategoryCode: "SWITCH",
			Type: "Core Switch", Vendor: "Cisco", Model: "Catalyst 9500-48Y4C", Status: "UP",
			AvailabilityPct: 99.98, ResponseTimeMS: 1, CPUPct: 24.5, MemPct: 42.1, DiskPct: 18.0, LastSeenAt: now,
			Interfaces: []integrations.InterfaceDTO{
				{Name: "HundredGigE1/0/1 (Tata ILL Uplink)", IndexNum: 1, SpeedBPS: 1000000000, Status: "UP", InTrafficBPS: 645000000, OutTrafficBPS: 312000000},
				{Name: "HundredGigE1/0/2 (Airtel ILL Uplink)", IndexNum: 2, SpeedBPS: 1000000000, Status: "UP", InTrafficBPS: 480000000, OutTrafficBPS: 210000000},
			},
		},
		integrations.DeviceDTO{
			SourceID: "opm_sw_02", Name: "SW-CORE-02", IPAddress: "10.0.1.2", CategoryCode: "SWITCH",
			Type: "Core Switch", Vendor: "Cisco", Model: "Catalyst 9500-48Y4C", Status: "UP",
			AvailabilityPct: 99.99, ResponseTimeMS: 1, CPUPct: 22.0, MemPct: 41.3, DiskPct: 18.0, LastSeenAt: now,
		},
		integrations.DeviceDTO{
			SourceID: "opm_sw_03", Name: "SW-DIST-ACAD-01", IPAddress: "10.0.2.1", CategoryCode: "SWITCH",
			Type: "Distribution Switch", Vendor: "Cisco", Model: "Catalyst 9300-48P", Status: "UP",
			AvailabilityPct: 99.85, ResponseTimeMS: 2, CPUPct: 31.0, MemPct: 48.0, DiskPct: 22.0, LastSeenAt: now,
		},
		integrations.DeviceDTO{
			SourceID: "opm_sw_04", Name: "SW-DIST-HOSTEL-01", IPAddress: "10.0.2.2", CategoryCode: "SWITCH",
			Type: "Distribution Switch", Vendor: "Cisco", Model: "Catalyst 9300-48P", Status: "UP",
			AvailabilityPct: 99.42, ResponseTimeMS: 3, CPUPct: 38.2, MemPct: 54.1, DiskPct: 24.0, LastSeenAt: now,
		},
		integrations.DeviceDTO{
			SourceID: "opm_ill_01", Name: "ILL-TATA-PRIMARY-1Gbps", IPAddress: "115.112.45.1", CategoryCode: "ILL",
			Type: "Internet Leased Line", Vendor: "Tata Teleservices", Model: "1 Gbps Leased Line", Status: "UP",
			AvailabilityPct: 99.95, ResponseTimeMS: 8, CPUPct: 45.0, MemPct: 52.0, DiskPct: 10.0, LastSeenAt: now,
		},
		integrations.DeviceDTO{
			SourceID: "opm_ill_02", Name: "ILL-AIRTEL-SECONDARY-1Gbps", IPAddress: "122.176.88.1", CategoryCode: "ILL",
			Type: "Internet Leased Line", Vendor: "Bharti Airtel", Model: "1 Gbps Leased Line", Status: "UP",
			AvailabilityPct: 99.88, ResponseTimeMS: 9, CPUPct: 38.0, MemPct: 49.0, DiskPct: 10.0, LastSeenAt: now,
		},
	)

	// Access switches
	for i := 1; i <= 40; i++ {
		m.devices = append(m.devices, integrations.DeviceDTO{
			SourceID:        fmt.Sprintf("opm_acc_sw_%02d", i),
			Name:            fmt.Sprintf("SW-ACC-%02d", i),
			IPAddress:       fmt.Sprintf("10.0.4.%d", i),
			CategoryCode:    "SWITCH",
			Type:            "Access Switch",
			Vendor:          "Aruba",
			Model:           "CX 6200F 48G",
			Status:          "UP",
			AvailabilityPct: 99.7,
			ResponseTimeMS:  3,
			CPUPct:          20.0 + rand.Float64()*15.0,
			MemPct:          35.0 + rand.Float64()*15.0,
			DiskPct:         15.0,
			LastSeenAt:      now,
		})
	}

	// Servers
	m.devices = append(m.devices,
		integrations.DeviceDTO{
			SourceID: "opm_srv_01", Name: "SRV-ERP-APP01", IPAddress: "10.0.10.11", CategoryCode: "SERVER",
			Type: "Application Server", Vendor: "Dell", Model: "PowerEdge R750", Status: "UP",
			AvailabilityPct: 99.95, ResponseTimeMS: 2, CPUPct: 48.2, MemPct: 74.5, DiskPct: 58.2, LastSeenAt: now,
		},
		integrations.DeviceDTO{
			SourceID: "opm_srv_02", Name: "SRV-ERP-DB01", IPAddress: "10.0.10.12", CategoryCode: "SERVER",
			Type: "Database Server", Vendor: "Dell", Model: "PowerEdge R750", Status: "UP",
			AvailabilityPct: 99.99, ResponseTimeMS: 1, CPUPct: 62.4, MemPct: 82.1, DiskPct: 69.4, LastSeenAt: now,
		},
		integrations.DeviceDTO{
			SourceID: "opm_srv_03", Name: "SRV-AD-DC01", IPAddress: "10.0.10.15", CategoryCode: "SERVER",
			Type: "Domain Controller", Vendor: "HPE", Model: "ProLiant DL380 Gen10", Status: "UP",
			AvailabilityPct: 100.0, ResponseTimeMS: 1, CPUPct: 14.5, MemPct: 34.0, DiskPct: 31.0, LastSeenAt: now,
		},
	)

	// 24 Biometric Readers
	biometricNames := []string{
		"BIO-001-ADMIN-MAIN", "BIO-002-ADMIN-HR", "BIO-003-LIB-ENTRY", "BIO-004-LIB-EXIT",
		"BIO-005-ACAD-A-GRD", "BIO-006-ACAD-A-FL1", "BIO-007-ACAD-A-FL2", "BIO-008-ACAD-B-GRD",
		"BIO-009-ACAD-B-FL1", "BIO-010-ACAD-B-FL2", "BIO-011-HOSTEL-1-ENTRY", "BIO-012-HOSTEL-1-EXIT",
		"BIO-013-HOSTEL-2-ENTRY", "BIO-014-HOSTEL-2-EXIT", "BIO-015-DINING-HALL-1", "BIO-016-DINING-HALL-2",
		"BIO-017-LAB-COMPLEX", "BIO-018-SPORTS-ARENA", "BIO-019-SECURITY-GATE1", "BIO-020-SECURITY-GATE2",
		"BIO-021-FACULTY-LOUNGE", "BIO-022-EXEC-COUNCIL", "BIO-023-HEALTH-CENTER", "BIO-024-MAINT-DEPOT",
	}

	for i, name := range biometricNames {
		status := "UP"
		if name == "BIO-003-LIB-ENTRY" || name == "BIO-020-SECURITY-GATE2" {
			status = "DOWN"
		}
		m.devices = append(m.devices, integrations.DeviceDTO{
			SourceID:        fmt.Sprintf("opm_bio_%02d", i+1),
			Name:            name,
			IPAddress:       fmt.Sprintf("10.150.1.%d", 101+i),
			CategoryCode:    "BIOMETRIC",
			Type:            "Biometric Attendance",
			Vendor:          "ZKTeco",
			Model:           "SpeedFace-V5L",
			Status:          status,
			AvailabilityPct: 98.5 + rand.Float64()*1.4,
			ResponseTimeMS:  10 + rand.Intn(10),
			CPUPct:          12.0 + rand.Float64()*5.0,
			MemPct:          30.0 + rand.Float64()*5.0,
			DiskPct:         20.0,
			LastSeenAt:      now,
		})
	}
}

func (m *MockProvider) GetDevices(ctx context.Context) ([]integrations.DeviceDTO, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]integrations.DeviceDTO, len(m.devices))
	copy(result, m.devices)

	// Apply dynamic overrides from simulated outages
	for i := range result {
		if isDown, ok := m.simulatedDown[result[i].Name]; ok {
			if isDown {
				result[i].Status = "DOWN"
				result[i].ResponseTimeMS = 0
			} else {
				result[i].Status = "UP"
			}
		}
		// Mild metric fluctuation to show live responsiveness
		if result[i].Status == "UP" {
			result[i].CPUPct = clampFloat(result[i].CPUPct + (rand.Float64()*2 - 1), 5.0, 95.0)
			result[i].MemPct = clampFloat(result[i].MemPct + (rand.Float64()*1 - 0.5), 10.0, 98.0)
		}
	}

	return result, nil
}

func (m *MockProvider) GetDevice(ctx context.Context, sourceID string) (*integrations.DeviceDTO, error) {
	devices, err := m.GetDevices(ctx)
	if err != nil {
		return nil, err
	}
	for _, d := range devices {
		if d.SourceID == sourceID || d.Name == sourceID {
			return &d, nil
		}
	}
	return nil, fmt.Errorf("device not found: %s", sourceID)
}

func (m *MockProvider) GetAlarms(ctx context.Context) ([]integrations.AlarmDTO, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now().UTC()
	var alarms []integrations.AlarmDTO

	alarms = append(alarms,
		integrations.AlarmDTO{
			SourceID: "opm_alm_101", DeviceName: "BIO-003-LIB-ENTRY", DeviceIP: "10.150.1.103",
			Severity: "CRITICAL", Message: "Device Unreachable (ICMP Ping Packet Loss 100%)", Entity: "ICMP-Ping",
			FirstSeenAt: now.Add(-45 * time.Minute), LastSeenAt: now,
		},
		integrations.AlarmDTO{
			SourceID: "opm_alm_102", DeviceName: "BIO-020-SECURITY-GATE2", DeviceIP: "10.150.1.120",
			Severity: "CRITICAL", Message: "Device Unreachable (ICMP Ping Packet Loss 100%)", Entity: "ICMP-Ping",
			FirstSeenAt: now.Add(-15 * time.Minute), LastSeenAt: now,
		},
		integrations.AlarmDTO{
			SourceID: "opm_alm_103", DeviceName: "SRV-ERP-DB01", DeviceIP: "10.0.10.12",
			Severity: "WARNING", Message: "Memory utilization exceeded threshold (82.1% > 80.0%)", Entity: "Memory-Physical",
			FirstSeenAt: now.Add(-2 * time.Hour), LastSeenAt: now,
		},
	)

	return alarms, nil
}

// SimulateDeviceStatus allows integration tests or live NOC drill to toggle device status.
func (m *MockProvider) SimulateDeviceStatus(deviceName string, isDown bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.simulatedDown[deviceName] = isDown
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
