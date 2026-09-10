# KREA IT Operations / NOC Command Center — Task & Progress Tracker

## Project Overview
Production-grade on-premise IT Operations / NOC Command Center for KREA.
A continuous, multi-year operational command center monitoring ManageEngine OpManager, Endpoint Central, FortiGate, and Biometric Devices with TV displays, operator consoles, management overviews, 4-channel sound alerts, FortiGate VLAN Internet control with verification & rollback, audit logs, and ERP embedding.

---

## Acceptance Criteria Checklist (Section 86)

- [x] Docker Compose starts (`noc`, `db`, `nginx`)
- [x] Database initializes & migrations run cleanly
- [x] First admin can log in (environment bootstrap)
- [x] User management works (Create, Edit, Disable, Reset Password, Assign Role)
- [x] RBAC works (VIEWER, OPERATOR, NETWORK_OPERATOR, ADMINISTRATOR)
- [x] OpManager integration works (interface + real + mock)
- [x] Endpoint Central integration works (interface + real + mock)
- [x] FortiGate integration works (interface + real + mock)
- [x] Biometric devices appear (OpManager lite devices category)
- [x] Network devices appear (Switches, Routers, APs, Interfaces)
- [x] Server devices appear (CPU, Mem, Disk, Alarms)
- [x] Endpoint devices appear (Inventory, OS, Users, Scans)
- [x] Alarm dashboard works (CRITICAL, MAJOR, WARNING, INFO)
- [x] Incident dashboard works (Lifecycle: OPEN -> ACKNOWLEDGED -> INVESTIGATING -> RESOLVED -> CLOSED)
- [x] Drilldowns work (Slide-over drawers, deep links)
- [x] Global search works (Shortcut `/`, across devices, IPs, alarms, VLANs)
- [x] WebSocket works (`/api/ws`, real-time updates)
- [x] TV display works (`/display`, 16:9, dark theme, high contrast)
- [x] Screen rotation works (Configurable interval, pause/play)
- [x] Sound can be enabled (AudioContext unlock button)
- [x] Switch sound works
- [x] Server sound works
- [x] Biometric sound works
- [x] ILL sound works
- [x] Classroom sound remains disabled by default
- [x] Recovery sounds work (DOWN -> UP with downtime calculation)
- [x] Sound flood protection works (Grouping & suppression window)
- [x] Critical takeover works (TV fullscreen critical incident banner)
- [x] Display idle mode works (Low power UI after timeout)
- [x] Display wake works (Mouse, keyboard, touch, critical event)
- [x] Multiple displays work (Display ID tracking, admin overview)
- [x] Display heartbeat works (Status ONLINE, STALE, OFFLINE)
- [x] ERP embed route works (`/embed`, clean iframe layout)
- [x] JWT embed exchange works (Short-lived signed token exchange)
- [x] JWT expiration works
- [x] CORS restrictions work (Strict allowed origins)
- [x] CSP frame restrictions work (`frame-ancestors`)
- [x] postMessage origin validation works
- [x] No secrets are exposed to frontend
- [x] VLAN disable requires permission & reason
- [x] VLAN enable requires permission & reason
- [x] VLAN operations require confirmation
- [x] VLAN operations are verified against FortiGate
- [x] VLAN operations are audited
- [x] Rollback works (Restore previous state)
- [x] Failed actions do not show success
- [x] Reports work (Daily availability, MTTR, top problem devices)
- [x] Audit logs work (Immutable tracking)
- [x] Health endpoints work (`/health`, `/ready`, `/health/integrations`)
- [x] Integration failures do not crash application (Circuit breaker / cached state)
- [x] Mock mode works (`MOCK_MODE=true` realistic simulation)
- [x] Backup works (Documented `mysqldump` command)
- [x] Restore documentation exists

---

## Phase Breakdown

### Phase 1: Environment, Configuration & Database Architecture
- [x] Define `.env.example` with all configuration parameters.
- [x] Design comprehensive MySQL/MariaDB database schema with automated migration engine.
- [x] Create seed data: Roles, Permissions, Default Admin, Default Sound Profiles, Default Device Categories, Sites, Mock Datasets.

### Phase 2: Go Backend Modular Monolith Foundation
- [x] Setup `cmd/server/main.go` with graceful shutdown, context propagation, config loader.
- [x] Setup Database connector with connection pooling & ping healthchecks.
- [x] Setup Database migration runner executing embedded SQL migrations.
- [x] Setup structured logger (slog / custom structured JSON logger).
- [x] Setup RBAC & Authentication module (Argon2id/Bcrypt, Session tokens, HttpOnly cookies).
- [x] Setup Middleware: CORS, CSP/Secure Headers, Rate Limiting, Request ID, Auth, RBAC.
- [x] Setup Health check endpoints: `/health`, `/ready`, `/health/integrations`.

### Phase 3: Integrations & Collectors Architecture
- [x] Define Provider Interfaces: `NMSProvider`, `EndpointProvider`, `FirewallProvider`.
- [x] Implement OpManager Provider (Real client + Realistic Mock).
- [x] Implement Endpoint Central Provider (Real client + Realistic Mock).
- [x] Implement FortiGate Provider (Real client + Realistic Mock).
- [x] Build Background Collectors with jitter, backoff, retry, and circuit breaker.
- [x] Implement State Transition Detector (UP->DOWN, DOWN->UP, downtime calculation).
- [x] Implement Sound Event Generator with 4-channel mapping, flood protection & cooldowns.
- [x] Implement WebSocket Hub (`/api/ws`) for broadcasting real-time events.

### Phase 4: Core Operational Backend APIs
- [x] Dashboard summaries (`/api/dashboard/summary`, `/network`, `/servers`, `/endpoints`, `/biometrics`).
- [x] Device management & history (`/api/devices`, `/api/devices/:id`, `/history`).
- [x] Biometrics API with local metadata editing.
- [x] Alarms API (acknowledge, clear, list with filters).
- [x] Incidents API (create, acknowledge, assign, add notes, resolve).
- [x] FortiGate & VLAN Control API with 7-step execution pipeline, verification, rollback, and audit logging.
- [x] Audit Log API (read-only query with filters).
- [x] NOC Displays API (heartbeat, list, display settings).
- [x] Sound Settings API (get/update profiles, test sounds).
- [x] Users & Settings API (admin user management, system configs).
- [x] ERP Embed Session Exchange API (JWT validation, scope enforcement).

### Phase 5: React Frontend Architecture & Design System
- [x] Initialize Vite + React + TypeScript + Tailwind CSS project.
- [x] Build high-contrast Enterprise Dark NOC Design System (colors, badges, cards, buttons, drawers, modals, tables).
- [x] Setup React Router with layouts: Operator Layout, Display Layout, Management Layout, Embed Layout, Auth Layout.
- [x] Setup TanStack Query & Axios/Fetch client with automatic session handling.
- [x] Setup WebSocket client with auto-reconnection and event dispatching.
- [x] Setup Web Audio API Sound Alert Manager (synthesizer/tones + AudioContext unlock button + flood protection).

### Phase 6: Frontend Operational Modes & Views
- [x] Mode 1: NOC Display (`/display`) — 16:9 full-screen, rotating pages, large typography, sound status, critical takeover modal, recovery banner, idle mode, wake triggers.
- [x] Mode 2: IT Operator Console (`/noc`) — Sidebar, Global Search (`/`), Overview, Network, Servers, Endpoints, Biometrics, Alarms, Incidents, VLAN Control, Firewall, Reports, Audit, Users, Settings.
- [x] Mode 3: Management / CTO View (`/management`) — High-level SLA, MTTR, Availability gauges, 30-day trend lines.
- [x] Mode 4: ERP Embed (`/embed`) — Iframe-optimized view, postMessage communication, JWT exchange.
- [x] Rich Interactive Drawer for device drilldown with deep links to OpManager/Endpoint Central/FortiGate.
- [x] ECharts Integration for live traffic, bandwidth consumers, CPU/Memory gauges, availability charts.

### Phase 7: Deployment, Testing & Verification
- [x] Docker Compose setup (`noc`, `db`, `nginx`).
- [x] Nginx configuration with WebSocket upgrade, CSP `frame-ancestors`, security headers, static caching.
- [x] Multi-stage Dockerfiles for Go backend and React frontend.
- [x] Automated Backend Unit & Integration Tests (RBAC, State Transitions, Flood Protection, VLAN Pipeline, Verification, Rollback).
- [x] Backup and restore documentation and scripts.
- [x] Comprehensive README.md with operation guide.
