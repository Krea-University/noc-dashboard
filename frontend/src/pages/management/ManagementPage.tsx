import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import {
  TrendingUp,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Building2,
  Server,
  Network,
  Laptop,
  Fingerprint,
  Activity,
  Tv,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { api } from '../../api/client';
import { Device, AvailabilityReport } from '../../types';

export const ManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const {
    data: report,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<AvailabilityReport>({
    queryKey: ['availability-report'],
    queryFn: api.getAvailabilityReport,
    refetchInterval: 15000,
  });

  const rep = report || {
    overall_availability_pct: 0,
    sla_compliance_pct: 0,
    sla_target_pct: 99.5,
    network_availability_pct: 0,
    network_devices_total: 0,
    network_devices_up: 0,
    network_devices_down: 0,
    servers_availability_pct: 0,
    servers_total: 0,
    servers_up: 0,
    servers_down: 0,
    endpoints_availability_pct: 0,
    endpoints_total: 0,
    endpoints_online: 0,
    endpoints_offline: 0,
    biometrics_availability_pct: 0,
    biometrics_total: 0,
    biometrics_up: 0,
    biometrics_down: 0,
    total_devices: 0,
    devices_up: 0,
    devices_down: 0,
    devices_warning: 0,
    mttr_minutes: 0,
    mttr_formatted: '0 min',
    mttr_target_minutes: 30,
    total_incidents_30d: 0,
    active_incidents_count: 0,
    resolved_incidents_count: 0,
    uptime_trends_30d: [],
    site_health_breakdown: [],
    top_problem_devices: [],
  };

  const problemDevices = rep.top_problem_devices || [];
  const trends = rep.uptime_trends_30d || [];
  const sites = rep.site_health_breakdown || [];

  const handleInspectDevice = async (deviceId: string) => {
    try {
      const dev = await api.getDevice(deviceId);
      setSelectedDevice(dev);
      setIsDrawerOpen(true);
    } catch (err) {
      console.error('Failed to load device details', err);
    }
  };

  // Compute dynamic Y-axis bounds based on real data
  const minTrendAvail = trends.length > 0
    ? Math.max(90, Math.floor(Math.min(...trends.map((t) => t.availability_pct)) - 0.5))
    : 98;

  const trendOption = {
    backgroundColor: 'transparent',
    grid: { left: '2%', right: '3%', bottom: '8%', top: '15%', containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        if (!params || params.length === 0) return '';
        const idx = params[0].dataIndex;
        const pt = trends[idx];
        if (!pt) return `${params[0].name}: ${params[0].value}%`;
        const slaStatus = pt.availability_pct >= rep.sla_target_pct ? 'Passing SLA' : 'Below Target';
        const slaColor = pt.availability_pct >= rep.sla_target_pct ? '#10b981' : '#f59e0b';
        return `
          <div style="font-family: monospace; padding: 4px;">
            <div style="font-weight: bold; color: #94a3b8; margin-bottom: 4px;">${pt.full_date || pt.date}</div>
            <div style="font-size: 14px; font-weight: 800; color: #38bdf8;">
              Uptime: ${pt.availability_pct.toFixed(2)}%
            </div>
            <div style="color: ${slaColor}; font-weight: 600; font-size: 11px; margin-top: 2px;">
              ${slaStatus} (Target ${rep.sla_target_pct}%)
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; border-top: 1px solid #334155; padding-top: 4px;">
              Alarms Logged: <b>${pt.alarms_count}</b> | Outages: <b>${pt.critical_count}</b>
            </div>
          </div>
        `;
      },
    },
    xAxis: {
      type: 'category',
      data: trends.map((t) => t.date),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        interval: 4,
      },
    },
    yAxis: {
      type: 'value',
      min: minTrendAvail,
      max: 100,
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#94a3b8', formatter: '{value}%' },
    },
    series: [
      {
        name: 'Daily Availability',
        type: 'line',
        smooth: true,
        data: trends.map((t) => t.availability_pct),
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 3, color: '#10b981' },
        markLine: {
          symbol: 'none',
          data: [
            {
              yAxis: rep.sla_target_pct || 99.5,
              name: `Target SLA (${rep.sla_target_pct || 99.5}%)`,
              lineStyle: { color: '#a855f7', type: 'dashed', width: 2 },
              label: {
                show: true,
                position: 'end',
                formatter: `SLA Target ${rep.sla_target_pct || 99.5}%`,
                color: '#c084fc',
                fontSize: 10,
                fontFamily: 'monospace',
              },
            },
          ],
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
            ],
          },
        },
      },
    ],
  };

  const isSlaCompliant = rep.sla_compliance_pct >= rep.sla_target_pct;
  const isMttrPassing = rep.mttr_minutes <= rep.mttr_target_minutes;

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 p-3 sm:p-4 md:p-6 lg:p-8 select-none">
      <div className="max-w-[1600px] mx-auto space-y-5 sm:space-y-6 md:space-y-8">
        {/* Executive Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/80 pb-4 sm:pb-6 gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner shrink-0">
              <img
                src="https://cdn.krea.edu.in/logo.png"
                alt="Krea University"
                className="h-8 sm:h-9 w-auto object-contain max-w-[110px] sm:max-w-[130px]"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/krea-logo.png';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  EXECUTIVE INFRASTRUCTURE BRIEFING
                </span>
                <span className="hidden sm:inline text-xs text-slate-500">•</span>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">Krea University IT Operations Command</span>
                <span className="text-xs text-slate-500">•</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE TELEMETRY
                </div>
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-wide text-slate-100 flex items-center gap-2 sm:gap-2.5">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 shrink-0" /> Management & CTO Infrastructure Scorecard
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-2"
              title="Refresh Telemetry Now"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
            <button
              onClick={() => navigate('/display')}
              className="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <Tv className="w-4 h-4 text-emerald-400" /> NOC Display
            </button>
            <ThemeToggle />
            <button
              onClick={() => navigate('/noc')}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/50 text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-purple-200 hover:text-white transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Operator Console
            </button>
          </div>
        </div>

        {/* Big Executive KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {/* KPI 1: Overall Availability */}
          <div className="noc-card p-4 sm:p-6 border-t-4 border-t-emerald-500 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Campus Infrastructure Health
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  rep.overall_availability_pct >= 98
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : rep.overall_availability_pct >= 90
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {rep.overall_availability_pct >= 98 ? 'HEALTHY' : rep.overall_availability_pct >= 90 ? 'DEGRADED' : 'CRITICAL'}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-emerald-400 font-mono">
              {isLoading ? '...' : `${rep.overall_availability_pct.toFixed(2)}%`}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                <b className="text-slate-200 font-mono">{rep.devices_up}</b> of{' '}
                <b className="text-slate-200 font-mono">{rep.total_devices}</b> devices operational
              </span>
            </p>
          </div>

          {/* KPI 2: MTTR */}
          <div className="noc-card p-4 sm:p-6 border-t-4 border-t-blue-500 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Mean Time To Resolution (MTTR)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isMttrPassing
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isMttrPassing ? 'PASSING' : 'ACTION REQUIRED'}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-blue-400 font-mono">
              {isLoading ? '...' : rep.mttr_formatted || `${rep.mttr_minutes}m`}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>
                Target SLA: &lt; <b className="text-slate-200 font-mono">{rep.mttr_target_minutes}m</b> ({isMttrPassing ? 'Within Limit' : 'Exceeding SLA'})
              </span>
            </p>
          </div>

          {/* KPI 3: Contractual SLA */}
          <div className="noc-card p-4 sm:p-6 border-t-4 border-t-purple-500 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contractual SLA Adherence
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isSlaCompliant
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {isSlaCompliant ? 'SLA MET' : 'ATTENTION'}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-purple-400 font-mono">
              {isLoading ? '...' : `${rep.sla_compliance_pct.toFixed(2)}%`}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Commitment Target: <b className="text-slate-200 font-mono">{rep.sla_target_pct.toFixed(2)}%</b>
              </span>
            </p>
          </div>

          {/* KPI 4: Recorded Incidents */}
          <div className="noc-card p-4 sm:p-6 border-t-4 border-t-amber-500 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recorded Incidents (30d)
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  rep.active_incidents_count === 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {rep.active_incidents_count === 0 ? '0 ACTIVE OUTAGES' : `${rep.active_incidents_count} ACTIVE`}
              </span>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-100 font-mono">
              {isLoading ? '...' : rep.total_incidents_30d}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>
                <b className="text-red-400 font-mono">{rep.active_incidents_count}</b> open •{' '}
                <b className="text-emerald-400 font-mono">{rep.resolved_incidents_count}</b> resolved
              </span>
            </p>
          </div>
        </div>

        {/* 30-Day Trend Chart & Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 noc-card p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Infrastructure Availability Trend (30 Days)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological telemetry calculated from continuous OpManager alarm monitoring
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-300">Daily Uptime</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-purple-400 border-b border-dashed border-purple-400" />
                  <span className="text-purple-300">SLA Commitment (99.5%)</span>
                </div>
              </div>
            </div>
            <div className="h-72">
              <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* Domain Health Scorecard */}
          <div className="noc-card p-6 space-y-5">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> Domain Health Scorecard
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Live operational status across all technology tiers</p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Network & ILL */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-emerald-400" /> Network & Backbones (ILL)
                  </span>
                  <div className="text-right">
                    <span className="text-emerald-400 font-mono font-bold">
                      {rep.network_availability_pct.toFixed(2)}%
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] ml-1.5">
                      ({rep.network_devices_up}/{rep.network_devices_total})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, rep.network_availability_pct))}%` }}
                  />
                </div>
              </div>

              {/* Compute & Databases */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-400" /> Compute & Databases
                  </span>
                  <div className="text-right">
                    <span className="text-emerald-400 font-mono font-bold">
                      {rep.servers_availability_pct.toFixed(2)}%
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] ml-1.5">
                      ({rep.servers_up}/{rep.servers_total})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, rep.servers_availability_pct))}%` }}
                  />
                </div>
              </div>

              {/* Managed Workstations */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-blue-400" /> Managed Workstations
                  </span>
                  <div className="text-right">
                    <span className="text-blue-400 font-mono font-bold">
                      {rep.endpoints_availability_pct.toFixed(2)}%
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] ml-1.5">
                      ({rep.endpoints_online}/{rep.endpoints_total})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, rep.endpoints_availability_pct))}%` }}
                  />
                </div>
              </div>

              {/* Biometric Access Readers */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-purple-400" /> Biometric Access Readers
                  </span>
                  <div className="text-right">
                    <span className="text-purple-400 font-mono font-bold">
                      {rep.biometrics_availability_pct.toFixed(2)}%
                    </span>
                    <span className="text-slate-500 font-mono text-[10px] ml-1.5">
                      ({rep.biometrics_up}/{rep.biometrics_total})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, rep.biometrics_availability_pct))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Campus Site & Zone Health Breakdown */}
        <div className="noc-card p-4 sm:p-6 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" /> Campus Site & Zone Health Breakdown
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time operational distribution across Sri City campus physical sectors
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400 self-start sm:self-auto">
              {sites.length} Monitored Zones
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {sites.map((zone, idx) => {
              const isHealthy = zone.status === 'HEALTHY';
              const isDegraded = zone.status === 'DEGRADED';
              const badgeClass = isHealthy
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isDegraded
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30';

              const barColor = isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-red-500';

              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 truncate">{zone.zone}</span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                      {zone.status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      <b className="text-slate-100">{zone.up}</b> / {zone.total} Active
                    </span>
                    <span className="font-bold text-slate-200">{zone.availability_pct.toFixed(1)}%</span>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`${barColor} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, zone.availability_pct))}%` }}
                    />
                  </div>

                  {(zone.down > 0 || zone.warning > 0) && (
                    <div className="flex items-center gap-2 text-[11px] font-mono pt-0.5">
                      {zone.down > 0 && <span className="text-red-400 font-bold">{zone.down} Down</span>}
                      {zone.warning > 0 && <span className="text-amber-400">{zone.warning} Degraded</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Recurring Problems Table with Drawer Inspection */}
        <div className="noc-card p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Top Recurring Infrastructure Problems & Outages
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Priority appliances requiring IT Operations attention • Click any device for full telemetry drilldown
              </p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-red-500/10 text-red-300 border border-red-500/20 self-start sm:self-auto">
              {problemDevices.length} Problem Devices Identified
            </span>
          </div>

          <div className="table-scroll-container">
            <table className="w-full text-left text-xs text-slate-300 min-w-[700px]">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Device Identifier</th>
                  <th className="py-3 px-4">Category / Model</th>
                  <th className="py-3 px-4 text-center">Status & Severity</th>
                  <th className="py-3 px-4 text-center">Downtime Duration</th>
                  <th className="py-3 px-4 text-center">Incidents</th>
                  <th className="py-3 px-4">Impact / Recommended Action</th>
                  <th className="py-3 px-4 text-right">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {problemDevices.map((d, i) => (
                  <tr
                    key={d.id || i}
                    onClick={() => handleInspectDevice(d.id)}
                    className="hover:bg-slate-900/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-100 group-hover:text-blue-400 transition-colors">
                        {d.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{d.ip}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-slate-300 font-semibold">{d.category}</span>
                      <div className="text-[11px] text-slate-500">{d.type}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded border ${
                          d.status === 'DOWN'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {d.status} • {d.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-red-400">
                      {d.duration || `${d.downtime_minutes}m`}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                      {d.incidents || d.count || 1}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-md">
                      {d.message ||
                        (d.category === 'BIOMETRIC'
                          ? 'Inspect PoE switch injector, check network port fluctuation, and verify battery backup'
                          : d.category === 'SWITCH'
                          ? 'Inspect upstream fiber trunk SFP+ module, switch temperature sensor, and PSU redundancy'
                          : 'Verify hypervisor resource quota, storage IOPS, and OS watchdog health')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectDevice(d.id);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Open Telemetry Drawer"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slide-Over Device Drawer */}
      <DeviceDrawer
        device={selectedDevice}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDevice(null);
        }}
      />
    </div>
  );
};
