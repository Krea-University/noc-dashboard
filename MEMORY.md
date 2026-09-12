# KREA IT Operations Command Center — Architectural Memory & System Guide (MEMORY.md)

## 1. Executive Summary & Vision
- **System Name**: KREA IT Operations Command Center (KREA IT NOC)
- **Organization**: KREA University, Sri City Campus
- **Audience**: KREA University IT Operations Team, NOC Wall Displays, Management / CTO, and embedded iframe view within the KREA Flutter ERP.
- **Mission**: Mission-critical on-premise IT & Network Operations Command Center designed to operate 24/7/365 continuously without reboots, manual resets, or memory leaks. Zero toy code, zero fake buttons, zero pseudo-implementations.
- **Architectural Pattern**: Modular Monolith — Go backend + React 19 / TypeScript frontend + MariaDB/MySQL database + Nginx reverse proxy.

---

## 2. Core Architectural Constraints
1. **No direct browser calls to external systems**: The browser NEVER communicates directly with ManageEngine OpManager, Endpoint Central, or FortiGate. All credentials remain secure inside the Go backend.
2. **Prohibited Dependencies**: No Kubernetes, Kafka, Redis, Elasticsearch, GraphQL, or distributed microservices. The architecture is intentionally lean, resilient, and maintainable by a single on-premise IT engineer.
3. **Single Source of Truth (`.env`)**: All environment-specific variables are defined in one `.env` file. Secrets are never exposed to Vite or client bundles.
4. **Fault Tolerance & Resilience**: Integration API failures must NEVER crash the server. Circuit breakers, exponential retry backoff, and last-known-good state caching guarantee continuous dashboard operation. If an external API is unreachable, the UI clearly displays `DATA STALE`.
5. **Real-time Delta Distribution**: External systems are polled asynchronously by background Go workers (`CollectorManager`). State transitions and metrics are broadcast over WebSockets (`/api/ws`). Browsers never poll external enterprise systems.
6. **Production Data Integrity**: When running in Production mode (`APP_ENV=production`, `MOCK_MODE=false`), the application automatically sweeps and purges any legacy mock or seeded operational data on startup (`db.PurgeSeedData()`), ensuring all devices, alarms, endpoints, and audit logs are 100% authentic live data.

---

## 3. Technology Stack

### Backend
- **Language & Runtime**: Go (Go 1.24 / 1.26+)
- **HTTP Routing**: `net/http` with `chi` router (`v5`)
- **Database Access**: Native `database/sql` with `go-sql-driver/mysql` and `modernc.org/sqlite` (dual-driver support for zero-dependency local dev or production MySQL/MariaDB)
- **WebSockets**: `gorilla/websocket` with thread-safe hub and broadcast channel
- **Logging**: Structured logging using native Go `log/slog`
- **Security & Passwords**: `golang.org/x/crypto/bcrypt` (cost 12)
- **Migrations**: Native embedded SQL migration engine (`RunMigrations`) with automatic schema version tracking in `schema_migrations` table

### Frontend
- **Framework**: React 19 with Vite
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS with dark palette (`#06090e`, `#080d17`, `#0a101d`)
- **Icons**: Lucide React
- **Routing**: React Router v6
- **Server State & Caching**: TanStack Query (React Query v5)
- **Data Visualizations**: Apache ECharts (`echarts-for-react`)
- **Sound Alerts**: Web Audio API with synthesis fallbacks and browser autoplay unlock handling

### Database
- **Engine**: MariaDB 11 or MySQL 8.0 with InnoDB
- **Charset & Collation**: UTF-8 MB4 (`utf8mb4_unicode_ci`)
- **Time Handling**: Stored in UTC, presented across all user interfaces in `Asia/Kolkata` (IST, UTC+05:30)

---

## 4. Live Integrations & Verified Credentials

| System | Role | URL | Auth Mechanism | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| **ManageEngine OpManager** | Switches, Routers, Servers, Biometrics, Alarms | `https://nms.krea.edu.in` | API Key (`85eb500a1fee0a071a96b66f4a3559a4`) | Active |
| **ManageEngine Endpoint Central** | Workstations, Laptops, OS & Security Patch Telemetry | `https://endpointcentral.krea.edu.in:8383` | API Key (`9D1A8504-33DB-445E-ADDD-0832D5932837`) | Active |
| **FortiGate 600F Firewall** | SD-WAN WAN Links, VLAN Policies, Throughput | `https://sc-firewall.krea.edu.in:5551` | REST API Token (`r3kr50qtjww0n4k8Ny6wbNzs5bkghH`) | **100% Verified Live** |

### FortiOS Administrator Profile (`NOC_Monitor_Profile`)
Configured on **`KREA-UNIV-FW`** (FortiGate 600F, FortiOS `v7.4.11`, build 2878):
- `fwgrp custom`:
  - `policy`: **`read-write`** (enables 12-step VLAN Internet Control Pipeline and policy audit comments)
  - `address`, `service`, `schedule`, `others`: `read`
- `netgrp custom`:
  - `cfg`: `read` (live interface throughput, bandwidth)
  - `packet-capture`: `read`
  - `route-cfg`: `read-write`
- `sysgrp`, `loggrp`, `ftviewgrp`, `secfabgrp`, `authgrp`, `utmgrp`, `wifi`: `read`
- `admintimeout-override enable`, `admintimeout 0` (zero session timeout disconnects)

---

## 5. Core Pipelines & Workflows

### A. FortiGate 12-Step VLAN Internet Control Pipeline
Treats all network modifications as **HIGH RISK**. Never flips a firewall rule without positive verification.
1. **Authenticate User**: Verify active session cookie.
2. **Check Granular Permission**: Verify `vlan.internet.disable` or `vlan.internet.enable` + check JWT scope is NOT restricted to `noc:view`.
3. **Validate Target VLAN**: Verify existence and current internet state in `vlans` table.
4. **Fetch Current State**: Query live FortiGate firewall policy (`GET /api/v2/cmdb/firewall/policy/{id}`).
5. **Calculate & Present Impact**: Display affected endpoints, access points, and classrooms.
6. **Require Justification Reason**: Non-empty operational string mandatory.
7. **Require Explicit Confirmation**: Double-check confirmation modal with typed action name.
8. **Create Action Job**: Insert record in `action_jobs` (`QUEUED` state, capturing `previous_state_json`).
9. **Transition & Execute**: Move to `VALIDATING` -> `EXECUTING` via FortiGate Provider (`PUT /api/v2/cmdb/firewall/policy/{id}` with `status: enable/disable` and comment `"Updated via KREA NOC: <reason>"`).
10. **Mandatory Post-Execution Verification**: Move to `VERIFYING` -> query live FortiGate rule status. Never mark `SUCCESS` without positive verification.
11. **Update Local State & DB**: If verified, mark `SUCCESS` and update `vlans.internet_status`; otherwise mark `FAILED` and prompt rollback.
12. **Audit & Broadcast**: Write immutable record to `audit_logs` (capturing timestamp, username, role, client IP, previous/new state, reason) and broadcast `ACTION_COMPLETED` & `VLAN_UPDATED` over WebSockets.

### B. Four-Channel Sound Alert System & Flood Protection
Audio triggers ONLY on state transitions (`UP -> DOWN` plays alert sound, `DOWN -> UP` plays recovery sound). Steady states produce zero sound.
- **Channels**:
  1. `SWITCH`: Core backbones, network switches (volume 80%, cooldown 30s)
  2. `SERVER`: Compute servers, hypervisors, ERP databases (volume 80%, cooldown 30s)
  3. `BIOMETRIC`: Campus attendance devices (volume 75%, cooldown 30s)
  4. `ILL`: Internet Leased Line backbones (Railtel, Airtel, BSNL) (volume 80%, cooldown 30s)
  5. `CLASSROOM`: Explicitly **MUTED** by default (`enabled=false`).
- **Flood Protection Rule**: If 40 switches fail simultaneously (e.g. upstream core switch power trip), the system suppresses 40 overlapping alerts. It triggers a single audio alert within the cooldown window, groups the affected devices, and presents a consolidated "Network Outage: 40 Switches Affected" banner.
- **Browser Autoplay Unlock**: Floating "ENABLE SOUND" badge initializes `AudioContext` upon user interaction and saves preference in `localStorage`.

### C. ERP Embed & JWT Security (`/embed`)
- Embeds NOC views inside the KREA Flutter ERP via iframe.
- **Security Controls**:
  - `Content-Security-Policy`: `frame-ancestors 'self' https://erp.krea.edu.in;` (configured via `NOC_EMBED_ALLOWED_ORIGINS`).
  - **No Hardcoded Tokens**: Exchange endpoint `/api/embed/session` verifies short-lived signed JWT (iss, aud=krea-noc, exp <= 5m, scope=noc:view) and sets an HttpOnly SameSite cookie.
  - **Scoped Access**: `noc:view` allows monitoring only. Network actions strictly require `noc:network_control` AND RBAC permission.

---

## 6. Display Modes

### Mode 1: NOC TV Display (`/display`)
- Optimized for 1080p and 4K wall displays running 24/7.
- High-contrast dark palette, large KPI typography, zero unnecessary scrollbars.
- **Auto-Rotation**: Rotates between Overall -> Network -> Servers -> Endpoints -> Biometrics -> Incidents (configurable, default 30s). Pausable via header controls.
- **Critical Outage Takeover**: Fullscreen high-priority alert overlaying device name, location, downstream switch impact, and detected time. Auto-reverts after configured timeout.
- **Device Recovery Banner**: Top green banner indicating restored device and calculated downtime duration.
- **No Sleep Mode (Stay Awake 24/7)**: Uses Screen Wake Lock API and disables 30m idle screensaver by default.
- **Responsive Layout**: `2xl:flex-nowrap` layout keeps Brand, Tabs, and Clock on a single line on wall displays, wrapping gracefully into two clean rows on laptop/tablet screens with `shrink-0 whitespace-nowrap` on the Asia/Kolkata clock.

### Mode 2: IT Operator Console (`/noc`)
- Full operational interface with Sidebar, Hamburger navigation for mobile, Global Search (`/`), live ECharts, device inspection drawers, alarm acknowledgment, incident management, FortiGate VLAN control, user management, and audit logs.

### Mode 3: Management / CTO View (`/management`)
- Executive dashboard: Overall availability %, 30-day uptime trends, MTTR, SLAs, top recurring problem devices, and site health breakdown.

---

## 7. Reports Module (`/noc/reports`)

The Reports module provides 3 audit views with CSV export and print capabilities:
1. **Custom Network LLP Report**: Link Load Performance across Railtel Primary (3 Gbps), Airtel Secondary (1.2 Gbps), and BSNL Backup (500 Mbps). Shows peak, average, and p95 throughput, utilization %, latency, and packet loss.
2. **Campus SLA & Availability**: 30-day availability compliance %, category breakdown, and top problem devices with recurrence counts and remediation recommendations.
3. **VLAN Internet Control Logs**:
   - Complete audit trail of all FortiGate VLAN internet disable and enable actions.
   - Captures: Asia/Kolkata Timestamp, Action (`DISABLED` / `ENABLED`), Target VLAN & Subnet, FortiGate Policy ID, Operator Username, Operator Role, Client IP Address, Result (`SUCCESS` / `FAILED`), FortiGate Verification (`✓ Verified on FortiGate`), and Operational Justification Reason.
   - Features: 5 KPI metric cards, action filter, time range filter (`24H`, `7D`, `30D`, `ALL TIME`), multi-field search, and formatted CSV export.

---

## 8. Role-Based Access Control (RBAC)

| Role | Description | Key Permissions |
| :--- | :--- | :--- |
| **`VIEWER`** | Read-only access across all monitoring modules | `dashboard.view`, `devices.view`, `alarms.view`, `incidents.view`, `vlan.view`, `fortigate.view`, `reports.view`, `audit.view` |
| **`OPERATOR`** | Operations team member | Viewer + `alarms.acknowledge`, `incidents.manage`, `devices.edit_metadata` |
| **`NETWORK_OPERATOR`** | Network & Firewall administrator | Operator + `vlan.internet.disable`, `vlan.internet.enable`, `fortigate.manage` |
| **`ADMINISTRATOR`** | Full system superuser | All permissions + `users.manage`, `settings.manage`, `displays.manage` |

---

## 9. Directory Structure & Key Files

```
c:\Development\NOC_ANTI\
├── .env                              # Production environment configuration (gitignored)
├── .env.example                      # Template environment file
├── docker-compose.yml                # Production multi-container composition (noc, db, nginx)
├── Task.md                           # Specification & execution checklist
├── GEMINI.md                         # Architectural Memory & Constraints
├── MEMORY.md                         # Complete System Guide & Architectural Memory
├── backend/
│   ├── cmd/server/main.go            # Application entrypoint, bootstrap, and production seed purge
│   ├── migrations/                   # Embedded SQL migrations (001 to 009)
│   └── internal/
│       ├── api/router.go             # Chi HTTP router, all REST endpoints, and WebSocket handler
│       ├── audit/audit.go            # Immutable audit logging service
│       ├── auth/auth.go              # Authentication, session cookies, bcrypt hashing, bootstrap admin
│       ├── automation/vlan_pipeline.go # 12-step FortiGate VLAN Internet Control Pipeline
│       ├── collectors/collector.go   # Background polling workers (OpManager, Endpoint Central, FortiGate)
│       ├── config/config.go          # Single .env configuration loader with mode defaults
│       ├── database/database.go      # Dual-driver DB wrapper, migration runner, and PurgeSeedData
│       ├── displays/displays.go      # NOC display heartbeat and monitor service
│       ├── events/events.go          # Event correlation engine and sound dispatch
│       ├── integrations/             # External integration clients & providers
│       │   ├── opmanager/            # ManageEngine OpManager REST client + mock provider
│       │   ├── endpointcentral/      # ManageEngine Endpoint Central client + mock provider
│       │   └── fortigate/            # FortiOS REST API client + mock provider
│       ├── models/models.go          # Core domain models and DTOs
│       ├── rbac/rbac.go              # Fine-grained permission checks and auth middleware
│       ├── sound/sound.go            # 4-channel sound profile manager and flood protection
│       └── websocket/hub.go          # Real-time WebSocket hub broadcasting delta events
└── frontend/
    ├── src/
    │   ├── api/client.ts             # Typed API client functions
    │   ├── types/index.ts            # TypeScript interface definitions
    │   ├── components/               # Reusable UI components (Modals, Drawers, Layouts, Charts)
    │   └── pages/
    │       ├── display/DisplayPage.tsx # NOC TV Wall Display (Mode 1)
    │       ├── noc/                  # IT Operator Console Pages (Mode 2)
    │       │   ├── OverviewPage.tsx
    │       │   ├── NetworkPage.tsx
    │       │   ├── ServersPage.tsx
    │       │   ├── EndpointsPage.tsx
    │       │   ├── BiometricsPage.tsx
    │       │   ├── FirewallPage.tsx
    │       │   ├── VlanControlPage.tsx # VLAN Manager
    │       │   ├── ReportsPage.tsx     # LLP, SLA & VLAN Internet Control Logs
    │       │   ├── AuditPage.tsx
    │       │   ├── UsersPage.tsx
    │       │   └── SettingsPage.tsx
    │       └── management/ManagementPage.tsx # Executive Management View (Mode 3)
```

---

## 10. Operations & Running Guide

### Standalone Local / Development Run
```powershell
# Backend (from backend directory)
cd backend
go run ./cmd/server

# Frontend (from frontend directory)
cd frontend
npm run dev
```

### Building for Production
```powershell
# Backend binary compilation
cd backend
go build -o noc-server.exe ./cmd/server

# Frontend production build
cd frontend
npm run build
```

### Verifying Tests
```powershell
cd backend
go test ./...
```

---

## 11. Security, Bot Protection & Single Sign-On

### Cloudflare Turnstile Integration (Canonical Existing-Widget Flow)
- **Site Key**: `0x4AAAAAAExldpVxn_Cfx4o7`
- **Secret Key**: `0x4AAAAAAExldgkxpZiriTiET5EUmmzQmQg` (configured in `.env`)
- **Flow**:
  1. Frontend embeds explicit Turnstile widget via `GET /api/auth/config`.
  2. Frontend sends `turnstile_token` with login request.
  3. Backend calls `VerifyTurnstileToken` (`https://challenges.cloudflare.com/turnstile/v0/siteverify`).
  4. Single-use token lifecycle: On failed login attempts, `window.turnstile.reset(widgetId)` resets the challenge to allow retries.

### Google Sign-In (Latest Google Identity Services — GIS)
- **Script**: `https://accounts.google.com/gsi/client`
- **Config**: `GOOGLE_CLIENT_ID` in `.env`
- **Verification**: `POST /api/auth/google` verifies against `https://oauth2.googleapis.com/tokeninfo`.
- **Institutional Access Rule**:
  - Existing DB users retain their designated roles (`ADMINISTRATOR`, `OPERATOR`, etc.).
  - New users with `@krea.edu.in` accounts are auto-provisioned as `VIEWER` (read-only monitoring).
  - External accounts not in the DB are strictly rejected with HTTP 403 Forbidden.

### Cloudflare Tunnel Support
- **Visitor IP Detection**: `CloudflareRealIP` middleware checks `CF-Connecting-IP`, `True-Client-IP`, `X-Forwarded-For` (first IP) and assigns it to `r.RemoteAddr`.
- **Dynamic Secure Cookies**: Sets `Secure: true` when `X-Forwarded-Proto == "https"` or in production behind Cloudflare Tunnel, preserving `SameSite=Lax`.
- **CORS Support**: `AllowOriginFunc` supports `*.trycloudflare.com` tunnel domains.
- **WebSockets**: Compatible with Cloudflare Tunnel proxying.

### Per-User Audit Trail
- Logs `USER_LOGIN`, `USER_LOGIN_FAILED`, `GOOGLE_LOGIN`, `GOOGLE_LOGIN_FAILED`, and `USER_LOGOUT` events.
- Console UI (`/noc` → Audit Logs) supports user/operator filtering and full text search.
