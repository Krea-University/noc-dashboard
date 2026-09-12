import {
  User, Role, Device, DeviceHistory, Endpoint, CustomGroup, Alarm, Incident,
  VLAN, ActionJob, ImpactEstimate, AuditLog, SoundProfile,
  DisplayDevice, DashboardSummary, ProblemDevice, AvailabilityReport,
  VlanLogsReportResponse,
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  getAuthConfig: () =>
    request<{ turnstile_site_key: string; google_client_id: string }>('/auth/config'),
  login: (username: string, password: string, turnstileToken?: string) =>
    request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        turnstile_token: turnstileToken,
        'cf-turnstile-response': turnstileToken,
      }),
    }),
  loginWithGoogle: (credential: string) =>
    request<{ user: User; token: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: User; scope: string }>('/me'),
  exchangeEmbedJWT: (jwt: string) =>
    request<{ token: string; scope: string; sub: string }>('/embed/session', {
      method: 'POST',
      body: JSON.stringify({ jwt }),
    }),

  // Dashboards
  getSummary: () => request<DashboardSummary>('/dashboard/summary'),
  getNetworkDashboard: () => request<{ devices: Device[]; interfaces: unknown[] }>('/dashboard/network'),
  getServerDashboard: () => request<{ servers: Device[]; server_endpoints?: Endpoint[] }>('/dashboard/servers'),
  getEndpointDashboard: () => request<{ endpoints: Endpoint[] }>('/dashboard/endpoints'),
  getBiometricDashboard: () => request<{ biometrics: Device[] }>('/dashboard/biometrics'),

  // Devices
  getDevices: (category?: string, search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    return request<Device[]>(`/devices?${params.toString()}`);
  },
  getDevice: (id: string) => request<Device>(`/devices/${id}`),
  getDeviceHistory: (id: string) => request<DeviceHistory[]>(`/devices/${id}/history`),
  getTopProblemDevices: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return request<ProblemDevice[]>(`/devices/top-problems${params}`);
  },

  // Biometrics
  getBiometrics: () => request<Device[]>('/biometrics'),
  getBiometric: (id: string) => request<Device>(`/biometrics/${id}`),
  updateBiometricMetadata: (id: string, meta: Record<string, unknown>) =>
    request<{ status: string }>(`/biometrics/${id}/metadata`, {
      method: 'PUT',
      body: JSON.stringify(meta),
    }),

  // Endpoints & Custom Groups
  getEndpoints: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('q', search);
    return request<Endpoint[]>(`/endpoints?${params.toString()}`);
  },
  getEndpoint: (id: string) => request<Endpoint>(`/endpoints/${id}`),
  getCustomGroups: () => request<CustomGroup[]>('/endpoints/custom-groups'),
  createCustomGroup: (data: Partial<CustomGroup>) =>
    request<CustomGroup>('/endpoints/custom-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCustomGroup: (id: string) =>
    request<{ status: string }>(`/endpoints/custom-groups/${id}`, {
      method: 'DELETE',
    }),

  getAlarms: (severity?: string, cleared?: boolean | string) => {
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (cleared !== undefined) {
      if (typeof cleared === 'boolean') {
        params.set('cleared', cleared ? 'true' : 'false');
      } else {
        params.set('status', cleared);
      }
    }
    return request<Alarm[]>(`/alarms?${params.toString()}`);
  },
  acknowledgeAlarm: (id: string) =>
    request<{ status: string }>(`/alarms/${id}/acknowledge`, { method: 'POST' }),

  getIncidents: () => request<Incident[]>('/incidents'),
  getIncident: (id: string) => request<Incident>(`/incidents/${id}`),
  updateIncidentStatus: (id: string, status: string) =>
    request<{ status: string }>(`/incidents/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  addIncidentNote: (id: string, notes: string) =>
    request<{ status: string }>(`/incidents/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  // FortiGate & VLAN Control
  getVlans: () => request<VLAN[]>('/vlans'),
  syncVlansFromFirewall: () =>
    request<{ status: string; synced_count: number; vlans: VLAN[] }>('/vlans/sync', {
      method: 'POST',
    }),
  getVlan: (id: number | string) => request<VLAN>(`/vlans/${id}`),
  getVlanImpact: (id: number | string, action: 'DISABLE' | 'ENABLE') =>
    request<ImpactEstimate>(`/vlans/${id}/impact?action=${action}`),
  disableVlanInternet: (id: number | string, reason: string, password?: string) =>
    request<ActionJob>(`/vlans/${id}/internet/disable`, {
      method: 'POST',
      body: JSON.stringify({ reason, password }),
    }),
  enableVlanInternet: (id: number | string, reason: string, password?: string) =>
    request<ActionJob>(`/vlans/${id}/internet/enable`, {
      method: 'POST',
      body: JSON.stringify({ reason, password }),
    }),
  getFirewallStatus: () => request<unknown>('/firewall'),
  getActions: () => request<ActionJob[]>('/actions'),
  rollbackAction: (id: string, password?: string) =>
    request<ActionJob>(`/actions/${id}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Audit & Reports
  getAuditLogs: (action?: string, username?: string) => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (username) params.set('username', username);
    return request<AuditLog[]>(`/audit?${params.toString()}`);
  },
  getAvailabilityReport: () => request<AvailabilityReport>('/reports/availability'),
  getLLPReport: (provider?: string, range?: string) => {
    const params = new URLSearchParams();
    if (provider) params.set('provider', provider);
    if (range) params.set('range', range);
    return request<any>(`/reports/llp?${params.toString()}`);
  },
  getVlanLogsReport: (range?: string, action?: string, search?: string) => {
    const params = new URLSearchParams();
    if (range) params.set('range', range);
    if (action) params.set('action', action);
    if (search) params.set('search', search);
    return request<VlanLogsReportResponse>(`/reports/vlan-logs?${params.toString()}`);
  },

  // NOC Displays
  getDisplays: () => request<DisplayDevice[]>('/displays'),
  sendDisplayHeartbeat: (data: Partial<DisplayDevice>) =>
    request<{ status: string }>('/displays/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Sound
  getSoundProfiles: () => request<SoundProfile[]>('/sound/profiles'),
  updateSoundProfile: (category: string, data: Partial<SoundProfile>) =>
    request<{ status: string }>(`/sound/profiles/${category}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Users & Settings
  getRoles: () => request<Role[]>('/roles'),
  getUsers: () => request<User[]>('/users'),
  createUser: (user: Record<string, unknown>) =>
    request<{ id: string; username: string; email: string; role_id: string; status: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    }),
  patchUser: (id: string, changes: Record<string, unknown>) =>
    request<{ status: string }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),
  deleteUser: (id: string) =>
    request<{ status: string; id: string }>(`/users/${id}`, {
      method: 'DELETE',
    }),
  resetUserPassword: (id: string, data?: { new_password?: string; must_change_password?: boolean }) =>
    request<{ status: string; temporary_password: string; must_change: boolean }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  getSettings: () => request<Record<string, string>>('/settings'),
  updateSettings: (settings: Record<string, string>) =>
    request<{ status: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Simulation
  simulateScenario: (scenario: string, deviceName?: string, status?: string) =>
    request<{ status: string; message?: string }>('/mock/simulate', {
      method: 'POST',
      body: JSON.stringify({ scenario, device_name: deviceName, status }),
    }),
};
