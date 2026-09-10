# KREA IT Operations Command Center (KREA IT NOC)

A mission-critical, production-grade on-premise IT Operations and Network Operations Command Center engineered for KREA University. Designed to operate 24/7/365 continuously without reboots or memory leaks, providing deep visibility across ManageEngine OpManager, ManageEngine Endpoint Central, FortiGate Firewalls, and campus Biometric readers.

---

## 1. High-Level Architecture

```
                         INTERNAL LAN
                              │
             ┌────────────────┴────────────────┐
             │                                 │
          NOC TVs                         IT Users
             │                                 │
             └────────────────┬────────────────┘
                              │
                              ▼
                         NGINX (Port 80)
                              │
                 ┌────────────┴────────────┐
                 │                         │
                 ▼                         ▼
          React Frontend              Go Backend (Port 8080)
          (Vite / Tailwind)                │
                              ┌────────────┼────────────┐
                              │            │             │
                              ▼            ▼             ▼
                           MariaDB     Collectors    WebSocket Hub
                                           │
                         ┌─────────────────┼────────────────┐
                         │                 │                │
                         ▼                 ▼                ▼
                    OpManager       Endpoint Central    FortiGate
                 (Network & Bio)      (Endpoints)       (VLAN CMDB)
```

- **Zero Direct Browser Calls**: Browsers never communicate directly with external integration APIs. All credentials and network modifications are strictly handled inside the Go backend.
- **Delta WebSocket Streaming**: External systems are polled asynchronously by background Go collectors; state transitions are broadcast to connected clients via `/api/ws`.

---

## 2. Technology Stack

- **Backend**: Go (Go 1.26+), standard library `net/http` with `chi` router, native `database/sql` driver, `gorilla/websocket`, structured logging (`log/slog`), bcrypt password hashing, embedded SQL migrations.
- **Frontend**: React 19 / Vite, TypeScript, Tailwind CSS, Lucide React, React Router v6, TanStack Query, Apache ECharts, Web Audio API.
- **Database**: MariaDB 11 / MySQL 8.0 with InnoDB engine, UTF-8 MB4, UTC timestamps stored internally, displayed in `Asia/Kolkata` (IST, UTC+05:30).
- **Deployment**: Docker Compose (3 services: `noc`, `db`, `nginx`).

---

## 3. Quick Start & Production Deployment

### Prerequisites
- Docker Engine 20.10+ and Docker Compose v2+
- Linux on-premise server or VM on the organization's internal LAN

### Step 1: Clone or Copy Project
```bash
cd /opt/krea-noc
```

### Step 2: Configure Environment
Copy the `.env.example` template:
```bash
cp .env.example .env
```
Edit `.env` with your organization credentials:
- Set `DB_PASSWORD` to a strong unique password.
- Set `SESSION_SECRET` and `JWT_EMBED_SECRET` to cryptographically random 32+ character strings.
- Set `OPMANAGER_URL` and `OPMANAGER_API_KEY`.
- Set `ENDPOINT_CENTRAL_URL` and `ENDPOINT_CENTRAL_API_KEY`.
- Set `FORTIGATE_URL` and `FORTIGATE_API_TOKEN`.
- To run in self-contained demonstration/simulation mode without connecting to live APIs, keep `MOCK_MODE=true`.

### Step 3: Launch Docker Compose
```bash
docker compose up -d --build
```

### Step 4: Access Command Center
Open your browser and navigate to:
```
http://<server-ip>/
```
- Default Initial Administrator:
  - **Username**: `admin`
  - **Password**: Defined by `BOOTSTRAP_ADMIN_PASSWORD` in `.env` (e.g. `YourSecureAdminPassword123!`)

---

## 4. Application Modes

| Mode | Route | Target Audience | Key Features |
|---|---|---|---|
| **Mode 1: NOC TV Display** | `/display` | Wall TV Displays (1080p / 4K 16:9) | Read-only, auto-rotation (30s), large KPI typography, sound alerts, fullscreen Critical Takeover modal, green Recovery banner, Display Idle mode, wake on input/critical event. |
| **Mode 2: IT Operator** | `/noc` | IT Operations Team | Full operational console: Overview, Network, Servers, Endpoints, Biometrics, Alarms, Incidents, FortiGate VLAN Control, Reports, Audit, Users, Settings. |
| **Mode 3: Management / CTO** | `/management` | Executive / CTO | High-level infrastructure availability %, 30-day trends, MTTR, SLA adherence, top recurring problem areas. |
| **Mode 4: ERP Embed** | `/embed` | KREA Flutter ERP | Clean iframe layout, short-lived JWT token exchange, secure HttpOnly cookie, bidirectional `postMessage` communication. |

---

## 5. Four-Channel Sound Alert System & Flood Protection

The sound system triggers acoustic alerts exclusively on **state transitions**:
- `UP -> DOWN`: Plays category DOWN alert.
- `DOWN -> UP`: Plays pleasant RECOVERY chime with calculated downtime duration.
- Steady states (`UP -> UP`, `DOWN -> DOWN`): Produce no sound.

### Channel Profiles
1. **SWITCH**: Core, distribution, and access switches (Default: enabled, volume 80%, cooldown 30s)
2. **SERVER**: Compute servers and database hosts (Default: enabled, volume 80%, cooldown 30s)
3. **BIOMETRIC**: Campus attendance devices (Default: enabled, volume 75%, cooldown 30s)
4. **ILL**: Internet Leased Line backbones (Default: enabled, volume 80%, cooldown 30s)
5. **CLASSROOM**: Classroom Wi-Fi switches are **strictly MUTED by default** (`enabled=false`).

### Flood Protection
If an upstream failure drops 40 access switches simultaneously, the sound engine suppresses 39 overlapping tones within the cooldown window, emitting exactly 1 unified alert and creating a grouped outage incident.

### Web Audio Autoplay Handling
Click the **ENABLE SOUND** button in the header or on `/display` to initialize the browser's `AudioContext` and store local audio preferences.

---

## 6. FortiGate VLAN Internet Control Pipeline

Network modifications are treated as **HIGH RISK**. Direct firewall rule flipping is forbidden.
The 12-step execution pipeline:
1. Authenticate user via secure session.
2. Check granular permission (`vlan.internet.disable` or `vlan.internet.enable`).
3. Validate target VLAN and fetch current status.
4. Calculate and present operational blast radius (impacted endpoints, APs, classrooms).
5. Require non-empty operator justification reason.
6. Require explicit confirmation checkbox.
7. Create stateful action job (`QUEUED`).
8. Transition to `VALIDATING` -> `EXECUTING` via FortiGate Provider.
9. **Mandatory Post-Execution Verification**: Transition to `VERIFYING` and verify live firewall policy status on FortiGate. Never mark `SUCCESS` without positive verification.
10. Update local database state.
11. Record immutable entry in `audit_logs`.
12. Broadcast `ACTION_COMPLETED` over WebSocket.

### Rollback
Any completed action job can be restored to its exact previous state with a single click using the `[Rollback]` button in the action history table.

---

## 7. Database Backup & Restore

### Backup
To take an automated logical backup of MariaDB:
```bash
docker compose exec db mysqldump -u krea_noc -p krea_noc > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore
To restore from a backup:
```bash
cat backup_YYYYMMDD_HHMMSS.sql | docker compose exec -T db mysql -u krea_noc -p krea_noc
```

---

## 8. Local Development (Without Docker)

To run the application locally on your workstation:

1. **Start Backend**:
   ```bash
   cd backend
   go run ./cmd/server
   ```
   (Uses local SQLite database `krea_noc.db` automatically with embedded migrations)

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173`.
