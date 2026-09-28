import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  CheckSquare,
  Square,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  X,
  Layers,
  Check,
} from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Alarm, Device } from '../../types';

export const AlarmsPage: React.FC = () => {
  const [severity, setSeverity] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [cleared, setCleared] = useState(false);
  const [selectedAlarmIds, setSelectedAlarmIds] = useState<Set<string>>(new Set());
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: rawAlarms, isLoading, refetch } = useQuery({
    queryKey: ['alarms', severity, cleared, search, category],
    queryFn: () => api.getAlarms(severity || undefined, cleared, search || undefined, category || undefined),
    refetchInterval: 15000,
  });

  // Client-side search and category filtering backup
  const filteredAlarms = useMemo(() => {
    let list = rawAlarms || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.device_name?.toLowerCase().includes(q) ||
          a.device_ip?.toLowerCase().includes(q) ||
          a.message?.toLowerCase().includes(q) ||
          a.entity?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawAlarms, search]);

  // Pagination calculation
  const totalItems = filteredAlarms.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);

  const paginatedAlarms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAlarms.slice(start, start + pageSize);
  }, [filteredAlarms, currentPage, pageSize]);

  // Selection helpers
  const allVisibleSelected =
    paginatedAlarms.length > 0 &&
    paginatedAlarms.every((a) => selectedAlarmIds.has(a.id) || a.acknowledged);

  const toggleSelectAllVisible = () => {
    const next = new Set(selectedAlarmIds);
    if (allVisibleSelected) {
      paginatedAlarms.forEach((a) => next.delete(a.id));
    } else {
      paginatedAlarms.forEach((a) => {
        if (!a.acknowledged) next.add(a.id);
      });
    }
    setSelectedAlarmIds(next);
  };

  const toggleSelectAlarm = (id: string) => {
    const next = new Set(selectedAlarmIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedAlarmIds(next);
  };

  const handleAcknowledgeSingle = async (id: string) => {
    try {
      await api.acknowledgeAlarm(id);
      refetch();
    } catch (e) {
      console.error('Failed to acknowledge alarm:', e);
    }
  };

  const handleAcknowledgeSelected = async () => {
    if (selectedAlarmIds.size === 0) return;
    setIsProcessing(true);
    try {
      await api.bulkAcknowledgeAlarms({ alarm_ids: Array.from(selectedAlarmIds) });
      setSelectedAlarmIds(new Set());
      refetch();
    } catch (e) {
      console.error('Failed bulk acknowledge:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcknowledgeAllCritical = async () => {
    if (!window.confirm('Are you sure you want to acknowledge ALL active critical alarms?')) return;
    setIsProcessing(true);
    try {
      await api.bulkAcknowledgeAlarms({ all_critical: true });
      setSelectedAlarmIds(new Set());
      refetch();
    } catch (e) {
      console.error('Failed to acknowledge all critical alarms:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDevice = async (deviceId?: string) => {
    if (!deviceId) return;
    try {
      const dev = await api.getDevice(deviceId);
      setSelectedDevice(dev);
    } catch (e) {
      console.error('Failed to load device for drawer:', e);
    }
  };

  const handleExportCSV = () => {
    if (!filteredAlarms || filteredAlarms.length === 0) return;
    const headers = [
      'Alarm ID',
      'Severity',
      'Device Name',
      'Device IP',
      'Entity',
      'Message',
      'First Seen',
      'Last Seen',
      'Acknowledged',
      'Cleared',
    ];
    const rows = filteredAlarms.map((a) => [
      a.id,
      a.severity,
      `"${(a.device_name || '').replace(/"/g, '""')}"`,
      a.device_ip || '',
      `"${(a.entity || '').replace(/"/g, '""')}"`,
      `"${(a.message || '').replace(/"/g, '""')}"`,
      new Date(a.first_seen_at).toISOString(),
      new Date(a.last_seen_at).toISOString(),
      a.acknowledged ? 'YES' : 'NO',
      a.cleared ? 'YES' : 'NO',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `krea_noc_alarms_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const criticalCount = useMemo(() => {
    return (filteredAlarms || []).filter((a) => a.severity === 'CRITICAL' && !a.acknowledged && !a.cleared).length;
  }, [filteredAlarms]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" /> Infrastructure Alarms Console
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            Real-Time OpManager & Infrastructure Events Filtered by Severity, Category & Search
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search hostname, IP, entity..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-red-500 focus:outline-none w-full sm:w-56"
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

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-red-500 focus:outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="SWITCH">Switches</option>
            <option value="ROUTER">Routers</option>
            <option value="WIRELESS_AP">Wireless APs</option>
            <option value="ILL">Internet Links</option>
            <option value="SERVER">Servers</option>
            <option value="BIOMETRIC">Biometrics</option>
            <option value="FIREWALL">Firewalls</option>
          </select>

          {/* Severity Filter */}
          <select
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-red-500 focus:outline-none cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="MAJOR">Major</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Show Cleared Toggle */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={cleared}
              onChange={(e) => {
                setCleared(e.target.checked);
                setPage(1);
              }}
              className="accent-red-500"
            />
            <span className="text-[11px]">Cleared</span>
          </label>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Action Bar (Bulk Actions + Counts) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800/80 p-3 rounded-xl text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono">
            Total Alarms: <strong className="text-slate-200">{totalItems}</strong>
          </span>
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold font-mono text-[11px] animate-pulse">
              {criticalCount} Critical Active
            </span>
          )}
          {selectedAlarmIds.size > 0 && (
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold font-mono text-[11px]">
              {selectedAlarmIds.size} Selected
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedAlarmIds.size > 0 && (
            <button
              onClick={handleAcknowledgeSelected}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Acknowledge Selected ({selectedAlarmIds.size})
            </button>
          )}

          {criticalCount > 0 && (
            <button
              onClick={handleAcknowledgeAllCritical}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-600/30 hover:bg-red-600/50 border border-red-500/40 disabled:opacity-50 text-red-200 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              Acknowledge All Critical ({criticalCount})
            </button>
          )}
        </div>
      </div>

      {/* Main Alarms Table */}
      <div className="noc-card overflow-hidden">
        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left text-xs text-slate-300 min-w-[900px]">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="accent-red-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Device Name</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Alarm Message</th>
                <th className="py-3 px-4">First Seen</th>
                <th className="py-3 px-4">Last Seen</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 italic">
                    Loading alarms console...
                  </td>
                </tr>
              ) : paginatedAlarms && paginatedAlarms.length > 0 ? (
                paginatedAlarms.map((alm) => {
                  const isCrit = alm.severity === 'CRITICAL';
                  const isSelected = selectedAlarmIds.has(alm.id);
                  return (
                    <tr
                      key={alm.id}
                      className={`hover:bg-slate-900/60 transition-colors ${
                        isSelected ? 'bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={alm.acknowledged}
                          onChange={() => toggleSelectAlarm(alm.id)}
                          className="accent-blue-500 cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase border ${
                            isCrit
                              ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                              : alm.severity === 'MAJOR'
                              ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                              : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                          }`}
                        >
                          {alm.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-100">
                        <button
                          onClick={() => handleOpenDevice(alm.device_id)}
                          className="text-left text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                        >
                          <span>{alm.device_name}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500 opacity-60" />
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{alm.device_ip || '-'}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{alm.entity || '-'}</td>
                      <td className="py-3 px-4 text-slate-200 max-w-md truncate" title={alm.message}>
                        {alm.message}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(alm.first_seen_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(alm.last_seen_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!alm.acknowledged ? (
                          <button
                            onClick={() => handleAcknowledgeSingle(alm.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold uppercase transition-colors"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center justify-end gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ack
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 italic">
                    No alarms match the selected filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-300 focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="ml-2">
                Showing {Math.min((currentPage - 1) * pageSize + 1, totalItems)} -{' '}
                {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-bold text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-slate-300"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drilldown Device Drawer */}
      <DeviceDrawer
        device={selectedDevice}
        isOpen={Boolean(selectedDevice)}
        onClose={() => setSelectedDevice(null)}
        onRefresh={() => refetch()}
      />
    </div>
  );
};
