import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  MessageSquare,
  User,
  ChevronRight,
  Search,
  Filter,
  PlusCircle,
  Download,
  X,
  ExternalLink,
  ShieldAlert,
  Server,
  Network,
  Activity,
} from 'lucide-react';
import { api } from '../../api/client';
import { DeviceDrawer } from '../../components/common/DeviceDrawer';
import { Incident, Device } from '../../types';

export const IncidentsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Manual Incident Creation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity] = useState('MAJOR');
  const [newPrimaryDeviceId, setNewPrimaryDeviceId] = useState('');
  const [newAffectedCount, setNewAffectedCount] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Fetch incidents
  const { data: rawIncidents, isLoading, refetch } = useQuery({
    queryKey: ['incidents', statusFilter, severityFilter, search],
    queryFn: () =>
      api.getIncidents(
        statusFilter !== 'ALL' ? statusFilter : undefined,
        severityFilter !== 'ALL' ? severityFilter : undefined,
        search || undefined
      ),
    refetchInterval: 15000,
  });

  // Fetch devices for the create incident dropdown
  const { data: devices } = useQuery({
    queryKey: ['devices-brief'],
    queryFn: () => api.getDevices(),
    staleTime: 60000,
  });

  // Client-side search backup
  const filteredIncidents = useMemo(() => {
    let list = rawIncidents || [];
    if (statusFilter !== 'ALL') {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (severityFilter !== 'ALL') {
      list = list.filter((i) => i.severity === severityFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.incident_number?.toLowerCase().includes(q) ||
          i.title?.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.assigned_to_username?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawIncidents, statusFilter, severityFilter, search]);

  // Counts for status tabs
  const counts = useMemo(() => {
    const list = rawIncidents || [];
    return {
      all: list.length,
      open: list.filter((i) => i.status === 'OPEN').length,
      investigating: list.filter((i) => i.status === 'INVESTIGATING').length,
      acknowledged: list.filter((i) => i.status === 'ACKNOWLEDGED').length,
      resolved: list.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').length,
    };
  }, [rawIncidents]);

  const handleStatusChange = async (status: string) => {
    if (!selectedIncident) return;
    try {
      await api.updateIncidentStatus(selectedIncident.id, status);
      const updated = await api.getIncident(selectedIncident.id);
      setSelectedIncident(updated);
      refetch();
    } catch (e) {
      console.error('Failed to change incident status:', e);
    }
  };

  const handleAddNote = async () => {
    if (!selectedIncident || !noteText.trim()) return;
    try {
      await api.addIncidentNote(selectedIncident.id, noteText);
      setNoteText('');
      const updated = await api.getIncident(selectedIncident.id);
      setSelectedIncident(updated);
      refetch();
    } catch (e) {
      console.error('Failed to add note:', e);
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

  const handleCreateIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Incident title is required.');
      return;
    }
    setIsSubmitting(true);
    setCreateError(null);
    try {
      await api.createIncident({
        title: newTitle.trim(),
        description: newDescription.trim(),
        severity: newSeverity,
        primary_device_id: newPrimaryDeviceId || undefined,
        affected_devices_count: Number(newAffectedCount) || 1,
      });
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setNewSeverity('MAJOR');
      setNewPrimaryDeviceId('');
      setNewAffectedCount(1);
      refetch();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create operational incident.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeviceDrawer = async (deviceId?: string) => {
    if (!deviceId) return;
    try {
      const dev = await api.getDevice(deviceId);
      setSelectedDevice(dev);
    } catch (err) {
      console.error('Failed to open device drawer:', err);
    }
  };

  const handleExportCSV = () => {
    if (!filteredIncidents || filteredIncidents.length === 0) return;
    const headers = [
      'Incident Number',
      'Severity',
      'Status',
      'Title',
      'Description',
      'Primary Device ID',
      'Affected Devices',
      'Assigned Operator',
      'Created At',
      'Updated At',
    ];
    const rows = filteredIncidents.map((i) => [
      i.incident_number,
      i.severity,
      i.status,
      `"${(i.title || '').replace(/"/g, '""')}"`,
      `"${(i.description || '').replace(/"/g, '""')}"`,
      i.primary_device_id || '',
      i.affected_devices_count || 1,
      i.assigned_to_username || '',
      new Date(i.created_at).toISOString(),
      new Date(i.updated_at).toISOString(),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `krea_noc_incidents_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2.5">
            <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" /> Operational Incidents
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            Correlated Infrastructure Outages & Operational Incidents Lifecycle Management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search incidents (e.g. INC-2026, Core)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none w-full sm:w-64"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="MAJOR">Major</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          {/* Log / Report Incident Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-colors shadow-md shadow-amber-500/10"
          >
            <PlusCircle className="w-4 h-4" /> Report Incident
          </button>
        </div>
      </div>

      {/* Status Quick Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { label: 'All Incidents', val: 'ALL', count: counts.all },
          { label: 'Open Outages', val: 'OPEN', count: counts.open, alert: counts.open > 0 },
          { label: 'Investigating', val: 'INVESTIGATING', count: counts.investigating },
          { label: 'Acknowledged', val: 'ACKNOWLEDGED', count: counts.acknowledged },
          { label: 'Resolved', val: 'RESOLVED', count: counts.resolved },
        ].map((tab) => (
          <button
            key={tab.val}
            onClick={() => setStatusFilter(tab.val)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === tab.val
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === tab.val
                  ? 'bg-slate-950 text-amber-400'
                  : tab.alert
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Incidents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
        {filteredIncidents && filteredIncidents.length > 0 ? (
          filteredIncidents.map((inc) => {
            const isCrit = inc.severity === 'CRITICAL';
            return (
              <div
                key={inc.id}
                onClick={() => openIncidentModal(inc)}
                className="noc-card noc-card-hover p-4 sm:p-5 cursor-pointer space-y-3 flex flex-col justify-between border-slate-800 hover:border-amber-500/40"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {inc.incident_number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isCrit
                            ? 'bg-red-500/20 border-red-500/40 text-red-400'
                            : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          inc.status === 'OPEN'
                            ? 'bg-red-500/15 border-red-500/30 text-red-300 animate-pulse'
                            : inc.status === 'INVESTIGATING'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : inc.status === 'ACKNOWLEDGED'
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 line-clamp-2">{inc.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {inc.description || 'No additional incident description logged.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Server className="w-3.5 h-3.5 text-slate-500" />
                    Impact: {inc.affected_devices_count} node(s)
                  </span>
                  <span>{new Date(inc.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-xs text-slate-500 italic">
            {isLoading ? 'Loading operational incidents...' : 'No operational incidents match criteria.'}
          </div>
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-amber-400">
                    {selectedIncident.incident_number}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold">
                    {selectedIncident.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                    {selectedIncident.source_system}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  {selectedIncident.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedIncident.description || 'No detailed incident description provided.'}
            </p>

            {/* Impacted Node / Primary Device Drilldown */}
            {selectedIncident.primary_device_id && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-400">Primary Impacted Device:</span>
                  <strong className="text-slate-200 font-mono">
                    {selectedIncident.primary_device_name || selectedIncident.primary_device_id}
                  </strong>
                </div>
                <button
                  onClick={() => handleOpenDeviceDrawer(selectedIncident.primary_device_id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold text-[11px] uppercase tracking-wider transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Inspect Telemetry
                </button>
              </div>
            )}

            {/* Status Transition Buttons */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2.5">
              <span className="text-slate-400">
                Current Status: <strong className="text-slate-200">{selectedIncident.status}</strong>
              </span>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {['ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={selectedIncident.status === st}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[10px] font-bold uppercase transition-colors"
                  >
                    Mark {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Incident Events Timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Timeline & Investigation Notes
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedIncident.events && selectedIncident.events.length > 0 ? (
                  selectedIncident.events.map((ev) => (
                    <div key={ev.id} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
                        <span className="font-bold text-blue-400">{ev.username || 'Operator'}</span>
                        <span>{new Date(ev.created_at).toLocaleString()}</span>
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
                placeholder="Add operator notes or investigation update..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddNote();
                }}
                className="flex-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
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

      {/* Manual Report Incident Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-5 text-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-400" /> Log Operational Incident
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateIncidentSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Incident Title / Headline <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Fiber cut on Railtel link near Main Gate"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value)}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Impacted Nodes Count</label>
                  <input
                    type="number"
                    min={1}
                    value={newAffectedCount}
                    onChange={(e) => setNewAffectedCount(Math.max(1, Number(e.target.value)))}
                    className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Primary Affected Device (Optional)</label>
                <select
                  value={newPrimaryDeviceId}
                  onChange={(e) => setNewPrimaryDeviceId(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">None / Multiple Infrastructure Nodes</option>
                  {(devices || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.ip_address}) - {d.category_code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Description & Initial Diagnosis</label>
                <textarea
                  rows={3}
                  placeholder="Detail the issue, observed outage symptoms, and initial actions taken..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wider transition-colors"
                >
                  {isSubmitting ? 'Logging...' : 'Create Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drilldown Device Drawer */}
      <DeviceDrawer
        device={selectedDevice}
        isOpen={Boolean(selectedDevice)}
        onClose={() => setSelectedDevice(null)}
        onRefresh={() => refetch()}
      />
    </div>
  );
};
