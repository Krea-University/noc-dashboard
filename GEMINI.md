# KREA IT Operations / NOC Command Center — Architectural Memory & Context (GEMINI.md)

## 1. System Vision & Objectives
- **System Name**: KREA IT Operations Command Center (KREA IT NOC)
- **Target Audience**: KREA University IT Operations Team, NOC TV displays, CTO/Management, and embedded view within the Flutter ERP.
- **Longevity & Quality**: Mission-critical on-premise system designed to run 24/7/365 for multiple years without manual reboots or memory leaks. Zero toy code, zero fake buttons, zero pseudo-implementations.
- **Architectural Paradigm**: Modular Monolith in Go (backend) + React/TypeScript (frontend) + MariaDB/MySQL (database) + Nginx (reverse proxy/static server).

---

## 2. Core Architectural Constraints
1. **No direct browser calls to external systems**: The browser NEVER touches OpManager, Endpoint Central, or FortiGate. All credentials remain secure inside the Go backend.
2. **Prohibited Dependencies**: No Kubernetes, Kafka, Redis, Elasticsearch, GraphQL, or microservices. The architecture is intentionally lean and robust.
3. **Single `.env` File**: All environment-specific variables are defined in one `.env` file. Secrets are never exposed to Vite or the frontend client.
4. **Resilience**: Integration API failures must NEVER crash the server. Circuit breakers, retry with backoff, and last-successful-state caching ensure continuous operation. If an integration is degraded or offline, the UI clearly displays `DATA STALE`.
5. **Real-time Distribution**: External systems are polled by background collectors in Go. Delta state changes are detected and broadcast to browsers via WebSockets (`/api/ws`). Browsers do NOT poll external APIs.

---

## 3. Technology Stack Specifics
- **Backend**: Go (Go 1.26+), `net/http` with `chi` router, native database/sql with MySQL driver, `gorilla/websocket`, structured logging (`log/slog`), bcrypt password hashing, embedded SQL migrations.
- **Frontend**: React 19 / Vite, TypeScript, Tailwind CSS, Lucide React, React Router v6, TanStack Query (React Query), TanStack Table, Apache ECharts, Web Audio API.
- **Database**: MariaDB 11 or MySQL 8.0 with InnoDB, UTF-8 MB4, UTC timestamps stored, displayed in `Asia/Kolkata` (IST, UTC+05:30).
- **Deployment**: Docker Compose with 3 services:
  - `noc`: Compiled Go binary container
  - `db`: MariaDB/MySQL container with persistent volume
  - `nginx`: Nginx Alpine serving built React static files and reverse-proxying `/api` and `/api/ws`

---

## 4. Four-Channel Sound Alert System & Flood Protection
The sound system handles state transitions (UP -> DOWN plays DOWN sound, DOWN -> UP plays RECOVERY sound). Steady states (UP -> UP, DOWN -> DOWN) produce no sound.
1. **SWITCH**: Network switches, routers, core backbones (default enabled, volume 80%, cooldown 30s)
2. **SERVER**: Compute servers, virtualization hosts, critical services (default enabled, volume 80%, cooldown 30s)
3. **BIOMETRIC**: Campus biometric attendance devices (default enabled, volume 75%, cooldown 30s)
4. **ILL**: Internet Leased Line backbones (default enabled, volume 80%, cooldown 30s)
5. **CLASSROOM**: Classroom Wi-Fi/switches are explicitly **MUTED** by default (`enabled=false`).

### Flood Protection Rule:
If 40 switches fail simultaneously (e.g. upstream core switch failure), the system does NOT play 40 overlapping sounds. It detects the surge within the cooldown window, plays a single alert, groups affected devices, and presents a unified "Network Outage: 40 Switches Affected" banner.

### Browser Audio Autoplay Handling:
Modern browsers restrict unprompted Web Audio. On `/display` and `/noc`, an intuitive Audio Unlock badge/modal ("ENABLE SOUND") initializes the `AudioContext` upon initial user interaction and stores local preference.

---

## 5. FortiGate VLAN Internet Control Pipeline
Treat all network modifications as **HIGH RISK**. Never directly flip a firewall rule.
The 12-step execution pipeline:
1. **Authenticate User** via session cookie.
2. **Check Granular Permission** (`vlan.internet.disable` or `vlan.internet.enable`).
3. **Validate Target VLAN** (verify existence, current status).
4. **Fetch Current State** from FortiGate provider.
5. **Calculate & Present Impact**: Show impacted endpoints, APs, and classrooms.
6. **Require Justification Reason** (mandatory non-empty string).
7. **Require Explicit Confirmation** (double-check confirmation dialog).
8. **Create Action Job** (`action_jobs` record in `QUEUED` state, capturing `previous_state_json`).
9. **Transition & Execute**: Move to `VALIDATING` -> `EXECUTING` via FortiGate Provider.
10. **Mandatory Post-Execution Verification**: Move to `VERIFYING` -> verify live FortiGate rule status. Never mark `SUCCESS` without positive verification.
11. **Update Local State & DB**: If verified, mark `SUCCESS`; otherwise mark `FAILED` and prompt rollback.
12. **Audit & Broadcast**: Write immutable `audit_logs` record and broadcast `ACTION_COMPLETED` over WebSocket.

---

## 6. ERP Embed & JWT Security
- Route: `/embed`
- Allows KREA Flutter ERP to embed NOC views inside an iframe.
- **Security Mechanisms**:
  - `Content-Security-Policy`: `frame-ancestors 'self' https://erp.krea.edu.in;` (configured via `NOC_EMBED_ALLOWED_ORIGINS`).
  - **No Hardcoded Tokens**: React never stores static JWTs.
  - **Exchange Flow**: ERP backend issues a short-lived signed JWT (sub, iss, aud=krea-noc, exp <= 5m, scope=noc:view). Frontend passes this token to `/api/embed/session`, which verifies cryptographic signature and issues a short-lived, HttpOnly, SameSite cookie scoped to `noc:view`.
  - Scopes: `noc:view` allows monitoring only. Network actions (VLAN toggle) strictly require `noc:network_control` AND backend permission.
  - `postMessage` Handshake: Origin is strictly validated against `NOC_EMBED_ALLOWED_ORIGINS`.

---

## 7. Display Modes
1. **Mode 1: NOC Display (`/display`)**:
   - Optimized for 1080p and 4K 16:9 wall displays.
   - High contrast dark palette, large KPI typography, zero unnecessary scrollbars.
   - Auto-rotates through views: Overall -> Network -> Servers -> Endpoints -> Biometrics -> Incidents (configurable interval, default 30s).
   - **Critical Incident Takeover**: Fullscreen takeover banner with device name, location, impact, detected time, and sound alert. Auto-reverts after configured timeout.
   - **Device Recovery Banner**: Green recovery banner with calculated downtime duration.
   - **Display Idle Mode**: After configured inactivity (15/30/60m), switches to low-power UI (dim clock/status) while keeping backend monitoring active. Wakes on input or critical event.
2. **Mode 2: IT Operator Console (`/noc`)**:
   - Full operational interface with Sidebar, Global Search (`/`), live ECharts, drawer drilldown, alarm acknowledgment, incident management, FortiGate VLAN control, user management, and audit logs.
3. **Mode 3: Management / CTO View (`/management`)**:
   - Executive-level dashboard: Overall availability %, 30-day uptime trends, MTTR, SLAs, top recurring problems, site health breakdown.
