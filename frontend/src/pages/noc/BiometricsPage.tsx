import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Fingerprint,
  Search,
  Filter,
  Shield,
  Activity,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  X,
  Building2,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Device } from '../../types';

export const BiometricsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'grid' | 'table'>('grouped');
  const [collapsedBuildings, setCollapsedBuildings] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const { data: biometrics, isLoading, refetch } = useQuery({
    queryKey: ['biometrics'],
    queryFn: api.getBiometrics,
    refetchInterval: 15000,
  });

  // Extract helper for device building and floor
  const getDeviceBuilding = (d: Device): string => {
    const b = d.building || d.biometric_meta?.building;
    return b && b.trim() !== '' ? b.trim() : '-';
  };

  const getDeviceFloor = (d: Device): string => {
    const f = d.floor || d.biometric_meta?.floor;
    return f && f.trim() !== '' ? f.trim() : '-';
  };

  const getDeviceLocation = (d: Device): string => {
    const loc = d.biometric_meta?.location;
    return loc && loc.trim() !== '' ? loc.trim() : '-';
  };

  // Distinct lists for dropdown filters
  const buildingOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    (biometrics || []).forEach((b) => {
      const bldg = getDeviceBuilding(b);
      counts[bldg] = (counts[bldg] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => {
      if (a[0] === '-') return 1;
      if (b[0] === '-') return -1;
      return b[1] - a[1];
    });
  }, [biometrics]);

  const floorOptions = useMemo(() => {
    const set = new Set<string>();
    (biometrics || []).forEach((b) => {
      set.add(getDeviceFloor(b));
    });
    const order = ['GF', '1F', '2F', '3F', '4F', '-'];
    return Array.from(set).sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [biometrics]);

  // Filtered devices
  const filtered = useMemo(() => {
    return (biometrics || []).filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      const bldg = getDeviceBuilding(b);
      if (buildingFilter !== 'ALL' && bldg !== buildingFilter) return false;
      const flr = getDeviceFloor(b);
      if (floorFilter !== 'ALL' && flr !== floorFilter) return false;

      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        b.name.toLowerCase().includes(s) ||
        b.ip_address.includes(s) ||
        bldg.toLowerCase().includes(s) ||
        flr.toLowerCase().includes(s) ||
        (b.biometric_meta?.location && b.biometric_meta.location.toLowerCase().includes(s)) ||
        (b.biometric_meta?.department && b.biometric_meta.department.toLowerCase().includes(s))
      );
    });
  }, [biometrics, statusFilter, buildingFilter, floorFilter, search]);

  // Grouped hierarchy: Building -> Floor -> Devices
  const groupedData = useMemo(() => {
    const map = new Map<string, Map<string, Device[]>>();

    filtered.forEach((b) => {
      const bldg = getDeviceBuilding(b);
      const flr = getDeviceFloor(b);

      if (!map.has(bldg)) {
        map.set(bldg, new Map<string, Device[]>());
      }
      const floorMap = map.get(bldg)!;
      if (!floorMap.has(flr)) {
        floorMap.set(flr, []);
      }
      floorMap.get(flr)!.push(b);
    });

    const floorOrder = ['GF', '1F', '2F', '3F', '4F', '-'];

    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[0] === '-') return 1;
        if (b[0] === '-') return -1;
        return a[0].localeCompare(b[0]);
      })
      .map(([bldgName, floorMap]) => {
        const floors = Array.from(floorMap.entries())
          .sort((a, b) => {
            const ia = floorOrder.indexOf(a[0]);
            const ib = floorOrder.indexOf(b[0]);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a[0].localeCompare(b[0]);
          })
          .map(([flrName, devs]) => ({
            floor: flrName,
            devices: devs.sort((x, y) => x.name.localeCompare(y.name)),
          }));

        const totalDevices = floors.reduce((sum, f) => sum + f.devices.length, 0);
        const upDevices = floors.reduce(
          (sum, f) => sum + f.devices.filter((d) => d.status === 'UP').length,
          0
        );

        return {
          building: bldgName,
          total: totalDevices,
          up: upDevices,
          down: totalDevices - upDevices,
          floors,
        };
      });
  }, [filtered]);

  const total = biometrics?.length || 0;
  const upCount = biometrics?.filter((b) => b.status === 'UP').length || 0;
  const downCount = biometrics?.filter((b) => b.status === 'DOWN').length || 0;

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleBuildingCollapse = (bldg: string) => {
    setCollapsedBuildings((prev) => ({
      ...prev,
      [bldg]: !prev[bldg],
    }));
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" /> Campus Biometric Attendance Readers
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            OpManager Monitored Devices organized by campus Building & Floor
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs">
            <span className="text-slate-400">Total: <strong className="text-slate-100">{total}</strong></span>
            <span className="text-emerald-400 font-bold">{upCount} UP</span>
            <span className="text-red-400 font-bold">{downCount} DOWN</span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('grouped')}
              title="Grouped by Building & Floor"
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1.5 transition-colors ${
                viewMode === 'grouped' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Grouped
            </button>
            <button
              onClick={() => setViewMode('grid')}
              title="Card Grid View"
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1.5 transition-colors ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Data Table View"
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] flex items-center gap-1.5 transition-colors ${
                viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table
            </button>
          </div>
        </div>
      </div>

      {/* Control Strip: Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Buttons */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(['ALL', 'UP', 'DOWN'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  statusFilter === st
                    ? st === 'DOWN'
                      ? 'bg-red-600 text-white'
                      : 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st}
              </button>
            ))}
          </div>

          {/* Building Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Building:</span>
            <select
              value={buildingFilter}
              onChange={(e) => {
                setBuildingFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-purple-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Buildings ({total})</option>
              {buildingOptions.map(([bldg, count]) => (
                <option key={bldg} value={bldg}>
                  {bldg === '-' ? 'Unassigned (-)' : bldg} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Floor Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Floor:</span>
            <select
              value={floorFilter}
              onChange={(e) => {
                setFloorFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-purple-500 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Floors</option>
              {floorOptions.map((flr) => (
                <option key={flr} value={flr}>
                  {flr === '-' ? 'No Floor (-)' : flr}
                </option>
              ))}
            </select>
          </div>

          {(buildingFilter !== 'ALL' || floorFilter !== 'ALL' || statusFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setBuildingFilter('ALL');
                setFloorFilter('ALL');
                setStatusFilter('ALL');
                setSearch('');
                setPage(1);
              }}
              className="px-2 py-1 text-[11px] text-purple-400 hover:text-purple-300 underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search device, IP, floor, building..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-purple-500 focus:outline-none w-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: GROUPED BY BUILDING & FLOOR ("Show all device under it") */}
      {viewMode === 'grouped' && (
        <div className="space-y-6">
          {groupedData.length === 0 ? (
            <div className="p-8 text-center noc-card rounded-xl border-slate-800 text-slate-400 text-sm">
              No biometric devices found matching your criteria.
            </div>
          ) : (
            groupedData.map((bldgGroup) => {
              const isCollapsed = collapsedBuildings[bldgGroup.building];
              return (
                <div
                  key={bldgGroup.building}
                  className="noc-card rounded-xl border-slate-800 overflow-hidden transition-all"
                >
                  {/* Building Header Banner */}
                  <div
                    onClick={() => toggleBuildingCollapse(bldgGroup.building)}
                    className="p-3.5 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-850 select-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-100">
                            {bldgGroup.building === '-' ? 'Unassigned Building (-)' : bldgGroup.building}
                          </h2>
                          <span className="text-[11px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 font-semibold">
                            {bldgGroup.total} {bldgGroup.total === 1 ? 'Reader' : 'Readers'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {bldgGroup.floors.length} {bldgGroup.floors.length === 1 ? 'floor level' : 'floor levels'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-emerald-400 font-bold">{bldgGroup.up} UP</span>
                        {bldgGroup.down > 0 && (
                          <span className="text-red-400 font-bold">{bldgGroup.down} DOWN</span>
                        )}
                      </div>
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Floors & Devices Container */}
                  {!isCollapsed && (
                    <div className="p-4 sm:p-5 space-y-5 bg-[#0a101d]">
                      {bldgGroup.floors.map((flrGroup) => (
                        <div key={flrGroup.floor} className="space-y-2.5">
                          {/* Floor Subheader */}
                          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800/80">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 font-mono font-bold text-xs uppercase">
                              {flrGroup.floor === '-' ? 'No Floor (-)' : `Floor: ${flrGroup.floor}`}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              ({flrGroup.devices.length} {flrGroup.devices.length === 1 ? 'reader' : 'readers'})
                            </span>
                          </div>

                          {/* Devices Under this Floor */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {flrGroup.devices.map((bio) => {
                              const isUp = bio.status === 'UP';
                              return (
                                <div
                                  key={bio.id}
                                  onClick={() => setSelectedDevice(bio)}
                                  className={`noc-card noc-card-hover p-3.5 cursor-pointer space-y-2.5 relative overflow-hidden transition-all ${
                                    !isUp
                                      ? 'border-red-500/50 bg-red-950/15 shadow-lg shadow-red-950/20'
                                      : 'border-slate-800 hover:border-purple-500/40'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="min-w-0 pr-2">
                                      <span
                                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${
                                          isUp
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                                        }`}
                                      >
                                        {bio.status}
                                      </span>
                                      <h3 className="text-xs font-bold text-slate-100 mt-1 truncate" title={bio.name}>
                                        {bio.name}
                                      </h3>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{bio.ip_address}</div>
                                    </div>

                                    <span className="text-xs font-mono font-bold text-slate-300">
                                      {bio.availability_pct}%
                                    </span>
                                  </div>

                                  <div className="p-2 rounded bg-slate-950/80 border border-slate-850 text-[11px] space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500">Placement:</span>
                                      <span className="text-slate-200 font-medium truncate max-w-[140px]" title={getDeviceLocation(bio)}>
                                        {getDeviceLocation(bio)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between font-mono text-[10px]">
                                      <span className="text-slate-500">Latency:</span>
                                      <span className={isUp ? 'text-slate-300' : 'text-red-400 font-bold'}>
                                        {isUp ? `${bio.response_time_ms} ms` : 'Unreachable'}
                                      </span>
                                    </div>
                                  </div>

                                  {!isUp && (
                                    <div className="p-1.5 rounded bg-red-950/50 border border-red-500/30 text-red-300 text-[10px] flex items-center gap-1.5 font-semibold">
                                      <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                                      <span className="truncate">Unreachable (ICMP Timeout)</span>
                                    </div>
                                  )}

                                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                                    <span>{bio.vendor || 'ZKTeco'}</span>
                                    <span className="text-purple-400 hover:text-purple-300 font-bold">
                                      Details →
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: CARD GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {paginated.map((bio) => {
              const isUp = bio.status === 'UP';
              const bldg = getDeviceBuilding(bio);
              const flr = getDeviceFloor(bio);
              const loc = getDeviceLocation(bio);
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

                  {/* Building & Floor & Placement */}
                  <div className="p-2.5 rounded bg-slate-950/80 border border-slate-850 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Building:</span>
                      <span className="text-purple-300 font-medium truncate max-w-[140px]" title={bldg}>
                        {bldg}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Floor:</span>
                      <span className="text-purple-300 font-mono font-medium truncate max-w-[140px]" title={flr}>
                        {flr}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Placement:</span>
                      <span className="text-slate-200 font-medium truncate max-w-[140px]" title={loc}>
                        {loc}
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
                    <span>{bio.vendor || 'ZKTeco'}</span>
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
        </div>
      )}

      {/* VIEW 3: TABULAR DATA VIEW */}
      {viewMode === 'table' && (
        <div className="noc-card rounded-xl border-slate-800 overflow-hidden">
          <div className="overflow-x-auto table-scroll-container">
            <table className="w-full text-left text-xs text-slate-300 min-w-[800px]">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Device Name</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Building</th>
                  <th className="py-3 px-4">Floor</th>
                  <th className="py-3 px-4">Placement / Location</th>
                  <th className="py-3 px-4 text-center">Latency</th>
                  <th className="py-3 px-4 text-center">Availability</th>
                  <th className="py-3 px-4">Vendor & Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {paginated.map((bio) => {
                  const isUp = bio.status === 'UP';
                  return (
                    <tr
                      key={bio.id}
                      onClick={() => setSelectedDevice(bio)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            isUp
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-red-500/20 border-red-500/40 text-red-400'
                          }`}
                        >
                          {bio.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-sans font-bold text-slate-100">{bio.name}</td>
                      <td className="py-2.5 px-4 text-slate-400">{bio.ip_address}</td>
                      <td className="py-2.5 px-4 font-sans text-purple-300 font-semibold">{getDeviceBuilding(bio)}</td>
                      <td className="py-2.5 px-4 text-purple-300 font-bold">{getDeviceFloor(bio)}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-300">{getDeviceLocation(bio)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={isUp ? 'text-slate-300' : 'text-red-400 font-bold'}>
                          {isUp ? `${bio.response_time_ms} ms` : 'Down'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-bold text-slate-200">{bio.availability_pct}%</td>
                      <td className="py-2.5 px-4 font-sans text-slate-400 text-[11px]">{bio.vendor || 'ZKTeco'} {bio.model}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} biometric readers
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold"
                >
                  Prev
                </button>
                <span className="px-2 font-bold text-slate-200">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
