import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Laptop,
  Search,
  Filter,
  Download,
  LayoutGrid,
  Table as TableIcon,
  X,
  Building2,
} from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Device } from '../../types';

export const ServersPage: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [search, setSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  const { data: resp, isLoading } = useQuery({
    queryKey: ['dashboard-servers'],
    queryFn: api.getServerDashboard,
    refetchInterval: 15000,
  });

  const rawServers = resp?.servers || [];
  const rawEndpoints = resp?.server_endpoints || [];

  // Filtered Core Servers
  const filteredServers = useMemo(() => {
    return rawServers.filter((s) => {
      if (buildingFilter !== 'ALL') {
        const b = s.building && s.building.trim() !== '' ? s.building.trim() : '-';
        if (b !== buildingFilter) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.ip_address && s.ip_address.toLowerCase().includes(q)) ||
        (s.type && s.type.toLowerCase().includes(q))
      );
    });
  }, [rawServers, buildingFilter, search]);

  // Filtered Endpoint Central Workloads
  const filteredEndpoints = useMemo(() => {
    return rawEndpoints.filter((ep) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        ep.hostname.toLowerCase().includes(q) ||
        (ep.ip_address && ep.ip_address.toLowerCase().includes(q)) ||
        (ep.os_name && ep.os_name.toLowerCase().includes(q)) ||
        (ep.domain_name && ep.domain_name.toLowerCase().includes(q)) ||
        (ep.remote_office && ep.remote_office.toLowerCase().includes(q))
      );
    });
  }, [rawEndpoints, search]);

  // Distinct building options
  const buildingOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    rawServers.forEach((s) => {
      const b = s.building && s.building.trim() !== '' ? s.building.trim() : '-';
      counts[b] = (counts[b] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rawServers]);

  const totalServers = rawServers.length + rawEndpoints.length;
  const serversOnline =
    rawServers.filter((s) => s.status === 'UP').length +
    rawEndpoints.filter((e) => e.status === 'ONLINE').length;
  const clusterAvail = totalServers > 0 ? ((serversOnline / totalServers) * 100).toFixed(1) : '100.0';

  const avgCpu =
    rawServers.length > 0
      ? Math.round(rawServers.reduce((acc, s) => acc + (s.cpu_pct || 0), 0) / rawServers.length)
      : null;
  const avgMem =
    rawServers.length > 0
      ? Math.round(rawServers.reduce((acc, s) => acc + (s.mem_pct || 0), 0) / rawServers.length)
      : null;

  const handleExportCSV = () => {
    const headers = ['Server Type', 'Status', 'Name / Hostname', 'IP Address', 'Building', 'Floor', 'OS / Role', 'CPU %', 'Memory %', 'Disk %', 'Availability %'];
    const rows = [
      ...filteredServers.map((s) => [
        'Core SNMP Appliance',
        s.status,
        `"${s.name.replace(/"/g, '""')}"`,
        s.ip_address || '',
        `"${(s.building || '-').replace(/"/g, '""')}"`,
        `"${(s.floor || '-').replace(/"/g, '""')}"`,
        `"${(s.type || '').replace(/"/g, '""')}"`,
        Math.round(s.cpu_pct || 0),
        Math.round(s.mem_pct || 0),
        Math.round(s.disk_pct || 0),
        `${s.availability_pct || 100}%`,
      ]),
      ...filteredEndpoints.map((ep) => [
        'Endpoint Central Workload',
        ep.status,
        `"${ep.hostname.replace(/"/g, '""')}"`,
        ep.ip_address || '',
        '-',
        '-',
        `"${(ep.os_name || '').replace(/"/g, '""')}"`,
        '-',
        '-',
        '-',
        '100%',
      ]),
    ];
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `krea_noc_servers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header & Quick Telemetry Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
            <span className="text-emerald-400 font-bold text-sm">{clusterAvail}% Online</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Avg CPU Load</span>
            <span className="text-purple-400 font-bold text-sm">{avgCpu !== null ? `${avgCpu}%` : 'Live Agent'}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">Avg Memory Load</span>
            <span className="text-blue-400 font-bold text-sm">{avgMem !== null ? `${avgMem}%` : 'Live Agent'}</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Building, View Mode, Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search hostname, IP, OS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-7 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none w-48 sm:w-60"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Building Filter */}
          {buildingOptions.length > 0 && (
            <select
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Buildings</option>
              {buildingOptions.map(([bldg, cnt]) => (
                <option key={bldg} value={bldg}>
                  {bldg === '-' ? 'Unassigned (-)' : bldg} ({cnt})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'card' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Section 1: Core Compute Hosts */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" /> Core Production Appliances & Virtual Hosts ({filteredServers.length})
        </h2>

        {filteredServers.length > 0 ? (
          viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredServers.map((srv) => {
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{srv.type}</span>
                          <span className="text-slate-600">•</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-750 font-mono text-[10px] text-slate-300">
                            {srv.building || '-'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-750 font-mono text-[10px] text-slate-300">
                            {srv.floor || '-'}
                          </span>
                        </div>
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
          ) : (
            <div className="noc-card overflow-hidden">
              <div className="table-scroll-container">
                <table className="w-full text-left text-xs text-slate-300 min-w-[750px]">
                  <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Server Hostname</th>
                      <th className="py-3 px-4">IP Address</th>
                      <th className="py-3 px-4">Building</th>
                      <th className="py-3 px-4">Floor</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-center">CPU</th>
                      <th className="py-3 px-4 text-center">Memory</th>
                      <th className="py-3 px-4 text-center">Disk</th>
                      <th className="py-3 px-4 text-center">Availability</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredServers.map((srv) => (
                      <tr
                        key={srv.id}
                        onClick={() => setSelectedDevice(srv)}
                        className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              srv.status === 'UP'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}
                          >
                            {srv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-100">{srv.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{srv.ip_address}</td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px]">
                            {srv.building || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px]">
                            {srv.floor || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{srv.type}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-purple-400">
                          {Math.round(srv.cpu_pct)}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-blue-400">
                          {Math.round(srv.mem_pct)}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          {Math.round(srv.disk_pct)}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          {srv.availability_pct}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDevice(srv);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
                          >
                            Drilldown
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="noc-card p-6 rounded-xl border-slate-800 bg-[#0a101d] text-center space-y-2">
            <Server className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-200">No Servers Match Filter Criteria</h3>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Try adjusting your search query or building filter above.
            </p>
          </div>
        )}
      </div>

      {/* Section 2: Management & Windows/Linux Server Nodes from Endpoint Central */}
      {filteredEndpoints.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Laptop className="w-4 h-4 text-blue-400" /> Endpoint Central Server Workloads ({filteredEndpoints.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEndpoints.map((ep) => (
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
