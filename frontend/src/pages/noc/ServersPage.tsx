import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, Cpu, HardDrive, Activity, ExternalLink, ShieldCheck, CheckCircle2, Laptop } from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Device } from '../../types';

export const ServersPage: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const { data: resp, isLoading } = useQuery({
    queryKey: ['dashboard-servers'],
    queryFn: api.getServerDashboard,
    refetchInterval: 15000,
  });

  const servers = resp?.servers || [];
  const serverEndpoints = resp?.server_endpoints || [];

  const avgCpu = Math.round(
    servers.reduce((acc, s) => acc + (s.cpu_pct || 0), 0) / (servers.length || 1)
  );
  const avgMem = Math.round(
    servers.reduce((acc, s) => acc + (s.mem_pct || 0), 0) / (servers.length || 1)
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header & Quick Telemetry Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Server className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" /> Compute & Virtualization Servers
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            Core Infrastructure Appliances, Virtual Hosts, Database Clusters & Endpoint Central Server Nodes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-slate-900 border border-slate-800 px-3 sm:px-4 py-2 rounded-xl text-xs font-mono self-start lg:self-auto">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Cluster Availability</span>
            <span className="text-emerald-400 font-bold text-sm">100.0% Online</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Avg CPU Load</span>
            <span className="text-purple-400 font-bold text-sm">{avgCpu}%</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Avg Memory Load</span>
            <span className="text-blue-400 font-bold text-sm">{avgMem}%</span>
          </div>
        </div>
      </div>

      {/* Section 1: Core Compute Hosts */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" /> Core Production Appliances & Virtual Hosts ({servers.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {servers.map((srv) => {
            const isUp = srv.status === 'UP';
            return (
              <div
                key={srv.id}
                onClick={() => setSelectedDevice(srv)}
                className="noc-card noc-card-hover p-5 cursor-pointer space-y-4 border-slate-800 hover:border-emerald-500/40"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isUp
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                      >
                        {srv.status}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{srv.ip_address}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100">{srv.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">{srv.type}</div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">Availability</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {srv.availability_pct}%
                    </span>
                  </div>
                </div>

                {/* Resource Utilization Gauges */}
                <div className="space-y-2.5 bg-slate-950 p-3 rounded-lg border border-slate-850 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-purple-400" /> CPU Load
                      </span>
                      <span className="font-mono text-slate-200 font-bold">{Math.round(srv.cpu_pct)}%</span>
                    </div>
                    <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          srv.cpu_pct > 80 ? 'bg-red-500' : srv.cpu_pct > 60 ? 'bg-amber-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${srv.cpu_pct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Activity className="w-3 h-3 text-blue-400" /> Memory Utilization
                      </span>
                      <span className="font-mono text-slate-200 font-bold">{Math.round(srv.mem_pct)}%</span>
                    </div>
                    <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          srv.mem_pct > 80 ? 'bg-red-500' : srv.mem_pct > 60 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${srv.mem_pct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-emerald-400" /> Storage Capacity
                      </span>
                      <span className="font-mono text-slate-200 font-bold">{Math.round(srv.disk_pct)}%</span>
                    </div>
                    <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${srv.disk_pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800 text-slate-400 font-mono">
                  <span>Latency: {srv.response_time_ms}ms</span>
                  <span className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
                    Drilldown Details →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Management & Windows/Linux Server Nodes from Endpoint Central */}
      {serverEndpoints.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Laptop className="w-4 h-4 text-blue-400" /> Endpoint Central Server Workloads ({serverEndpoints.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {serverEndpoints.map((ep) => (
              <div
                key={ep.id}
                className="noc-card p-5 space-y-3 border-slate-800 bg-slate-950/60"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        {ep.status}
                      </span>
                      <span className="text-xs font-mono text-slate-400">{ep.ip_address}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100">{ep.hostname}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">{ep.os_name}</div>
                  </div>

                  <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                    <Server className="w-5 h-5" />
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Logged User:</span>
                    <span className="text-slate-200 font-semibold">{ep.logged_in_user || 'SYSTEM'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Domain:</span>
                    <span className="text-slate-300">{ep.domain_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Office/Scope:</span>
                    <span className="text-slate-300">{ep.remote_office}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">ManageEngine Endpoint</span>
                  <a
                    href={`https://endpointcentral.krea.edu.in:8383/inventory.do?action=showComputerDetails&resourceId=${ep.source_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> Console
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeviceDrawer
        device={selectedDevice}
        isOpen={selectedDevice !== null}
        onClose={() => setSelectedDevice(null)}
      />
    </div>
  );
};
