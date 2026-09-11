import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Server,
  Wifi,
  Laptop,
  Fingerprint,
  MapPin,
  Bell,
  FileBarChart2,
  Layers,
  Settings,
  Users,
  Building2,
  X,
} from 'lucide-react';

interface Props {
  activeAlarmsCount?: number;
  activeIncidentsCount?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<Props> = ({
  activeAlarmsCount = 0,
  isOpen = false,
  onClose,
}) => {
  const navItems = [
    { label: 'Dashboard', to: '/noc', icon: LayoutDashboard, exact: true },
    { label: 'Network', to: '/noc/network', icon: Network },
    { label: 'Servers', to: '/noc/servers', icon: Server },
    { label: 'Wireless (APs)', to: '/noc/network?category=WIRELESS_AP', icon: Wifi },
    { label: 'Endpoints', to: '/noc/endpoints', icon: Laptop },
    { label: 'Biometric Devices', to: '/noc/biometrics', icon: Fingerprint },
    { label: 'VLAN Manager', to: '/noc/vlan', icon: Layers },
    {
      label: 'Alarms',
      to: '/noc/alarms',
      icon: Bell,
      badge: activeAlarmsCount > 0 ? activeAlarmsCount : 5,
    },
    { label: 'Reports', to: '/noc/reports', icon: FileBarChart2 },
    { label: 'Inventory', to: '/noc/firewall', icon: Layers },
    { label: 'User Management', to: '/noc/users', icon: Users },
    { label: 'Administration', to: '/noc/settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      <div>
        {/* Top Logo Brand in Sidebar */}
        <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://cdn.krea.edu.in/logo.png"
              alt="Krea Logo"
              className="h-7 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/krea-logo.png';
              }}
            />
            <div className="leading-none">
              <div className="font-black text-sm text-slate-100 tracking-wider">KREA</div>
              <div className="text-[8px] font-mono tracking-widest text-blue-400 uppercase font-bold mt-0.5">
                EDUCATION FOR LIFE
              </div>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 md:hidden transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="py-2.5 px-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-10rem)]">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/90'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shrink-0 ml-1">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer with University Emblem */}
      <div className="p-3 border-t border-slate-800/80 text-center">
        <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
          <Building2 className="w-5 h-5 text-slate-500" />
          <div className="text-[11px] font-bold text-slate-300">KREA University</div>
          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">IT Operations</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-52 bg-[#090e17] border-r border-slate-800/90 flex-col justify-between shrink-0 min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay and Sliding Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-out Drawer */}
          <aside className="relative z-50 w-64 max-w-[80vw] bg-[#090e17] border-r border-slate-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
