import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX, AlertTriangle, Search, User as UserIcon, LogOut, RefreshCw, Radio, Tv, Menu, Users, Shield } from 'lucide-react';
import { soundManager } from '../../sound/SoundManager';
import { SoundUnlockModal } from '../common/SoundUnlockModal';
import { ThemeToggle } from '../common/ThemeToggle';
import { api } from '../../api/client';
import { User, Integration } from '../../types';

interface Props {
  user: User | null;
  onOpenSearch: () => void;
  onToggleMobileNav?: () => void;
  integrations?: Integration[];
  activeCriticalAlarms?: number;
  dataFreshness?: string;
}

export const OperatorHeader: React.FC<Props> = ({
  user,
  onOpenSearch,
  onToggleMobileNav,
  integrations = [],
  activeCriticalAlarms = 0,
  dataFreshness = 'LIVE',
}) => {
  const navigate = useNavigate();
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [soundModalOpen, setSoundModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(soundManager.isAudioUnlocked());
  const [isSoundActive, setIsSoundActive] = useState(soundManager.isSoundEnabled());

  useEffect(() => {
    return soundManager.subscribe((unlocked, enabled) => {
      setIsAudioUnlocked(unlocked);
      setIsSoundActive(enabled);
    });
  }, []);

  // Live Asia/Kolkata Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDateStr(
        now.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
    };
    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const [autoRefresh, setAutoRefresh] = useState(true);

  return (
    <header className="h-14 border-b border-slate-800/90 bg-[#090e17] px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Brand Title, Hamburger on Mobile & Subtitle */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 md:hidden transition-colors shrink-0"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="font-extrabold text-xs sm:text-sm tracking-wide text-slate-100 flex items-center gap-1.5 truncate">
              <span className="shrink-0">KREA IT NOC</span>
              <span className="text-slate-500 font-normal hidden md:inline">—</span>
              <span className="text-slate-300 font-semibold hidden md:inline truncate">Infrastructure Command Center</span>
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wider font-medium hidden lg:block truncate">
            Monitor • Detect • Respond • Keep KREA Connected
          </p>
        </div>

        {/* Status Pill in Center/Left */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
          <div className="flex items-center gap-1.5 leading-none">
            <strong className="text-[11px] font-bold tracking-wide uppercase">SYSTEMS OPERATIONAL</strong>
            <span className="text-[10px] text-emerald-400/80 font-normal">All critical services running</span>
          </div>
        </div>
      </div>

      {/* Right: Last Updated, Auto Refresh, Search, Notifications, Settings, Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Last Updated */}
        <div className="hidden 2xl:block text-right text-[11px] leading-tight">
          <span className="text-slate-500 block text-[9px] uppercase font-mono">Last Updated</span>
          <span className="font-mono text-slate-300 font-medium">{dateStr} {timeStr}</span>
        </div>

        {/* Auto Refresh Toggle */}
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-800/80">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Auto Refresh</div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
              autoRefresh ? 'bg-blue-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                autoRefresh ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-[11px] font-mono text-slate-300">60s</span>
        </div>

        {/* Mobile Search Icon Button (< sm) */}
        <button
          onClick={onOpenSearch}
          title="Search (Press /)"
          className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <Search className="w-4 h-4 text-slate-400" />
        </button>

        {/* Desktop Search Bar (>= sm) */}
        <div className="hidden sm:block relative w-36 md:w-48 lg:w-60">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            onClick={onOpenSearch}
            readOnly
            placeholder="Search devices, IPs... (/)"
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 cursor-pointer shadow-inner truncate"
          />
        </div>

        {/* Notification Bell with Badge */}
        <button
          onClick={() => navigate('/noc/alarms')}
          title="Active Alarms"
          className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          {activeCriticalAlarms > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-[0_0_6px_#ef4444]">
              {activeCriticalAlarms > 99 ? '99+' : activeCriticalAlarms}
            </span>
          )}
        </button>

        {/* Sound Toggle Icon */}
        <button
          onClick={() => setSoundModalOpen(true)}
          title="Audio Settings"
          className={`p-1.5 rounded-lg transition-colors ${
            !isAudioUnlocked
              ? 'text-amber-400 hover:bg-amber-500/20 animate-pulse'
              : isSoundActive
              ? 'text-emerald-400 hover:bg-emerald-500/20'
              : 'text-slate-400 hover:bg-slate-800'
          }`}
        >
          {isSoundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Theme Toggle (Light/Dark) */}
        <ThemeToggle />

        {/* Settings Navigation */}
        <button
          onClick={() => navigate('/noc/settings')}
          title="Administration Settings"
          className="hidden sm:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* User Initials Avatar & Menu */}
        <div className="relative flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-slate-800/80">
          <button
            type="button"
            title={`Logged in as ${user?.username || 'admin'}`}
            className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center shadow-xs cursor-pointer hover:border-blue-400 hover:bg-blue-600/30 transition-colors"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-10 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-800">
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 truncate">
                  <UserIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{user?.username || 'Administrator'}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  {user?.email || 'admin@krea.edu.in'}
                </div>
                <div className="mt-1.5">
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold text-[9px] uppercase tracking-wider">
                    {user?.role_name || 'ADMINISTRATOR'}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/noc/users');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>User Management</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/noc/settings');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>System Settings</span>
                </button>
              </div>

              <div className="pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <SoundUnlockModal isOpen={soundModalOpen} onClose={() => setSoundModalOpen(false)} />
    </header>
  );
};
