import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

/**
 * Krea OneERP counts for the TV Biometrics view. Counts only: wall displays
 * must never fetch or show the faceless list (names, roll numbers).
 */
export const ErpBiometricTvStrip: React.FC = () => {
  const { data: snap } = useQuery({
    queryKey: ['erp-biometrics'],
    queryFn: api.getErpBiometrics,
    refetchInterval: 60000,
  });
  if (!snap?.enabled || !snap.summary) return null;

  const s = snap.summary;
  const notLinked = snap.devices.filter((d) => !d.zk).length;
  const faces = snap.faceless?.summary.total ?? 0;
  const items: { label: string; value: number; tone: string }[] = [
    { label: 'ERP Offline', value: s.offline, tone: s.offline > 0 ? 'text-red-400' : 'text-slate-300' },
    { label: 'Open Outages', value: s.open_outages, tone: s.open_outages > 0 ? 'text-red-400' : 'text-slate-300' },
    { label: 'ZK Portal Offline', value: s.zk_offline, tone: s.zk_offline > 0 ? 'text-amber-400' : 'text-slate-300' },
    { label: 'Not Linked to ZK', value: notLinked, tone: notLinked > 0 ? 'text-amber-400' : 'text-slate-300' },
    { label: 'Faces to Re-capture', value: faces, tone: faces > 0 ? 'text-amber-400' : 'text-slate-300' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0">
      <span className="text-[10px] uppercase font-black tracking-wider text-sky-400">
        OneERP{snap.is_stale ? ' (stale)' : ''}
      </span>
      {items.map((i) => (
        <span key={i.label} className="text-[11px] text-slate-400 uppercase font-bold">
          {i.label} <span className={`text-lg font-black font-mono ${i.tone}`}>{i.value}</span>
        </span>
      ))}
    </div>
  );
};
