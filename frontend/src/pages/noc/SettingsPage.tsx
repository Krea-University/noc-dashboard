import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Settings, Volume2, Sliders, Play, AlertTriangle, ShieldCheck, Check, Sun, Moon, Palette, Users } from 'lucide-react';
import { api } from '../../api/client';
import { SoundProfile } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 md:space-y-8 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
          <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 shrink-0" /> Command Center Settings & Live Drills
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          System Polling Intervals, Display Wall Retention, Appearance & Outage Simulation Suite
        </p>
      </div>

      {/* Theme & Appearance Configuration */}
      <div className="noc-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400" /> Command Center Appearance & Theme
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalize your display mode. Your preference is automatically saved and remembered across sessions.
            </p>
          </div>
          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase self-start sm:self-auto">
            Active: {theme} mode
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
              theme === 'dark'
                ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75'
            }`}
          >
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400">
              <Moon className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">Dark Ops Theme</span>
                {theme === 'dark' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ultra-high-contrast OLED black and midnight navy palette. Designed for NOC wall displays, 24/7 dark command rooms, and reduced eye strain.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 ${
              theme === 'light'
                ? 'bg-white border-blue-500 ring-2 ring-blue-500/30 shadow-lg'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75'
            }`}
          >
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <Sun className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-100">Executive White Theme</span>
                {theme === 'light' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-400">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clean, crisp white and light slate interface. Optimized for well-lit office environments, daytime operations, executive reports, and Flutter ERP embedding.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Operator Accounts & RBAC Card */}
      <div className="noc-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> Operator Accounts & Access Control (RBAC)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage NOC operator accounts, assign permission roles (Viewer, Operator, Network Operator, Administrator), and control system access.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/noc/users')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 self-start sm:self-auto transition-colors shadow-sm"
          >
            <Users className="w-4 h-4" /> Manage User Accounts
          </button>
        </div>
      </div>

      {/* Interactive NOC Outage Simulation Suite (Section 61) */}
      <div className="noc-card p-4 sm:p-5 border-blue-500/30 bg-blue-950/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-300 flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-400" /> NOC Simulation Suite & Flood Protection Drills
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live simulation triggers to test TV takeovers, 4-channel sound alerts, flood suppression & recovery
            </p>
          </div>
          {simulationMsg && (
            <span className="px-3 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-mono font-bold border border-blue-500/30 animate-pulse self-start sm:self-auto">
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
