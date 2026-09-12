import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, Search, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { AuditLog } from '../../types';

export const AuditPage: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: rawLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, usernameFilter],
    queryFn: () => api.getAuditLogs(actionFilter || undefined, usernameFilter || undefined),
    refetchInterval: 15000,
  });

  const logs = rawLogs?.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.reason && l.reason.toLowerCase().includes(q)) ||
      (l.ip_address && l.ip_address.toLowerCase().includes(q)) ||
      (l.target_id && l.target_id.toLowerCase().includes(q)) ||
      (l.username && l.username.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <History className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 shrink-0" /> Immutable Operational Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete Security Audit Log: Logins, FortiGate VLAN Actions, Incident Changes & User Modifications
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none w-36 sm:w-48"
            />
          </div>

          {/* User/Operator Filter */}
          <input
            type="text"
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            placeholder="Filter by user..."
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 placeholder:text-slate-600 focus:border-purple-500 focus:outline-none w-32 sm:w-40 font-mono"
          />

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-purple-500 focus:outline-none cursor-pointer"
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
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="SETTINGS_CHANGED">SETTINGS_CHANGED</option>
          </select>
        </div>
      </div>

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
              ) : logs && logs.length > 0 ? (
                logs.map((l) => {
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
      </div>
    </div>
  );
};
