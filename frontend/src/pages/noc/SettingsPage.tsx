import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Volume2, Sliders, Play, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { api } from '../../api/client';
import { SoundProfile } from '../../types';

export const SettingsPage: React.FC = () => {
  const [simulationMsg, setSimulationMsg] = useState('');
  const [simLoading, setSimLoading] = useState(false);

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['system-settings'],
    queryFn: api.getSettings,
  });

  const { data: profiles, refetch: refetchProfiles } = useQuery({
    queryKey: ['sound-profiles'],
    queryFn: api.getSoundProfiles,
  });

  const handleSimulate = async (scenario: string, deviceName?: string, status?: string) => {
    setSimLoading(true);
    setSimulationMsg('');
    try {
      const res = await api.simulateScenario(scenario, deviceName, status);
      setSimulationMsg(res.message || `Scenario "${scenario}" triggered successfully!`);
    } catch (e: unknown) {
      if (e instanceof Error) setSimulationMsg(e.message);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-slate-400" /> Command Center Settings & Live Drills
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          System Polling Intervals, Display Wall Retention, Sound Channels & Outage Simulation Suite
        </p>
      </div>

      {/* Interactive NOC Outage Simulation Suite (Section 61) */}
      <div className="noc-card p-5 border-blue-500/30 bg-blue-950/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-400" /> NOC Simulation Suite & Flood Protection Drills
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live simulation triggers to test TV takeovers, 4-channel sound alerts, flood suppression & recovery
            </p>
          </div>
          {simulationMsg && (
            <span className="px-3 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30 animate-pulse">
              {simulationMsg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => handleSimulate('core_down')}
            disabled={simLoading}
            className="p-3 rounded-lg bg-red-950/40 hover:bg-red-950/60 border border-red-500/30 text-left transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-xs text-red-300 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Core Switch Outage
            </div>
            <p className="text-[11px] text-slate-400">
              Triggers fullscreen TV takeover modal, critical switch alarm & sound alert.
            </p>
          </button>

          <button
            onClick={() => handleSimulate('core_recovered')}
            disabled={simLoading}
            className="p-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-500/30 text-left transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-300 mb-1">
              <Check className="w-4 h-4 text-emerald-400" /> Core Switch Recovery
            </div>
            <p className="text-[11px] text-slate-400">
              Clears alarm, triggers green recovery banner with downtime calculation & recovery chime.
            </p>
          </button>

          <button
            onClick={() => handleSimulate('flood_test')}
            disabled={simLoading}
            className="p-3 rounded-lg bg-purple-950/40 hover:bg-purple-950/60 border border-purple-500/30 text-left transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-xs text-purple-300 mb-1">
              <Volume2 className="w-4 h-4 text-purple-400" /> 40-Switch Flood Test
            </div>
            <p className="text-[11px] text-slate-400">
              Simulates 40 simultaneous switch failures to verify flood suppression to 1 sound.
            </p>
          </button>

          <button
            onClick={() => handleSimulate('', 'BIO-003-LIB-ENTRY', 'DOWN')}
            disabled={simLoading}
            className="p-3 rounded-lg bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/30 text-left transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-xs text-amber-300 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Biometric Failure
            </div>
            <p className="text-[11px] text-slate-400">
              Triggers Biometric Channel sound alert and marks device DOWN in library.
            </p>
          </button>
        </div>
      </div>

      {/* System Settings Form */}
      <div className="noc-card p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-400" /> System Parameters & Retention Policies
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-semibold block">Timezone</span>
            <span className="text-slate-200 font-mono font-bold">{settings?.timezone || 'Asia/Kolkata (IST)'}</span>
          </div>

          <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-semibold block">TV Rotation Interval</span>
            <span className="text-slate-200 font-mono font-bold">
              {settings?.tv_rotation_seconds || '30'} seconds
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-semibold block">TV Idle Screen Timeout</span>
            <span className="text-slate-200 font-mono font-bold">
              {settings?.display_idle_timeout_minutes || '30'} minutes
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-semibold block">Alarms DB Retention</span>
            <span className="text-slate-200 font-mono font-bold">
              {settings?.retention_alarms_days || '180'} days
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-semibold block">Audit Trail DB Retention</span>
            <span className="text-slate-200 font-mono font-bold">
              {settings?.retention_audit_days || '365'} days
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-500 font-semibold block">OpManager Lite Device Category</span>
            <span className="text-slate-200 font-mono font-bold">Biometric Devices</span>
          </div>
        </div>
      </div>
    </div>
  );
};
