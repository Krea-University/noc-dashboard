export interface User {
  id: string;
  username: string;
  email: string;
  role_id: string;
  role_name?: string;
  status: string;
  must_change_password: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  permissions?: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
  permissions?: { id?: string; code: string; description?: string; module?: string }[];
}

export interface Permission {
  id: string;
  code: string;
  description: string;
  module: string;
}

export interface Device {
  id: string;
  source_id: string;
  source_system: string;
  name: string;
  ip_address: string;
  mac_address?: string;
  category_code: 'SWITCH' | 'SERVER' | 'BIOMETRIC' | 'ILL' | 'CLASSROOM' | 'ROUTER' | 'WIRELESS_AP' | 'OTHER';
  site_id?: string;
  site_name?: string;
  location_id?: string;
  location_name?: string;
  type: string;
  vendor: string;
  model: string;
  status: 'UP' | 'DOWN' | 'WARNING' | 'UNKNOWN';
  availability_pct: number;
  response_time_ms: number;
  cpu_pct: number;
  mem_pct: number;
  disk_pct: number;
  last_seen_at?: string;
  last_status_change_at?: string;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
  biometric_meta?: BiometricMetadata;
  interfaces?: Interface[];
  active_alarms?: Alarm[];
}

export interface BiometricMetadata {
  id: string;
  device_id: string;
  vendor: string;
  model: string;
  building: string;
  location: string;
  department: string;
  purpose: string;
  contact_person: string;
  notes: string;
  updated_at: string;
}

export interface Interface {
  id: string;
  device_id: string;
  name: string;
  index_num: number;
  speed_bps: number;
  status: 'UP' | 'DOWN';
  in_traffic_bps: number;
  out_traffic_bps: number;
  updated_at: string;
}

export interface DeviceHistory {
  id: string;
  device_id: string;
  previous_status: string;
  new_status: string;
  duration_seconds: number;
  timestamp: string;
}

export interface EndpointGroup {
  id?: string;
  name: string;
  group_type: 'Computers';
  category: string;
  description: string;
  total: number;
  online: number;
  offline: number;
  is_custom?: boolean;
  match_type?: string;
  match_value?: string;
  color?: string;
}

export interface CustomGroup {
  id: string;
  name: string;
  group_type: 'Computers';
  category: string;
  description: string;
  match_type: 'HOSTNAME_PREFIX' | 'HOSTNAME_CONTAINS' | 'IP_PREFIX' | 'OS_CONTAINS' | 'MANUAL';
  match_value: string;
  color?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  total_count?: number;
  online_count?: number;
  offline_count?: number;
}

export interface Endpoint {
  id: string;
  source_id: string;
  hostname: string;
  ip_address: string;
  mac_address: string;
  os_name: string;
  os_version: string;
  logged_in_user: string;
  domain_name: string;
  remote_office: string;
  status: 'ONLINE' | 'OFFLINE' | 'NOT_SCANNED' | 'MISSING';
  last_scan_at?: string;
  last_seen_at?: string;
  hardware_summary: string;
  software_count: number;
  metadata_json?: string;
  primary_group?: string;
  groups?: string[];
  updated_at: string;
}


export interface Alarm {
  id: string;
  source_id: string;
  source_system: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  severity: 'CRITICAL' | 'MAJOR' | 'WARNING' | 'INFO';
  message: string;
  entity: string;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  cleared: boolean;
  cleared_at?: string;
}

export interface Incident {
  id: string;
  incident_number: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'MAJOR' | 'WARNING' | 'INFO';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  source_system: string;
  primary_device_id: string;
  primary_device_name?: string;
  affected_devices_count: number;
  assigned_to_user_id?: string;
  assigned_to_username?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolved_by?: string;
  events?: IncidentEvent[];
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  user_id?: string;
  username?: string;
  event_type: string;
  notes: string;
  created_at: string;
}

export interface VLAN {
  id: string;
  vlan_id: number;
  name: string;
  description: string;
  subnet: string;
  gateway: string;
  internet_status: 'ENABLED' | 'DISABLED';
  fortigate_policy_id: number;
  expected_endpoints: number;
  expected_aps: number;
  expected_classrooms: number;
  last_state_change_at?: string;
  last_action_job_id?: string;
  updated_at: string;
}

export interface ActionJob {
  id: string;
  job_number: string;
  action_type: string;
  target_type: string;
  target_id: string;
  user_id: string;
  username: string;
  reason: string;
  state: 'QUEUED' | 'VALIDATING' | 'EXECUTING' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'CANCELLED';
  previous_state_json: string;
  new_state_json?: string;
  api_request_json?: string;
  api_response_json?: string;
  verification_result_json?: string;
  error_message?: string;
  requested_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ImpactEstimate {
  vlan_id: number;
  vlan_name: string;
  target_action: 'DISABLE' | 'ENABLE';
  expected_endpoints: number;
  expected_aps: number;
  expected_classrooms: number;
  internal_network: string;
  internet_access: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  username: string;
  action: string;
  target_type?: string;
  target_id?: string;
  ip_address?: string;
  user_agent?: string;
  previous_state_json?: string;
  new_state_json?: string;
  result: 'SUCCESS' | 'FAILURE';
  reason?: string;
  metadata_json?: string;
  timestamp: string;
}

export interface VlanLogReportItem {
  id: string;
  timestamp: string;
  timestamp_ist: string;
  action: string;
  action_label: 'DISABLE' | 'ENABLE';
  vlan_id: number;
  vlan_name: string;
  subnet: string;
  gateway: string;
  policy_id: number;
  user_id?: string;
  username: string;
  user_role: string;
  ip_address: string;
  user_agent: string;
  result: 'SUCCESS' | 'FAILED';
  reason: string;
  previous_status: string;
  new_status: string;
  fortigate_verified: boolean;
}

export interface VlanLogsReportResponse {
  generated_at: string;
  generated_at_ist: string;
  range: string;
  total_events: number;
  disable_count: number;
  enable_count: number;
  success_count: number;
  failed_count: number;
  success_rate: number;
  unique_users_count: number;
  impacted_vlans_count: number;
  logs: VlanLogReportItem[];
}

export interface SoundProfile {
  id: string;
  category_code: string;
  enabled: boolean;
  down_sound: string;
  recovery_sound: string;
  volume: number;
  cooldown_seconds: number;
  updated_at: string;
}

export interface DisplayDevice {
  id: string;
  display_uid: string;
  name: string;
  ip_address?: string;
  resolution?: string;
  browser_info?: string;
  current_page?: string;
  sound_enabled: boolean;
  last_seen_at: string;
  status: 'ONLINE' | 'STALE' | 'OFFLINE';
  settings_json?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_devices: number;
  devices_up: number;
  devices_down: number;
  devices_warning: number;
  overall_availability: number;

  network_devices_total: number;
  network_devices_up: number;
  network_devices_down: number;
  network_availability: number;

  switches_total?: number;
  switches_up?: number;
  switches_down?: number;
  wireless_aps_total?: number;
  wireless_aps_up?: number;
  wireless_aps_down?: number;
  ill_total?: number;
  ill_up?: number;

  servers_total: number;
  servers_up: number;
  servers_down: number;

  endpoints_total: number;
  endpoints_online: number;
  endpoints_offline: number;

  biometrics_total: number;
  biometrics_up: number;
  biometrics_down: number;

  active_critical_alarms: number;
  active_major_alarms: number;
  active_incidents: number;

  inbound_traffic_bps: number;
  outbound_traffic_bps: number;

  integrations_health: Integration[];
  data_freshness: 'LIVE' | 'DEGRADED' | 'STALE';
}

export interface Integration {
  id: string;
  name: string;
  type: string;
  base_url: string;
  status: 'CONNECTED' | 'DEGRADED' | 'OFFLINE';
  last_sync_at?: string;
  last_error?: string;
  sync_count: number;
  error_count: number;
}

export interface ProblemDevice {
  id: string;
  name: string;
  type: string;
  category: string;
  ip: string;
  status: string;
  severity: 'CRITICAL' | 'MAJOR' | 'WARNING' | 'INFO';
  duration: string;
  downtime_minutes: number;
  count: number;
  incidents: number;
  message?: string;
  last_status_change_at?: string;
}

export interface TrendPoint {
  date: string;
  full_date: string;
  availability_pct: number;
  alarms_count: number;
  critical_count: number;
}

export interface ZoneHealth {
  zone: string;
  total: number;
  up: number;
  down: number;
  warning: number;
  availability_pct: number;
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
}

export interface AvailabilityReport {
  overall_availability_pct: number;
  sla_compliance_pct: number;
  sla_target_pct: number;
  network_availability_pct: number;
  network_devices_total: number;
  network_devices_up: number;
  network_devices_down: number;
  servers_availability_pct: number;
  servers_total: number;
  servers_up: number;
  servers_down: number;
  endpoints_availability_pct: number;
  endpoints_total: number;
  endpoints_online: number;
  endpoints_offline: number;
  biometrics_availability_pct: number;
  biometrics_total: number;
  biometrics_up: number;
  biometrics_down: number;
  total_devices: number;
  devices_up: number;
  devices_down: number;
  devices_warning: number;
  mttr_minutes: number;
  mttr_formatted?: string;
  mttr_target_minutes: number;
  total_incidents_30d: number;
  active_incidents_count: number;
  resolved_incidents_count: number;
  uptime_trends_30d: TrendPoint[];
  site_health_breakdown: ZoneHealth[];
  top_problem_devices: ProblemDevice[];
}

