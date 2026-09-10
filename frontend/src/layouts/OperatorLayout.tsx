import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { OperatorHeader } from '../components/layout/OperatorHeader';
import { Sidebar } from '../components/layout/Sidebar';
import { GlobalSearchModal } from '../components/common/GlobalSearchModal';
import { DeviceDrawer } from '../components/common/DeviceDrawer';
import { useNocWebSocket } from '../websocket/useNocWebSocket';
import { api } from '../api/client';
import { Device } from '../types';

export const OperatorLayout: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Initialize real-time WebSocket connection
  useNocWebSocket();

  // Global '/' keyboard listener to open search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    staleTime: 60000,
  });

  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: api.getSummary,
    refetchInterval: 15000,
  });

  const user = meData?.user || null;

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col">
      <OperatorHeader
        user={user}
        onOpenSearch={() => setIsSearchOpen(true)}
        integrations={summary?.integrations_health}
        activeCriticalAlarms={summary?.active_critical_alarms}
        dataFreshness={summary?.data_freshness}
      />

      <div className="flex flex-1">
        <Sidebar
          activeAlarmsCount={summary?.active_critical_alarms}
          activeIncidentsCount={summary?.active_incidents}
        />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectDevice={(dev) => setSelectedDevice(dev)}
      />

      <DeviceDrawer
        device={selectedDevice}
        isOpen={selectedDevice !== null}
        onClose={() => setSelectedDevice(null)}
      />
    </div>
  );
};
