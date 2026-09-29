package integrations

import (
	"context"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// DeviceDTO represents a device received from an NMS provider.
type DeviceDTO struct {
	SourceID        string
	Name            string
	IPAddress       string
	MACAddress      string
	CategoryCode    string // SWITCH, SERVER, BIOMETRIC, ILL, CLASSROOM, ROUTER, WIRELESS_AP
	Type            string
	Vendor          string
	Model           string
	Status          string // UP, DOWN, WARNING, UNKNOWN
	AvailabilityPct float64
	ResponseTimeMS  int
	CPUPct          float64
	MemPct          float64
	DiskPct         float64
	LastSeenAt      time.Time
	MetadataJSON    string
	Building        string
	Floor           string
	CustomFields    map[string]string
	Interfaces      []InterfaceDTO
}

// InterfaceDTO represents an interface on a device.
type InterfaceDTO struct {
	Name         string
	IndexNum     int
	SpeedBPS     int64
	Status       string
	InTrafficBPS int64
	OutTrafficBPS int64
}

// AlarmDTO represents an active alarm from an NMS provider.
type AlarmDTO struct {
	SourceID    string
	DeviceName  string
	DeviceIP    string
	Severity    string // CRITICAL, MAJOR, WARNING, INFO
	Message     string
	Entity      string
	FirstSeenAt time.Time
	LastSeenAt  time.Time
}

// NMSProvider abstracts network monitoring systems like ManageEngine OpManager.
type NMSProvider interface {
	Name() string
	GetDevices(ctx context.Context) ([]DeviceDTO, error)
	GetDevice(ctx context.Context, sourceID string) (*DeviceDTO, error)
	GetAlarms(ctx context.Context) ([]AlarmDTO, error)
	GetDeviceNotes(ctx context.Context, deviceNameOrIP string) (map[string]string, error)
	TestConnection(ctx context.Context) error
}

// EndpointDTO represents a computer received from an Endpoint provider.
type EndpointDTO struct {
	SourceID        string
	Hostname        string
	IPAddress       string
	MACAddress      string
	OSName          string
	OSVersion       string
	LoggedInUser    string
	DomainName      string
	RemoteOffice    string
	Status          string // ONLINE, OFFLINE, NOT_SCANNED, MISSING
	LastScanAt      *time.Time
	LastSeenAt      time.Time
	HardwareSummary string
	SoftwareCount   int
}

// EndpointProvider abstracts endpoint management systems like ManageEngine Endpoint Central.
type EndpointProvider interface {
	Name() string
	GetComputers(ctx context.Context) ([]EndpointDTO, error)
	GetComputer(ctx context.Context, sourceID string) (*EndpointDTO, error)
	TestConnection(ctx context.Context) error
}

// WANLinkDTO represents live telemetry for an individual WAN / ILL connection.
type WANLinkDTO struct {
	Interface    string  `json:"interface"`
	Name         string  `json:"name"`
	ISP          string  `json:"isp"`
	Status       string  `json:"status"` // UP, DOWN
	Speed        string  `json:"speed"`  // e.g. "3 Gbps", "1.2 Gbps", "500 Mbps"
	RxBPS        int64   `json:"rx_bps"`
	TxBPS        int64   `json:"tx_bps"`
	LatencyMS    float64 `json:"latency_ms"`
	PacketLoss   float64 `json:"packet_loss"`
	SessionCount int     `json:"session_count"`
}

// FirewallStatusDTO represents FortiGate operational status.
type FirewallStatusDTO struct {
	Hostname       string       `json:"hostname"`
	Version        string       `json:"version"`
	Serial         string       `json:"serial"`
	Status         string       `json:"status"` // CONNECTED, DEGRADED, OFFLINE
	ActiveSessions int64        `json:"active_sessions"`
	CPUPct         float64      `json:"cpu_pct"`
	MemPct         float64      `json:"mem_pct"`
	InboundBPS     int64        `json:"inbound_bps"`
	OutboundBPS    int64        `json:"outbound_bps"`
	RoutingMode    string       `json:"routing_mode"`
	WANLinks       []WANLinkDTO `json:"wan_links"`
	LastSeen       time.Time    `json:"last_seen"`
}

// FortiGateActionResult contains the result of a firewall policy change.
type FortiGateActionResult struct {
	PolicyID     int    `json:"policy_id"`
	Action       string `json:"action"` // DISABLE, ENABLE
	PreviousState string `json:"previous_state"`
	NewState     string `json:"new_state"`
	RawResponse  string `json:"raw_response"`
}

// FirewallProvider abstracts firewall management systems like FortiGate.
type FirewallProvider interface {
	Name() string
	GetStatus(ctx context.Context) (*FirewallStatusDTO, error)
	GetVlans(ctx context.Context) ([]models.VLAN, error)
	DisableInternet(ctx context.Context, vlanID int, policyID int, reason string) (*FortiGateActionResult, error)
	EnableInternet(ctx context.Context, vlanID int, policyID int, reason string) (*FortiGateActionResult, error)
	VerifyInternetState(ctx context.Context, vlanID int, policyID int) (expectedStatus string, isVerified bool, err error)
	TestConnection(ctx context.Context) error
}

// ZoomMeetingDTO represents an individual meeting in Zoom Pool Manager / NOC API.
type ZoomMeetingDTO struct {
	ID                    any            `json:"id"`
	PublicID              string         `json:"public_id,omitempty"`
	Title                 string         `json:"title,omitempty"`
	Topic                 string         `json:"topic,omitempty"`
	Description           string         `json:"description,omitempty"`
	MeetingType           string         `json:"meeting_type,omitempty"`
	Status                string         `json:"status,omitempty"` // scheduled, started, ended, etc.
	IsLive                bool           `json:"is_live"`
	StartsAt              string         `json:"starts_at,omitempty"`
	EndsAt                string         `json:"ends_at,omitempty"`
	StartTime             string         `json:"start_time,omitempty"`
	EndTime               string         `json:"end_time,omitempty"`
	DurationMinutes       int            `json:"duration_minutes,omitempty"`
	Duration              int            `json:"duration,omitempty"`
	StartsInMinutes       int            `json:"starts_in_minutes"`
	EndsInMinutes         int            `json:"ends_in_minutes"`
	Timezone              string         `json:"timezone,omitempty"`
	ParticipantCount      int            `json:"participant_count,omitempty"`
	ParticipantsCount     int            `json:"participants_count,omitempty"`
	ZoomMeetingID         string         `json:"zoom_meeting_id,omitempty"`
	MeetingID             string         `json:"meeting_id,omitempty"`
	JoinURL               string         `json:"join_url,omitempty"`
	Passcode              string         `json:"passcode,omitempty"`
	HostKey               any            `json:"host_key,omitempty"`
	WaitingRoom           bool           `json:"waiting_room,omitempty"`
	JoinBeforeHost        bool           `json:"join_before_host,omitempty"`
	JbhTime               int            `json:"jbh_time,omitempty"`
	RecordingMode         string         `json:"recording_mode,omitempty"`
	Room                  string         `json:"room,omitempty"`
	Classroom             string         `json:"classroom,omitempty"`
	Department            any            `json:"department,omitempty"`
	HostName              string         `json:"host_name,omitempty"`
	HostEmail             string         `json:"host_email,omitempty"`
	AccountName           string         `json:"account_name,omitempty"`
	AccountEmail          string         `json:"account_email,omitempty"`
	CustomFields          map[string]any `json:"custom_fields,omitempty"`
	CustomFieldsFormatted []any          `json:"custom_fields_formatted,omitempty"`
	Requester             map[string]any `json:"requester,omitempty"`
	Owner                 map[string]any `json:"owner,omitempty"`
	HostResource          map[string]any `json:"host_resource,omitempty"`
	RawData               map[string]any `json:"raw_data,omitempty"`
}

// ZoomMeetingsResponseDTO represents the full payload returned from the Zoom NOC endpoint.
type ZoomMeetingsResponseDTO struct {
	Success       bool             `json:"success"`
	Timestamp     string           `json:"timestamp"`
	QueryWindow   map[string]any   `json:"query_window,omitempty"`
	TotalCount    int              `json:"total_count"`
	LiveCount     int              `json:"live_count"`
	UpcomingCount int              `json:"upcoming_count"`
	Meetings      []ZoomMeetingDTO `json:"meetings"`
	LastSyncedAt  time.Time        `json:"last_synced_at"`
	IsStale       bool             `json:"is_stale"`
}

// ZoomProvider abstracts interaction with the Zoom Pool Manager NOC API.
type ZoomProvider interface {
	Name() string
	GetMeetings(ctx context.Context, params map[string]string) (*ZoomMeetingsResponseDTO, error)
	GetCachedMeetings() *ZoomMeetingsResponseDTO
	TestConnection(ctx context.Context) error
}

