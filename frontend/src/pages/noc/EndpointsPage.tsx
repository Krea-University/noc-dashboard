import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Laptop,
  Search,
  ExternalLink,
  CheckCircle,
  Clock,
  Shield,
  Activity,
  ArrowLeft,
  ArrowRight,
  X,
  Layers,
  Filter,
  Monitor,
  FolderTree,
  Check,
  AlertTriangle,
  Server,
  Terminal,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
  Tag,
  FolderPlus,
} from 'lucide-react';
import { api } from '../../api/client';
import { Endpoint, CustomGroup } from '../../types';
import {
  ENDPOINT_CENTRAL_GROUPS,
  getPrimaryGroup,
  getEndpointGroups,
  calculateGroupSummaries,
  matchCustomGroup,
} from '../../utils/endpointGroups';

export const EndpointsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'groups' | 'inventory'>('groups');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Custom Group Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCategory, setNewGroupCategory] = useState('Custom Groups');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newMatchType, setNewMatchType] = useState<'HOSTNAME_PREFIX' | 'HOSTNAME_CONTAINS' | 'IP_PREFIX' | 'OS_CONTAINS'>('HOSTNAME_PREFIX');
  const [newMatchValue, setNewMatchValue] = useState('');
  const [newColor, setNewColor] = useState('violet');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: api.getSummary,
    refetchInterval: 15000,
  });

  const { data: endpoints, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['endpoints', status, search],
    queryFn: () => api.getEndpoints(status || undefined, search || undefined),
    refetchInterval: 30000,
  });

  const { data: customGroups, refetch: refetchCustomGroups } = useQuery({
    queryKey: ['custom-endpoint-groups'],
    queryFn: api.getCustomGroups,
    refetchInterval: 15000,
  });

  // Calculate live group summaries from all endpoints + user custom groups
  const groupSummaries = useMemo(() => {
    if (!endpoints) return [];
    return calculateGroupSummaries(endpoints, customGroups);
  }, [endpoints, customGroups]);

  // Client-side filtering for group and OS
  const filteredEndpoints = useMemo(() => {
    if (!endpoints) return [];
    return endpoints.filter((ep) => {
      if (osFilter && !ep.os_name?.toLowerCase().includes(osFilter.toLowerCase())) {
        return false;
      }
      if (selectedGroup) {
        const groups = getEndpointGroups(ep, customGroups);
        if (!groups.includes(selectedGroup)) {
          return false;
        }
      }
      return true;
    });
  }, [endpoints, osFilter, selectedGroup, customGroups]);

  const totalItems = filteredEndpoints.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);

  const paginatedEndpoints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEndpoints.slice(start, start + pageSize);
  }, [filteredEndpoints, currentPage, pageSize]);

  // Real-time matching preview count for Create Custom Group modal
  const previewMatchCount = useMemo(() => {
    if (!endpoints || !newMatchValue.trim()) return 0;
    const val = newMatchValue.trim().toLowerCase();
    return endpoints.filter((ep) => {
      const h = (ep.hostname || '').toLowerCase();
      const ip = (ep.ip_address || '').toLowerCase();
      const os = (ep.os_name || '').toLowerCase();
      switch (newMatchType) {
        case 'HOSTNAME_PREFIX':
          return h.startsWith(val);
        case 'HOSTNAME_CONTAINS':
          return h.includes(val);
        case 'IP_PREFIX':
          return ip.startsWith(val);
        case 'OS_CONTAINS':
          return os.includes(val);
        default:
          return h.includes(val);
      }
    }).length;
  }, [endpoints, newMatchType, newMatchValue]);

  // Quick helper to jump from groups table to inventory with filter
  const handleSelectGroup = (groupName: string) => {
    setSelectedGroup(groupName);
    setActiveTab('inventory');
    setPage(1);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !newMatchValue.trim()) {
      setErrorMessage('Group name and match value are required');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    try {
      await api.createCustomGroup({
        name: newGroupName.trim(),
        group_type: 'Computers',
        category: newGroupCategory.trim() || 'Custom Groups',
        description: newGroupDesc.trim(),
        match_type: newMatchType,
        match_value: newMatchValue.trim(),
        color: newColor,
      });
      setIsCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewMatchValue('');
      await refetchCustomGroups();
      await refetch();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create custom group');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Are you sure you want to delete the custom group "${groupName}"?`)) {
      return;
    }
    try {
      await api.deleteCustomGroup(groupId);
      if (selectedGroup === groupName) {
        setSelectedGroup('');
      }
      await refetchCustomGroups();
      await refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to delete custom group');
    }
  };

  const getBadgeColor = (group: string, isCustom?: boolean, color?: string) => {
    if (color) {
      switch (color) {
        case 'violet':
          return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
        case 'indigo':
          return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
        case 'emerald':
          return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
        case 'amber':
          return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
        case 'sky':
          return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
        case 'rose':
          return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
        case 'teal':
          return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
        case 'cyan':
          return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      }
    }
    if (isCustom) {
      return 'bg-violet-500/20 text-violet-300 border-violet-500/40';
    }
    switch (group) {
      case 'COM':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'DATASCIENCE LAB':
      case 'DATASCIENCE LAB Static':
        return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
      case 'JSW':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case "NAB CLASSROOM PC'S":
        return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'Tradingfloor':
      case 'Trading Lab Computers':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Library-Computer':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'Windows Servers':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'All Mac machines':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'All Linux machines':
        return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
      case 'USB Block':
      case 'block':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
      default:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-[1720px] mx-auto text-slate-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ManageEngine UEMS
            </span>
            <span className="text-xs text-slate-500 font-mono">Endpoint Central 11.3</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5 mt-1">
            <Monitor className="w-5 h-5 text-amber-400" /> Endpoint Central Inventory & Custom Groups
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
            Academic Labs, Smart Classrooms, Faculty & Administrative Workstations across Krea University
          </p>
        </div>

        {/* View Mode Toggle Tabs & Create Custom Group Action */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
              activeTab === 'groups'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Endpoint Groups ({groupSummaries.length})
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
              activeTab === 'inventory'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-sm'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Workstation Inventory ({endpoints?.length ?? 0})
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30 border border-violet-500/40"
          >
            <Plus className="w-3.5 h-3.5" />
            New Custom Group
          </button>

          <button
            onClick={() => {
              refetch();
              refetchCustomGroups();
            }}
            disabled={isFetching}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 5 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <div className="noc-card p-3.5 rounded-xl border-t-2 border-t-amber-500 bg-[#0a101d]">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Total Managed Assets</span>
          <div className="text-xl sm:text-2xl font-black text-white font-mono mt-0.5">
            {summary?.endpoints_total ?? endpoints?.length ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">ManageEngine Agent</div>
        </div>

        <div className="noc-card p-3.5 rounded-xl border-t-2 border-t-emerald-500 bg-[#0a101d]">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Active & Online</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-0.5">
            {summary?.endpoints_online ?? endpoints?.filter(e => e.status === 'ONLINE').length ?? 0}
          </div>
          <div className="text-[10px] text-emerald-400 font-mono mt-1">Live Heartbeat Ping</div>
        </div>

        <div className="noc-card p-3.5 rounded-xl border-t-2 border-t-slate-500 bg-[#0a101d]">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Offline / Standby</span>
          <div className="text-xl sm:text-2xl font-black text-slate-300 font-mono mt-0.5">
            {summary?.endpoints_offline ?? endpoints?.filter(e => e.status === 'OFFLINE').length ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">Inactive &gt; 2 hours</div>
        </div>

        <div className="noc-card p-3.5 rounded-xl border-t-2 border-t-indigo-500 bg-[#0a101d]">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Active Groups</span>
          <div className="text-xl sm:text-2xl font-black text-indigo-400 font-mono mt-0.5">
            {groupSummaries.length} Groups
          </div>
          <div className="text-[10px] text-indigo-300 font-mono mt-1">
            {customGroups?.length ? `${customGroups.length} User Custom` : 'Standard & Custom'}
          </div>
        </div>

        <div className="noc-card p-3.5 rounded-xl border-t-2 border-t-blue-500 bg-[#0a101d]">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Patch Compliance</span>
          <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono mt-0.5">99.2%</div>
          <div className="text-[10px] text-blue-300 font-mono mt-1">Antivirus Current</div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ENDPOINT GROUPS VIEW (MATCHING USER SCREENSHOT)     */}
      {/* ========================================================= */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Endpoint Central Defined Computer Groups
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {groupSummaries.length} Groups Active
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Click <strong className="text-amber-300">"Explore Computers"</strong> on any group to inspect individual workstations
            </p>
          </div>

          <div className="noc-card rounded-xl border-slate-800 overflow-hidden bg-[#0a101d]">
            <div className="overflow-x-auto table-scroll-container">
              <table className="w-full text-left text-xs text-slate-300 min-w-[720px]">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10.5px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-200">Name</th>
                    <th className="py-3 px-4 font-bold text-amber-400">Group Type</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Total Computers</th>
                    <th className="py-3 px-4 text-right">Online</th>
                    <th className="py-3 px-4 text-right">Offline</th>
                    <th className="py-3 px-4 min-w-[140px]">Availability / Health</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {groupSummaries.map((grp) => {
                    const healthPct = grp.total > 0 ? Math.round((grp.online / grp.total) * 100) : 100;
                    return (
                      <tr
                        key={grp.name}
                        onClick={() => handleSelectGroup(grp.name)}
                        className="hover:bg-slate-900/80 cursor-pointer transition-colors group"
                      >
                        {/* Name & Custom Group Badge */}
                        <td className="py-3 px-4 font-sans font-bold text-white text-xs flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${grp.online > 0 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <span className="group-hover:text-amber-300 transition-colors">{grp.name}</span>
                          {grp.is_custom && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/40 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5 text-violet-400" /> CUSTOM
                            </span>
                          )}
                        </td>

                        {/* Group Type */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 text-amber-300">
                            {grp.group_type}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4 font-sans text-slate-400 text-xs">
                          {grp.category}
                        </td>

                        {/* Total Computers */}
                        <td className="py-3 px-4 text-right font-bold text-white text-xs">
                          {grp.total}
                        </td>

                        {/* Online */}
                        <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                          {grp.online}
                        </td>

                        {/* Offline */}
                        <td className="py-3 px-4 text-right text-slate-400">
                          {grp.offline}
                        </td>

                        {/* Health Bar */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  healthPct >= 90
                                    ? 'bg-emerald-500'
                                    : healthPct >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${healthPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 w-8 text-right">
                              {healthPct}%
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSelectGroup(grp.name)}
                              className="px-2.5 py-1 rounded bg-slate-800 group-hover:bg-amber-500/20 group-hover:text-amber-300 group-hover:border-amber-500/40 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase inline-flex items-center gap-1 font-sans transition-all"
                            >
                              Explore Computers <ArrowRight className="w-3 h-3" />
                            </button>
                            {grp.is_custom && grp.id && (
                              <button
                                onClick={() => handleDeleteGroup(grp.id!, grp.name)}
                                className="p-1.5 rounded bg-slate-800 hover:bg-rose-500/20 hover:border-rose-500/40 border border-slate-700 text-slate-400 hover:text-rose-300 transition-all"
                                title="Delete Custom Group"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: WORKSTATION INVENTORY VIEW (WITH GROUP TAGS)       */}
      {/* ========================================================= */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Active Group Filter Banner */}
          {selectedGroup && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Active Group Filter
                </span>
                <span className="text-xs font-bold text-white">
                  {selectedGroup}
                </span>
                <span className="text-xs text-slate-400">
                  (Group Type: <strong className="text-amber-300">Computers</strong> — {filteredEndpoints.length} devices match)
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedGroup('');
                  setPage(1);
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 w-fit transition-colors"
              >
                <X className="w-3 h-3" /> Clear Group Filter
              </button>
            </div>
          )}

          {/* Search, Filter Bar & Quick Pills */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Quick Group Pill Chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => {
                    setSelectedGroup('');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    !selectedGroup
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  All Groups ({endpoints?.length ?? 406})
                </button>
                {['COM', 'DATASCIENCE LAB', 'JSW', "NAB CLASSROOM PC'S", 'Tradingfloor', 'Library-Computer'].map(
                  (grpName) => {
                    const count = groupSummaries.find((g) => g.name === grpName)?.total ?? 0;
                    return (
                      <button
                        key={grpName}
                        onClick={() => {
                          setSelectedGroup(grpName);
                          setPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          selectedGroup === grpName
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {grpName} ({count})
                      </button>
                    );
                  }
                )}
                {/* User Custom Groups Quick Pills */}
                {customGroups && customGroups.map((cg) => {
                  const count = groupSummaries.find((g) => g.name === cg.name)?.total ?? 0;
                  return (
                    <button
                      key={cg.id}
                      onClick={() => {
                        setSelectedGroup(cg.name);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                        selectedGroup === cg.name
                          ? 'bg-purple-500/30 border-purple-500/60 text-purple-200'
                          : 'bg-purple-950/20 border-purple-800/40 text-purple-300 hover:border-purple-600'
                      }`}
                    >
                      <span>✨ {cg.name}</span>
                      <span className="text-[10px] opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search user, hostname, IP..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none w-52 shadow-inner"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={selectedGroup}
                  onChange={(e) => {
                    setSelectedGroup(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-blue-500 focus:outline-none cursor-pointer max-w-[200px]"
                >
                  <option value="">All Groups ({groupSummaries.length})</option>
                  <optgroup label="Default Groups">
                    {groupSummaries
                      .filter((g) => !g.is_custom)
                      .map((g) => (
                        <option key={g.name} value={g.name}>
                          {g.name} ({g.total})
                        </option>
                      ))}
                  </optgroup>
                  {groupSummaries.some((g) => g.is_custom) && (
                    <optgroup label="User Custom Groups">
                      {groupSummaries
                        .filter((g) => g.is_custom)
                        .map((g) => (
                          <option key={g.name} value={g.name}>
                            ✨ {g.name} ({g.total})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="ONLINE">ONLINE Only</option>
                  <option value="OFFLINE">OFFLINE Only</option>
                </select>

                <select
                  value={osFilter}
                  onChange={(e) => {
                    setOsFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:border-blue-500 focus:outline-none cursor-pointer"
                >
                  <option value="">All OS Types</option>
                  <option value="Windows 11">Windows 11</option>
                  <option value="Windows 10">Windows 10</option>
                  <option value="macOS">macOS</option>
                  <option value="Linux">Linux / Ubuntu</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="noc-card rounded-xl border-slate-800 overflow-hidden bg-[#0a101d]">
            <div className="overflow-x-auto table-scroll-container">
              <table className="w-full text-left text-xs text-slate-300 min-w-[760px]">
                <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10.5px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Computer Name</th>
                    <th className="py-2.5 px-3">Group Name</th>
                    <th className="py-2.5 px-3">Group Type</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3">Logged In / Assigned User</th>
                    <th className="py-2.5 px-3">Operating System</th>
                    <th className="py-2.5 px-3">Location / Lab</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 italic">
                        Loading endpoint inventory from Endpoint Central...
                      </td>
                    </tr>
                  ) : paginatedEndpoints.length > 0 ? (
                    paginatedEndpoints.map((ep) => {
                      const isOnline = ep.status === 'ONLINE';
                      const primaryGroup = getPrimaryGroup(ep, customGroups);
                      const epCustomGroups = (customGroups || []).filter((cg) => matchCustomGroup(ep, cg));
                      return (
                        <tr key={ep.id} className="hover:bg-slate-900/60 transition-colors">
                          {/* Status */}
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border flex items-center gap-1.5 w-fit ${
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

                          {/* Computer Name */}
                          <td className="py-2.5 px-3 font-bold text-white font-sans text-xs">
                            {ep.hostname}
                          </td>

                          {/* Group Name */}
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[9.5px] font-bold border font-sans ${getBadgeColor(
                                  primaryGroup
                                )}`}
                              >
                                {primaryGroup}
                              </span>
                              {epCustomGroups.map((cg) => (
                                <span
                                  key={cg.id}
                                  className="px-1.5 py-0.5 rounded text-[8.5px] font-bold border font-sans uppercase tracking-wider bg-purple-500/20 text-purple-300 border-purple-500/40"
                                  title={`Matched Custom Group: ${cg.name}`}
                                >
                                  ✨ {cg.name}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Group Type */}
                          <td className="py-2.5 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800/80 border border-slate-700 text-slate-300">
                              Computers
                            </span>
                          </td>

                          {/* IP Address */}
                          <td className="py-2.5 px-3 text-slate-300">{ep.ip_address}</td>

                          {/* Logged In / Assigned User */}
                          <td className="py-2.5 px-3 text-sky-400 font-medium truncate max-w-xs font-sans">
                            {ep.logged_in_user || '—'}
                          </td>

                          {/* OS */}
                          <td className="py-2.5 px-3 text-slate-300 font-sans text-xs truncate max-w-xs">
                            {ep.os_name}
                          </td>

                          {/* Location */}
                          <td className="py-2.5 px-3 text-slate-400 font-sans">
                            {ep.remote_office || 'Main Campus'}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() =>
                                window.open(
                                  `https://endpointcentral.krea.edu.in:8383/inventory.do?action=showComputerDetails&resourceId=${ep.source_id}`,
                                  '_blank'
                                )
                              }
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase inline-flex items-center gap-1 font-sans transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" /> Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500 italic font-sans">
                        No computers found matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-950/40">
              <div>
                Showing <strong className="text-slate-200">{paginatedEndpoints.length}</strong> of{' '}
                <strong className="text-slate-200">{totalItems}</strong> assets
                {selectedGroup && (
                  <span>
                    {' '}in group <strong className="text-amber-300">{selectedGroup}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 px-2 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 border border-slate-800 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <span>
                  Page <strong className="text-slate-200">{currentPage}</strong> of{' '}
                  <strong className="text-slate-200">{totalPages}</strong>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 px-2 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 border border-slate-800 flex items-center gap-1"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE CUSTOM COMPUTER GROUP                       */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#0d1527] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-sans">
            {/* Header */}
            <div className="p-5 border-b border-slate-800/80 bg-gradient-to-r from-purple-900/30 to-blue-900/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Custom Computer Group</h3>
                  <p className="text-xs text-slate-400">Define dynamic matching criteria for workstations</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateGroupSubmit} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Group Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., AI Research Lab, Exam Kiosks, High GPU Desktops"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={newGroupCategory}
                    onChange={(e) => setNewGroupCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Custom Groups">Custom Groups</option>
                    <option value="Academic Labs">Academic Labs</option>
                    <option value="Classrooms & Venues">Classrooms & Venues</option>
                    <option value="Operating Systems">Operating Systems</option>
                    <option value="Security Policies">Security Policies</option>
                    <option value="Workstations & Servers">Workstations & Servers</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Theme Color
                  </label>
                  <select
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    <option value="violet">Violet / Purple</option>
                    <option value="blue">Electric Blue</option>
                    <option value="emerald">Emerald Green</option>
                    <option value="amber">Amber Gold</option>
                    <option value="cyan">Cyan Teal</option>
                    <option value="rose">Rose Red</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Operational purpose, department, or lab details..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Dynamic Matching Rule */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Dynamic Matching Rule
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Type: <span className="text-amber-400">Computers</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Rule Type
                    </label>
                    <select
                      value={newMatchType}
                      onChange={(e) => setNewMatchType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                    >
                      <option value="HOSTNAME_PREFIX">Hostname Starts With</option>
                      <option value="HOSTNAME_CONTAINS">Hostname Contains</option>
                      <option value="IP_PREFIX">IP Subnet Prefix</option>
                      <option value="OS_CONTAINS">Operating System Contains</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Match Pattern Value <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        newMatchType === 'HOSTNAME_PREFIX'
                          ? 'e.g., COM-, LAB-, JSW-'
                          : newMatchType === 'HOSTNAME_CONTAINS'
                          ? 'e.g., GPU, RESEARCH, MAC'
                          : newMatchType === 'IP_PREFIX'
                          ? 'e.g., 10.10.17., 192.168.10.'
                          : 'e.g., Ubuntu, Sonoma, Windows 11'
                      }
                      value={newMatchValue}
                      onChange={(e) => setNewMatchValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-600 focus:border-purple-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Real-Time Preview Badge */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400" /> Live Matching Preview:
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${
                      previewMatchCount > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {previewMatchCount} computer{previewMatchCount === 1 ? '' : 's'} match
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !newGroupName.trim() || !newMatchValue.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30 transition-all"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Creating Group...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" /> Save Custom Group
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
