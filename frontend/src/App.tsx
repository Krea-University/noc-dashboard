import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './api/client';
import { LoginPage } from './pages/auth/LoginPage';
import { DisplayPage } from './pages/display/DisplayPage';
import { ManagementPage } from './pages/management/ManagementPage';
import { EmbedPage } from './pages/embed/EmbedPage';
import { OperatorLayout } from './layouts/OperatorLayout';

import { OverviewPage } from './pages/noc/OverviewPage';
import { NetworkPage } from './pages/noc/NetworkPage';
import { ServersPage } from './pages/noc/ServersPage';
import { EndpointsPage } from './pages/noc/EndpointsPage';
import { BiometricsPage } from './pages/noc/BiometricsPage';
import { AlarmsPage } from './pages/noc/AlarmsPage';
import { IncidentsPage } from './pages/noc/IncidentsPage';
import { VlanControlPage } from './pages/noc/VlanControlPage';
import { FirewallPage } from './pages/noc/FirewallPage';
import { ReportsPage } from './pages/noc/ReportsPage';
import { AuditPage } from './pages/noc/AuditPage';
import { UsersPage } from './pages/noc/UsersPage';
import { SettingsPage } from './pages/noc/SettingsPage';
import { SyncPage } from './pages/noc/SyncPage';
import { AuthGuard } from './components/auth/AuthGuard';

const RootRoute: React.FC = () => {
  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    staleTime: 30000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#06090e] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (meData?.user) {
    return <Navigate to="/noc" replace />;
  }

  return <Navigate to="/login" replace />;
};

export function App() {
  return (
    <Routes>
      {/* Public / Auth */}
      <Route path="/login" element={<LoginPage />} />

      {/* Mode 1: NOC TV Wall Display (Protected - redirects unauthenticated users to login) */}
      <Route
        path="/display"
        element={
          <AuthGuard>
            <DisplayPage />
          </AuthGuard>
        }
      />

      {/* Mode 3: Executive Management / CTO Dashboard (Protected) */}
      <Route
        path="/management"
        element={
          <AuthGuard>
            <ManagementPage />
          </AuthGuard>
        }
      />

      {/* Mode 4: Flutter ERP Iframe Embed */}
      <Route path="/embed" element={<EmbedPage />} />

      {/* Mode 2: IT Operator Console */}
      <Route path="/noc" element={<OperatorLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="network" element={<NetworkPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="endpoints" element={<EndpointsPage />} />
        <Route path="biometrics" element={<BiometricsPage />} />
        <Route path="alarms" element={<AlarmsPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="vlan" element={<VlanControlPage />} />
        <Route path="firewall" element={<FirewallPage />} />
        <Route path="sync" element={<SyncPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Default Route */}
      <Route path="/" element={<RootRoute />} />
      <Route path="*" element={<RootRoute />} />
    </Routes>
  );
}
