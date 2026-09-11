import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Fingerprint, Search, Filter, Shield, Activity, Clock, AlertTriangle, ExternalLink, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Device } from '../../types';

export const BiometricsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const { data: biometrics, isLoading, refetch } = useQuery({
    queryKey: ['biometrics'],
    queryFn: api.getBiometrics,
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    return (biometrics || []).filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(s) ||
        b.ip_address.includes(s) ||
        (b.biometric_meta?.location && b.biometric_meta.location.toLowerCase().includes(s)) ||
        (b.biometric_meta?.building && b.biometric_meta.building.toLowerCase().includes(s)) ||
        (b.biometric_meta?.department && b.biometric_meta.department.toLowerCase().includes(s))
      );
    });
  }, [biometrics, statusFilter, search]);

  const total = biometrics?.length || 0;
  const upCount = biometrics?.filter((b) => b.status === 'UP').length || 0;
  const downCount = biometrics?.filter((b) => b.status === 'DOWN').length || 0;

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" /> Campus Biometric Attendance Readers
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            OpManager Lite Monitored Devices across Hostels, Academic Blocks, Library, Diners & Security Gates
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs">
            <span className="text-slate-400">Total: <strong className="text-slate-100">{total}</strong></span>
            <span className="text-emerald-400 font-bold">{upCount} UP</span>
            <span className="text-red-400 font-bold">{downCount} DOWN</span>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            {(['ALL', 'UP', 'DOWN'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md font-bold text-[11px] transition-colors ${
                  statusFilter === st
                    ? st === 'DOWN'
                      ? 'bg-red-600 text-white'
                      : 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          <div className="relative flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search building, gate or IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-8 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:border-purple-500 focus:outline-none w-full sm:w-56"
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
        </div>
      </div>

      {/* Biometric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {paginated.map((bio) => {
          const isUp = bio.status === 'UP';
          return (
            <div
              key={bio.id}
              onClick={() => setSelectedDevice(bio)}
              className={`noc-card noc-card-hover p-4 cursor-pointer space-y-3 relative overflow-hidden transition-all ${
                !isUp
                  ? 'border-red-500/50 bg-red-950/15 shadow-lg shadow-red-950/20'
                  : 'border-slate-800 hover:border-purple-500/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isUp
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                    }`}
                  >
                    {bio.status}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 mt-1.5 truncate max-w-[180px]">
                    {bio.name}
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{bio.ip_address}</div>
                </div>

                <span className="text-xs font-mono font-bold text-slate-300">
                  {bio.availability_pct}%
                </span>
              </div>

              {/* Location & Placement */}
              <div className="p-2.5 rounded bg-slate-950/80 border border-slate-850 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Building:</span>
                  <span className="text-slate-200 font-medium truncate max-w-[140px]">
                    {bio.biometric_meta?.building || 'Main Campus'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Placement:</span>
                  <span className="text-slate-200 font-medium truncate max-w-[140px]">
                    {bio.biometric_meta?.location || 'Access Barrier'}
                  </span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-500">Latency:</span>
                  <span className={isUp ? 'text-slate-300' : 'text-red-400 font-bold'}>
                    {isUp ? `${bio.response_time_ms} ms` : 'Unreachable'}
                  </span>
                </div>
              </div>

              {/* Alarm Banner if Down */}
              {!isUp && (
                <div className="p-2 rounded bg-red-950/50 border border-red-500/30 text-red-300 text-[11px] flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span className="truncate">Device Unreachable (ICMP Timeout)</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>{bio.vendor} {bio.model}</span>
                <span className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1">
                  Manage Details →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} biometric readers
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

      <DeviceDrawer
        device={selectedDevice}
        isOpen={selectedDevice !== null}
        onClose={() => setSelectedDevice(null)}
        onRefresh={refetch}
      />
    </div>
  );
};
