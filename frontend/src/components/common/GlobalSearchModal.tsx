import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Network, Server, Fingerprint, Laptop, AlertTriangle, Layers } from 'lucide-react';
import { api } from '../../api/client';
import { Device, Endpoint, VLAN, Alarm } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice: (device: Device) => void;
}

export const GlobalSearchModal: React.FC<Props> = ({ isOpen, onClose, onSelectDevice }) => {
  const [query, setQuery] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [vlans, setVlans] = useState<VLAN[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setDevices([]);
      setEndpoints([]);
      setVlans([]);
      setAlarms([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const [devs, eps, vls, alms] = await Promise.all([
          api.getDevices(undefined, query),
          api.getEndpoints(undefined, query),
          api.getVlans(),
          api.getAlarms(),
        ]);
        setDevices(devs.slice(0, 5));
        setEndpoints(eps.slice(0, 5));
        setVlans(
          vls.filter(
            (v) =>
              v.name.toLowerCase().includes(query.toLowerCase()) ||
              v.vlan_id.toString().includes(query) ||
              v.subnet.includes(query)
          )
        );
        setAlarms(
          alms
            .filter(
              (a) =>
                a.device_name.toLowerCase().includes(query.toLowerCase()) ||
                a.message.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 5)
        );
      } catch (err) {
        console.error(err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Keyboard shortcut '/' listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        onClose(); // toggle or open
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-16 bg-black/75 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-100 max-h-[85vh] flex flex-col">
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Search className="w-5 h-5 text-blue-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search devices, IPs, hostnames, VLANs, alarms... (/)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-slate-100 placeholder-slate-500 min-w-0"
          />
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-200 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[65vh] sm:max-h-96 overflow-y-auto p-3 sm:p-4 space-y-4">
          {devices.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Network Devices & Biometrics
              </div>
              <div className="space-y-1">
                {devices.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      onSelectDevice(d);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 cursor-pointer border border-slate-800 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {d.category_code === 'BIOMETRIC' ? (
                        <Fingerprint className="w-4 h-4 text-purple-400" />
                      ) : d.category_code === 'SERVER' ? (
                        <Server className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Network className="w-4 h-4 text-blue-400" />
                      )}
                      <div>
                        <div className="font-bold text-slate-200">{d.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {d.ip_address} • {d.vendor} {d.model}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.status === 'UP'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoints.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Endpoints (Endpoint Central)
              </div>
              <div className="space-y-1">
                {endpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Laptop className="w-4 h-4 text-amber-400" />
                      <div>
                        <div className="font-bold text-slate-200">{ep.hostname}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {ep.ip_address} • {ep.os_name} • User: {ep.logged_in_user}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{ep.remote_office}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vlans.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">VLANs</div>
              <div className="space-y-1">
                {vlans.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <div>
                        <div className="font-bold text-slate-200">
                          VLAN {v.vlan_id} — {v.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{v.subnet}</div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        v.internet_status === 'ENABLED'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      Internet {v.internet_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alarms.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Alarms</div>
              <div className="space-y-1">
                {alarms.map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/20 text-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <div>
                        <span className="font-bold text-red-300">{a.device_name}: </span>
                        <span className="text-slate-300">{a.message}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(a.first_seen_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {query.trim() &&
            devices.length === 0 &&
            endpoints.length === 0 &&
            vlans.length === 0 &&
            alarms.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching infrastructure items found for "{query}".
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
