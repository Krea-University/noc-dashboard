import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export function App() {
  return (
    <Routes>
      {/* Public / Auth */}
      <Route path="/login" element={<LoginPage />} />

      {/* Mode 1: NOC TV Wall Display */}
      <Route path="/display" element={<DisplayPage />} />

      {/* Mode 3: Executive Management / CTO Dashboard */}
      <Route path="/management" element={<ManagementPage />} />

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
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/noc" replace />} />
      <Route path="*" element={<Navigate to="/noc" replace />} />
    </Routes>
  );
}
