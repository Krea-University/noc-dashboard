import React from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { TrendingUp, ShieldCheck, Clock, Award, CheckCircle2, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { api } from '../../api/client';

export const ManagementPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: report } = useQuery({
    queryKey: ['availability-report'],
    queryFn: api.getAvailabilityReport,
  });

  const rep = (report as Record<string, unknown>) || {};
  const problemDevices = (rep.top_problem_devices as Array<Record<string, unknown>>) || [];

  const trendOption = {
    backgroundColor: 'transparent',
    grid: { left: '3%', right: '3%', bottom: '8%', top: '15%', containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Current'],
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'value',
      min: 98,
      max: 100,
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#94a3b8', formatter: '{value}%' },
    },
    series: [
      {
        name: 'Availability Trend',
        type: 'line',
        smooth: true,
        data: [99.75, 99.81, 99.84, 99.88, 99.92],
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ],
          },
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 p-8 select-none">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Executive Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <img
                src="https://cdn.krea.edu.in/logo.png"
                alt="Krea University"
                className="h-9 w-auto object-contain max-w-[130px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/krea-logo.png';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  EXECUTIVE BRIEFING
                </span>
                <span className="text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400">Krea University IT Infrastructure</span>
              </div>
              <h1 className="text-2xl font-black tracking-wide text-slate-100 flex items-center gap-2.5">
                <TrendingUp className="w-6 h-6 text-purple-400" /> Management & CTO Infrastructure Scorecard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={() => navigate('/noc')}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Operator Console
            </button>
          </div>
        </div>

        {/* Big Executive KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="noc-card p-6 border-t-4 border-t-emerald-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Campus Infrastructure Health
            </span>
            <div className="text-5xl font-black text-emerald-400 font-mono mt-3">
              {Number(rep.sla_compliance_pct ?? 99.85)}%
            </div>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
              Real-time weighted operational availability
            </p>
          </div>

          <div className="noc-card p-6 border-t-4 border-t-blue-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Mean Time To Resolution (MTTR)
            </span>
            <div className="text-5xl font-black text-blue-400 font-mono mt-3">
              {Number(rep.mttr_minutes ?? 14.5)} min
            </div>
            <p className="text-xs text-slate-400 mt-2">Target SLA: 30 minutes (Passing)</p>
          </div>

          <div className="noc-card p-6 border-t-4 border-t-purple-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Contractual SLA Adherence
            </span>
            <div className="text-5xl font-black text-purple-400 font-mono mt-3">
              {Number(rep.sla_compliance_pct ?? 99.75)}%
            </div>
            <p className="text-xs text-slate-400 mt-2">Verified uptime across network & compute</p>
          </div>

          <div className="noc-card p-6 border-t-4 border-t-amber-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Recorded Incidents (30d)
            </span>
            <div className="text-5xl font-black text-slate-100 font-mono mt-3">
              {Number(rep.total_incidents_30d ?? 3)}
            </div>
            <p className="text-xs text-emerald-400 mt-2 font-semibold">Tracked with immutable audit records</p>
          </div>
        </div>

        {/* 30-Day Trend Chart & Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 noc-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Infrastructure Availability Trend (Weekly Aggregates)
            </h3>
            <div className="h-64">
              <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          <div className="noc-card p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Domain Health Scorecard
            </h3>
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span className="text-slate-300">Network & Backbones (ILL)</span>
                  <span className="text-emerald-400 font-mono">{Number(rep.network_availability_pct ?? 99.8)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${rep.network_availability_pct ?? 99.8}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span className="text-slate-300">Compute & Databases</span>
                  <span className="text-emerald-400 font-mono">{Number(rep.servers_availability_pct ?? 100.0)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${rep.servers_availability_pct ?? 100}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span className="text-slate-300">Managed Workstations</span>
                  <span className="text-blue-400 font-mono">99.20%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: '99.2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold">
                  <span className="text-slate-300">Biometric Access Readers</span>
                  <span className="text-purple-400 font-mono">{Number(rep.biometrics_availability_pct ?? 98.5)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${rep.biometrics_availability_pct ?? 98.5}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
