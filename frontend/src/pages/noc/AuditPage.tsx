import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, Search, ShieldCheck, Download, ArrowLeft, ArrowRight, X, Calendar } from 'lucide-react';
import { api } from '../../api/client';
import { AuditLog } from '../../types';

export const AuditPage: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: rawLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, usernameFilter],
    queryFn: () => api.getAuditLogs(actionFilter || undefined, usernameFilter || undefined),
    refetchInterval: 15000,
  });

  const filteredLogs = useMemo(() => {
    let list = rawLogs || [];

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateRange === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else if (dateRange === '7d') {
        cutoff.setDate(now.getDate() - 7);
      } else if (dateRange === '30d') {
        cutoff.setDate(now.getDate() - 30);
      }
      list = list.filter((l) => new Date(l.timestamp) >= cutoff);
    }

    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((l) => {
        return (
          (l.reason && l.reason.toLowerCase().includes(q)) ||
          (l.ip_address && l.ip_address.toLowerCase().includes(q)) ||
          (l.target_id && l.target_id.toLowerCase().includes(q)) ||
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.action && l.action.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [rawLogs, dateRange, searchQuery]);

  // Pagination calculation
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) return;
    const headers = [
      'Timestamp',
      'Operator',
      'Action',
      'Target Type',
      'Target ID',
      'Reason',
      'Result',
      'IP Address',
    ];
    const rows = filteredLogs.map((l) => [
      new Date(l.timestamp).toISOString(),
      `"${(l.username || '').replace(/"/g, '""')}"`,
      l.action,
      l.target_type || '',
      `"${(l.target_id || '').replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      l.result,
      l.ip_address || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `krea_noc_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header and Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <History className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 shrink-0" /> Immutable Operational Audit Trail
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            Complete Security Audit Log: Logins, FortiGate VLAN Actions, Incident Changes & User Modifications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search audit trail..."
              className="pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none w-full sm:w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* User/Operator Filter */}
          <input
            type="text"
            value={usernameFilter}
            onChange={(e) => {
              setUsernameFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Operator username..."
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none w-32 sm:w-36 font-mono"
          />

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-purple-500 focus:outline-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="USER_LOGIN_FAILED">USER_LOGIN_FAILED</option>
            <option value="GOOGLE_LOGIN">GOOGLE_LOGIN</option>
            <option value="GOOGLE_LOGIN_FAILED">GOOGLE_LOGIN_FAILED</option>
            <option value="USER_LOGOUT">USER_LOGOUT</option>
            <option value="VLAN_INTERNET_DISABLE">VLAN_INTERNET_DISABLE</option>
            <option value="VLAN_INTERNET_ENABLE">VLAN_INTERNET_ENABLE</option>
            <option value="ALARM_ACKNOWLEDGED">ALARM_ACKNOWLEDGED</option>
            <option value="ALARMS_BULK_ACKNOWLEDGED">ALARMS_BULK_ACKNOWLEDGED</option>
            <option value="INCIDENT_CREATED">INCIDENT_CREATED</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="SETTINGS_CHANGED">SETTINGS_CHANGED</option>
          </select>

          {/* Date Range Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-xs font-mono">
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7d' },
              { id: '30d', label: '30d' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setDateRange(p.id as any);
                  setPage(1);
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  dateRange === p.id ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="noc-card overflow-hidden">
        <div className="table-scroll-container">
          <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">Reason / Justification</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                    Loading audit trail...
                  </td>
                </tr>
              ) : paginatedLogs && paginatedLogs.length > 0 ? (
                paginatedLogs.map((l) => {
                  const isSuccess = l.result === 'SUCCESS';
                  return (
                    <tr key={l.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(l.timestamp).toLocaleDateString()}{' '}
                        {new Date(l.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-400 font-mono">{l.username}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">{l.action}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {l.target_type && `${l.target_type}: `}
                        {l.target_id || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-sm truncate" title={l.reason || ''}>
                        {l.reason || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{l.ip_address || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/10 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {l.result}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                    No audit records match the selected filter.
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
    </div>
  );
};
