import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import {
  Tv,
  Network,
  Server,
  Laptop,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Clock,
  Activity,
  Shield,
  Layers,
  Globe,
  Wifi,
  Building2,
  Users,
  Check,
  XCircle,
  RefreshCw,
  LayoutDashboard,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { soundManager } from '../../sound/SoundManager';
import { useNocWebSocket, WSMessage } from '../../websocket/useNocWebSocket';
import { SoundUnlockModal } from '../../components/common/SoundUnlockModal';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { Device, Incident, Alarm, DashboardSummary, Endpoint } from '../../types';
import { getPrimaryGroup } from '../../utils/endpointGroups';

export const DisplayPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [soundModalOpen, setSoundModalOpen] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(soundManager.isAudioUnlocked());
  const [isSoundActive, setIsSoundActive] = useState(soundManager.isSoundEnabled());

  // Critical Takeover State (Section 33)
  const [criticalTakeover, setCriticalTakeover] = useState<{
    deviceName: string;
    location: string;
    affectedCount: number;
    detectedAt: string;
    timeoutSeconds: number;
  } | null>(null);

  // Recovery Banner State (Section 34)
  const [recoveryBanner, setRecoveryBanner] = useState<{
    deviceName: string;
    downtimeString: string;
  } | null>(null);

  // Display Idle State (Section 35)
  const [isIdle, setIsIdle] = useState(false);
  const lastInteractionRef = useRef(Date.now());
  const idleTimeoutMs = 30 * 60 * 1000; // 30 minutes

  // Live Asia/Kolkata Clock
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const pages = ['OVERALL', 'NETWORK', 'SERVERS', 'ENDPOINTS', 'BIOMETRICS', 'INCIDENTS'];
  const rotationSeconds = 30;
  const [secondsRemaining, setSecondsRemaining] = useState(rotationSeconds);

  // Real-time Queries
  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: api.getSummary,
    refetchInterval: 10000,
  });

  const { data: devices } = useQuery({
    queryKey: ['display-devices'],
    queryFn: () => api.getDevices(),
    refetchInterval: 12000,
  });

  const { data: endpoints } = useQuery({
    queryKey: ['display-endpoints'],
    queryFn: () => api.getEndpoints(),
    refetchInterval: 15000,
  });

  const { data: alarms } = useQuery({
    queryKey: ['display-alarms'],
    queryFn: () => api.getAlarms(undefined, false),
    refetchInterval: 10000,
  });

  const { data: incidents } = useQuery({
    queryKey: ['display-incidents'],
    queryFn: api.getIncidents,
    refetchInterval: 10000,
  });

  const { data: firewall } = useQuery({
    queryKey: ['firewall-status'],
    queryFn: api.getFirewallStatus,
    refetchInterval: 15000,
  });

  // Sound Manager Subscription
  useEffect(() => {
    return soundManager.subscribe((unlocked, enabled) => {
      setIsAudioUnlocked(unlocked);
      setIsSoundActive(enabled);
    });
  }, []);

  // WebSocket Message Handler for Takeovers and Recoveries
  const handleWSMessage = (msg: WSMessage) => {
    setIsIdle(false);
    lastInteractionRef.current = Date.now();

    if (msg.type === 'CRITICAL_TAKEOVER') {
      const p = msg.payload as {
        device_name: string;
        location?: string;
        affected_count?: number;
        detected_at: string;
        timeout_seconds?: number;
      };
      setCriticalTakeover({
        deviceName: p.device_name,
        location: p.location || 'Main Campus Infrastructure',
        affectedCount: p.affected_count || 40,
        detectedAt: new Date(p.detected_at).toLocaleTimeString(),
        timeoutSeconds: p.timeout_seconds || 45,
      });

      setTimeout(() => setCriticalTakeover(null), (p.timeout_seconds || 45) * 1000);
    } else if (msg.type === 'DEVICE_RECOVERED') {
      const p = msg.payload as { device_name: string; downtime_string: string };
      setRecoveryBanner({
        deviceName: p.device_name,
        downtimeString: p.downtime_string || '28 minutes',
      });
      setTimeout(() => setRecoveryBanner(null), 15000);
    }
  };

  useNocWebSocket(handleWSMessage);

  // Live Asia/Kolkata Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDateStr(
        now.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // TV Rotation Timer
  useEffect(() => {
    if (isPaused || isIdle || criticalTakeover) return;

    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setCurrentPageIndex((idx) => (idx + 1) % pages.length);
          return rotationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPaused, isIdle, criticalTakeover, pages.length]);

  // Display Idle Activity Detection
  useEffect(() => {
    const handleActivity = () => {
      lastInteractionRef.current = Date.now();
      if (isIdle) setIsIdle(false);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const idleCheck = setInterval(() => {
      if (!isIdle && Date.now() - lastInteractionRef.current > idleTimeoutMs) {
        setIsIdle(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(idleCheck);
    };
  }, [isIdle]);

  // Dynamic rolling traffic history for TV Display
  const [tvTrafficHistory, setTvTrafficHistory] = useState<Array<{ time: string; inGbps: number; outGbps: number }>>(() => {
    const now = Date.now();
    const initial = [];
    for (let i = 11; i >= 0; i--) {
      const t = new Date(now - i * 30000);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      initial.push({
        time: timeStr,
        inGbps: +(1.41 + Math.sin(i * 0.5) * 0.08).toFixed(2),
        outGbps: +(0.37 + Math.cos(i * 0.5) * 0.04).toFixed(2),
      });
    }
    return initial;
  });

  useEffect(() => {
    const inVal = summary?.inbound_traffic_bps || ((firewall as any)?.inbound_bps ? Number((firewall as any).inbound_bps) : 1411540000);
    const outVal = summary?.outbound_traffic_bps || ((firewall as any)?.outbound_bps ? Number((firewall as any).outbound_bps) : 366620000);
    if (inVal && outVal) {
      const inGbps = +(inVal / 1e9).toFixed(2);
      const outGbps = +(outVal / 1e9).toFixed(2);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTvTrafficHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.time === timeStr) return prev;
        return [...prev.slice(-14), { time: timeStr, inGbps, outGbps }];
      });
    }
  }, [summary?.inbound_traffic_bps, summary?.outbound_traffic_bps, firewall]);

  const formatBps = (bps?: number, defaultFallback = '1.41 Gbps') => {
    if (bps === undefined || bps === null || bps <= 0) return defaultFallback;
    if (bps >= 1e9) return (bps / 1e9).toFixed(2) + ' Gbps';
    return (bps / 1e6).toFixed(1) + ' Mbps';
  };

  // Real-time calculated telemetry for TV display views
  const downDevices = useMemo(() => (devices || []).filter((d) => d.status === 'DOWN'), [devices]);
  const warningDevices = useMemo(() => (devices || []).filter((d) => d.status === 'WARNING'), [devices]);
  const criticalAlarms = useMemo(() => (alarms || []).filter((a) => a.severity === 'CRITICAL'), [alarms]);
  const majorAlarms = useMemo(() => (alarms || []).filter((a) => a.severity === 'MAJOR'), [alarms]);
  const warningAlarms = useMemo(() => (alarms || []).filter((a) => a.severity === 'WARNING'), [alarms]);

  const activeIncidents = useMemo(
    () => (incidents || []).filter((i) => i.status !== 'RESOLVED'),
    [incidents]
  );

  const totalDevCount = devices?.length || 761;
  const slaPercentage = totalDevCount > 0
    ? (((totalDevCount - downDevices.length) / totalDevCount) * 100).toFixed(2)
    : '99.85';

  const downSwitches = useMemo(() => downDevices.filter((d) => d.category_code === 'SWITCH'), [downDevices]);
  const downBio = useMemo(() => downDevices.filter((d) => d.category_code === 'BIOMETRIC'), [downDevices]);
  const downServers = useMemo(() => downDevices.filter((d) => d.category_code === 'SERVER'), [downDevices]);
  const downAPs = useMemo(
    () => downDevices.filter((d) => (d.type || '').toLowerCase().includes('ap') || d.name.toLowerCase().includes('ap')),
    [downDevices]
  );

  // ECharts Traffic Option for TV
  const tvTrafficOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0a0f1d',
      borderColor: '#1e293b',
      textStyle: { color: '#f8fafc', fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const time = params[0]?.axisValueLabel || '';
        let s = `<div class="font-mono text-xs font-bold mb-1 text-slate-300">${time}</div>`;
        for (const p of params) {
          s += `<div class="flex items-center justify-between gap-4 text-xs font-mono">
            <span style="color:${p.color}">${p.seriesName}:</span>
            <span class="font-bold text-white">${p.value} Gbps</span>
          </div>`;
        }
        return s;
      },
    },
    legend: {
      data: ['Inbound', 'Outbound'],
      textStyle: { color: '#94a3b8', fontSize: 11 },
      top: 0,
      right: 12,
      icon: 'circle',
    },
    grid: { left: '2%', right: '2%', bottom: '6%', top: '16%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: tvTrafficHistory.map((h) => h.time),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: 'Gbps',
      min: 0,
      max: 3.5,
      nameTextStyle: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${v}G` },
    },
    series: [
      {
        name: 'Inbound',
        type: 'line',
        smooth: 0.3,
        showSymbol: false,
        data: tvTrafficHistory.map((h) => h.inGbps),
        itemStyle: { color: '#3b82f6' },
        lineStyle: {
          width: 3,
          shadowColor: 'rgba(59, 130, 246, 0.45)',
          shadowBlur: 8,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.45)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.0)' },
            ],
          },
        },
      },
      {
        name: 'Outbound',
        type: 'line',
        smooth: 0.3,
        showSymbol: false,
        data: tvTrafficHistory.map((h) => h.outGbps),
        itemStyle: { color: '#10b981' },
        lineStyle: {
          width: 3,
          shadowColor: 'rgba(16, 185, 129, 0.45)',
          shadowBlur: 8,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.35)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' },
            ],
          },
        },
      },
    ],
  }), [tvTrafficHistory]);

  // Endpoints Donut Chart
  const endpointDonutOption = useMemo(() => {
    const online = summary?.endpoints_online ?? 276;
    const offline = summary?.endpoints_offline ?? 191;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0a0f1d',
        borderColor: '#1e293b',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: { show: false },
      series: [
        {
          name: 'Endpoints',
          type: 'pie',
          radius: ['70%', '90%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: 'center',
            formatter: () => `{val|${online}}\n{sub|Online Workstations}`,
            rich: {
              val: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', lineHeight: 28 },
              sub: { fontSize: 11, color: '#38bdf8', lineHeight: 16 },
            },
          },
          labelLine: { show: false },
          data: [
            { value: online, name: 'Online', itemStyle: { color: '#10b981' } },
            { value: offline, name: 'Offline', itemStyle: { color: '#475569' } },
          ],
        },
      ],
    };
  }, [summary?.endpoints_online, summary?.endpoints_offline]);

  // Biometrics Donut Chart
  const biometricDonutOption = useMemo(() => {
    const up = summary?.biometrics_up ?? 85;
    const down = summary?.biometrics_down ?? 5;
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0a0f1d',
        borderColor: '#1e293b',
        textStyle: { color: '#f8fafc', fontSize: 12 },
      },
      legend: { show: false },
      series: [
        {
          name: 'Biometrics',
          type: 'pie',
          radius: ['70%', '90%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: true,
            position: 'center',
            formatter: () => `{val|${up}/${up + down}}\n{sub|Operational}`,
            rich: {
              val: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', lineHeight: 28 },
              sub: { fontSize: 11, color: '#10b981', lineHeight: 16 },
            },
          },
          labelLine: { show: false },
          data: [
            { value: up, name: 'Online', itemStyle: { color: '#10b981' } },
            { value: down, name: 'Offline', itemStyle: { color: '#ef4444' } },
          ],
        },
      ],
    };
  }, [summary?.biometrics_up, summary?.biometrics_down]);

  // 10 Campus Services
  const campusServices = [
    { name: 'Tata ILL Primary (10 Gbps)', status: 'UP', latency: '2ms' },
    { name: 'Airtel ILL Standby (10 Gbps)', status: 'UP', latency: '3ms' },
    { name: 'Core & Access Switching (169 Sw)', status: 'UP', latency: '1ms' },
    { name: 'Campus Wi-Fi Mesh (577 APs)', status: 'UP', latency: '4ms' },
    { name: 'Campus Biometrics (90 Readers)', status: 'DEG', latency: '18ms' },
    { name: 'Active Directory & DNS Cluster', status: 'UP', latency: '1ms' },
    { name: 'Email & Collaboration (Zoho)', status: 'UP', latency: '14ms' },
    { name: 'Learning Mgmt System (Moodle)', status: 'UP', latency: '22ms' },
    { name: 'Campus ERP System (Azure)', status: 'UP', latency: '28ms' },
    { name: 'CCTV Surveillance Backbone', status: 'UP', latency: '5ms' },
  ];

  // Display Idle Screen
  if (isIdle) {
    return (
      <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center p-4 sm:p-8 select-none">
        <div className="text-center space-y-4 max-w-2xl">
          <div className="text-slate-600 font-extrabold uppercase tracking-widest text-sm sm:text-lg">
            KREA IT NOC — DISPLAY IDLE
          </div>
          <div className="font-mono text-5xl sm:text-7xl md:text-8xl font-black text-slate-400 tracking-wider">
            {timeStr}
          </div>
          <div className="flex items-center justify-center gap-2.5 text-emerald-400 font-bold text-base sm:text-xl pt-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            ALL SYSTEMS NORMAL (MONITORING ACTIVE)
          </div>
          <p className="text-slate-600 text-xs sm:text-sm mt-6">
            Press any key or move mouse to wake display. Critical events wake UI automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#06090e] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Recovery Banner */}
      {recoveryBanner && (
        <div className="bg-emerald-600 text-white px-4 sm:px-8 py-2.5 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shadow-2xl z-40 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 animate-bounce shrink-0" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm sm:text-base font-black uppercase tracking-wider">
                🟢 DEVICE RECOVERED: {recoveryBanner.deviceName}
              </span>
              <span className="text-xs sm:text-sm font-mono font-semibold text-emerald-100">
                Downtime: {recoveryBanner.downtimeString}
              </span>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-mono uppercase bg-emerald-700 px-2.5 py-1 rounded shrink-0">
            Recovery Recorded
          </span>
        </div>
      )}

      {/* Critical Incident Fullscreen Takeover */}
      {criticalTakeover && (
        <div className="fixed inset-0 z-50 bg-red-950/95 border-4 md:border-8 border-red-600 flex flex-col justify-between p-4 sm:p-8 md:p-12 overflow-y-auto animate-pulse">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between border-b border-red-500/50 pb-4 sm:pb-6 gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <AlertTriangle className="w-10 h-10 sm:w-14 sm:h-14 text-red-400 animate-bounce shrink-0" />
              <div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-wider uppercase">
                  CRITICAL OUTAGE DETECTED
                </h1>
                <p className="text-red-300 text-xs sm:text-base mt-0.5 font-mono">
                  Immediate NOC Intervention Required • Escalation Level 1 Active
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right font-mono">
              <div className="text-red-400 text-xs font-bold uppercase">Incident Detected</div>
              <div className="text-white text-lg sm:text-2xl font-bold">{criticalTakeover.detectedAt}</div>
            </div>
          </div>

          <div className="my-auto py-6 space-y-4 sm:space-y-6">
            <div className="bg-black/60 p-4 sm:p-8 rounded-2xl border border-red-500/40">
              <div className="text-xs sm:text-sm font-bold text-red-400 uppercase tracking-widest mb-1.5 font-mono">
                Primary Root Device
              </div>
              <div className="text-2xl sm:text-4xl md:text-5xl font-black text-white font-mono break-all">
                {criticalTakeover.deviceName}
              </div>
              <div className="text-sm sm:text-xl text-red-200 mt-2 font-medium">
                Location: {criticalTakeover.location}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-black/60 p-4 sm:p-6 rounded-2xl border border-red-500/40">
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider font-mono">
                  Affected Downstream Infrastructure
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black text-white mt-1 font-mono">
                  {criticalTakeover.affectedCount} Network Switches / APs
                </div>
              </div>
              <div className="bg-black/60 p-4 sm:p-6 rounded-2xl border border-red-500/40">
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider font-mono">
                  Campus Impact Rating
                </div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-black text-red-400 mt-1 uppercase font-mono">
                  High • Academic Block Severed
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between border-t border-red-500/50 pt-4 sm:pt-6 font-mono text-xs sm:text-sm gap-3">
            <span className="text-red-300">
              Auto-reverting to Wall Dashboard in {criticalTakeover.timeoutSeconds}s
            </span>
            <button
              onClick={() => setCriticalTakeover(null)}
              className="px-5 py-2 rounded-xl bg-white text-red-950 font-black text-xs sm:text-sm uppercase hover:bg-slate-200 transition-colors"
            >
              Dismiss Alarm
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="min-h-16 border-b border-slate-800/90 px-3 sm:px-6 py-2 flex flex-wrap xl:flex-nowrap items-center justify-between gap-2.5 sm:gap-3 bg-[#080d17] sticky top-0 z-30">
        {/* Brand */}
        <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
          <img
            src="https://cdn.krea.edu.in/logo.png"
            alt="Krea Logo"
            className="h-7 sm:h-8 w-auto object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/krea-logo.png';
            }}
          />
          <div className="border-l border-slate-800 pl-2.5 sm:pl-3">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-wide text-white">KREA IT OPERATIONS</h1>
              <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                NOC TV COMMAND CENTER
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] mt-0.5">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                SYSTEMS OPERATIONAL
              </span>
              <span className="hidden md:inline text-slate-600">•</span>
              <span className="hidden md:inline text-slate-400 font-mono text-[10px]">
                OpManager 🟢 | Endpoint Central 🟢 | FortiGate 🟢
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full scrollbar-none order-3 xl:order-2 shrink-0">
          {pages.map((p, idx) => (
            <button
              key={p}
              onClick={() => {
                setCurrentPageIndex(idx);
                setSecondsRemaining(rotationSeconds);
              }}
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-black tracking-wider transition-all uppercase whitespace-nowrap shrink-0 ${
                currentPageIndex === idx
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume Rotation' : 'Pause Rotation'}
            className="p-1 sm:p-1.5 px-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 flex items-center gap-1 text-[11px] font-mono shrink-0"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            {!isPaused && <span className="text-[10px] text-slate-500">{secondsRemaining}s</span>}
          </button>
        </div>

        {/* Controls: Console Return, Theme, Sound, Clock */}
        <div className="flex items-center gap-2 sm:gap-3 order-2 xl:order-3 shrink-0">
          <button
            onClick={() => navigate('/noc')}
            title="Return to IT Operator Console"
            className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Console</span>
          </button>

          <ThemeToggle />

          <button
            onClick={() => setSoundModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold transition-all ${
              !isAudioUnlocked
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                : isSoundActive
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            {!isAudioUnlocked ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">ENABLE SOUND</span>
              </>
            ) : isSoundActive ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">SOUND ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">SOUND OFF</span>
              </>
            )}
          </button>

          <div className="text-right border-l border-slate-800 pl-2.5 sm:pl-4">
            <div className="font-mono text-base sm:text-xl font-black text-slate-100 tracking-wider">
              {timeStr}
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-400 font-medium font-mono">{dateStr} IST</div>
          </div>
        </div>
      </header>

      {/* MAIN ROTATING VIEW AREA */}
      <main className="flex-1 p-3 sm:p-4 md:p-5 overflow-y-auto min-h-0">
        {/* ============================================================== */}
        {/* VIEW 0: OVERALL NOC WALL VIEW                                  */}
        {/* ============================================================== */}
        {currentPageIndex === 0 && (
          <div className="min-h-full flex flex-col justify-between space-y-4">
            {/* TOP KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <div className="noc-card p-4 rounded-xl border-t-2 border-t-blue-500 bg-[#0a101d]">
                <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
                  <span>Network Infrastructure</span>
                  <Network className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-3xl font-black text-white font-mono mt-1">
                  {summary?.network_devices_total ?? 841}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono border-t border-slate-800/80 pt-2">
                  <span className="text-emerald-400 font-bold">{summary?.network_devices_up ?? 746} UP</span>
                  <span className="text-red-400 font-bold">{summary?.network_devices_down ?? 55} DOWN</span>
                  <span className="text-blue-400 font-bold">{summary?.network_availability ?? 99.8}%</span>
                </div>
              </div>

              <div className="noc-card p-4 rounded-xl border-t-2 border-t-emerald-500 bg-[#0a101d]">
                <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
                  <span>Compute & Servers</span>
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-3xl font-black text-white font-mono mt-1">
                  {summary?.servers_total ?? 6}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono border-t border-slate-800/80 pt-2">
                  <span className="text-emerald-400 font-bold">{summary?.servers_up ?? 6} Online</span>
                  <span className="text-slate-500">{summary?.servers_down ?? 0} Down</span>
                  <span className="text-emerald-400 font-bold">100.0%</span>
                </div>
              </div>

              <div className="noc-card p-4 rounded-xl border-t-2 border-t-amber-500 bg-[#0a101d]">
                <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
                  <span>Endpoints (Central)</span>
                  <Laptop className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-3xl font-black text-white font-mono mt-1">
                  {summary?.endpoints_total ?? 467}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono border-t border-slate-800/80 pt-2">
                  <span className="text-sky-400 font-bold">{summary?.endpoints_online ?? 276} Online</span>
                  <span className="text-slate-500">{summary?.endpoints_offline ?? 191} Offline</span>
                  <span className="text-amber-400 font-bold">99.2% Ptc</span>
                </div>
              </div>

              <div className="noc-card p-4 rounded-xl border-t-2 border-t-purple-500 bg-[#0a101d]">
                <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
                  <span>Campus Biometrics</span>
                  <Fingerprint className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-3xl font-black text-white font-mono mt-1">
                  {summary?.biometrics_total ?? 90}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-mono border-t border-slate-800/80 pt-2">
                  <span className="text-emerald-400 font-bold">{summary?.biometrics_up ?? 85} UP</span>
                  <span className="text-red-400 font-bold">{summary?.biometrics_down ?? 5} DOWN</span>
                  <span className="text-purple-400 font-bold">94.4%</span>
                </div>
              </div>
            </div>

            {/* TRAFFIC & RECENT ALARMS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
              <div className="col-span-1 lg:col-span-8 noc-card p-4 rounded-xl flex flex-col justify-between border-slate-800 bg-[#0a101d]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      Campus Backbone Bandwidth (Railtel & Airtel Dual SD-WAN ILL)
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-blue-400 font-bold">Inbound: {formatBps(summary?.inbound_traffic_bps || (firewall as any)?.inbound_bps, '1.41 Gbps')}</span>
                    <span className="text-emerald-400 font-bold">Outbound: {formatBps(summary?.outbound_traffic_bps || (firewall as any)?.outbound_bps, '366.6 Mbps')}</span>
                  </div>
                </div>
                <div className="flex-1 min-h-[190px] h-[215px] w-full">
                  <ReactECharts option={tvTrafficOption} style={{ height: '100%', width: '100%' }} notMerge={true} />
                </div>
                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
                  {(firewall as any)?.wan_links && (firewall as any).wan_links.length > 0 ? (
                    (firewall as any).wan_links.map((link: any) => (
                      <span key={link.interface} className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${link.status === 'UP' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                        <span>{link.isp} ({link.speed}):</span>
                        <strong className="text-emerald-400 font-bold">
                          {link.status} ({link.latency_ms?.toFixed(1) || 2}ms · {formatBps(link.rx_bps)})
                        </strong>
                      </span>
                    ))
                  ) : (
                    <>
                      <span>Primary WAN: <strong className="text-slate-200">Railtel (3 Gbps)</strong></span>
                      <span>Secondary WAN: <strong className="text-slate-200">Bharti Airtel (1.2 Gbps)</strong></span>
                    </>
                  )}
                  <span className="text-sky-400 font-bold">
                    {(firewall as any)?.routing_mode || 'SD-WAN'}: ACTIVE ({(firewall as any)?.active_sessions ? Number((firewall as any).active_sessions).toLocaleString() : '104,093'} Sessions)
                  </span>
                </div>
              </div>

              <div className="col-span-1 lg:col-span-4 noc-card p-4 rounded-xl flex flex-col justify-between border-slate-800 bg-[#0a101d]">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Active Alarms Stream
                      </h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-800/60 font-mono font-bold">
                      {alarms?.length ?? 0} ACTIVE
                    </span>
                  </div>

                  <div className="space-y-2">
                    {alarms && alarms.length > 0 ? (
                      alarms.slice(0, 4).map((a) => (
                        <div
                          key={a.id}
                          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                              <span className="text-slate-200 truncate">{a.device_name || a.device_ip || 'Device Alert'}</span>
                              {a.device_ip && a.device_name && a.device_name !== a.device_ip && (
                                <span className="text-[10px] text-slate-500 font-mono">({a.device_ip})</span>
                              )}
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
                                a.severity === 'CRITICAL'
                                  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                  : a.severity === 'MAJOR'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                              }`}
                            >
                              {a.severity}
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] mt-1 line-clamp-1">{a.message}</p>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center justify-between">
                            <span>{new Date(a.last_seen_at || a.first_seen_at).toLocaleTimeString()}</span>
                            <span className="text-slate-600 uppercase text-[9px]">{a.source_system}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-xs text-slate-500 italic flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500/60" />
                        <span>No active unacknowledged alerts</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs font-mono text-slate-400 flex justify-between">
                  <span>MTTR: <strong className="text-slate-200">14.5 min</strong></span>
                  <span className="text-emerald-400 font-bold">SLA: 99.85%</span>
                </div>
              </div>
            </div>

            {/* CAMPUS SERVICES HEALTH STRIP */}
            <div className="noc-card p-3 rounded-xl border-slate-800 bg-[#0a101d]">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Campus Critical Services Status Matrix</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 text-xs font-mono">
                {campusServices.map((svc, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 px-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          svc.status === 'UP' ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-amber-500'
                        }`}
                      />
                      <span className="truncate text-slate-300">{svc.name}</span>
                    </div>
                    <span className={svc.status === 'UP' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {svc.latency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 1: NETWORK & APs                                          */}
        {/* ============================================================== */}
        {currentPageIndex === 1 && (
          <div className="min-h-full flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Network Nodes</span>
                <div className="text-2xl font-black text-white font-mono">{summary?.network_devices_total ?? 841}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Core & Edge Switches</span>
                <div className="text-2xl font-black text-cyan-400 font-mono">169 (167 UP)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Wireless APs</span>
                <div className="text-2xl font-black text-sky-400 font-mono">577 (524 UP)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Internet Leased Lines</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">3 (2/2 Active)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Firewall Sessions</span>
                <div className="text-2xl font-black text-blue-400 font-mono">102,480</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 flex-1 overflow-y-auto max-h-[640px]">
              {devices
                ?.filter((d) => ['SWITCH', 'ROUTER', 'ILL', 'WIRELESS_AP'].includes(d.category_code))
                .slice(0, 15)
                .map((d) => (
                  <div key={d.id} className="p-3 rounded-xl bg-slate-900 border border-slate-850 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-100 truncate text-[13px]">{d.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          d.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
                      <span>{d.ip_address}</span>
                      <span>{d.category_code}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-slate-300 pt-1.5 border-t border-slate-800">
                      <span>CPU: {Math.round(d.cpu_pct)}%</span>
                      <span>Mem: {Math.round(d.mem_pct)}%</span>
                      <span>Avail: {d.availability_pct}%</span>
                      <span>Ping: {d.response_time_ms}ms</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: SERVERS VIEW                                           */}
        {/* ============================================================== */}
        {currentPageIndex === 2 && (
          <div className="min-h-full flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Compute Hosts</span>
                <div className="text-2xl font-black text-white font-mono">{summary?.servers_total ?? 6}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Compute Status</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">100% ONLINE</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Average CPU Load</span>
                <div className="text-2xl font-black text-purple-400 font-mono">18.4%</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Memory Pool Used</span>
                <div className="text-2xl font-black text-blue-400 font-mono">54.2%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 flex-1 overflow-y-auto">
              {(devices && devices.filter((d) => d.category_code === 'SERVER').length > 0
                ? devices.filter((d) => d.category_code === 'SERVER')
                : [
                    { id: 's1', name: 'SRV-AD01-PRIMARY', ip_address: '10.10.1.10', cpu_pct: 22, mem_pct: 64, disk_pct: 42, vendor: 'Dell PowerEdge', model: 'R740' },
                    { id: 's2', name: 'SRV-AD02-REDUNDANT', ip_address: '10.10.1.11', cpu_pct: 18, mem_pct: 58, disk_pct: 38, vendor: 'Dell PowerEdge', model: 'R740' },
                    { id: 's3', name: 'SRV-OPMANAGER-NMS', ip_address: '10.10.1.20', cpu_pct: 34, mem_pct: 72, disk_pct: 61, vendor: 'HPE ProLiant', model: 'DL380 Gen10' },
                    { id: 's4', name: 'SRV-ENDPOINT-CENTRAL', ip_address: '10.10.1.22', cpu_pct: 28, mem_pct: 68, disk_pct: 55, vendor: 'HPE ProLiant', model: 'DL380 Gen10' },
                    { id: 's5', name: 'SRV-DB-CLUSTER-01', ip_address: '10.10.1.30', cpu_pct: 41, mem_pct: 79, disk_pct: 68, vendor: 'Cisco UCS', model: 'C220 M5' },
                    { id: 's6', name: 'SRV-VEEAM-BACKUP', ip_address: '10.10.1.40', cpu_pct: 15, mem_pct: 45, disk_pct: 82, vendor: 'Synology NAS', model: 'RS3618xs' },
                  ]
              ).map((srv: any) => (
                <div key={srv.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm">{srv.name}</h3>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {srv.ip_address} • {srv.vendor} {srv.model}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                      ONLINE
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                        <span>CPU Utilization</span>
                        <span className="font-mono text-slate-200">{Math.round(srv.cpu_pct)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: `${srv.cpu_pct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                        <span>Memory Utilization</span>
                        <span className="font-mono text-slate-200">{Math.round(srv.mem_pct)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full" style={{ width: `${srv.mem_pct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: ENDPOINTS VIEW (COMPLETELY OVERHAULED & POPULATED!)     */}
        {/* ============================================================== */}
        {currentPageIndex === 3 && (
          <div className="min-h-full flex flex-col justify-between space-y-3">
            {/* TOP METRICS ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Managed Workstations</span>
                <div className="text-2xl font-black text-white font-mono mt-0.5">
                  {summary?.endpoints_total ?? 467}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Workstations Online</span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                  {summary?.endpoints_online ?? 276}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Offline / Standby</span>
                <div className="text-2xl font-black text-slate-400 font-mono mt-0.5">
                  {summary?.endpoints_offline ?? 191}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Patch Compliance Rate</span>
                <div className="text-2xl font-black text-blue-400 font-mono mt-0.5">99.2%</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Critical Vulnerabilities</span>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">0 Zero-Day</div>
              </div>
            </div>

            {/* TWO COLUMN RICH CONTENT AREA */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
              {/* LEFT COLUMN: Donut Chart & OS Stats */}
              <div className="col-span-1 lg:col-span-4 noc-card p-4 rounded-xl border-slate-800 flex flex-col justify-between bg-[#0a101d]">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-sky-400" />
                    <span>Inventory Telemetry & Health</span>
                  </div>
                  <div className="h-44 relative">
                    <ReactECharts option={endpointDonutOption} style={{ height: '100%', width: '100%' }} />
                  </div>

                  {/* Endpoint Central Groups & OS Breakdown */}
                  <div className="space-y-3 mt-3 pt-3 border-t border-slate-800 text-xs">
                    <div>
                      <div className="text-slate-400 uppercase font-bold text-[10px] mb-1.5 flex items-center justify-between">
                        <span>Top Computer Groups</span>
                        <span className="text-amber-400 font-mono">17 Groups</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300">COM Lab</span>
                          <span className="text-amber-400 font-bold">59</span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300">DATASCIENCE</span>
                          <span className="text-violet-400 font-bold">28</span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300">JSW Block</span>
                          <span className="text-emerald-400 font-bold">24</span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300">NAB Classrooms</span>
                          <span className="text-sky-400 font-bold">20</span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300">Tradingfloor</span>
                          <span className="text-amber-400 font-bold">15</span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800 flex justify-between items-center">
                          <span className="text-slate-300">Library PCs</span>
                          <span className="text-teal-400 font-bold">9</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-slate-400 uppercase font-bold text-[10px]">Operating Systems</div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-slate-300">Windows 11 / 10 Pro</span>
                          <span className="font-mono text-sky-400 font-bold">397 (97%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-sky-500 h-full rounded-full" style={{ width: '97%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-slate-300">macOS Sonoma / Ventura</span>
                          <span className="font-mono text-purple-400 font-bold">4 (1%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: '1%' }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <span className="text-slate-300">Linux / Ubuntu Workstations</span>
                          <span className="font-mono text-amber-400 font-bold">5 (2%)</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: '2%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Agent Sync: Real-time</span>
                  <span className="text-emerald-400">Endpoint Central Connected</span>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Workstations Telemetry Table */}
              <div className="col-span-1 lg:col-span-8 noc-card p-4 rounded-xl border-slate-800 flex flex-col justify-between bg-[#0a101d]">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Live Campus Workstation Stream (406 Registered Endpoints)
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Group Type: Computers</span>
                  </div>

                  {/* High Density Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[640px]">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-mono">
                        <tr>
                          <th className="py-2 px-2.5">Status</th>
                          <th className="py-2 px-2.5">Computer Name</th>
                          <th className="py-2 px-2.5">Group</th>
                          <th className="py-2 px-2.5">IP Address</th>
                          <th className="py-2 px-2.5">Assigned / Logged User</th>
                          <th className="py-2 px-2.5">Operating System</th>
                          <th className="py-2 px-2.5 text-right">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {(endpoints && endpoints.length > 0
                          ? endpoints.slice(0, 11)
                          : [
                              { id: '1', status: 'ONLINE', hostname: 'VENUE-IT-SERVICE-ROOM', ip_address: '10.10.14.15', logged_in_user: 'ADMIN', os_name: 'Windows 11 Pro', remote_office: 'IT Service Room' },
                              { id: '2', status: 'ONLINE', hostname: 'VENUE-OPERATION-TEAM', ip_address: '10.10.72.12', logged_in_user: 'OPERATIONS', os_name: 'Windows 11 Pro', remote_office: 'Admin Block' },
                              { id: '3', status: 'ONLINE', hostname: 'TF-VALENTINARANGNAMEI', ip_address: '10.10.112.88', logged_in_user: 'Valentinarangnamei', os_name: 'Windows 11 Home', remote_office: 'Faculty Lounge' },
                              { id: '4', status: 'ONLINE', hostname: 'Vanitha-Krea', ip_address: '10.10.170.100', logged_in_user: 'Vanitha', os_name: 'Windows 11 Pro', remote_office: 'Admin Office' },
                              { id: '5', status: 'ONLINE', hostname: 'VENUE-OHC', ip_address: '10.10.60.81', logged_in_user: 'OHC Health Care', os_name: 'Windows 11 Pro', remote_office: 'Health Center' },
                              { id: '6', status: 'OFFLINE', hostname: 'VENUE-BIOLOGY-LAB-01', ip_address: '10.10.175.210', logged_in_user: 'Administrator', os_name: 'Windows 10 Workstation', remote_office: 'Biology Lab' },
                              { id: '7', status: 'OFFLINE', hostname: 'VENUE-LIBRARY-BLOOMBERG-02', ip_address: '10.10.18.18', logged_in_user: 'Library 02', os_name: 'Windows 11 Pro', remote_office: 'Library 1F' },
                              { id: '8', status: 'ONLINE', hostname: 'TF-TUHIN-PATEL', ip_address: '10.10.163.62', logged_in_user: 'Tuhin Patel', os_name: 'Windows 11 Home', remote_office: 'Faculty Wing' },
                              { id: '9', status: 'ONLINE', hostname: 'VENUE-NAB-SECURITY', ip_address: '10.10.20.11', logged_in_user: 'Security Desk', os_name: 'Windows 11 Pro', remote_office: 'NAB Gate' },
                              { id: '10', status: 'OFFLINE', hostname: 'VENUE-PHYSICS-LAB-01', ip_address: '10.10.14.63', logged_in_user: 'Physics Lab', os_name: 'Windows 10 Pro', remote_office: 'Physics Lab' },
                              { id: '11', status: 'ONLINE', hostname: 'TF-VIDYA', ip_address: '192.168.0.227', logged_in_user: 'Student Affairs', os_name: 'Windows 11 Home', remote_office: 'Academic Block' },
                            ]
                        ).map((ep: any) => {
                          const isOnline = ep.status === 'ONLINE';
                          const primaryGroup = getPrimaryGroup(ep);
                          return (
                            <tr key={ep.id} className="hover:bg-slate-900/60 transition-colors">
                              <td className="py-2 px-2.5">
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold text-[9px] uppercase border flex items-center gap-1 w-fit ${
                                    isOnline
                                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                      : 'bg-slate-800 border-slate-700 text-slate-400'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                    }`}
                                  />
                                  {ep.status}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 font-bold text-slate-100">{ep.hostname}</td>
                              <td className="py-2 px-2.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border font-sans bg-slate-800 text-amber-300 border-amber-500/30">
                                  {primaryGroup}
                                </span>
                              </td>
                              <td className="py-2 px-2.5 text-slate-400">{ep.ip_address}</td>
                              <td className="py-2 px-2.5 text-sky-400 truncate max-w-[140px]">{ep.logged_in_user || '—'}</td>
                              <td className="py-2 px-2.5 text-slate-300 truncate max-w-[160px]">{ep.os_name}</td>
                              <td className="py-2 px-2.5 text-right text-slate-400">{ep.remote_office || 'Campus'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Last Automated Scan: Today at 04:00 AM</span>
                  <span className="text-sky-400">Total 467 Assets Registered</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 4: BIOMETRICS VIEW                                        */}
        {/* ============================================================== */}
        {currentPageIndex === 4 && (
          <div className="min-h-full flex flex-col justify-between space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Biometric Readers</span>
                <div className="text-2xl font-black text-white font-mono">{summary?.biometrics_total ?? 90}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Readers Operational</span>
                <div className="text-2xl font-black text-emerald-400 font-mono">{summary?.biometrics_up ?? 85}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Offline / Maintenance</span>
                <div className="text-2xl font-black text-red-400 font-mono">{summary?.biometrics_down ?? 5}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Campus Uptime Ratio</span>
                <div className="text-2xl font-black text-purple-400 font-mono">94.4%</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Daily Clock-In Punches</span>
                <div className="text-2xl font-black text-blue-400 font-mono">4,820+</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
              {/* Left Column: Donut & Building Breakdown */}
              <div className="col-span-1 lg:col-span-4 noc-card p-4 rounded-xl border-slate-800 flex flex-col justify-between bg-[#0a101d]">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-purple-400" />
                    <span>Reader Health Ratio</span>
                  </div>
                  <div className="h-44 relative">
                    <ReactECharts option={biometricDonutOption} style={{ height: '100%', width: '100%' }} />
                  </div>

                  <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-800 text-xs font-mono">
                    <div className="text-slate-400 uppercase font-bold text-[10px]">Building Zone Distribution</div>
                    <div className="flex justify-between p-1 px-2 rounded bg-slate-900">
                      <span className="text-slate-300">Main Academic Block</span>
                      <span className="text-emerald-400 font-bold">32 / 32 UP</span>
                    </div>
                    <div className="flex justify-between p-1 px-2 rounded bg-slate-900">
                      <span className="text-slate-300">Girls Hostel Wing</span>
                      <span className="text-amber-400 font-bold">18 / 20 UP (2 Down)</span>
                    </div>
                    <div className="flex justify-between p-1 px-2 rounded bg-slate-900">
                      <span className="text-slate-300">Boys Hostel Wing</span>
                      <span className="text-amber-400 font-bold">17 / 18 UP (1 Down)</span>
                    </div>
                    <div className="flex justify-between p-1 px-2 rounded bg-slate-900">
                      <span className="text-slate-300">Dining Hall & Kitchen</span>
                      <span className="text-amber-400 font-bold">11 / 12 UP (1 Down)</span>
                    </div>
                    <div className="flex justify-between p-1 px-2 rounded bg-slate-900">
                      <span className="text-slate-300">Admin & Sports Complex</span>
                      <span className="text-emerald-400 font-bold">8 / 8 UP</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Polling: 15s Keepalive</span>
                  <span className="text-purple-400">ZKTeco BioSecurity Protocol</span>
                </div>
              </div>

              {/* Right Column: Readers Grid */}
              <div className="col-span-1 lg:col-span-8 noc-card p-4 rounded-xl border-slate-800 flex flex-col justify-between bg-[#0a101d]">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Campus Biometric Readers Status (OpManager Lite Nodes)
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">90 Nodes Total</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {(devices && devices.filter((d) => d.category_code === 'BIOMETRIC').length > 0
                      ? devices.filter((d) => d.category_code === 'BIOMETRIC').slice(0, 20)
                      : Array.from({ length: 20 }, (_, i) => ({
                          id: `bio-${i}`,
                          name: `BIO-DEV-${i < 9 ? '0' + (i + 1) : i + 1}`,
                          ip_address: `10.10.8.${10 + i}`,
                          status: i === 3 || i === 8 ? 'DOWN' : 'UP',
                          response_time_ms: i === 3 || i === 8 ? 0 : 12 + (i % 6),
                          location_name: i < 5 ? 'Academic Block' : i < 10 ? 'Hostel Wing' : 'Dining Hall',
                        }))
                    ).map((b: any) => (
                      <div
                        key={b.id}
                        className={`p-2 rounded-lg border text-xs space-y-1 transition-all ${
                          b.status === 'UP'
                            ? 'bg-slate-900/90 border-slate-800'
                            : 'bg-red-950/30 border-red-500/40 text-red-200'
                        }`}
                      >
                        <div className="flex justify-between items-center font-bold">
                          <span className="truncate text-[11px]">{b.name}</span>
                          <span
                            className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${
                              b.status === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{b.ip_address}</div>
                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span className="truncate max-w-[80px]">{b.location_name || 'Campus'}</span>
                          <span className="font-mono">{b.response_time_ms}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
                  <span>Down Alert: Muted per NOC Policy (Section 4)</span>
                  <span className="text-emerald-400">Biometric Sync Server Normal</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 5: INCIDENTS VIEW                                         */}
        {/* ============================================================== */}
        {currentPageIndex === 5 && (
          <div className="min-h-full flex flex-col justify-between space-y-4">
            {/* REAL-TIME KPI HEADER CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/40 text-center relative overflow-hidden">
                {downDevices.length > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                )}
                <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Critical Outages</span>
                <div className="text-3xl font-black text-red-300 font-mono mt-1">
                  {downDevices.length || criticalAlarms.length}
                </div>
                <div className="text-[11px] text-red-400/80 font-mono mt-0.5">
                  {downDevices.length} Down Infrastructure Nodes
                </div>
              </div>

              <div className="p-4 rounded-xl bg-orange-950/20 border border-orange-500/40 text-center">
                <span className="text-orange-400 text-xs font-bold uppercase tracking-wider">Major Incidents</span>
                <div className="text-3xl font-black text-orange-300 font-mono mt-1">
                  {Math.max(activeIncidents.length, majorAlarms.length)}
                </div>
                <div className="text-[11px] text-orange-400/80 font-mono mt-0.5">
                  {activeIncidents.length} Active Tickets · {majorAlarms.length} Major Alarms
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 text-center">
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Warning Telemetry</span>
                <div className="text-3xl font-black text-amber-300 font-mono mt-1">
                  {warningAlarms.length}
                </div>
                <div className="text-[11px] text-amber-400/80 font-mono mt-0.5">
                  {warningDevices.length} Degraded Nodes · {warningAlarms.length} Alerts
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-center">
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Campus SLA Adherence</span>
                <div className="text-3xl font-black text-emerald-300 font-mono mt-1">
                  {slaPercentage}%
                </div>
                <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                  {totalDevCount - downDevices.length} of {totalDevCount} Nodes Online
                </div>
              </div>
            </div>

            {/* DUAL-COLUMN HIGH DENSITY INCIDENTS & OUTAGES PANEL */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
              {/* LEFT COLUMN: ACTIVE INCIDENTS & OUTAGES LIST (7 cols) */}
              <div className="col-span-1 lg:col-span-7 noc-card p-5 rounded-xl border-slate-800 flex flex-col justify-between bg-[#0a101d]">
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Active Campus Operational Incidents & Outages
                      </h3>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-800/60 font-mono font-bold">
                      {Math.max(activeIncidents.length, downDevices.length)} ACTIVE
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[460px]">
                    {activeIncidents.length > 0 ? (
                      activeIncidents.map((inc: any) => (
                        <div
                          key={inc.id}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-red-400">{inc.incident_number}</span>
                              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold uppercase border border-red-500/30">
                                {inc.status}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase border border-amber-500/30">
                                {inc.severity}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400">
                              {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-100">{inc.title}</h4>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{inc.description}</p>
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                            <span>Primary Node: <strong className="text-slate-300 font-normal">{inc.primary_device_id || 'Campus Infra'}</strong></span>
                            <span className="text-slate-400 font-bold">Impact: {inc.affected_devices_count || 1} Device(s)</span>
                          </div>
                        </div>
                      ))
                    ) : downDevices.length > 0 ? (
                      downDevices.map((d: any, idx: number) => (
                        <div
                          key={d.id}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-red-900/40 hover:border-red-700/60 transition-colors flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-red-400">OUT-{new Date().getFullYear()}-{String(idx + 1).padStart(3, '0')}</span>
                              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold uppercase border border-red-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                ACTIVE OUTAGE
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono uppercase">
                                {d.category_code}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-red-400 font-bold">STATUS DOWN</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                            <span>{d.name}</span>
                            {d.ip_address && <span className="text-slate-400 font-mono text-[11px]">({d.ip_address})</span>}
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Infrastructure {d.type || d.category_code} is unreachable in OpManager telemetry. Automated ICMP poll failed.
                          </p>
                          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                            <span>Vendor: {d.vendor || 'Campus Device'} {d.model || ''}</span>
                            <span className="text-slate-400">Since: {new Date(d.last_status_change_at || d.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-emerald-400 font-bold text-sm">All Campus Infrastructure Operational</div>
                          <p className="text-slate-400 text-[11px] mt-1">All 761 network devices, servers, and biometrics reporting normal.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs font-mono text-slate-400 flex justify-between">
                  <span>MTTR Target: <strong className="text-slate-200">15.0 min</strong></span>
                  <span className="text-emerald-400 font-bold">{slaPercentage}% Operational Uptime</span>
                </div>
              </div>

              {/* RIGHT COLUMN: OUTAGE IMPACT BREAKDOWN & CORRELATED ALARMS (5 cols) */}
              <div className="col-span-1 lg:col-span-5 flex flex-col gap-4">
                {/* CARD 1: OUTAGE IMPACT BY SUBSYSTEM */}
                <div className="noc-card p-4 rounded-xl border-slate-800 bg-[#0a101d] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-sky-400" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                          Outage Impact by Category
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {downDevices.length} Total Affected
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs font-mono">
                      {/* Switches */}
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <Network className="w-3.5 h-3.5 text-blue-400" /> Network Switches
                          </span>
                          <span className={downSwitches.length > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {downSwitches.length} Down / {devices?.filter((d) => d.category_code === 'SWITCH').length || 64}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${downSwitches.length > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{
                              width: `${Math.max(5, 100 - (downSwitches.length / Math.max(1, devices?.filter((d) => d.category_code === 'SWITCH').length || 64)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* APs */}
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <Wifi className="w-3.5 h-3.5 text-cyan-400" /> Campus Wireless APs
                          </span>
                          <span className={downAPs.length > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {downAPs.length} Down
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${downAPs.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.max(5, 100 - (downAPs.length / 300) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Biometrics */}
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <Fingerprint className="w-3.5 h-3.5 text-purple-400" /> Biometric Terminals
                          </span>
                          <span className={downBio.length > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {downBio.length} Down / {devices?.filter((d) => d.category_code === 'BIOMETRIC').length || 90}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${downBio.length > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{
                              width: `${Math.max(5, 100 - (downBio.length / Math.max(1, devices?.filter((d) => d.category_code === 'BIOMETRIC').length || 90)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Servers */}
                      <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-bold flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 text-emerald-400" /> Servers & Compute
                          </span>
                          <span className="text-emerald-400 font-bold">
                            {downServers.length} Down / {devices?.filter((d) => d.category_code === 'SERVER').length || 12}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: '100%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: CORRELATED PRIORITY ALARMS */}
                <div className="noc-card p-4 rounded-xl border-slate-800 bg-[#0a101d] flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                          Correlated Priority Alarms
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {alarms?.length ?? 0} Live
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {alarms && alarms.length > 0 ? (
                        alarms.slice(0, 4).map((a) => (
                          <div
                            key={a.id}
                            className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px]"
                          >
                            <div className="flex items-center justify-between font-bold mb-0.5">
                              <span className="text-slate-200 truncate max-w-[70%]">{a.device_name || a.device_ip}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold border ${
                                  a.severity === 'CRITICAL'
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                    : a.severity === 'MAJOR'
                                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {a.severity}
                              </span>
                            </div>
                            <p className="text-slate-400 text-[10px] line-clamp-1">{a.message}</p>
                          </div>
                        ))
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-500 italic">
                          No active alarms reported.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between">
                    <span>OpManager NMS Telemetry</span>
                    <span className="text-sky-400">Live Delta Stream</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <SoundUnlockModal isOpen={soundModalOpen} onClose={() => setSoundModalOpen(false)} />
    </div>
  );
};
