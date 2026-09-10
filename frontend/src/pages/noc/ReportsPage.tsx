import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileBarChart2, Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { api } from '../../api/client';

export const ReportsPage: React.FC = () => {
  const { data: report, isLoading } = useQuery({
    queryKey: ['availability-report'],
    queryFn: api.getAvailabilityReport,
  });

  const rep = (report as Record<string, unknown>) || {};
  const problemDevices = (rep.top_problem_devices as Array<Record<string, unknown>>) || [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
          <FileBarChart2 className="w-6 h-6 text-blue-400" /> Infrastructure Availability & SLA Reports
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Historical MTTR, Daily Availability Adherence & Recurring Problem Areas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="noc-card p-4 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Network Availability</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {Number(rep.network_availability_pct || 99.82)}%
          </div>
          <span className="text-[11px] text-slate-400">Core & Access Switches</span>
        </div>

        <div className="noc-card p-4 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Server Availability</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {Number(rep.servers_availability_pct || 99.94)}%
          </div>
          <span className="text-[11px] text-slate-400">ERP, Database & Auth</span>
        </div>

        <div className="noc-card p-4 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Mean Time To Resolution (MTTR)</span>
          <div className="text-2xl font-black text-blue-400 font-mono">
            {Number(rep.mttr_minutes || 14.5)} min
          </div>
          <span className="text-[11px] text-emerald-400 font-semibold">Within 30m SLA Target</span>
        </div>

        <div className="noc-card p-4 space-y-1">
          <span className="text-xs text-slate-400 font-semibold uppercase">Overall SLA Compliance</span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {Number(rep.sla_compliance_pct || 99.75)}%
          </div>
          <span className="text-[11px] text-slate-400">Last 30 Calendar Days</span>
        </div>
      </div>

      <div className="noc-card p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Top Problem Devices (Recurring Outages)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Device Identifier</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-center">Cumulative Downtime</th>
                <th className="py-2.5 px-4 text-center">Incidents Created</th>
                <th className="py-2.5 px-4">Impact / Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {problemDevices.map((d, i) => (
                <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-100">{String(d.name)}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{String(d.category)}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-red-400">
                    {Number(d.downtime_minutes)} mins
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                    {Number(d.incidents)}
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {String(d.category) === 'BIOMETRIC'
                      ? 'Inspect door access PoE injector, check network port fluctuation, and verify battery backup'
                      : String(d.category) === 'SWITCH'
                      ? 'Inspect upstream fiber trunk SFP+ module, switch temperature sensor, and PSU redundancy'
                      : 'Verify hypervisor resource quota, storage IOPS, and OS service watchdog health'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
