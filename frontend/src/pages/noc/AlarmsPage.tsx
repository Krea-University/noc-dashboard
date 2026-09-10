import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, AlertTriangle, Filter, Search } from 'lucide-react';
import { api } from '../../api/client';
import { Alarm } from '../../types';

export const AlarmsPage: React.FC = () => {
  const [severity, setSeverity] = useState('');
  const [cleared, setCleared] = useState(false);

  const { data: alarms, isLoading, refetch } = useQuery({
    queryKey: ['alarms', severity, cleared],
    queryFn: () => api.getAlarms(severity || undefined, cleared),
    refetchInterval: 15000,
  });

  const handleAcknowledge = async (id: string) => {
    try {
      await api.acknowledgeAlarm(id);
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-red-400" /> Infrastructure Alarms Console
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-Time OpManager & Infrastructure Events Filtered by Severity
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-red-500 focus:outline-none cursor-pointer"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="MAJOR">Major</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={cleared}
              onChange={(e) => setCleared(e.target.checked)}
              className="accent-red-500"
            />
            Show Cleared Alarms
          </label>
        </div>
      </div>

      <div className="noc-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Device Name</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Message</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">First Detected</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 italic">
                    Loading alarms...
                  </td>
                </tr>
              ) : alarms && alarms.length > 0 ? (
                alarms.map((alm) => {
                  const isCrit = alm.severity === 'CRITICAL';
                  return (
                    <tr key={alm.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded font-bold text-[10px] uppercase border ${
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
                      <td className="py-3 px-4 font-bold text-slate-100">{alm.device_name}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{alm.device_ip}</td>
                      <td className="py-3 px-4 text-slate-200">{alm.message}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">{alm.entity}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(alm.first_seen_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(alm.last_seen_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!alm.acknowledged ? (
                          <button
                            onClick={() => handleAcknowledge(alm.id)}
                            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase transition-colors"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center justify-end gap-1 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 italic">
                    No active unacknowledged alarms.
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
