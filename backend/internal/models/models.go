package models

import "time"

// User represents an IT operator or administrator.
type User struct {
	ID                 string     `json:"id"`
	Username           string     `json:"username"`
	Email              string     `json:"email"`
	PasswordHash       string     `json:"-"`
	RoleID             string     `json:"role_id"`
	RoleName           string     `json:"role_name,omitempty"`
	Status             string     `json:"status"` // ACTIVE, DISABLED
	MustChangePassword bool       `json:"must_change_password"`
	LastLoginAt        *time.Time `json:"last_login_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	Permissions        []string   `json:"permissions,omitempty"`
}

// Role represents an RBAC role.
type Role struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"` // VIEWER, OPERATOR, NETWORK_OPERATOR, ADMINISTRATOR
	Description string       `json:"description"`
	CreatedAt   time.Time    `json:"created_at"`
	Permissions []Permission `json:"permissions,omitempty"`
}

// Permission represents a fine-grained authorization permission.
type Permission struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Description string `json:"description"`
	Module      string `json:"module"`
}

// Session represents an active session cookie.
type Session struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TokenHash string    `json:"-"`
	Scope     string    `json:"scope"`
	ExpiresAt time.Time `json:"expires_at"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
}

// Device represents an OpManager monitored network device, switch, server, or biometric reader.
type Device struct {
	ID                 string     `json:"id"`
	SourceID           string     `json:"source_id"`
	SourceSystem       string     `json:"source_system"` // opmanager
	Name               string     `json:"name"`
	IPAddress          string     `json:"ip_address"`
	MACAddress         string     `json:"mac_address"`
	CategoryCode       string     `json:"category_code"` // SWITCH, SERVER, BIOMETRIC, ILL, CLASSROOM, ROUTER, WIRELESS_AP
	SiteID             string     `json:"site_id"`
	SiteName           string     `json:"site_name,omitempty"`
	LocationID         string     `json:"location_id"`
	LocationName       string     `json:"location_name,omitempty"`
	Type               string     `json:"type"`
	Vendor             string     `json:"vendor"`
	Model              string     `json:"model"`
	Status             string     `json:"status"` // UP, DOWN, WARNING, UNKNOWN
	AvailabilityPct    float64    `json:"availability_pct"`
	ResponseTimeMS     int        `json:"response_time_ms"`
	CPUPct             float64    `json:"cpu_pct"`
	MemPct             float64    `json:"mem_pct"`
	DiskPct            float64    `json:"disk_pct"`
	LastSeenAt         *time.Time `json:"last_seen_at,omitempty"`
	LastStatusChangeAt *time.Time `json:"last_status_change_at,omitempty"`
	MetadataJSON       string     `json:"metadata_json,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	// Biometric specific enriched metadata
	BiometricMeta *BiometricMetadata `json:"biometric_meta,omitempty"`
	Interfaces    []Interface        `json:"interfaces,omitempty"`
	ActiveAlarms  []Alarm            `json:"active_alarms,omitempty"`
}

// BiometricMetadata stores local operator enhancements for OpManager lite biometric devices.
type BiometricMetadata struct {
	ID            string    `json:"id"`
	DeviceID      string    `json:"device_id"`
	Vendor        string    `json:"vendor"`
	Model         string    `json:"model"`
	Building      string    `json:"building"`
	Location      string    `json:"location"`
	Department    string    `json:"department"`
	Purpose       string    `json:"purpose"`
	ContactPerson string    `json:"contact_person"`
	Notes         string    `json:"notes"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// DeviceHistory tracks uptime/downtime transitions for MTTR and reports.
type DeviceHistory struct {
	ID              string    `json:"id"`
	DeviceID        string    `json:"device_id"`
	DeviceName      string    `json:"device_name,omitempty"`
	PreviousStatus  string    `json:"previous_status"`
	NewStatus       string    `json:"new_status"`
	DurationSeconds int       `json:"duration_seconds"`
	Timestamp       time.Time `json:"timestamp"`
}

// Interface represents a network port/interface on a switch or router.
type Interface struct {
	ID           string    `json:"id"`
	DeviceID     string    `json:"device_id"`
	Name         string    `json:"name"`
	IndexNum     int       `json:"index_num"`
	SpeedBPS     int64     `json:"speed_bps"`
	Status       string    `json:"status"` // UP, DOWN
	InTrafficBPS int64     `json:"in_traffic_bps"`
	OutTrafficBPS int64    `json:"out_traffic_bps"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Endpoint represents a computer/laptop monitored by ManageEngine Endpoint Central.
type Endpoint struct {
	ID              string     `json:"id"`
	SourceID        string     `json:"source_id"`
	Hostname        string     `json:"hostname"`
	IPAddress       string     `json:"ip_address"`
	MACAddress      string     `json:"mac_address"`
	OSName          string     `json:"os_name"`
	OSVersion       string     `json:"os_version"`
	LoggedInUser    string     `json:"logged_in_user"`
	DomainName      string     `json:"domain_name"`
	RemoteOffice    string     `json:"remote_office"`
	Status          string     `json:"status"` // ONLINE, OFFLINE, NOT_SCANNED, MISSING
	LastScanAt      *time.Time `json:"last_scan_at,omitempty"`
	LastSeenAt      *time.Time `json:"last_seen_at,omitempty"`
	HardwareSummary string     `json:"hardware_summary"`
	SoftwareCount   int        `json:"software_count"`
	MetadataJSON    string     `json:"metadata_json,omitempty"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// CustomEndpointGroup represents a user-created or custom-defined group of computers.
type CustomEndpointGroup struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	GroupType    string    `json:"group_type"`
	Category     string    `json:"category"`
	Description  string    `json:"description"`
	MatchType    string    `json:"match_type"` // HOSTNAME_PREFIX, HOSTNAME_CONTAINS, IP_PREFIX, OS_CONTAINS
	MatchValue   string    `json:"match_value"`
	Color        string    `json:"color"`
	CreatedBy    string    `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	TotalCount   int       `json:"total_count,omitempty"`
	OnlineCount  int       `json:"online_count,omitempty"`
	OfflineCount int       `json:"offline_count,omitempty"`
}

// Alarm represents a monitored alert from OpManager.
type Alarm struct {
	ID             string     `json:"id"`
	SourceID       string     `json:"source_id"`
	SourceSystem   string     `json:"source_system"`
	DeviceID       string     `json:"device_id"`
	DeviceName     string     `json:"device_name"`
	DeviceIP       string     `json:"device_ip"`
	Severity       string     `json:"severity"` // CRITICAL, MAJOR, WARNING, INFO
	Message        string     `json:"message"`
	Entity         string     `json:"entity"`
	FirstSeenAt    time.Time  `json:"first_seen_at"`
	LastSeenAt     time.Time  `json:"last_seen_at"`
	Acknowledged   bool       `json:"acknowledged"`
	AcknowledgedBy string     `json:"acknowledged_by,omitempty"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	Cleared        bool       `json:"cleared"`
	ClearedAt      *time.Time `json:"cleared_at,omitempty"`
}

// Incident represents an operational incident / outage.
type Incident struct {
	ID                   string          `json:"id"`
	IncidentNumber       string          `json:"incident_number"`
	Title                string          `json:"title"`
	Description          string          `json:"description"`
	Severity             string          `json:"severity"` // CRITICAL, MAJOR, WARNING, INFO
	Status               string          `json:"status"`   // OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED
	SourceSystem         string          `json:"source_system"`
	PrimaryDeviceID      string          `json:"primary_device_id"`
	PrimaryDeviceName    string          `json:"primary_device_name,omitempty"`
	AffectedDevicesCount int             `json:"affected_devices_count"`
	AssignedToUserID     string          `json:"assigned_to_user_id,omitempty"`
	AssignedToUsername   string          `json:"assigned_to_username,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
	ResolvedAt           *time.Time      `json:"resolved_at,omitempty"`
	ResolvedBy           string          `json:"resolved_by,omitempty"`
	Events               []IncidentEvent `json:"events,omitempty"`
}

// IncidentEvent represents timeline notes and status transitions.
type IncidentEvent struct {
	ID         string    `json:"id"`
	IncidentID string    `json:"incident_id"`
	UserID     string    `json:"user_id,omitempty"`
	Username   string    `json:"username,omitempty"`
	EventType  string    `json:"event_type"`
	Notes      string    `json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
}

// VLAN represents a network segment controlled via FortiGate.
type VLAN struct {
	ID                 string     `json:"id"`
	VlanID             int        `json:"vlan_id"`
	Name               string     `json:"name"`
	Description        string     `json:"description"`
	Subnet             string     `json:"subnet"`
	Gateway            string     `json:"gateway"`
	InternetStatus     string     `json:"internet_status"` // ENABLED, DISABLED
	FortiGatePolicyID  int        `json:"fortigate_policy_id"`
	ExpectedEndpoints  int        `json:"expected_endpoints"`
	ExpectedAPs        int        `json:"expected_aps"`
	ExpectedClassrooms int        `json:"expected_classrooms"`
	LastStateChangeAt  *time.Time `json:"last_state_change_at,omitempty"`
	LastActionJobID    string     `json:"last_action_job_id,omitempty"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// ActionJob represents a stateful network action pipeline execution.
type ActionJob struct {
	ID                     string     `json:"id"`
	JobNumber              string     `json:"job_number"`
	ActionType             string     `json:"action_type"` // VLAN_INTERNET_DISABLE, VLAN_INTERNET_ENABLE, ROLLBACK
	TargetType             string     `json:"target_type"`
	TargetID               string     `json:"target_id"`
	UserID                 string     `json:"user_id"`
	Username               string     `json:"username"`
	Reason                 string     `json:"reason"`
	State                  string     `json:"state"` // QUEUED, VALIDATING, EXECUTING, VERIFYING, SUCCESS, FAILED, UNKNOWN, CANCELLED
	PreviousStateJSON      string     `json:"previous_state_json"`
	NewStateJSON           string     `json:"new_state_json"`
	APIRequestJSON         string     `json:"api_request_json,omitempty"`
	APIResponseJSON        string     `json:"api_response_json,omitempty"`
	VerificationResultJSON string     `json:"verification_result_json,omitempty"`
	ErrorMessage           string     `json:"error_message,omitempty"`
	RequestedAt            time.Time  `json:"requested_at"`
	StartedAt              *time.Time `json:"started_at,omitempty"`
	CompletedAt            *time.Time `json:"completed_at,omitempty"`
}

// AuditLog tracks immutable system records.
type AuditLog struct {
	ID                string    `json:"id"`
	UserID            string    `json:"user_id,omitempty"`
	Username          string    `json:"username"`
	Action            string    `json:"action"`
	TargetType        string    `json:"target_type,omitempty"`
	TargetID          string    `json:"target_id,omitempty"`
	IPAddress         string    `json:"ip_address"`
	UserAgent         string    `json:"user_agent"`
	PreviousStateJSON string    `json:"previous_state_json,omitempty"`
	NewStateJSON      string    `json:"new_state_json,omitempty"`
	Result            string    `json:"result"` // SUCCESS, FAILURE
	Reason            string    `json:"reason,omitempty"`
	MetadataJSON      string    `json:"metadata_json,omitempty"`
	Timestamp         time.Time `json:"timestamp"`
}

// SoundProfile defines audio alert configurations per device category.
type SoundProfile struct {
	ID              string    `json:"id"`
	CategoryCode    string    `json:"category_code"` // SWITCH, SERVER, BIOMETRIC, ILL, CLASSROOM
	Enabled         bool      `json:"enabled"`
	DownSound       string    `json:"down_sound"`
	RecoverySound   string    `json:"recovery_sound"`
	Volume          int       `json:"volume"` // 0-100
	CooldownSeconds int       `json:"cooldown_seconds"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// DisplayDevice tracks registered NOC TV wall displays and their heartbeats.
type DisplayDevice struct {
	ID           string    `json:"id"`
	DisplayUID   string    `json:"display_uid"`
	Name         string    `json:"name"`
	IPAddress    string    `json:"ip_address"`
	Resolution   string    `json:"resolution"`
	BrowserInfo  string    `json:"browser_info"`
	CurrentPage  string    `json:"current_page"`
	SoundEnabled bool      `json:"sound_enabled"`
	LastSeenAt   time.Time `json:"last_seen_at"`
	Status       string    `json:"status"` // ONLINE, STALE, OFFLINE
	SettingsJSON string    `json:"settings_json,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Integration represents integration provider sync health.
type Integration struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"` // opmanager, endpointcentral, fortigate
	BaseURL     string     `json:"base_url"`
	Status      string     `json:"status"` // CONNECTED, DEGRADED, OFFLINE
	LastSyncAt  *time.Time `json:"last_sync_at,omitempty"`
	LastError   string     `json:"last_error,omitempty"`
	LastErrorAt *time.Time `json:"last_error_at,omitempty"`
	SyncCount   int64      `json:"sync_count"`
	ErrorCount  int64      `json:"error_count"`
}

// DashboardSummaryDTO provides consolidated metrics for cards.
type DashboardSummaryDTO struct {
	TotalDevices       int     `json:"total_devices"`
	DevicesUp          int     `json:"devices_up"`
	DevicesDown        int     `json:"devices_down"`
	DevicesWarning     int     `json:"devices_warning"`
	OverallAvailability float64 `json:"overall_availability"`

	NetworkDevicesTotal int     `json:"network_devices_total"`
	NetworkDevicesUp    int     `json:"network_devices_up"`
	NetworkDevicesDown  int     `json:"network_devices_down"`
	NetworkAvailability float64 `json:"network_availability"`

	SwitchesTotal    int `json:"switches_total"`
	SwitchesUp       int `json:"switches_up"`
	SwitchesDown     int `json:"switches_down"`
	WirelessAPsTotal int `json:"wireless_aps_total"`
	WirelessAPsUp    int `json:"wireless_aps_up"`
	WirelessAPsDown  int `json:"wireless_aps_down"`
	ILLTotal         int `json:"ill_total"`
	ILLUp            int `json:"ill_up"`

	ServersTotal int     `json:"servers_total"`
	ServersUp    int     `json:"servers_up"`
	ServersDown  int     `json:"servers_down"`

	EndpointsTotal   int `json:"endpoints_total"`
	EndpointsOnline  int `json:"endpoints_online"`
	EndpointsOffline int `json:"endpoints_offline"`

	BiometricsTotal int `json:"biometrics_total"`
	BiometricsUp    int `json:"biometrics_up"`
	BiometricsDown  int `json:"biometrics_down"`

	ActiveCriticalAlarms int `json:"active_critical_alarms"`
	ActiveMajorAlarms    int `json:"active_major_alarms"`
	ActiveIncidents      int `json:"active_incidents"`

	InboundTrafficBPS  int64 `json:"inbound_traffic_bps"`
	OutboundTrafficBPS int64 `json:"outbound_traffic_bps"`

	IntegrationsHealth []Integration `json:"integrations_health"`
	DataFreshness      string        `json:"data_freshness"` // LIVE, DEGRADED, STALE
}
