package endpointcentral

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// MockProvider provides realistic simulated Endpoint Central data.
type MockProvider struct {
	mu        sync.RWMutex
	computers []integrations.EndpointDTO
}

// NewMockProvider creates an endpoint central mock provider.
func NewMockProvider() *MockProvider {
	mp := &MockProvider{}
	mp.initializeSeedData()
	return mp
}

func (m *MockProvider) Name() string {
	return "Endpoint Central (Mock)"
}

func (m *MockProvider) TestConnection(ctx context.Context) error {
	return nil
}

func (m *MockProvider) initializeSeedData() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	scanTime := now.Add(-3 * time.Hour)

	m.computers = []integrations.EndpointDTO{
		{
			SourceID: "epc_01", Hostname: "KREA-FAC-014", IPAddress: "10.110.4.12", MACAddress: "44:85:00:11:22:33",
			OSName: "Windows 11 Pro", OSVersion: "23H2", LoggedInUser: "prof.sharma", DomainName: "krea.edu.in",
			RemoteOffice: "Academic Block A", Status: "ONLINE", LastScanAt: &scanTime, LastSeenAt: now,
			HardwareSummary: "Dell Latitude 5440, i7-1365U, 16GB RAM", SoftwareCount: 64,
		},
		{
			SourceID: "epc_02", Hostname: "KREA-FAC-028", IPAddress: "10.110.4.25", MACAddress: "44:85:00:11:22:34",
			OSName: "macOS Sonoma", OSVersion: "14.5", LoggedInUser: "dr.meera", DomainName: "krea.edu.in",
			RemoteOffice: "Academic Block B", Status: "ONLINE", LastScanAt: &scanTime, LastSeenAt: now,
			HardwareSummary: "MacBook Pro 14\", M3 Pro, 18GB Unified RAM", SoftwareCount: 48,
		},
		{
			SourceID: "epc_03", Hostname: "KREA-LAB1-WS01", IPAddress: "10.130.1.1", MACAddress: "50:EB:71:22:33:44",
			OSName: "Ubuntu Desktop", OSVersion: "24.04 LTS", LoggedInUser: "student_lab", DomainName: "krea.edu.in",
			RemoteOffice: "Computer Lab 1", Status: "ONLINE", LastScanAt: &scanTime, LastSeenAt: now,
			HardwareSummary: "HP Z2 Mini G9, i7-13700, 32GB RAM, RTX A2000", SoftwareCount: 82,
		},
		{
			SourceID: "epc_04", Hostname: "KREA-LAB1-WS02", IPAddress: "10.130.1.2", MACAddress: "50:EB:71:22:33:45",
			OSName: "Ubuntu Desktop", OSVersion: "24.04 LTS", LoggedInUser: "student_lab", DomainName: "krea.edu.in",
			RemoteOffice: "Computer Lab 1", Status: "ONLINE", LastScanAt: &scanTime, LastSeenAt: now,
			HardwareSummary: "HP Z2 Mini G9, i7-13700, 32GB RAM, RTX A2000", SoftwareCount: 82,
		},
		{
			SourceID: "epc_05", Hostname: "KREA-ADM-FIN02", IPAddress: "10.110.2.14", MACAddress: "44:85:00:33:44:55",
			OSName: "Windows 11 Pro", OSVersion: "23H2", LoggedInUser: "finance.exec", DomainName: "krea.edu.in",
			RemoteOffice: "Admin Block", Status: "ONLINE", LastScanAt: &scanTime, LastSeenAt: now,
			HardwareSummary: "Lenovo ThinkCentre M70q, i5-13400T, 16GB RAM", SoftwareCount: 52,
		},
		{
			SourceID: "epc_06", Hostname: "KREA-LIB-DESK01", IPAddress: "10.110.5.10", MACAddress: "44:85:00:55:66:77",
			OSName: "Windows 10 Pro", OSVersion: "22H2", LoggedInUser: "lib.circulation", DomainName: "krea.edu.in",
			RemoteOffice: "Library", Status: "OFFLINE", LastScanAt: &scanTime, LastSeenAt: now.Add(-14 * time.Hour),
			HardwareSummary: "Dell OptiPlex 3080, i5-10500, 8GB RAM", SoftwareCount: 38,
		},
	}

	// Generate additional lab and staff machines
	for i := 3; i <= 30; i++ {
		m.computers = append(m.computers, integrations.EndpointDTO{
			SourceID:        fmt.Sprintf("epc_lab1_%02d", i),
			Hostname:        fmt.Sprintf("KREA-LAB1-WS%02d", i),
			IPAddress:       fmt.Sprintf("10.130.1.%d", i),
			MACAddress:      fmt.Sprintf("50:EB:71:22:33:%02X", i),
			OSName:          "Ubuntu Desktop",
			OSVersion:       "24.04 LTS",
			LoggedInUser:    "student_lab",
			DomainName:      "krea.edu.in",
			RemoteOffice:    "Computer Lab 1",
			Status:          "ONLINE",
			LastScanAt:      &scanTime,
			LastSeenAt:      now,
			HardwareSummary: "HP Z2 Mini G9, i7-13700, 32GB RAM",
			SoftwareCount:   80,
		})
	}
}

func (m *MockProvider) GetComputers(ctx context.Context) ([]integrations.EndpointDTO, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]integrations.EndpointDTO, len(m.computers))
	copy(result, m.computers)
	return result, nil
}

func (m *MockProvider) GetComputer(ctx context.Context, sourceID string) (*integrations.EndpointDTO, error) {
	computers, err := m.GetComputers(ctx)
	if err != nil {
		return nil, err
	}
	for _, comp := range computers {
		if comp.SourceID == sourceID || comp.Hostname == sourceID {
			return &comp, nil
		}
	}
	return nil, fmt.Errorf("endpoint not found: %s", sourceID)
}
