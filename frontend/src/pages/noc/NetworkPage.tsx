import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Network, Search, Filter, ExternalLink, Activity, Wifi, Shield, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Device } from '../../types';

export const NetworkPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState<string>(searchParams.get('category') || '');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat !== null) {
      setCategory(cat);
      setPage(1);
    }
  }, [searchParams]);
  const pageSize = 30;
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices', category, status, search],
    queryFn: () => api.getDevices(category || undefined, search || undefined, status || undefined),
    refetchInterval: 15000,
  });

  const totalItems = devices?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);

  const paginatedDevices = useMemo(() => {
    if (!devices) return [];
    const start = (currentPage - 1) * pageSize;
    return devices.slice(start, start + pageSize);
  }, [devices, currentPage, pageSize]);

  const counts = useMemo(() => {
    if (!devices) return { up: 0, down: 0, warning: 0 };
    return {
      up: devices.filter((d) => d.status === 'UP').length,
      down: devices.filter((d) => d.status === 'DOWN').length,
      warning: devices.filter((d) => d.status === 'WARNING').length,
    };
  }, [devices]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Network className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" /> Network Infrastructure
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            OpManager Monitored Core, Distribution, Access Switches, Aruba/Ruckus APs & Leased Lines
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search hostname or IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-8 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-blue-500 focus:outline-none w-full sm:w-56"
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

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="UP">UP Only</option>
            <option value="DOWN">DOWN Only</option>
            <option value="WARNING">Warning</option>
          </select>
        </div>
      </div>

      {/* Category Quick Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { label: 'All Devices', val: '' },
          { label: 'Switches', val: 'SWITCH' },
          { label: 'Wireless APs', val: 'WIRELESS_AP' },
          { label: 'Leased Lines', val: 'ILL' },
          { label: 'Firewalls', val: 'FIREWALL' },
        ].map((tab) => (
          <button
            key={tab.val}
            onClick={() => {
              setCategory(tab.val);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              category === tab.val
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-mono pt-1 sm:pt-0">
          <span className="text-slate-400">Total: <strong className="text-slate-200">{totalItems}</strong></span>
          <span className="text-emerald-400 font-bold">{counts.up} UP</span>
          <span className="text-red-400 font-bold">{counts.down} DOWN</span>
          {counts.warning > 0 && <span className="text-amber-400 font-bold">{counts.warning} WARN</span>}
        </div>
      </div>

      {/* Network Devices Table */}
      <div className="noc-card overflow-hidden">
        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left text-xs text-slate-300 min-w-[720px]">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Device Name</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Vendor & Model</th>
                <th className="py-3 px-4 text-center">Availability</th>
                <th className="py-3 px-4 text-center">Latency</th>
                <th className="py-3 px-4 text-center">CPU</th>
                <th className="py-3 px-4 text-center">Memory</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 italic">
                    Loading network devices...
                  </td>
                </tr>
              ) : paginatedDevices.length > 0 ? (
                paginatedDevices.map((dev) => {
                  const isUp = dev.status === 'UP';
                  const isDown = dev.status === 'DOWN';
                  return (
                    <tr
                      key={dev.id}
                      onClick={() => setSelectedDevice(dev)}
                      className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isUp
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : isDown
                              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {dev.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">{dev.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{dev.ip_address}</td>
                      <td className="py-3 px-4 text-slate-300">{dev.type}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {dev.vendor} {dev.model}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-200">
                        {dev.availability_pct}%
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {dev.response_time_ms} ms
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {Math.round(dev.cpu_pct)}%
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {Math.round(dev.mem_pct)}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDevice(dev);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
                        >
                          Drilldown
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 italic">
                    No network devices matched the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, totalItems)} of {totalItems} devices
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <span className="px-2 text-slate-300 font-bold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold flex items-center gap-1 transition-colors"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <DeviceDrawer
        device={selectedDevice}
        isOpen={selectedDevice !== null}
        onClose={() => setSelectedDevice(null)}
      />
    </div>
  );
};
