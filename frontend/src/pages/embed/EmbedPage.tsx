import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network, Server, Fingerprint, Laptop, AlertTriangle, ExternalLink } from 'lucide-react';
import { api } from '../../api/client';
import { DashboardSummary } from '../../types';

export const EmbedPage: React.FC = () => {
  const [embedAuthReady, setEmbedAuthReady] = useState(false);
  const [parentOrigin, setParentOrigin] = useState('');

  // 1. Authenticate via short-lived signed JWT if provided in URL or postMessage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');

    if (tokenParam) {
      api
        .exchangeEmbedJWT(tokenParam)
        .then(() => setEmbedAuthReady(true))
        .catch((e) => {
          console.warn('Embed JWT exchange failed, attempting fallback cookie session:', e);
          setEmbedAuthReady(true);
        });
    } else {
      setEmbedAuthReady(true);
    }
  }, []);

  // 2. PostMessage Communication with KREA Flutter ERP
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      // Validate origin strictly (Section 52 & 53)
      if (
        event.origin !== 'https://erp.krea.edu.in' &&
        event.origin !== 'http://localhost:5173' &&
        event.origin !== 'http://localhost:8080'
      ) {
        return;
      }
      setParentOrigin(event.origin);

      const data = event.data;
      if (data && data.type === 'ERP_PING') {
        event.source?.postMessage({ type: 'NOC_PONG', status: 'READY' }, { targetOrigin: event.origin });
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, []);

  const { data: summary } = useQuery({
    queryKey: ['embed-dashboard-summary'],
    queryFn: api.getSummary,
    enabled: embedAuthReady,
    refetchInterval: 15000,
  });

  const { data: alarms } = useQuery({
    queryKey: ['embed-alarms'],
    queryFn: () => api.getAlarms(undefined, false),
    enabled: embedAuthReady,
    refetchInterval: 15000,
  });

  return (
    <div className="min-h-screen bg-[#0b111a] text-slate-100 p-4 font-sans select-none">
      {/* Clean Iframe Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs">
            KN
          </div>
          <span className="font-black text-sm text-slate-200">KREA IT Operations (ERP Embedded)</span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ● LIVE STREAM
        </span>
      </div>

      {/* 4 Compact Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Network</span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {summary?.network_devices_total ?? '--'}
          </div>
          <span className="text-[10px] text-emerald-400 font-bold font-mono">
            {summary?.network_devices_up ?? '--'} UP
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Servers</span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {summary?.servers_total ?? '--'}
          </div>
          <span className="text-[10px] text-emerald-400 font-bold font-mono">
            {summary?.servers_up ?? '--'} Online
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Endpoints</span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {summary?.endpoints_total ?? '--'}
          </div>
          <span className="text-[10px] text-blue-400 font-bold font-mono">
            {summary?.endpoints_online ?? '--'} Online
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-850">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Biometrics</span>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">
            {summary?.biometrics_total ?? '--'}
          </div>
          <span className="text-[10px] text-purple-400 font-bold font-mono">
            {summary?.biometrics_up ?? '--'} UP
          </span>
        </div>
      </div>

      {/* Active Outage Summary */}
      <div className="rounded-lg bg-slate-950 border border-slate-850 p-3 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Monitored Alarms
        </div>
        {alarms && alarms.length > 0 ? (
          alarms.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between p-2 rounded bg-slate-900 text-xs border border-slate-800"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-bold text-slate-200">{a.device_name}:</span>
                <span className="text-slate-400 truncate">{a.message}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono ml-2">
                {new Date(a.first_seen_at).toLocaleTimeString()}
              </span>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-500 italic py-2">No active alarms.</div>
        )}
      </div>
    </div>
  );
};
