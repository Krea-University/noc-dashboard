import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, Search, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { AuditLog } from '../../types';

export const AuditPage: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter],
    queryFn: () => api.getAuditLogs(actionFilter || undefined),
    refetchInterval: 15000,
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
            <History className="w-6 h-6 text-purple-400" /> Immutable Operational Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete Security Audit Log: Logins, FortiGate VLAN Actions, Incident Changes & User Modifications
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-purple-500 focus:outline-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="VLAN_INTERNET_DISABLE">VLAN_INTERNET_DISABLE</option>
            <option value="VLAN_INTERNET_ENABLE">VLAN_INTERNET_ENABLE</option>
            <option value="ALARM_ACKNOWLEDGED">ALARM_ACKNOWLEDGED</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="SETTINGS_CHANGED">SETTINGS_CHANGED</option>
          </select>
        </div>
      </div>

      <div className="noc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
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
