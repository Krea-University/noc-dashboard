import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Clock,
  Calendar,
  Users,
  MapPin,
  Radio,
  ExternalLink,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Shield,
  Layers,
  ArrowRight,
  Tv,
} from 'lucide-react';
import { api } from '../../api/client';
import { ZoomMeeting, ZoomMeetingsResponse } from '../../types';

export const ZoomMeetingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ALL' | 'IN_PROGRESS' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Zoom meetings for the next 48 hours (covers today & tomorrow)
  const {
    data: zoomResponse,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ZoomMeetingsResponse>({
    queryKey: ['zoom-meetings-full', 'hours-48'],
    queryFn: () => api.getZoomMeetings({ hours: 48 }),
    refetchInterval: 15000,
  });

  const meetings = useMemo(() => zoomResponse?.meetings || [], [zoomResponse]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to determine meeting state
  const isMeetingLive = (m: ZoomMeeting): boolean => {
    if (m.is_live) return true;
    if (m.status === 'started' || m.status === 'live') return true;
    if (m.starts_in_minutes !== undefined && m.ends_in_minutes !== undefined) {
      return m.starts_in_minutes <= 0 && m.ends_in_minutes > 0;
    }
    const start = m.starts_at || m.start_time;
    const end = m.ends_at || m.end_time;
    if (start && end) {
      const now = Date.now();
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      return now >= s && now <= e;
    }
    return false;
  };

  const isMeetingCompleted = (m: ZoomMeeting): boolean => {
    if (m.status === 'ended' || m.status === 'completed') return true;
    if (m.ends_in_minutes !== undefined && m.ends_in_minutes <= 0) return true;
    const end = m.ends_at || m.end_time;
    if (end) {
      return Date.now() > new Date(end).getTime();
    }
    return false;
  };

  const isMeetingUpcoming = (m: ZoomMeeting): boolean => {
    return !isMeetingLive(m) && !isMeetingCompleted(m);
  };

  // Categorize meetings
  const liveMeetings = useMemo(() => meetings.filter(isMeetingLive), [meetings]);
  const upcomingMeetings = useMemo(() => meetings.filter(isMeetingUpcoming), [meetings]);
  const completedMeetings = useMemo(() => meetings.filter(isMeetingCompleted), [meetings]);

  // Subdivide upcoming meetings into Today vs Tomorrow
  const { upcomingToday, upcomingTomorrow } = useMemo(() => {
    const today: ZoomMeeting[] = [];
    const tomorrow: ZoomMeeting[] = [];

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrowDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    upcomingMeetings.forEach((m) => {
      const timeStr = m.starts_at || m.start_time;
      if (!timeStr) {
        today.push(m);
        return;
      }
      try {
        const d = new Date(timeStr);
        const mDateStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (mDateStr === todayStr) {
          today.push(m);
        } else if (mDateStr === tomorrowStr) {
          tomorrow.push(m);
        } else {
          // If past or further out, include in appropriate bucket
          if (d < tomorrowDate) today.push(m);
          else tomorrow.push(m);
        }
      } catch {
        today.push(m);
      }
    });

    return { upcomingToday: today, upcomingTomorrow: tomorrow };
  }, [upcomingMeetings]);

  // Extract unique rooms for filtering
  const availableRooms = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach((m) => {
      const r = m.room || m.classroom || m.custom_fields?.class_room;
      if (r) set.add(r);
    });
    return Array.from(set).sort();
  }, [meetings]);

  // Filter meetings based on active tab, search, and room
  const displayedMeetings = useMemo(() => {
    let list: ZoomMeeting[] = [];
    if (activeTab === 'ALL') list = meetings;
    else if (activeTab === 'IN_PROGRESS') list = liveMeetings;
    else if (activeTab === 'UPCOMING') list = upcomingMeetings;
    else if (activeTab === 'COMPLETED') list = completedMeetings;

    return list.filter((m) => {
      // Room filter
      if (selectedRoom !== 'ALL') {
        const r = m.room || m.classroom || m.custom_fields?.class_room;
        if (r !== selectedRoom) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (m.title || m.topic || '').toLowerCase();
        const id = (m.zoom_meeting_id || m.meeting_id || '').toLowerCase();
        const room = (m.room || m.classroom || m.custom_fields?.class_room || '').toLowerCase();
        const host = (m.host_name || m.requester?.name || m.host_resource?.name || '').toLowerCase();
        const email = (m.host_email || m.requester?.email || m.host_resource?.email || '').toLowerCase();
        return (
          title.includes(q) ||
          id.includes(q) ||
          room.includes(q) ||
          host.includes(q) ||
          email.includes(q)
        );
      }

      return true;
    });
  }, [activeTab, meetings, liveMeetings, upcomingMeetings, completedMeetings, selectedRoom, searchQuery]);

  const formatTimeIST = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return timeStr;
    }
  };

  const formatDateIST = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-[1720px] mx-auto text-slate-200">
      {/* 1. TOP HEADER & TELEMETRY STATUS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
                Zoom Meetings & Pool Manager
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                LIVE POOL MONITOR
              </span>
              {zoomResponse?.is_stale && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  DATA STALE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous NOC telemetry feed displaying live, upcoming (till tomorrow), and completed sessions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/display')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm"
            title="Open NOC TV Wallboard View"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
            <span>TV Wallboard</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            title="Refresh Meetings Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. TOP METRIC CARDS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: In Progress */}
        <div
          onClick={() => setActiveTab('IN_PROGRESS')}
          className={`noc-card p-3.5 rounded-xl border-t-2 border-t-emerald-500 cursor-pointer transition-all ${
            activeTab === 'IN_PROGRESS' ? 'ring-2 ring-emerald-500/50 bg-[#0a141f]' : 'hover:border-emerald-500/60'
          }`}
        >
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
            <span>In Progress (Live)</span>
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
            <span>{liveMeetings.length}</span>
            <span className="text-xs text-slate-400 font-sans font-normal">Active Session</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-emerald-400 font-bold border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
            <span>Currently Happening</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
        </div>

        {/* Card 2: Upcoming (Till Tomorrow) */}
        <div
          onClick={() => setActiveTab('UPCOMING')}
          className={`noc-card p-3.5 rounded-xl border-t-2 border-t-cyan-500 cursor-pointer transition-all ${
            activeTab === 'UPCOMING' ? 'ring-2 ring-cyan-500/50 bg-[#0a141f]' : 'hover:border-cyan-500/60'
          }`}
        >
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
            <span>Upcoming (Till Tomorrow)</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
            <span>{upcomingMeetings.length}</span>
            <span className="text-xs text-slate-400 font-sans font-normal">Scheduled</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-cyan-400 font-bold border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
            <span>{upcomingToday.length} Today • {upcomingTomorrow.length} Tomorrow</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Card 3: Completed */}
        <div
          onClick={() => setActiveTab('COMPLETED')}
          className={`noc-card p-3.5 rounded-xl border-t-2 border-t-purple-500 cursor-pointer transition-all ${
            activeTab === 'COMPLETED' ? 'ring-2 ring-purple-500/50 bg-[#0a141f]' : 'hover:border-purple-500/60'
          }`}
        >
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
            <span>Completed Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
            <span>{completedMeetings.length}</span>
            <span className="text-xs text-slate-400 font-sans font-normal">Past Meetings</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-purple-400 font-bold border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
            <span>Archived from Active View</span>
            <span>History</span>
          </div>
        </div>

        {/* Card 4: Pool Status */}
        <div className="noc-card p-3.5 rounded-xl border-t-2 border-t-blue-500 flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
            <span>Total Pool Window</span>
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-white font-mono mt-1 flex items-baseline gap-2">
            <span>{meetings.length}</span>
            <span className="text-xs text-slate-400 font-sans font-normal">Total Sessions</span>
          </div>
          <div className="mt-2 text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-1.5 flex items-center justify-between">
            <span>NOC Token Verified</span>
            <span className="text-emerald-400 font-bold">200 OK</span>
          </div>
        </div>
      </div>

      {/* 3. TABS & SEARCH / FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All Meetings ({meetings.length})
          </button>

          <button
            onClick={() => setActiveTab('IN_PROGRESS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
              activeTab === 'IN_PROGRESS'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>In Progress ({liveMeetings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('UPCOMING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
              activeTab === 'UPCOMING'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-cyan-400 hover:bg-cyan-950/40 hover:text-cyan-300'
            }`}
          >
            Upcoming Till Tomorrow ({upcomingMeetings.length})
          </button>

          <button
            onClick={() => setActiveTab('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
              activeTab === 'COMPLETED'
                ? 'bg-purple-600 text-white shadow'
                : 'text-purple-400 hover:bg-purple-950/40 hover:text-purple-300'
            }`}
          >
            Completed ({completedMeetings.length})
          </button>
        </div>

        {/* Search & Room Filter */}
        <div className="flex items-center gap-2 shrink-0">
          {availableRooms.length > 0 && (
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Rooms ({availableRooms.length})</option>
              {availableRooms.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search meetings, rooms, hosts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* 4. ACTIVE MEETINGS LIST */}
      {isLoading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-mono">Synchronizing live Zoom pool meetings...</p>
        </div>
      ) : displayedMeetings.length > 0 ? (
        <div className="space-y-4">
          {/* Spotlight banner if in ALL or IN_PROGRESS and there are live meetings */}
          {activeTab !== 'COMPLETED' && liveMeetings.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/60 shadow-xl shadow-emerald-950/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black uppercase font-mono animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                  CURRENTLY HAPPENING NOW
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {liveMeetings.length} active meeting session in progress
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveMeetings.map((m, idx) => (
                  <div
                    key={m.id || m.public_id || idx}
                    className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/40 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-base font-bold text-white line-clamp-2">
                          {m.title || m.topic || 'In Progress Session'}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0 animate-pulse">
                          IN PROGRESS
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 mt-3">
                        <div className="flex items-center gap-2 text-slate-300 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            {formatTimeIST(m.starts_at || m.start_time)} - {formatTimeIST(m.ends_at || m.end_time)} IST
                          </span>
                        </div>

                        {(m.room || m.classroom || m.custom_fields?.class_room) && (
                          <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-slate-200">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="font-semibold truncate">
                              {m.room || m.classroom || m.custom_fields?.class_room}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 truncate">
                          <Users className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">
                            Host: <strong className="text-slate-200">{m.host_name || m.requester?.name || m.host_resource?.name || 'Administrator'}</strong>
                            {(m.host_email || m.requester?.email) && (
                              <span className="text-slate-500"> ({m.host_email || m.requester?.email})</span>
                            )}
                          </span>
                        </div>

                        {m.participant_count ? (
                          <span className="font-mono text-cyan-400 font-bold shrink-0">
                            {m.participant_count} Attendees
                          </span>
                        ) : null}
                      </div>

                      {m.ends_in_minutes !== undefined && (
                        <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <Radio className="w-3 h-3 animate-ping" />
                          <span>Started {Math.abs(m.starts_in_minutes || 0)}m ago • Ends in {m.ends_in_minutes}m</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span>ID: <strong className="text-cyan-300">{m.zoom_meeting_id || m.meeting_id}</strong></span>
                        {m.passcode && (
                          <span>Pass: <strong className="text-slate-200">{m.passcode}</strong></span>
                        )}
                      </div>

                      {m.join_url && (
                        <a
                          href={m.join_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/40"
                        >
                          <span>Join Meeting</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid of All Displayed Meetings */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {displayedMeetings.map((m, idx) => {
              const live = isMeetingLive(m);
              const completed = isMeetingCompleted(m);
              const copyKey = `id-${m.id || idx}`;

              return (
                <div
                  key={m.id || m.public_id || idx}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    live
                      ? 'bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-950/30'
                      : completed
                      ? 'bg-slate-900/40 border-slate-800 opacity-75'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-100 line-clamp-2" title={m.title || m.topic}>
                        {m.title || m.topic || 'Scheduled Meeting'}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono tracking-wider shrink-0 ${
                          live
                            ? 'bg-emerald-500 text-slate-950 animate-pulse'
                            : completed
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {live ? 'IN PROGRESS' : completed ? 'COMPLETED' : 'UPCOMING'}
                      </span>
                    </div>

                    {/* Schedule / Time Slot */}
                    <div className="space-y-2 text-xs text-slate-300 mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-850">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-bold text-slate-100">
                            {formatTimeIST(m.starts_at || m.start_time)} - {formatTimeIST(m.ends_at || m.end_time)} IST
                          </span>
                        </div>
                        <span className="text-slate-400">
                          {formatDateIST(m.starts_at || m.start_time)}
                        </span>
                      </div>

                      {/* Location / Room */}
                      {(m.room || m.classroom || m.custom_fields?.class_room) && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-semibold truncate">
                            {m.room || m.classroom || m.custom_fields?.class_room}
                          </span>
                        </div>
                      )}

                      {/* Host */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                        <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">
                          Host: <strong className="text-slate-200">{m.host_name || m.requester?.name || m.host_resource?.name || 'Administrator'}</strong>
                          {(m.host_email || m.requester?.email) && (
                            <span className="text-slate-500"> ({m.host_email || m.requester?.email})</span>
                          )}
                        </span>
                      </div>

                      {/* Status / Timing Details */}
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                        <span>
                          Duration: <strong className="text-slate-300">{m.duration_minutes || m.duration || 60}m</strong>
                        </span>
                        {live ? (
                          <span className="text-emerald-400 font-bold">Ends in {m.ends_in_minutes || 0}m</span>
                        ) : completed ? (
                          <span className="text-slate-500">Finished</span>
                        ) : m.starts_in_minutes !== undefined && m.starts_in_minutes > 0 ? (
                          <span className="text-cyan-400 font-bold">
                            Starts in {m.starts_in_minutes < 60 ? `${m.starts_in_minutes}m` : `${(m.starts_in_minutes / 60).toFixed(1)}h`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Footer Strip */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">
                        ID: <strong className="text-slate-200">{m.zoom_meeting_id || m.meeting_id || '--'}</strong>
                      </span>
                      {m.zoom_meeting_id && (
                        <button
                          onClick={() => copyToClipboard(m.zoom_meeting_id!, copyKey)}
                          className="text-slate-500 hover:text-slate-300 p-0.5 rounded"
                          title="Copy Meeting ID"
                        >
                          {copiedId === copyKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {m.join_url ? (
                      <a
                        href={m.join_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 font-sans text-xs font-bold transition ${
                          live
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-cyan-400 hover:text-cyan-300'
                        }`}
                      >
                        <span>{live ? 'Join Live' : 'Open Link'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Pool Protected</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-16 rounded-xl bg-slate-900/40 border border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-200">
            {activeTab === 'IN_PROGRESS'
              ? 'No Meetings In Progress'
              : activeTab === 'UPCOMING'
              ? 'No Upcoming Meetings Scheduled'
              : activeTab === 'COMPLETED'
              ? 'No Completed Meetings Recorded'
              : 'No Zoom Meetings Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            {activeTab === 'IN_PROGRESS'
              ? 'There are currently no meetings running live in the KREA Zoom pool. When a meeting goes live, it will appear here with instant join links.'
              : activeTab === 'UPCOMING'
              ? 'There are no upcoming meetings scheduled for today or tomorrow. New bookings will automatically synchronize.'
              : activeTab === 'COMPLETED'
              ? 'No completed sessions exist in the current 48-hour monitoring window.'
              : 'No meetings matched your search criteria or room filter.'}
          </p>
        </div>
      )}
    </div>
  );
};
