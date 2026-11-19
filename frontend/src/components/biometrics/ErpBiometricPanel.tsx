import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CloudOff, Database, ScanFace, Search, X } from 'lucide-react';
import { api } from '../../api/client';
import { ErpBiometricDevice } from '../../types';

/** Minutes since an IST "YYYY-MM-DD HH:MM:SS" timestamp, shown as 3h 20m. */
function since(ts: string): string {
  if (!ts) return '';
  const t = new Date(ts.replace(' ', 'T') + '+05:30').getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

type Filter = 'problems' | 'all' | 'not_linked' | 'not_in_opmanager';

const Tile: React.FC<{ label: string; value: number | string; tone?: 'ok' | 'bad' | 'warn' | 'muted' }> = ({
  label,
  value,
  tone = 'muted',
}) => {
  const color = {
    ok: 'text-emerald-400',
    bad: 'text-red-400',
    warn: 'text-amber-400',
    muted: 'text-slate-100',
  }[tone];
  return (
    <div className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800">
      <div className={`text-lg font-black font-mono ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
};

/**
 * Krea OneERP view of the biometric readers: whether attendance can read each
 * device, open outages, ZK portal state, and the people whose face needs a
 * re-capture. The faceless list is personal data and is fetched only when an
 * operator opens it.
 */
export const ErpBiometricPanel: React.FC<{ opmanagerIps: Set<string> }> = ({ opmanagerIps }) => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('problems');
  const [search, setSearch] = useState('');
  const [showFaceless, setShowFaceless] = useState(false);
  const [faceSearch, setFaceSearch] = useState('');

  const { data: snap } = useQuery({
    queryKey: ['erp-biometrics'],
    queryFn: api.getErpBiometrics,
    refetchInterval: 60000,
  });

  const faceless = useQuery({
    queryKey: ['erp-faceless'],
    queryFn: api.getErpFaceless,
    enabled: showFaceless,
    retry: false,
    staleTime: 5 * 60000,
  });

  const devices = useMemo(() => snap?.devices ?? [], [snap]);
  const notLinked = devices.filter((d) => !d.zk).length;
  const notInOpManager = devices.filter((d) => d.ip && !opmanagerIps.has(d.ip)).length;

  const isProblem = (d: ErpBiometricDevice) =>
    d.status === 'offline' || !!d.down_since || !d.zk || (d.zk && !d.zk.online);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      if (filter === 'problems' && !isProblem(d)) return false;
      if (filter === 'not_linked' && d.zk) return false;
      if (filter === 'not_in_opmanager' && (!d.ip || opmanagerIps.has(d.ip))) return false;
      if (!q) return true;
      return `${d.name} ${d.ip} ${d.rooms} ${d.serial} ${d.zk?.area ?? ''}`.toLowerCase().includes(q);
    });
  }, [devices, filter, search, opmanagerIps]);

  const people = useMemo(() => {
    const q = faceSearch.trim().toLowerCase();
    const all = faceless.data?.people ?? [];
    return q ? all.filter((p) => `${p.biometric_id} ${p.name} ${p.code}`.toLowerCase().includes(q)) : all;
  }, [faceless.data, faceSearch]);

  if (!snap) return null;
  if (!snap.enabled) {
    return (
      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
        <Database className="w-4 h-4" /> Krea OneERP biometric feed is off (ERP_NOC_TOKEN not set).
      </div>
    );
  }

  const s = snap.summary;
  const fs = snap.faceless?.summary;

  const hideFaceless = () => {
    setShowFaceless(false);
    setFaceSearch('');
    // Drop the names from memory once the operator closes the list.
    queryClient.removeQueries({ queryKey: ['erp-faceless'] });
  };

  return (
    <div className="space-y-3 p-3 sm:p-4 rounded-xl bg-slate-900/90 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-sky-400" /> Krea OneERP attendance health
        </h2>
        <span className="text-[10px] font-mono text-slate-500">
          {snap.fetched_at ? `updated ${new Date(snap.fetched_at).toLocaleTimeString()}` : ''}
        </span>
      </div>

      {snap.is_stale && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          <CloudOff className="w-4 h-4" />
          ERP data is stale{snap.fetched_at ? ` since ${new Date(snap.fetched_at).toLocaleString()}` : ''}: {snap.error}
        </div>
      )}
      {snap.zk_error && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
          <AlertTriangle className="w-4 h-4" /> ZK portal unreachable from the ERP: {snap.zk_error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Tile label="ERP online" value={s?.online ?? 0} tone="ok" />
        <Tile label="ERP offline" value={s?.offline ?? 0} tone={(s?.offline ?? 0) > 0 ? 'bad' : 'muted'} />
        <Tile label="Open outages" value={s?.open_outages ?? 0} tone={(s?.open_outages ?? 0) > 0 ? 'bad' : 'muted'} />
        <Tile label="ZK offline" value={s?.zk_offline ?? 0} tone={(s?.zk_offline ?? 0) > 0 ? 'warn' : 'muted'} />
        <Tile label="Not linked to ZK" value={notLinked} tone={notLinked > 0 ? 'warn' : 'muted'} />
        <Tile label="Not in OpManager" value={notInOpManager} tone={notInOpManager > 0 ? 'warn' : 'muted'} />
        <Tile label="Faces to re-capture" value={fs?.total ?? 0} tone={(fs?.total ?? 0) > 0 ? 'warn' : 'muted'} />
      </div>

      {/* Device health */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(
            [
              ['problems', 'Problems'],
              ['all', 'All'],
              ['not_linked', 'Not linked to ZK'],
              ['not_in_opmanager', 'Not in OpManager'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-2.5 py-1 rounded-md font-bold text-[11px] transition-colors ${
                filter === k ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, IP, room, area"
            className="pl-7 pr-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-[11px] w-52"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-slate-400 text-left">
            <tr className="border-b border-slate-800">
              <th className="py-1.5 pr-2">Device</th>
              <th className="py-1.5 pr-2">IP</th>
              <th className="py-1.5 pr-2">ERP</th>
              <th className="py-1.5 pr-2">Outage</th>
              <th className="py-1.5 pr-2">ZK portal</th>
              <th className="py-1.5 pr-2">Area</th>
              <th className="py-1.5 pr-2">Users / faces / fingers</th>
              <th className="py-1.5">Last read</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-slate-500">
                  Nothing to show
                </td>
              </tr>
            )}
            {shown.map((d) => (
              <tr key={d.device_id} className="border-b border-slate-800/60 text-slate-300">
                <td className="py-1.5 pr-2">
                  <div className="font-bold text-slate-100">{d.name}</div>
                  <div className="text-slate-500">
                    {d.type}
                    {d.rooms ? ` · ${d.rooms}` : ''}
                  </div>
                </td>
                <td className="py-1.5 pr-2 font-mono">
                  {d.ip}
                  {d.ip && !opmanagerIps.has(d.ip) && (
                    <div className="text-amber-400 text-[10px]">not in OpManager</div>
                  )}
                </td>
                <td className={`py-1.5 pr-2 font-bold ${d.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {d.status}
                </td>
                <td className="py-1.5 pr-2 text-red-400">{d.down_since ? since(d.down_since) : ''}</td>
                <td className="py-1.5 pr-2">
                  {d.zk ? (
                    <span className={d.zk.online ? 'text-emerald-400' : 'text-amber-400'}>
                      {d.zk.online ? 'online' : 'offline'}
                    </span>
                  ) : (
                    <span className="text-amber-400">not linked</span>
                  )}
                </td>
                <td className="py-1.5 pr-2">{d.zk?.area ?? ''}</td>
                <td className="py-1.5 pr-2 font-mono">
                  {d.zk ? `${d.zk.user_count} / ${d.zk.face_count} / ${d.zk.fp_count}` : ''}
                </td>
                <td className="py-1.5 font-mono text-slate-400">{d.last_sync ? `${since(d.last_sync)} ago` : 'never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Faces to re-capture (personal data, on demand) */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <ScanFace className="w-4 h-4 text-amber-400" />
            Faces to re-capture: <strong>{fs?.total ?? 0}</strong>
            <span className="text-slate-500">
              ({fs?.no_face ?? 0} no face, {fs?.old_face_template ?? 0} old template)
            </span>
          </div>
          {showFaceless ? (
            <button
              onClick={hideFaceless}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-300 bg-slate-800 flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Hide list
            </button>
          ) : (
            <button
              onClick={() => setShowFaceless(true)}
              disabled={(fs?.total ?? 0) === 0}
              className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-sky-600 disabled:opacity-40"
            >
              Show list
            </button>
          )}
        </div>

        {showFaceless && (
          <div className="mt-2 space-y-2">
            <p className="text-[10px] text-slate-500">
              Contains names and roll numbers. Viewing is audited; do not show this on wall displays.
            </p>
            {faceless.isLoading && <div className="text-[11px] text-slate-400">Loading…</div>}
            {faceless.error && (
              <div className="text-[11px] text-red-400">{(faceless.error as Error).message}</div>
            )}
            {faceless.data && (
              <>
                {faceless.data.is_stale && (
                  <div className="text-[11px] text-amber-300">List is stale: {faceless.data.error}</div>
                )}
                <input
                  value={faceSearch}
                  onChange={(e) => setFaceSearch(e.target.value)}
                  placeholder="Search name, roll no, biometric id"
                  className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-[11px] w-64"
                />
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-slate-400 text-left sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-800">
                        <th className="py-1.5 pr-2">Biometric ID</th>
                        <th className="py-1.5 pr-2">Name</th>
                        <th className="py-1.5 pr-2">Roll no / Employee ID</th>
                        <th className="py-1.5 pr-2">Type</th>
                        <th className="py-1.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p) => (
                        <tr key={p.biometric_id} className="border-b border-slate-800/60 text-slate-300">
                          <td className="py-1 pr-2 font-mono">{p.biometric_id}</td>
                          <td className="py-1 pr-2">{p.name}</td>
                          <td className="py-1 pr-2 font-mono">{p.code}</td>
                          <td className="py-1 pr-2">{p.type === 'not_in_erp' ? 'not in ERP' : p.type}</td>
                          <td className={`py-1 ${p.reason === 'no_face' ? 'text-red-400' : 'text-amber-400'}`}>
                            {p.reason === 'no_face' ? 'No face' : `Old template (${p.zk_face})`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
