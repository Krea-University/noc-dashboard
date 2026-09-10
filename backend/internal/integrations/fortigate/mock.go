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
			VlanID: 110, Name: "Faculty & Staff", Description: "Academic and administrative staff workstations & secure Wi-Fi",
			Subnet: "10.110.0.0/20", Gateway: "10.110.0.1", FortiGatePolicyID: 1101,
			ExpectedEndpoints: 420, ExpectedAPs: 24, ExpectedClassrooms: 18,
			InternetStatus: m.getInternetStatus(1101),
		},
		{
			VlanID: 120, Name: "Students", Description: "Hostel and classroom student personal devices & BYOD",
			Subnet: "10.120.0.0/19", Gateway: "10.120.0.1", FortiGatePolicyID: 1201,
			ExpectedEndpoints: 850, ExpectedAPs: 48, ExpectedClassrooms: 24,
			InternetStatus: m.getInternetStatus(1201),
		},
		{
			VlanID: 130, Name: "Computer Labs", Description: "Academic computer science & research laboratory systems",
			Subnet: "10.130.0.0/22", Gateway: "10.130.0.1", FortiGatePolicyID: 1301,
			ExpectedEndpoints: 160, ExpectedAPs: 4, ExpectedClassrooms: 6,
			InternetStatus: m.getInternetStatus(1301),
		},
		{
			VlanID: 140, Name: "Campus Guests", Description: "Visitor self-registered wireless internet access",
			Subnet: "10.140.0.0/22", Gateway: "10.140.0.1", FortiGatePolicyID: 1401,
			ExpectedEndpoints: 85, ExpectedAPs: 16, ExpectedClassrooms: 0,
			InternetStatus: m.getInternetStatus(1401),
		},
		{
			VlanID: 150, Name: "IoT & Biometrics", Description: "Campus biometric readers, IP cameras and environmental sensors",
			Subnet: "10.150.0.0/23", Gateway: "10.150.0.1", FortiGatePolicyID: 1501,
			ExpectedEndpoints: 65, ExpectedAPs: 0, ExpectedClassrooms: 0,
			InternetStatus: m.getInternetStatus(1501),
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
