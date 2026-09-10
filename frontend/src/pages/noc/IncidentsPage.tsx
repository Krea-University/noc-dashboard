import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, CheckCircle2, Clock, MessageSquare, User, ChevronRight } from 'lucide-react';
import { api } from '../../api/client';
import { Incident } from '../../types';

export const IncidentsPage: React.FC = () => {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [noteText, setNoteText] = useState('');

  const { data: incidents, isLoading, refetch } = useQuery({
    queryKey: ['incidents'],
    queryFn: api.getIncidents,
    refetchInterval: 15000,
  });

  const handleStatusChange = async (status: string) => {
    if (!selectedIncident) return;
    try {
      await api.updateIncidentStatus(selectedIncident.id, status);
      const updated = await api.getIncident(selectedIncident.id);
      setSelectedIncident(updated);
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddNote = async () => {
    if (!selectedIncident || !noteText.trim()) return;
    try {
      await api.addIncidentNote(selectedIncident.id, noteText);
      setNoteText('');
      const updated = await api.getIncident(selectedIncident.id);
      setSelectedIncident(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const openIncidentModal = async (inc: Incident) => {
    try {
      const full = await api.getIncident(inc.id);
      setSelectedIncident(full);
    } catch {
      setSelectedIncident(inc);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
          <AlertOctagon className="w-6 h-6 text-amber-400" /> Operational Incidents
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Automated Correlated Outages & Infrastructure Incidents Lifecycle Management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {incidents && incidents.length > 0 ? (
          incidents.map((inc) => {
            const isCrit = inc.severity === 'CRITICAL';
            return (
              <div
                key={inc.id}
                onClick={() => openIncidentModal(inc)}
                className="noc-card noc-card-hover p-5 cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-red-400">{inc.incident_number}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        inc.status === 'OPEN'
                          ? 'bg-red-500/15 border-red-500/30 text-red-300'
                          : inc.status === 'INVESTIGATING'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2">{inc.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{inc.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span>Affected: {inc.affected_devices_count} device(s)</span>
                  <span>{new Date(inc.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-3 py-16 text-center text-xs text-slate-500 italic">
            No active operational incidents.
          </div>
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-red-400">
                    {selectedIncident.incident_number}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold">
                    {selectedIncident.severity}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-100">{selectedIncident.title}</h2>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">{selectedIncident.description}</p>

            {/* Status Transition Buttons */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Current Status: <strong className="text-slate-200">{selectedIncident.status}</strong>
              </span>
              <div className="flex items-center gap-2">
                {['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={selectedIncident.status === st}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-[10px] font-bold uppercase transition-colors"
                  >
                    Mark {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident Events Timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Timeline & Notes
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedIncident.events && selectedIncident.events.length > 0 ? (
                  selectedIncident.events.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                        <span className="font-bold text-blue-400">{ev.username || 'Operator'}</span>
                        <span>{new Date(ev.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-300">{ev.notes}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic py-2">No timeline notes yet.</div>
                )}
              </div>
            </div>

            {/* Add Note Input */}
            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Add operator notes..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="flex-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddNote}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
