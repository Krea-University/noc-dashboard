package fortigate

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// MockProvider provides realistic simulated FortiGate firewall operations.
type MockProvider struct {
	mu           sync.RWMutex
	policyStates map[int]string // policyID -> "enable" or "disable"
}

// NewMockProvider creates a new FortiGate mock provider.
func NewMockProvider() *MockProvider {
	mp := &MockProvider{
		policyStates: map[int]string{
			1101: "enable", // VLAN 110 Faculty
			1201: "enable", // VLAN 120 Students
			1301: "enable", // VLAN 130 Labs
			1401: "enable", // VLAN 140 Guests
			1501: "enable", // VLAN 150 IoT
		},
	}
	return mp
}

func (m *MockProvider) Name() string {
	return "FortiGate (Mock)"
}

func (m *MockProvider) TestConnection(ctx context.Context) error {
	return nil
}

func (m *MockProvider) GetStatus(ctx context.Context) (*integrations.FirewallStatusDTO, error) {
	return &integrations.FirewallStatusDTO{
		Hostname:       "FG-100F-CORE-SEC01",
		Version:        "FortiOS v7.2.8 build1639 (GA)",
		Serial:         "FGT100FTK21004928",
		Status:         "CONNECTED",
		ActiveSessions: 42850,
		CPUPct:         18.4,
		MemPct:         52.7,
		InboundBPS:     4280000000,
		OutboundBPS:    2850000000,
		RoutingMode:    "SD-WAN",
		WANLinks: []integrations.WANLinkDTO{
			{Interface: "x3", Name: "Railtel Primary", ISP: "Railtel", Status: "UP", Speed: "3 Gbps", RxBPS: 2450000000, TxBPS: 1600000000, LatencyMS: 1.8, PacketLoss: 0.0, SessionCount: 28500},
			{Interface: "x4", Name: "Airtel Secondary", ISP: "Airtel", Status: "UP", Speed: "1.2 Gbps", RxBPS: 1830000000, TxBPS: 1250000000, LatencyMS: 4.3, PacketLoss: 0.0, SessionCount: 14350},
		},
		LastSeen:       time.Now().UTC(),
	}, nil
}

func (m *MockProvider) GetVlans(ctx context.Context) ([]models.VLAN, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return []models.VLAN{
		{
			ID: "vlan_160", VlanID: 160, Name: "Student Wi-Fi", Description: "Student personal devices & hostel/academic Wi-Fi",
			Subnet: "10.10.160.0/20", Gateway: "10.10.160.1", FortiGatePolicyID: 38,
			ExpectedEndpoints: 850, ExpectedAPs: 58, ExpectedClassrooms: 24,
			InternetStatus: m.getInternetStatus(38),
		},
		{
			ID: "vlan_72", VlanID: 72, Name: "Staff Wi-Fi", Description: "Administrative and operational staff wireless access",
			Subnet: "10.10.72.0/22", Gateway: "10.10.72.1", FortiGatePolicyID: 37,
			ExpectedEndpoints: 120, ExpectedAPs: 26, ExpectedClassrooms: 12,
			InternetStatus: m.getInternetStatus(37),
		},
		{
			ID: "vlan_76", VlanID: 76, Name: "Faculty Wi-Fi", Description: "Academic faculty & research cabin wireless access",
			Subnet: "10.10.76.0/22", Gateway: "10.10.76.1", FortiGatePolicyID: 33,
			ExpectedEndpoints: 95, ExpectedAPs: 20, ExpectedClassrooms: 14,
			InternetStatus: m.getInternetStatus(33),
		},
		{
			ID: "vlan_68", VlanID: 68, Name: "Guest Wi-Fi", Description: "Visitor & event guest portal wireless access",
			Subnet: "10.10.68.0/23", Gateway: "10.10.68.1", FortiGatePolicyID: 36,
			ExpectedEndpoints: 50, ExpectedAPs: 18, ExpectedClassrooms: 0,
			InternetStatus: m.getInternetStatus(36),
		},
		{
			ID: "vlan_17", VlanID: 17, Name: "Main Block DS Lab", Description: "Main Block 1st Floor Data Science research laboratory",
			Subnet: "10.10.17.0/24", Gateway: "10.10.17.1", FortiGatePolicyID: 24,
			ExpectedEndpoints: 29, ExpectedAPs: 2, ExpectedClassrooms: 1,
			InternetStatus: m.getInternetStatus(24),
		},
		{
			ID: "vlan_16", VlanID: 16, Name: "MB Trading Lab", Description: "Financial trading lab & economics computer systems",
			Subnet: "10.10.16.0/24", Gateway: "10.10.16.1", FortiGatePolicyID: 70,
			ExpectedEndpoints: 60, ExpectedAPs: 2, ExpectedClassrooms: 1,
			InternetStatus: m.getInternetStatus(70),
		},
		{
			ID: "vlan_18", VlanID: 18, Name: "Library Systems", Description: "Central Library digital commons and catalog workstations",
			Subnet: "10.10.18.0/23", Gateway: "10.10.18.1", FortiGatePolicyID: 26,
			ExpectedEndpoints: 14, ExpectedAPs: 8, ExpectedClassrooms: 0,
			InternetStatus: m.getInternetStatus(26),
		},
		{
			ID: "vlan_24", VlanID: 24, Name: "Campus Biometrics", Description: "Campus biometric attendance readers & access control",
			Subnet: "10.10.24.0/24", Gateway: "10.10.24.1", FortiGatePolicyID: 29,
			ExpectedEndpoints: 66, ExpectedAPs: 0, ExpectedClassrooms: 0,
			InternetStatus: m.getInternetStatus(29),
		},
		{
			ID: "vlan_64", VlanID: 64, Name: "Events Wi-Fi", Description: "Auditorium, seminar halls and special campus events",
			Subnet: "10.10.64.0/22", Gateway: "10.10.64.1", FortiGatePolicyID: 35,
			ExpectedEndpoints: 150, ExpectedAPs: 14, ExpectedClassrooms: 4,
			InternetStatus: m.getInternetStatus(35),
		},
		{
			ID: "vlan_88", VlanID: 88, Name: "Exam Wi-Fi", Description: "Dedicated academic examination and testing network",
			Subnet: "10.10.88.0/21", Gateway: "10.10.88.1", FortiGatePolicyID: 34,
			ExpectedEndpoints: 300, ExpectedAPs: 22, ExpectedClassrooms: 16,
			InternetStatus: m.getInternetStatus(34),
		},
		{
			ID: "vlan_14", VlanID: 14, Name: "Main Block LAN", Description: "Main academic block wired ethernet workstations",
			Subnet: "10.10.14.0/23", Gateway: "10.10.14.1", FortiGatePolicyID: 25,
			ExpectedEndpoints: 37, ExpectedAPs: 0, ExpectedClassrooms: 8,
			InternetStatus: m.getInternetStatus(25),
		},
		{
			ID: "vlan_20", VlanID: 20, Name: "New Academic LAN", Description: "New academic building wired ethernet workstations",
			Subnet: "10.10.20.0/23", Gateway: "10.10.20.1", FortiGatePolicyID: 22,
			ExpectedEndpoints: 34, ExpectedAPs: 0, ExpectedClassrooms: 10,
			InternetStatus: m.getInternetStatus(22),
		},
	}, nil
}

func (m *MockProvider) DisableInternet(ctx context.Context, vlanID int, policyID int, reason string) (*integrations.FortiGateActionResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	prev := m.getInternetStatus(policyID)
	m.policyStates[policyID] = "disable"

	return &integrations.FortiGateActionResult{
		PolicyID:      policyID,
		Action:        "DISABLE",
		PreviousState: prev,
		NewState:      "DISABLED",
		RawResponse:   `{"status":"success","http_status":200,"vdom":"root","mkey":"` + fmt.Sprintf("%d", policyID) + `"}`,
	}, nil
}

func (m *MockProvider) EnableInternet(ctx context.Context, vlanID int, policyID int, reason string) (*integrations.FortiGateActionResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	prev := m.getInternetStatus(policyID)
	m.policyStates[policyID] = "enable"

	return &integrations.FortiGateActionResult{
		PolicyID:      policyID,
		Action:        "ENABLE",
		PreviousState: prev,
		NewState:      "ENABLED",
		RawResponse:   `{"status":"success","http_status":200,"vdom":"root","mkey":"` + fmt.Sprintf("%d", policyID) + `"}`,
	}, nil
}

func (m *MockProvider) VerifyInternetState(ctx context.Context, vlanID int, policyID int) (string, bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	status := m.getInternetStatus(policyID)
	return status, true, nil
}

func (m *MockProvider) getInternetStatus(policyID int) string {
	state, ok := m.policyStates[policyID]
	if !ok || state == "enable" {
		return "ENABLED"
	}
	return "DISABLED"
}
