import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Server,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Layers,
  Search,
  CheckSquare,
  Square,
  Clock,
  ArrowRight,
  ShieldCheck,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { SyncPreviewResult, SyncExecuteResult } from '../../types';

export const SyncPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'add' | 'update' | 'remove'>('add');
  const [searchQuery, setSearchQuery] = useState('');
  const [removeMode, setRemoveMode] = useState<'decommission' | 'purge'>('decommission');
  const [selectedAddIDs, setSelectedAddIDs] = useState<string[]>([]);
  const [selectedRemoveIDs, setSelectedRemoveIDs] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [lastResult, setLastResult] = useState<SyncExecuteResult | null>(null);

  // 1. Fetch Sync Preview Query
  const {
    data: preview,
    isLoading: isScanning,
    isRefetching,
    refetch: scanPreview,
    error: previewError,
  } = useQuery({
    queryKey: ['infrastructure-sync-preview'],
    queryFn: api.getSyncPreview,
    staleTime: 60000,
  });

  // When preview loads or changes, auto-select all adds & removes
  React.useEffect(() => {
    if (preview) {
      setSelectedAddIDs(preview.to_add.map((i) => i.id || i.name));
      setSelectedRemoveIDs(preview.to_remove.map((i) => i.id || i.name));
    }
  }, [preview]);

  // 2. Execute Sync Mutation
  const executeMutation = useMutation({
    mutationFn: api.executeSync,
    onSuccess: (data) => {
      setLastResult(data);
      setIsConfirmModalOpen(false);
      setConfirmInput('');
      setReason('');
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['infrastructure-sync-preview'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['vlans'] });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  const handleSelectAllAdds = () => {
    if (!preview) return;
    if (selectedAddIDs.length === preview.to_add.length) {
      setSelectedAddIDs([]);
    } else {
      setSelectedAddIDs(preview.to_add.map((i) => i.id || i.name));
    }
  };

  const handleToggleAddID = (id: string) => {
    setSelectedAddIDs((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllRemoves = () => {
    if (!preview) return;
    if (selectedRemoveIDs.length === preview.to_remove.length) {
      setSelectedRemoveIDs([]);
    } else {
      setSelectedRemoveIDs(preview.to_remove.map((i) => i.id || i.name));
    }
  };

  const handleToggleRemoveID = (id: string) => {
    setSelectedRemoveIDs((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredAdds = (preview?.to_add || []).filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.ip_address.toLowerCase().includes(q) ||
      item.category_code.toLowerCase().includes(q) ||
      item.vendor.toLowerCase().includes(q) ||
      item.model.toLowerCase().includes(q)
    );
  });

  const filteredUpdates = (preview?.to_update || []).filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.ip_address.toLowerCase().includes(q) ||
      item.category_code.toLowerCase().includes(q)
    );
  });

  const filteredRemoves = (preview?.to_remove || []).filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.ip_address.toLowerCase().includes(q) ||
      item.category_code.toLowerCase().includes(q)
    );
  });

  const handleOpenConfirm = () => {
    if (!reason.trim()) {
      alert('Please provide a mandatory justification reason before executing reconciliation.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleConfirmExecute = () => {
    executeMutation.mutate({
      remove_mode: removeMode,
      selected_add_ids: selectedAddIDs,
      selected_remove_ids: selectedRemoveIDs,
      reason: reason.trim(),
    });
  };

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'SWITCH':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'SERVER':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'BIOMETRIC':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ILL':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'WIRELESS_AP':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 select-none">
      {/* 1. Header & Primary Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <RefreshCw className={`w-6 h-6 ${isScanning || isRefetching ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-wide">
                Full Infrastructure Sync & Reconciliation
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Reconcile campus network inventory against upstream ManageEngine OpManager, Endpoint Central, and FortiGate Firewall.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => scanPreview()}
            disabled={isScanning || isRefetching}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning || isRefetching ? 'animate-spin' : ''}`} />
            <span>{isScanning || isRefetching ? 'Scanning Upstream...' : 'Scan & Preview Diff'}</span>
          </button>
        </div>
      </div>

      {/* 2. Success Banner (If execution recently completed) */}
      {lastResult && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm text-emerald-200">
                Infrastructure Reconciliation Completed Successfully
              </div>
              <div className="text-xs text-emerald-300/90 mt-0.5">
                Job ID: <span className="font-mono font-semibold">{lastResult.job_id}</span> •{' '}
                {lastResult.added_count} Added • {lastResult.updated_count} Updated •{' '}
                {lastResult.removed_count} {lastResult.remove_mode === 'purge' ? 'Purged' : 'Decommissioned'} in {lastResult.duration_ms}ms.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/noc/audit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-semibold border border-emerald-500/30 transition-colors"
            >
              <span>View Audit Logs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setLastResult(null)}
              className="px-2.5 py-1.5 rounded-lg text-emerald-400 hover:text-emerald-200 text-xs transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 3. Error Banner */}
      {previewError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">Sync Discovery Warning:</span>{' '}
            {previewError instanceof Error ? previewError.message : 'Failed fetching sync preview'}
          </div>
        </div>
      )}

      {/* 4. Upstream System Connectivity & Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400">OpManager NMS</div>
              <div className="text-lg font-black text-slate-100 font-mono">
                {preview?.upstream_summary.opmanager_devices ?? '—'} <span className="text-xs text-slate-400 font-normal">devices</span>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            CONNECTED
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Endpoint Central</div>
              <div className="text-lg font-black text-slate-100 font-mono">
                {preview?.upstream_summary.endpoint_computers ?? '—'} <span className="text-xs text-slate-400 font-normal">hosts</span>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            CONNECTED
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase text-slate-400">FortiGate Firewall</div>
              <div className="text-lg font-black text-slate-100 font-mono">
                {preview?.upstream_summary.fortigate_vlans ?? '—'} <span className="text-xs text-slate-400 font-normal">policies</span>
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            CONNECTED
          </span>
        </div>
      </div>

      {/* 5. Diff Metrics KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          onClick={() => setActiveTab('add')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'add'
              ? 'bg-blue-950/40 border-blue-500/60 ring-1 ring-blue-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">To Add</span>
            <PlusCircle className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-400 font-mono mt-1">
            +{preview?.counts.add_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">New devices discovered</div>
        </button>

        <button
          onClick={() => setActiveTab('update')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'update'
              ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">To Update</span>
            <RefreshCw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            ~{preview?.counts.update_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Telemetry changes</div>
        </button>

        <button
          onClick={() => setActiveTab('remove')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
            activeTab === 'remove'
              ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/30'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Missing / Retired</span>
            <Trash2 className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 font-mono mt-1">
            -{preview?.counts.remove_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Missing in upstream scan</div>
        </button>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Local Inventory</span>
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-200 font-mono mt-1">
            {preview?.local_summary.total_devices ?? '—'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Existing devices in NOC DB</div>
        </div>
      </div>

      {/* 6. Tabs & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-3.5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800/80">
            <button
              onClick={() => setActiveTab('add')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'add'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              New Devices (+{preview?.counts.add_count ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('update')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'update'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Telemetry Changes (~{preview?.counts.update_count ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('remove')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'remove'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Missing / Obsolete (-{preview?.counts.remove_count ?? 0})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Tab 1: New Devices to Add */}
        {activeTab === 'add' && (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllAdds}
                  className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  {selectedAddIDs.length === (preview?.to_add.length ?? 0) ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedAddIDs.length === (preview?.to_add.length ?? 0)
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </button>
                <span>•</span>
                <span>
                  {selectedAddIDs.length} of {preview?.to_add.length ?? 0} selected for addition
                </span>
              </div>
            </div>

            {filteredAdds.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                {searchQuery
                  ? 'No discovered devices match your search query.'
                  : 'No new devices detected. Upstream and local inventory are synchronized.'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5 w-8"></th>
                      <th className="p-2.5">Device Name</th>
                      <th className="p-2.5">IP Address</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Type & Vendor</th>
                      <th className="p-2.5">Model</th>
                      <th className="p-2.5">Initial Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredAdds.map((item) => {
                      const itemKey = item.id || item.name;
                      const isSelected = selectedAddIDs.includes(itemKey);
                      return (
                        <tr
                          key={itemKey}
                          onClick={() => handleToggleAddID(itemKey)}
                          className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-slate-100">{item.name}</td>
                          <td className="p-2.5 font-mono text-slate-400">{item.ip_address}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${categoryColor(
                                item.category_code
                              )}`}
                            >
                              {item.category_code}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-300">
                            {item.vendor} • {item.type}
                          </td>
                          <td className="p-2.5 text-slate-400 font-mono text-[11px]">{item.model}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.status === 'UP'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Telemetry Changes */}
        {activeTab === 'update' && (
          <div className="p-4 space-y-3">
            <div className="text-xs text-slate-400 pb-2 border-b border-slate-800/80">
              All telemetry and status changes detected upstream will be synchronized during execution.
            </div>

            {filteredUpdates.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                {searchQuery
                  ? 'No telemetry changes match your search filter.'
                  : 'All device statuses and metrics match upstream telemetry.'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">Device Name</th>
                      <th className="p-2.5">IP Address</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Detected Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredUpdates.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2.5 font-bold text-slate-100">{item.name}</td>
                        <td className="p-2.5 font-mono text-slate-400">{item.ip_address}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${categoryColor(
                              item.category_code
                            )}`}
                          >
                            {item.category_code}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            {item.diff_fields?.map((diff, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono text-[10px]"
                              >
                                {diff}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Missing / Removed Devices */}
        {activeTab === 'remove' && (
          <div className="p-4 space-y-4">
            {/* Safe Decommission vs Hard Purge Mode Selector */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <Info className="w-4 h-4 text-blue-400" />
                <span>Select Removal Action Mode</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label
                  onClick={() => setRemoveMode('decommission')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    removeMode === 'decommission'
                      ? 'bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/40 text-blue-100'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="removeMode"
                      checked={removeMode === 'decommission'}
                      onChange={() => setRemoveMode('decommission')}
                      className="accent-blue-500 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-slate-100">
                      Decommission Mode (Recommended & Safe)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-5">
                    Marks status as <code className="text-amber-300">DECOMMISSIONED</code>, auto-clears active alarms,
                    and preserves historical records, graphs, and audit logs.
                  </p>
                </label>

                <label
                  onClick={() => setRemoveMode('purge')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    removeMode === 'purge'
                      ? 'bg-rose-950/30 border-rose-500 ring-1 ring-rose-500/40 text-rose-100'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="removeMode"
                      checked={removeMode === 'purge'}
                      onChange={() => setRemoveMode('purge')}
                      className="accent-rose-500 cursor-pointer"
                    />
                    <span className="font-bold text-xs text-rose-300 flex items-center gap-1.5">
                      <span>Purge Mode (Hard Delete)</span>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 pl-5">
                    Permanently deletes device records, interfaces, active alarms, and telemetry tables from the
                    database. Irreversible.
                  </p>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllRemoves}
                  className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                >
                  {selectedRemoveIDs.length === (preview?.to_remove.length ?? 0) ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>
                    {selectedRemoveIDs.length === (preview?.to_remove.length ?? 0)
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </button>
                <span>•</span>
                <span>
                  {selectedRemoveIDs.length} of {preview?.to_remove.length ?? 0} selected for{' '}
                  {removeMode === 'purge' ? 'purge' : 'decommissioning'}
                </span>
              </div>
            </div>

            {filteredRemoves.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                {searchQuery
                  ? 'No removed devices match your search query.'
                  : 'No obsolete or retired devices found in local database.'}
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/70 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5 w-8"></th>
                      <th className="p-2.5">Device Name</th>
                      <th className="p-2.5">IP Address</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Current Status</th>
                      <th className="p-2.5">Action on Execute</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredRemoves.map((item) => {
                      const itemKey = item.id || item.name;
                      const isSelected = selectedRemoveIDs.includes(itemKey);
                      return (
                        <tr
                          key={itemKey}
                          onClick={() => handleToggleRemoveID(itemKey)}
                          className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                            isSelected ? 'bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </td>
                          <td className="p-2.5 font-bold text-slate-100">{item.name}</td>
                          <td className="p-2.5 font-mono text-slate-400">{item.ip_address}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${categoryColor(
                                item.category_code
                              )}`}
                            >
                              {item.category_code}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-400 font-mono text-[11px]">{item.status}</td>
                          <td className="p-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                removeMode === 'purge'
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {removeMode === 'purge' ? 'PURGE RECORD' : 'DECOMMISSION'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Action Execution Configuration Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-100">
              Reconciliation Execution Plan
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Summary of operations that will be applied to the KREA IT NOC database upon confirmation.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              +{selectedAddIDs.length} to add
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              ~{preview?.counts.update_count ?? 0} to update
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              -{selectedRemoveIDs.length} {removeMode}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300">
            Mandatory Justification Reason <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Scheduled full discovery and campus switch inventory reconciliation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleOpenConfirm}
            disabled={executeMutation.isPending || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-40 transition-all cursor-pointer"
          >
            {executeMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            <span>Execute Reconciliation</span>
          </button>
        </div>
      </div>

      {/* 8. Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                  Confirm Infrastructure Reconciliation
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  You are about to execute modifications to the live KREA IT NOC infrastructure database.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Devices to Insert:</span>
                <span className="font-bold text-blue-400 font-mono">+{selectedAddIDs.length}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Telemetry Updates:</span>
                <span className="font-bold text-amber-400 font-mono">~{preview?.counts.update_count ?? 0}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Devices to Remove ({removeMode}):</span>
                <span className="font-bold text-rose-400 font-mono">-{selectedRemoveIDs.length}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-400 text-[11px]">
                <span>Justification:</span>
                <span className="text-slate-200 truncate max-w-[240px] italic">"{reason}"</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-400">
                Type <span className="font-mono font-bold text-slate-200">CONFIRM</span> to verify execution:
              </label>
              <input
                type="text"
                placeholder="CONFIRM"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setConfirmInput('');
                }}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExecute}
                disabled={confirmInput !== 'CONFIRM' || executeMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 disabled:opacity-40 transition-all cursor-pointer"
              >
                {executeMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Confirm & Execute Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
