import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Shield,
  Wifi,
  History,
  AlertTriangle,
  Edit2,
  Check,
  Network,
  Server,
  Fingerprint,
  Layers,
  Globe,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { Device, DeviceHistory } from '../../types';
import { api } from '../../api/client';

interface Props {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const DeviceDrawer: React.FC<Props> = ({ device, isOpen, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'monitors' | 'alarms' | 'notes'>('overview');
  const [history, setHistory] = useState<DeviceHistory[]>([]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioForm, setBioForm] = useState({
    building: '',
    location: '',
    department: '',
    purpose: '',
    contact_person: '',
    notes: '',
  });

  useEffect(() => {
    if (device?.id) {
      api.getDeviceHistory(device.id).then(setHistory).catch(console.error);
      if (device.biometric_meta) {
        setBioForm({
          building: device.biometric_meta.building || '',
          location: device.biometric_meta.location || '',
          department: device.biometric_meta.department || '',
          purpose: device.biometric_meta.purpose || '',
          contact_person: device.biometric_meta.contact_person || '',
          notes: device.biometric_meta.notes || '',
        });
      }
    }
  }, [device]);

  if (!isOpen || !device) return null;

  const handleSaveBioMeta = async () => {
    try {
      await api.updateBiometricMetadata(device.id, bioForm);
      setIsEditingBio(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const getDeviceIcon = () => {
    switch (device.category_code) {
      case 'SWITCH':
        return <Layers className="w-8 h-8 text-cyan-400" />;
      case 'SERVER':
        return <Server className="w-8 h-8 text-emerald-400" />;
      case 'BIOMETRIC':
        return <Fingerprint className="w-8 h-8 text-purple-400" />;
      case 'WIRELESS_AP':
        return <Wifi className="w-8 h-8 text-sky-400" />;
      case 'ILL':
      case 'ROUTER':
        return <Globe className="w-8 h-8 text-blue-400" />;
      default:
        return <Network className="w-8 h-8 text-slate-400" />;
    }
  };

  const statusColor =
    device.status === 'UP'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
      : device.status === 'DOWN'
      ? 'bg-red-500/15 text-red-400 border-red-500/40 animate-pulse'
      : 'bg-amber-500/15 text-amber-400 border-amber-500/40';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-full sm:max-w-xl bg-slate-950 border-l border-slate-800 shadow-2xl h-full flex flex-col justify-between overflow-y-auto">
        {/* Header matching reference mockup */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800 sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
                {getDeviceIcon()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColor}`}>
                    {device.status}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{device.category_code}</span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400 truncate">{device.vendor || 'Cisco / ZKTeco'}</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-100 truncate">{device.name}</h2>
                <div className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>IP: {device.ip_address}</span>
                  {device.mac_address && <span className="hidden sm:inline">MAC: {device.mac_address}</span>}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 mt-4 pt-3 border-t border-slate-800/80 overflow-x-auto scrollbar-none pb-0.5">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'monitors', label: 'Monitors & Telemetry' },
              { key: 'alarms', label: `Alarms (${device.active_alarms?.length || 0})` },
              { key: 'notes', label: 'Notes & History' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Overview */}
        <div className="p-3.5 sm:p-6 space-y-5 flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Active Alarm Callout (if alarms present) */}
              {device.active_alarms && device.active_alarms.length > 0 && (
                <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-red-400 uppercase">
                      <AlertTriangle className="w-4 h-4" /> Active Alarm Triggered
                    </span>
                    <span className="text-[10px] font-mono text-red-300">
                      {new Date(device.active_alarms[0].first_seen_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-red-200 font-medium">{device.active_alarms[0].message}</p>
                </div>
              )}

              {/* Quick Metrics Strip */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-blue-400" /> Availability
                  </div>
                  <div className="text-lg font-bold text-slate-100 font-mono">{device.availability_pct}%</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" /> Latency
                  </div>
                  <div className="text-lg font-bold text-slate-100 font-mono">{device.response_time_ms} ms</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-purple-400" /> CPU Load
                  </div>
                  <div className="text-lg font-bold text-slate-100 font-mono">{Math.round(device.cpu_pct)}%</div>
                </div>
              </div>

              {/* 2-Column Property Details Grid */}
              <div className="noc-card p-4 rounded-xl border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Device Properties</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Category</span>
                    <span className="text-slate-200 font-medium">{device.category_code}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Type / Model</span>
                    <span className="text-slate-200 font-medium">{device.type || device.model || 'Standard Device'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">IP Address</span>
                    <span className="text-slate-200 font-mono">{device.ip_address}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">MAC Address</span>
                    <span className="text-slate-200 font-mono">{device.mac_address || '00:1A:2B:3C:4D:5E'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Location</span>
                    <span className="text-slate-200">{device.location_name || 'Main Campus'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Campus Site</span>
                    <span className="text-slate-200">{device.site_name || 'Sri City Campus'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Status Change</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {device.last_status_change_at
                        ? new Date(device.last_status_change_at).toLocaleTimeString()
                        : 'Steady State'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Polled</span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {device.last_seen_at ? new Date(device.last_seen_at).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Biometric Details (if category is Biometric) */}
              {device.category_code === 'BIOMETRIC' && (
                <div className="noc-card p-4 rounded-xl border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-purple-400" /> Biometric Installation Details
                    </div>
                    {!isEditingBio ? (
                      <button
                        onClick={() => setIsEditingBio(true)}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 flex items-center gap-1 text-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveBioMeta}
                        className="p-1 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-xs font-bold"
                      >
                        <Check className="w-3.5 h-3.5" /> Save
                      </button>
                    )}
                  </div>

                  {!isEditingBio ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px]">Building:</span>
                        <span className="text-slate-200 font-medium block">
                          {device.biometric_meta?.building || 'Hostel Block'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Specific Location:</span>
                        <span className="text-slate-200 font-medium block">
                          {device.biometric_meta?.location || 'Ground Floor Entry'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Department:</span>
                        <span className="text-slate-200 font-medium block">
                          {device.biometric_meta?.department || 'Student Affairs'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Contact Person:</span>
                        <span className="text-slate-200 font-medium block">
                          {device.biometric_meta?.contact_person || 'Campus Facilities'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <input
                        type="text"
                        placeholder="Building"
                        value={bioForm.building}
                        onChange={(e) => setBioForm({ ...bioForm, building: e.target.value })}
                        className="w-full p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={bioForm.location}
                        onChange={(e) => setBioForm({ ...bioForm, location: e.target.value })}
                        className="w-full p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                      />
                      <input
                        type="text"
                        placeholder="Department"
                        value={bioForm.department}
                        onChange={(e) => setBioForm({ ...bioForm, department: e.target.value })}
                        className="w-full p-2 rounded bg-slate-900 border border-slate-800 text-slate-200"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* TAB 2: MONITORS & TELEMETRY */}
          {activeTab === 'monitors' && (
            <div className="space-y-4">
              {/* Telemetry Resource Bars */}
              <div className="noc-card p-4 rounded-xl border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Telemetry Gauges</div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">CPU Utilization</span>
                    <span className="text-slate-200 font-mono">{Math.round(device.cpu_pct)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        device.cpu_pct > 80 ? 'bg-red-500' : device.cpu_pct > 60 ? 'bg-amber-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, device.cpu_pct))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Memory Utilization</span>
                    <span className="text-slate-200 font-mono">{Math.round(device.mem_pct)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        device.mem_pct > 80 ? 'bg-red-500' : device.mem_pct > 60 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, device.mem_pct))}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Disk Utilization</span>
                    <span className="text-slate-200 font-mono">{Math.round(device.disk_pct)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(5, device.disk_pct))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Interfaces (if any) */}
              {device.interfaces && device.interfaces.length > 0 && (
                <div className="noc-card p-4 rounded-xl border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-emerald-400" /> Monitored Ports ({device.interfaces.length})
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {device.interfaces.map((iface) => (
                      <div key={iface.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{iface.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                            {iface.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                          <span>In: {Math.round(iface.in_traffic_bps / 1000000)} Mbps</span>
                          <span>Out: {Math.round(iface.out_traffic_bps / 1000000)} Mbps</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ALARMS */}
          {activeTab === 'alarms' && (
            <div className="space-y-3">
              {device.active_alarms && device.active_alarms.length > 0 ? (
                device.active_alarms.map((alm) => (
                  <div key={alm.id} className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold uppercase text-[10px]">
                        {alm.severity}
                      </span>
                      <span className="font-mono text-slate-400 text-[10px]">
                        {new Date(alm.first_seen_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-200 font-medium">{alm.message}</p>
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={async () => {
                          await api.acknowledgeAlarm(alm.id);
                          if (onRefresh) onRefresh();
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-slate-500 italic">
                  No active alarms for this device. System is healthy.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTES & HISTORY */}
          {activeTab === 'notes' && (
            <div className="noc-card p-4 rounded-xl border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-400" /> State Transition Log
              </div>
              {history.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-4">No recent state transitions recorded.</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 text-xs">
                      <div>
                        <span className="font-semibold text-slate-300">
                          {h.previous_status} → {h.new_status}
                        </span>
                        {h.duration_seconds > 0 && (
                          <span className="text-slate-500 text-[11px] ml-2 font-mono">
                            Duration: {h.duration_seconds}s
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => window.open(`https://nms.krea.edu.in/device/${device.name}`, '_blank')}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" /> OPEN IN OPMANAGER
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
