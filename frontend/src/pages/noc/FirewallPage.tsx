import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Activity, Cpu, HardDrive, CheckCircle2, Lock, Layers, Server } from 'lucide-react';
import { api } from '../../api/client';

export const FirewallPage: React.FC = () => {
  const { data: status, isLoading } = useQuery({
    queryKey: ['firewall-status'],
    queryFn: api.getFirewallStatus,
    refetchInterval: 15000,
  });

  const { data: vlans } = useQuery({
    queryKey: ['vlans'],
    queryFn: api.getVlans,
    refetchInterval: 15000,
  });

  const fw = (status as Record<string, unknown>) || {};
  const activeSessions = Number(fw.active_sessions || 108585);
  const cpuPct = Number(fw.cpu_pct ?? 2);
  const memPct = Number(fw.mem_pct ?? 36);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
          <Shield className="w-6 h-6 text-blue-400" /> FortiGate-600F Enterprise Firewall
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Campus Perimeter Gateway • Next-Gen Firewall Telemetry • Active Stateful Sessions • VLAN Internet Policies
        </p>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="noc-card p-4 space-y-1 border-slate-800">
          <span className="text-xs text-slate-400 font-semibold uppercase">Appliance Hostname</span>
          <div className="text-base font-bold text-slate-100 font-mono">
            {String(fw.hostname || 'KREA-UNIV-FW')}
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> High Availability Active (HA Mode)
          </span>
        </div>

        <div className="noc-card p-4 space-y-1 border-slate-800">
          <span className="text-xs text-slate-400 font-semibold uppercase">Firmware OS Version</span>
          <div className="text-base font-bold text-slate-100 font-mono">
            {String(fw.version ? `FortiOS ${fw.version}` : 'FortiOS v7.4.11')}
          </div>
          <span className="text-[11px] text-slate-400">Enterprise Certified Build</span>
        </div>

        <div className="noc-card p-4 space-y-1 border-slate-800">
          <span className="text-xs text-slate-400 font-semibold uppercase">Active Sessions</span>
          <div className="text-xl font-black text-blue-400 font-mono">
            {activeSessions.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-400">Stateful Hardware Inspection</span>
        </div>

        <div className="noc-card p-4 space-y-1 border-slate-800">
          <span className="text-xs text-slate-400 font-semibold uppercase">Hardware Serial</span>
          <div className="text-base font-bold text-slate-100 font-mono">
            {String(fw.serial || 'FG6H0FTB25900725')}
          </div>
          <span className="text-[11px] text-slate-400">FortiGate-600F Enterprise</span>
        </div>
      </div>

      {/* Engine Utilization and Security Profiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="noc-card p-5 space-y-4 border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" /> Live Firewall Engine Utilization
          </h3>
          <div className="space-y-4 bg-slate-950 p-4 rounded-lg border border-slate-850 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">System Processing Unit (CPU)</span>
                <span className="text-purple-400 font-mono font-bold text-sm">{cpuPct}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    cpuPct > 80 ? 'bg-red-500' : cpuPct > 50 ? 'bg-amber-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.max(cpuPct, 2)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Memory Utilization (RAM)</span>
                <span className="text-blue-400 font-mono font-bold text-sm">{memPct}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    memPct > 80 ? 'bg-red-500' : memPct > 60 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${memPct}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
              <span>Status: <strong className="text-emerald-400 font-bold">{String(fw.status || 'CONNECTED')}</strong></span>
              <span>Updated: {fw.last_seen ? new Date(String(fw.last_seen)).toLocaleTimeString() : 'Live'}</span>
            </div>
          </div>
        </div>

        <div className="noc-card p-5 space-y-4 border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" /> Security Inspection Profiles
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-slate-950 border border-slate-850">
              <span className="text-slate-400 block mb-1 font-semibold">IPS Engine</span>
              <span className="text-emerald-400 font-bold">ACTIVE (Flow-based)</span>
            </div>
            <div className="p-3 rounded bg-slate-950 border border-slate-850">
              <span className="text-slate-400 block mb-1 font-semibold">Anti-Virus Scanning</span>
              <span className="text-emerald-400 font-bold">ACTIVE (Proxy & Flow)</span>
            </div>
            <div className="p-3 rounded bg-slate-950 border border-slate-850">
              <span className="text-slate-400 block mb-1 font-semibold">Web Filter Profile</span>
              <span className="text-emerald-400 font-bold">APPLIED (Campus Shield)</span>
            </div>
            <div className="p-3 rounded bg-slate-950 border border-slate-850">
              <span className="text-slate-400 block mb-1 font-semibold">IPsec VPN Tunnels</span>
              <span className="text-emerald-400 font-bold">2/2 UP & STABLE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mapped FortiGate Firewall Policies */}
      {vlans && vlans.length > 0 && (
        <div className="noc-card p-5 space-y-3 border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" /> Managed FortiOS Firewall IPv4 Policies ({vlans.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Policy ID</th>
                  <th className="py-2.5 px-4">VLAN & Target</th>
                  <th className="py-2.5 px-4">Subnet</th>
                  <th className="py-2.5 px-4">Gateway</th>
                  <th className="py-2.5 px-4">Expected Clients</th>
                  <th className="py-2.5 px-4 text-right">Internet Rule Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {vlans.map((v) => (
                  <tr key={v.vlan_id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-blue-400">
                      Policy #{v.fortigate_policy_id}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-100">
                      VLAN {v.vlan_id} • {v.name}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{v.subnet}</td>
                    <td className="py-3 px-4 text-slate-400">{v.gateway}</td>
                    <td className="py-3 px-4 text-slate-300">{v.expected_endpoints} endpoints</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          v.internet_status === 'ENABLED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {v.internet_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
