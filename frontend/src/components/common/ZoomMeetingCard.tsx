import React from 'react';
import { Video, Clock, Users, MapPin, Radio, AlertCircle, Calendar, ExternalLink } from 'lucide-react';
import { ZoomMeetingsResponse, ZoomMeeting } from '../../types';

interface ZoomMeetingCardProps {
  data?: ZoomMeetingsResponse;
  isLoading?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export const ZoomMeetingCard: React.FC<ZoomMeetingCardProps> = ({
  data,
  isLoading,
  onClick,
  compact = false,
}) => {
  const liveCount = data?.live_count ?? 0;
  const upcomingCount = data?.upcoming_count ?? (data?.meetings?.filter((m) => m.status !== 'ended' && m.status !== 'started')?.length || 0);
  const totalCount = data?.total_count ?? (data?.meetings?.length || 0);
  const isStale = data?.is_stale;

  // Find next upcoming or currently live meeting
  const sortedMeetings = React.useMemo(() => {
    if (!data?.meetings) return [];
    return [...data.meetings].sort((a, b) => {
      // Prioritize in progress / live meetings first
      const aLive = a.is_live || a.status === 'started' || a.status === 'live';
      const bLive = b.is_live || b.status === 'started' || b.status === 'live';
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      const tA = (a.starts_at || a.start_time) ? new Date(a.starts_at || a.start_time!).getTime() : 0;
      const tB = (b.starts_at || b.start_time) ? new Date(b.starts_at || b.start_time!).getTime() : 0;
      return tA - tB;
    });
  }, [data?.meetings]);

  const spotlightMeeting = sortedMeetings[0];

  const formatMeetingTime = (timeStr?: string) => {
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

  const getRelativeTime = (meeting?: ZoomMeeting) => {
    if (!meeting) return '';
    if (meeting.is_live || meeting.status === 'started' || meeting.status === 'live' || (meeting.starts_in_minutes !== undefined && meeting.starts_in_minutes <= 0 && (meeting.ends_in_minutes || 0) > 0)) {
      return 'IN PROGRESS';
    }
    if (meeting.starts_in_minutes !== undefined && meeting.starts_in_minutes > 0) {
      if (meeting.starts_in_minutes < 60) return `in ${meeting.starts_in_minutes}m`;
      return `in ${(meeting.starts_in_minutes / 60).toFixed(1)}h`;
    }
    const timeStr = meeting.starts_at || meeting.start_time;
    if (!timeStr) return '';
    try {
      const diffMs = new Date(timeStr).getTime() - Date.now();
      if (diffMs <= 0) return 'IN PROGRESS';
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 60) return `in ${diffMins}m`;
      return `in ${(diffMins / 60).toFixed(1)}h`;
    } catch {
      return '';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`noc-card p-4 rounded-xl border-t-2 border-t-cyan-500 bg-[#0a101d] transition-all flex flex-col justify-between ${
        onClick ? 'cursor-pointer hover:border-cyan-500/70 hover:shadow-lg hover:shadow-cyan-950/40' : ''
      }`}
    >
      <div>
        {/* Header */}
        <div className="flex justify-between items-center text-slate-400 text-xs font-bold uppercase">
          <div className="flex items-center gap-1.5 truncate">
            <Video className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="truncate">Upcoming Zoom Meetings</span>
          </div>
          {isStale && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>DATA STALE</span>
            </span>
          )}
        </div>

        {/* Primary KPI & Counters */}
        <div className="flex items-baseline justify-between mt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">
              {isLoading ? '--' : upcomingCount}
            </span>
            <span className="text-xs font-medium text-slate-400 font-sans">
              Upcoming Today
            </span>
          </div>

          {liveCount > 0 ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {liveCount} LIVE
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
              0 Live
            </span>
          )}
        </div>

        {/* Secondary Spotlight Preview (Next Meeting) */}
        {!compact && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-xs">
            {spotlightMeeting ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] gap-2">
                  <span className="font-semibold text-slate-200 truncate flex-1" title={spotlightMeeting.topic || spotlightMeeting.title}>
                    {spotlightMeeting.topic || spotlightMeeting.title || 'Scheduled Meeting'}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 flex items-center gap-1 ${
                      spotlightMeeting.is_live || spotlightMeeting.status === 'started' || spotlightMeeting.status === 'live'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {spotlightMeeting.is_live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    {getRelativeTime(spotlightMeeting)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1 truncate max-w-[65%]">
                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{formatMeetingTime(spotlightMeeting.starts_at || spotlightMeeting.start_time)} IST</span>
                    {(spotlightMeeting.duration_minutes || spotlightMeeting.duration) && (
                      <span className="text-slate-500">({spotlightMeeting.duration_minutes || spotlightMeeting.duration}m)</span>
                    )}
                  </div>

                  {(spotlightMeeting.room || spotlightMeeting.classroom || spotlightMeeting.custom_fields?.class_room) && (
                    <div className="flex items-center gap-1 truncate text-slate-300">
                      <MapPin className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                      <span className="truncate">{spotlightMeeting.room || spotlightMeeting.classroom || spotlightMeeting.custom_fields?.class_room}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-1 text-slate-500 text-[11px] italic flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                <span>No more meetings scheduled today</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Strip */}
      <div className="mt-2 flex items-center justify-between text-xs font-mono border-t border-slate-800/80 pt-2">
        <span className="text-emerald-400 font-bold">{liveCount} In Session</span>
        <span className="text-cyan-400 font-bold">{upcomingCount} Queued</span>
        <span className="text-slate-400">{totalCount} Today</span>
      </div>
    </div>
  );
};
