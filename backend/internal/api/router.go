package api

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/auth"
	"github.com/Krea-University/noc-dashboard/backend/internal/automation"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/displays"
	"github.com/Krea-University/noc-dashboard/backend/internal/events"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/opmanager"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/rbac"
	"github.com/Krea-University/noc-dashboard/backend/internal/sound"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

// RouterDeps provides dependencies for the API router.
type RouterDeps struct {
	Cfg          *config.Config
	DB           *database.DB
	AuthSvc      *auth.Service
	AuditSvc     *audit.Service
	DisplaysSvc  *displays.Service
	VlanPipeline *automation.Pipeline
	SoundEngine  *sound.Engine
	WSHub        *websocket.Hub
	NMSProvider  integrations.NMSProvider
	EPCProvider  integrations.EndpointProvider
	FGProvider   integrations.FirewallProvider
}

// SetupRouter constructs the Chi router with middleware, security headers, and routes.
func SetupRouter(deps *RouterDeps) http.Handler {
	r := chi.NewRouter()

	// Global Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS Configuration (Strict origins from config)
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   deps.Cfg.NOCAllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Requested-With"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
	r.Use(corsMiddleware.Handler)

	// Security Headers Middleware (CSP frame-ancestors, X-Content-Type-Options)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ancestors := strings.Join(deps.Cfg.NOCEmbedAllowedOrigins, " ")
			w.Header().Set("Content-Security-Policy", fmt.Sprintf("frame-ancestors 'self' %s;", ancestors))
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			next.ServeHTTP(w, r)
		})
	})

	// Public Health Endpoints
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok", "app": deps.Cfg.AppName})
	})
	r.Get("/ready", func(w http.ResponseWriter, r *http.Request) {
		if err := deps.DB.Ping(); err != nil {
			respondJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unhealthy", "error": "db ping failed"})
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	r.Get("/health/integrations", handleHealthIntegrations(deps))

	// Real-Time WebSocket
	r.Get("/api/ws", deps.WSHub.ServeWS)

	// Authentication Endpoints
	r.Post("/api/auth/login", handleLogin(deps))
	r.Post("/api/auth/logout", handleLogout(deps))
	r.Post("/api/embed/session", handleEmbedSession(deps))

	// Authenticated Routes
	r.Group(func(api chi.Router) {
		api.Use(rbac.RequireAuth(deps.AuthSvc))

		api.Get("/api/me", handleMe(deps))

		// Dashboards
		api.Get("/api/dashboard/summary", handleDashboardSummary(deps))
		api.Get("/api/dashboard/network", handleDashboardNetwork(deps))
		api.Get("/api/dashboard/servers", handleDashboardServers(deps))
		api.Get("/api/dashboard/endpoints", handleDashboardEndpoints(deps))
		api.Get("/api/dashboard/biometrics", handleDashboardBiometrics(deps))

		// Devices
		api.Get("/api/devices", handleListDevices(deps))
		api.Get("/api/devices/top-problems", handleGetTopProblemDevices(deps))
		api.Get("/api/devices/{id}", handleGetDevice(deps))
		api.Get("/api/devices/{id}/history", handleGetDeviceHistory(deps))

		// Biometrics
		api.Get("/api/biometrics", handleListBiometrics(deps))
		api.Get("/api/biometrics/{id}", handleGetBiometric(deps))
		api.Put("/api/biometrics/{id}/metadata", handleUpdateBiometricMeta(deps))

		// Endpoints (Endpoint Central) & Custom Groups
		api.Get("/api/endpoints", handleListEndpoints(deps))
		api.Get("/api/endpoints/custom-groups", handleListCustomGroups(deps))
		api.Post("/api/endpoints/custom-groups", handleCreateCustomGroup(deps))
		api.Delete("/api/endpoints/custom-groups/{id}", handleDeleteCustomGroup(deps))
		api.Get("/api/endpoints/{id}", handleGetEndpoint(deps))

		// Alarms & Incidents
		api.Get("/api/alarms", handleListAlarms(deps))
		api.Post("/api/alarms/{id}/acknowledge", handleAcknowledgeAlarm(deps))
		api.Get("/api/incidents", handleListIncidents(deps))
		api.Get("/api/incidents/{id}", handleGetIncident(deps))
		api.Post("/api/incidents/{id}/status", handleUpdateIncidentStatus(deps))
		api.Post("/api/incidents/{id}/notes", handleAddIncidentNote(deps))

		// VLAN & Firewall Control
		api.Get("/api/vlans", handleListVLANs(deps))
		api.Get("/api/vlans/{id}", handleGetVLAN(deps))
		api.Get("/api/vlans/{id}/impact", handleGetVLANImpact(deps))
		api.Post("/api/vlans/{id}/internet/disable", handleDisableVlanInternet(deps))
		api.Post("/api/vlans/{id}/internet/enable", handleEnableVlanInternet(deps))
		api.Get("/api/firewall", handleGetFirewallStatus(deps))
		api.Get("/api/actions", handleListActions(deps))
		api.Post("/api/actions/{id}/rollback", handleRollbackAction(deps))

		// Audit & Reports
		api.Get("/api/audit", handleListAuditLogs(deps))
		api.Get("/api/reports/availability", handleReportAvailability(deps))

		// NOC Displays
		api.Get("/api/displays", handleListDisplays(deps))
		api.Post("/api/displays/heartbeat", handleDisplayHeartbeat(deps))

		// Sound Settings
		api.Get("/api/sound/profiles", handleListSoundProfiles(deps))
		api.Put("/api/sound/profiles/{category}", handleUpdateSoundProfile(deps))

		// Users (Admin Only)
		api.Get("/api/users", handleListUsers(deps))
		api.Post("/api/users", handleCreateUser(deps))
		api.Patch("/api/users/{id}", handlePatchUser(deps))

		// Settings
		api.Get("/api/settings", handleListSettings(deps))
		api.Put("/api/settings", handleUpdateSettings(deps))

		// Mock Simulation Controls (for interactive tests and NOC demonstrations)
		api.Post("/api/mock/simulate", handleMockSimulation(deps))
	})

	return r
}

// ---------------- Handlers ----------------

func handleHealthIntegrations(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query("SELECT id, name, type, base_url, status, last_sync_at, last_error, sync_count, error_count FROM integrations")
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed querying integrations health")
			return
		}
		defer rows.Close()

		var results []models.Integration
		for rows.Next() {
			var i models.Integration
			var lastErr *string
			_ = rows.Scan(&i.ID, &i.Name, &i.Type, &i.BaseURL, &i.Status, &i.LastSyncAt, &lastErr, &i.SyncCount, &i.ErrorCount)
			if lastErr != nil {
				i.LastError = *lastErr
			}
			results = append(results, i)
		}
		respondJSON(w, http.StatusOK, results)
	}
}

func handleLogin(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		ip := r.RemoteAddr
		ua := r.UserAgent()
		user, token, err := deps.AuthSvc.Authenticate(req.Username, req.Password, ip, ua)
		if err != nil {
			respondError(w, http.StatusUnauthorized, err.Error())
			return
		}

		auth.SetSessionCookie(w, token, auth.SessionDuration)

		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    user.ID,
			Username:  user.Username,
			Action:    "LOGIN",
			IPAddress: ip,
			UserAgent: ua,
			Result:    "SUCCESS",
			Reason:    "Standard user login",
		})

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"user":  user,
			"token": token,
		})
	}
}

func handleLogout(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
			_ = deps.AuthSvc.DeleteSession(cookie.Value)
		}
		auth.ClearSessionCookie(w)
		respondJSON(w, http.StatusOK, map[string]string{"message": "logged out successfully"})
	}
}

func handleEmbedSession(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			JWT string `json:"jwt"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.JWT == "" {
			respondError(w, http.StatusBadRequest, "missing jwt in request body")
			return
		}

		sub, scope, err := deps.AuthSvc.ValidateERPJWTEmbedToken(req.JWT)
		if err != nil {
			respondError(w, http.StatusUnauthorized, err.Error())
			return
		}

		// Find or assign ERP embed viewer user
		user, err := deps.AuthSvc.GetUserByUsername("erp_viewer")
		if err != nil {
			user, _ = deps.AuthSvc.GetUserByUsername(deps.Cfg.BootstrapAdminUsername)
		}

		token, _, err := deps.AuthSvc.CreateSession(user.ID, scope, auth.EmbedSessionDuration, r.RemoteAddr, r.UserAgent())
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed creating embed session")
			return
		}

		auth.SetSessionCookie(w, token, auth.EmbedSessionDuration)

		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    user.ID,
			Username:  user.Username,
			Action:    "ERP_EMBED_SESSION",
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
			Result:    "SUCCESS",
			Reason:    fmt.Sprintf("ERP embed exchange for subject %s with scope %s", sub, scope),
		})

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"token": token,
			"scope": scope,
			"sub":   sub,
		})
	}
}

func handleMe(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := rbac.GetUserFromContext(r.Context())
		scope := rbac.GetScopeFromContext(r.Context())
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"user":  user,
			"scope": scope,
		})
	}
}

func handleDashboardSummary(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		summary := models.DashboardSummaryDTO{
			OverallAvailability: 99.85,
			NetworkAvailability: 99.72,
			DataFreshness:       "LIVE",
		}

		// Query devices counts
		_ = deps.DB.QueryRow("SELECT COUNT(*), SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), SUM(CASE WHEN status='DOWN' THEN 1 ELSE 0 END), SUM(CASE WHEN status='WARNING' THEN 1 ELSE 0 END) FROM devices").
			Scan(&summary.TotalDevices, &summary.DevicesUp, &summary.DevicesDown, &summary.DevicesWarning)

		// Query network devices
		_ = deps.DB.QueryRow("SELECT COUNT(*), SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), SUM(CASE WHEN status='DOWN' THEN 1 ELSE 0 END) FROM devices WHERE category_code IN ('SWITCH','ROUTER','WIRELESS_AP')").
			Scan(&summary.NetworkDevicesTotal, &summary.NetworkDevicesUp, &summary.NetworkDevicesDown)

		// Query servers
		_ = deps.DB.QueryRow("SELECT COUNT(*), SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), SUM(CASE WHEN status='DOWN' THEN 1 ELSE 0 END) FROM devices WHERE category_code = 'SERVER'").
			Scan(&summary.ServersTotal, &summary.ServersUp, &summary.ServersDown)

		// Query biometrics
		_ = deps.DB.QueryRow("SELECT COUNT(*), SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), SUM(CASE WHEN status='DOWN' THEN 1 ELSE 0 END) FROM devices WHERE category_code = 'BIOMETRIC'").
			Scan(&summary.BiometricsTotal, &summary.BiometricsUp, &summary.BiometricsDown)

		// Query endpoints
		_ = deps.DB.QueryRow("SELECT COUNT(*), SUM(CASE WHEN status='ONLINE' THEN 1 ELSE 0 END), SUM(CASE WHEN status='OFFLINE' THEN 1 ELSE 0 END) FROM endpoints").
			Scan(&summary.EndpointsTotal, &summary.EndpointsOnline, &summary.EndpointsOffline)

		// Query alarms & incidents
		_ = deps.DB.QueryRow("SELECT SUM(CASE WHEN severity='CRITICAL' THEN 1 ELSE 0 END), SUM(CASE WHEN severity='MAJOR' THEN 1 ELSE 0 END) FROM alarms WHERE cleared = 0").
			Scan(&summary.ActiveCriticalAlarms, &summary.ActiveMajorAlarms)
		_ = deps.DB.QueryRow("SELECT COUNT(*) FROM incidents WHERE status IN ('OPEN','ACKNOWLEDGED','INVESTIGATING')").
			Scan(&summary.ActiveIncidents)

		// WAN Interfaces total traffic
		_ = deps.DB.QueryRow("SELECT COALESCE(SUM(in_traffic_bps),0), COALESCE(SUM(out_traffic_bps),0) FROM interfaces WHERE id IN ('if_01', 'if_02', 'if_05')").
			Scan(&summary.InboundTrafficBPS, &summary.OutboundTrafficBPS)
		if summary.InboundTrafficBPS == 0 && summary.OutboundTrafficBPS == 0 {
			_ = deps.DB.QueryRow("SELECT COALESCE(SUM(in_traffic_bps),0), COALESCE(SUM(out_traffic_bps),0) FROM interfaces WHERE name LIKE '%Uplink%' OR name LIKE '%ILL%'").
				Scan(&summary.InboundTrafficBPS, &summary.OutboundTrafficBPS)
		}

		// Integrations
		rows, err := deps.DB.Query("SELECT id, name, type, base_url, status, last_sync_at, sync_count, error_count FROM integrations")
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var i models.Integration
				_ = rows.Scan(&i.ID, &i.Name, &i.Type, &i.BaseURL, &i.Status, &i.LastSyncAt, &i.SyncCount, &i.ErrorCount)
				summary.IntegrationsHealth = append(summary.IntegrationsHealth, i)
				if i.Status != "CONNECTED" {
					summary.DataFreshness = "DEGRADED"
				}
			}
		}

		respondJSON(w, http.StatusOK, summary)
	}
}

func handleDashboardNetwork(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		devices, _ := queryDevices(deps.DB, "category_code IN ('SWITCH','ROUTER','WIRELESS_AP','ILL')", 100)
		interfaces, _ := queryInterfaces(deps.DB, 20)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"devices":    devices,
			"interfaces": interfaces,
		})
	}
}

func handleDashboardServers(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		servers, _ := queryDevices(deps.DB, "category_code = 'SERVER'", 50)
		serverEndpoints, _ := queryEndpoints(deps.DB, "os_name LIKE '%Server%'", 20)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"servers":          servers,
			"server_endpoints": serverEndpoints,
		})
	}
}

func handleDashboardEndpoints(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		endpoints, _ := queryEndpoints(deps.DB, "", 500)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"endpoints": endpoints,
		})
	}
}

func handleDashboardBiometrics(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		biometrics, _ := queryDevices(deps.DB, "category_code = 'BIOMETRIC'", 200)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"biometrics": biometrics,
		})
	}
}

func handleListDevices(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cat := r.URL.Query().Get("category")
		search := r.URL.Query().Get("q")
		status := r.URL.Query().Get("status")
		limitStr := r.URL.Query().Get("limit")
		limit := 1000
		if limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
				limit = l
			}
		}

		var conditions []string
		if cat != "" {
			switch strings.ToUpper(cat) {
			case "WIRELESS_AP", "AP":
				conditions = append(conditions, "(category_code = 'WIRELESS_AP' OR type LIKE '%AP%' OR type LIKE '%Access Point%')")
			case "SWITCH":
				conditions = append(conditions, "(category_code = 'SWITCH' AND type NOT LIKE '%AP%' AND type NOT LIKE '%Access Point%' AND type NOT LIKE '%Firewall%')")
			case "FIREWALL":
				conditions = append(conditions, "(type LIKE '%Firewall%' OR vendor LIKE '%Fortinet%')")
			case "ROUTER":
				conditions = append(conditions, "(category_code = 'ROUTER' OR type LIKE '%Router%')")
			default:
				conditions = append(conditions, fmt.Sprintf("category_code = '%s'", sanitizeSQL(cat)))
			}
		}
		if status != "" {
			conditions = append(conditions, fmt.Sprintf("status = '%s'", sanitizeSQL(status)))
		}
		if search != "" {
			s := sanitizeSQL(search)
			conditions = append(conditions, fmt.Sprintf("(name LIKE '%%%s%%' OR ip_address LIKE '%%%s%%' OR vendor LIKE '%%%s%%' OR type LIKE '%%%s%%')", s, s, s, s))
		}

		where := ""
		if len(conditions) > 0 {
			where = strings.Join(conditions, " AND ")
		}

		devices, err := queryDevices(deps.DB, where, limit)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, devices)
	}
}

func handleGetDevice(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		dev, err := querySingleDevice(deps.DB, id)
		if err != nil {
			respondError(w, http.StatusNotFound, "device not found")
			return
		}

		// Fetch interfaces
		if dev.CategoryCode == "SWITCH" || dev.CategoryCode == "ROUTER" || dev.CategoryCode == "ILL" {
			iRows, _ := deps.DB.Query("SELECT id, device_id, name, index_num, speed_bps, status, in_traffic_bps, out_traffic_bps, updated_at FROM interfaces WHERE device_id = ?", dev.ID)
			if iRows != nil {
				defer iRows.Close()
				for iRows.Next() {
					var iface models.Interface
					_ = iRows.Scan(&iface.ID, &iface.DeviceID, &iface.Name, &iface.IndexNum, &iface.SpeedBPS, &iface.Status, &iface.InTrafficBPS, &iface.OutTrafficBPS, &iface.UpdatedAt)
					dev.Interfaces = append(dev.Interfaces, iface)
				}
			}
		}

		// Fetch active alarms
		aRows, _ := deps.DB.Query("SELECT id, source_id, source_system, device_id, device_name, device_ip, severity, message, entity, first_seen_at, last_seen_at, acknowledged, cleared FROM alarms WHERE device_id = ? AND cleared = 0", dev.ID)
		if aRows != nil {
			defer aRows.Close()
			for aRows.Next() {
				var alm models.Alarm
				_ = aRows.Scan(&alm.ID, &alm.SourceID, &alm.SourceSystem, &alm.DeviceID, &alm.DeviceName, &alm.DeviceIP, &alm.Severity, &alm.Message, &alm.Entity, &alm.FirstSeenAt, &alm.LastSeenAt, &alm.Acknowledged, &alm.Cleared)
				dev.ActiveAlarms = append(dev.ActiveAlarms, alm)
			}
		}

		respondJSON(w, http.StatusOK, dev)
	}
}

func formatDowntimeDuration(t time.Time) (string, int) {
	if t.IsZero() {
		return "25m", 25
	}
	diff := time.Since(t)
	mins := int(diff.Minutes())
	if mins < 1 {
		return "< 1m", 1
	}
	if mins < 60 {
		return fmt.Sprintf("%dm", mins), mins
	}
	if mins < 1440 {
		return fmt.Sprintf("%dh %02dm", mins/60, mins%60), mins
	}
	return fmt.Sprintf("%dd %dh", mins/1440, (mins%1440)/60), mins
}

func formatDeviceType(rawType, cat string) string {
	raw := strings.TrimSpace(rawType)
	if raw != "" && !strings.EqualFold(raw, "Unknown") {
		return raw
	}
	switch strings.ToUpper(cat) {
	case "SWITCH":
		return "Switch"
	case "BIOMETRIC":
		return "Biometric"
	case "SERVER":
		return "Server"
	case "WIRELESS_AP":
		return "Wireless AP"
	case "ROUTER":
		return "Router"
	case "ILL":
		return "Internet Leased Line"
	default:
		return "Device"
	}
}

func fetchTopProblemDevices(db *database.DB, limit int) []map[string]interface{} {
	if limit <= 0 {
		limit = 10
	}

	query := `
	SELECT 
		d.id,
		d.name,
		COALESCE(d.ip_address, ''),
		d.category_code,
		COALESCE(d.type, ''),
		d.status,
		d.last_status_change_at,
		COALESCE((SELECT COUNT(*) FROM alarms a WHERE a.device_id = d.id AND a.cleared = 0), 0) AS alarm_cnt,
		COALESCE((SELECT a.severity FROM alarms a WHERE a.device_id = d.id AND a.cleared = 0 ORDER BY CASE a.severity WHEN 'CRITICAL' THEN 1 WHEN 'MAJOR' THEN 2 WHEN 'WARNING' THEN 3 ELSE 4 END ASC LIMIT 1), '') AS highest_alarm_sev,
		COALESCE((SELECT a.message FROM alarms a WHERE a.device_id = d.id AND a.cleared = 0 ORDER BY a.first_seen_at DESC LIMIT 1), '') AS latest_alarm_msg
	FROM devices d
	WHERE d.status IN ('DOWN', 'WARNING')
	   OR EXISTS (SELECT 1 FROM alarms a WHERE a.device_id = d.id AND a.cleared = 0)
	ORDER BY 
		CASE d.status WHEN 'DOWN' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END ASC,
		alarm_cnt DESC,
		d.last_status_change_at ASC
	LIMIT ?`

	rows, err := db.Query(query, limit)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		var id, name, ip, cat, rawType, status, highestAlarmSev, latestAlarmMsg string
		var lastStatusChange time.Time
		var alarmCnt int

		if err := rows.Scan(&id, &name, &ip, &cat, &rawType, &status, &lastStatusChange, &alarmCnt, &highestAlarmSev, &latestAlarmMsg); err != nil {
			continue
		}

		durStr, mins := formatDowntimeDuration(lastStatusChange)
		devType := formatDeviceType(rawType, cat)

		sev := "WARNING"
		if status == "DOWN" {
			sev = "CRITICAL"
		} else if highestAlarmSev != "" {
			sev = highestAlarmSev
		} else if status == "WARNING" {
			sev = "MAJOR"
		}

		count := alarmCnt
		if count <= 0 {
			count = 1
		}

		msg := latestAlarmMsg
		if msg == "" {
			if status == "DOWN" {
				msg = fmt.Sprintf("Device %s is unreachable (status DOWN)", name)
			} else if status == "WARNING" {
				msg = fmt.Sprintf("Device %s state is degraded (status WARNING)", name)
			}
		}

		results = append(results, map[string]interface{}{
			"id":                    id,
			"name":                  name,
			"ip":                    ip,
			"type":                  devType,
			"category":              cat,
			"status":                status,
			"severity":              sev,
			"duration":              durStr,
			"downtime_minutes":      mins,
			"count":                 count,
			"incidents":             count,
			"message":               msg,
			"last_status_change_at": lastStatusChange.Format(time.RFC3339),
		})
	}

	return results
}

func handleGetTopProblemDevices(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 10
		if lStr := r.URL.Query().Get("limit"); lStr != "" {
			if l, err := strconv.Atoi(lStr); err == nil && l > 0 {
				limit = l
			}
		}
		problems := fetchTopProblemDevices(deps.DB, limit)
		respondJSON(w, http.StatusOK, problems)
	}
}

func handleGetDeviceHistory(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		rows, err := deps.DB.Query("SELECT id, device_id, previous_status, new_status, duration_seconds, timestamp FROM device_history WHERE device_id = ? ORDER BY timestamp DESC LIMIT 50", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var history []models.DeviceHistory
		for rows.Next() {
			var h models.DeviceHistory
			_ = rows.Scan(&h.ID, &h.DeviceID, &h.PreviousStatus, &h.NewStatus, &h.DurationSeconds, &h.Timestamp)
			history = append(history, h)
		}
		respondJSON(w, http.StatusOK, history)
	}
}

func handleListBiometrics(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		devices, err := queryDevices(deps.DB, "category_code = 'BIOMETRIC'", 100)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, devices)
	}
}

func handleGetBiometric(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		dev, err := querySingleDevice(deps.DB, id)
		if err != nil {
			respondError(w, http.StatusNotFound, "biometric device not found")
			return
		}
		respondJSON(w, http.StatusOK, dev)
	}
}

func handleUpdateBiometricMeta(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var req struct {
			Vendor        string `json:"vendor"`
			Model         string `json:"model"`
			Building      string `json:"building"`
			Location      string `json:"location"`
			Department    string `json:"department"`
			Purpose       string `json:"purpose"`
			ContactPerson string `json:"contact_person"`
			Notes         string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		now := time.Now().UTC()
		var existing string
		err := deps.DB.QueryRow("SELECT id FROM biometric_metadata WHERE device_id = ?", id).Scan(&existing)
		if err != nil {
			metaID := "bmd_" + uuid.New().String()[:8]
			_, _ = deps.DB.Exec(`
				INSERT INTO biometric_metadata (id, device_id, vendor, model, building, location, department, purpose, contact_person, notes, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				metaID, id, req.Vendor, req.Model, req.Building, req.Location, req.Department, req.Purpose, req.ContactPerson, req.Notes, now)
		} else {
			_, _ = deps.DB.Exec(`
				UPDATE biometric_metadata
				SET vendor = ?, model = ?, building = ?, location = ?, department = ?, purpose = ?, contact_person = ?, notes = ?, updated_at = ?
				WHERE device_id = ?`,
				req.Vendor, req.Model, req.Building, req.Location, req.Department, req.Purpose, req.ContactPerson, req.Notes, now, id)
		}

		respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func handleListEndpoints(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status := r.URL.Query().Get("status")
		search := r.URL.Query().Get("q")
		limitStr := r.URL.Query().Get("limit")
		limit := 1000
		if limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
				limit = l
			}
		}

		var conditions []string
		if status != "" {
			conditions = append(conditions, fmt.Sprintf("status = '%s'", sanitizeSQL(status)))
		}
		if search != "" {
			s := sanitizeSQL(search)
			conditions = append(conditions, fmt.Sprintf("(hostname LIKE '%%%s%%' OR ip_address LIKE '%%%s%%' OR logged_in_user LIKE '%%%s%%' OR os_name LIKE '%%%s%%' OR remote_office LIKE '%%%s%%')", s, s, s, s, s))
		}
		where := ""
		if len(conditions) > 0 {
			where = strings.Join(conditions, " AND ")
		}
		endpoints, err := queryEndpoints(deps.DB, where, limit)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, endpoints)
	}
}

func handleGetEndpoint(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var ep models.Endpoint
		query := `
		SELECT id, source_id, hostname, ip_address, mac_address, os_name, os_version, logged_in_user, domain_name, remote_office, status, last_scan_at, last_seen_at, hardware_summary, software_count, updated_at
		FROM endpoints
		WHERE id = ? OR source_id = ?`
		err := deps.DB.QueryRow(query, id, id).Scan(
			&ep.ID, &ep.SourceID, &ep.Hostname, &ep.IPAddress, &ep.MACAddress,
			&ep.OSName, &ep.OSVersion, &ep.LoggedInUser, &ep.DomainName,
			&ep.RemoteOffice, &ep.Status, &ep.LastScanAt, &ep.LastSeenAt,
			&ep.HardwareSummary, &ep.SoftwareCount, &ep.UpdatedAt,
		)
		if err != nil {
			respondError(w, http.StatusNotFound, "endpoint not found")
			return
		}
		respondJSON(w, http.StatusOK, ep)
	}
}

func handleListCustomGroups(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(`
			SELECT id, name, group_type, category, description, match_type, match_value, color, created_by, created_at, updated_at
			FROM custom_endpoint_groups
			ORDER BY name ASC`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var groups []models.CustomEndpointGroup
		for rows.Next() {
			var grp models.CustomEndpointGroup
			var desc, color, createdBy *string
			if err := rows.Scan(
				&grp.ID, &grp.Name, &grp.GroupType, &grp.Category, &desc,
				&grp.MatchType, &grp.MatchValue, &color, &createdBy,
				&grp.CreatedAt, &grp.UpdatedAt,
			); err != nil {
				continue
			}
			if desc != nil {
				grp.Description = *desc
			}
			if color != nil {
				grp.Color = *color
			}
			if createdBy != nil {
				grp.CreatedBy = *createdBy
			}

			// Compute dynamic real-time metrics from endpoints table
			var whereClause string
			var args []interface{}
			switch grp.MatchType {
			case "HOSTNAME_PREFIX":
				whereClause = "hostname LIKE ?"
				args = []interface{}{grp.MatchValue + "%"}
			case "HOSTNAME_CONTAINS":
				whereClause = "hostname LIKE ?"
				args = []interface{}{"%" + grp.MatchValue + "%"}
			case "IP_PREFIX":
				whereClause = "ip_address LIKE ?"
				args = []interface{}{grp.MatchValue + "%"}
			case "OS_CONTAINS":
				whereClause = "os_name LIKE ?"
				args = []interface{}{"%" + grp.MatchValue + "%"}
			default:
				whereClause = "hostname LIKE ?"
				args = []interface{}{"%" + grp.MatchValue + "%"}
			}

			_ = deps.DB.QueryRow(
				fmt.Sprintf("SELECT COUNT(*), COALESCE(SUM(CASE WHEN status='ONLINE' THEN 1 ELSE 0 END), 0), COALESCE(SUM(CASE WHEN status!='ONLINE' THEN 1 ELSE 0 END), 0) FROM endpoints WHERE %s", whereClause),
				args...,
			).Scan(&grp.TotalCount, &grp.OnlineCount, &grp.OfflineCount)

			groups = append(groups, grp)
		}

		respondJSON(w, http.StatusOK, groups)
	}
}

func handleCreateCustomGroup(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name        string `json:"name"`
			GroupType   string `json:"group_type"`
			Category    string `json:"category"`
			Description string `json:"description"`
			MatchType   string `json:"match_type"`
			MatchValue  string `json:"match_value"`
			Color       string `json:"color"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		name := strings.TrimSpace(req.Name)
		if name == "" {
			respondError(w, http.StatusBadRequest, "group name is required")
			return
		}
		matchVal := strings.TrimSpace(req.MatchValue)
		if matchVal == "" {
			respondError(w, http.StatusBadRequest, "match value is required")
			return
		}

		groupType := req.GroupType
		if groupType == "" {
			groupType = "Computers"
		}
		category := req.Category
		if category == "" {
			category = "Custom Groups"
		}
		matchType := req.MatchType
		if matchType == "" {
			matchType = "HOSTNAME_PREFIX"
		}
		color := req.Color
		if color == "" {
			color = "indigo"
		}

		user := rbac.GetUserFromContext(r.Context())
		username := "admin"
		userID := "system"
		if user != nil {
			username = user.Username
			userID = user.ID
		}

		grpID := "cg_" + uuid.New().String()[:8]
		now := time.Now().UTC()

		insertSQL := `
		INSERT INTO custom_endpoint_groups (id, name, group_type, category, description, match_type, match_value, color, created_by, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		_, err := deps.DB.Exec(insertSQL, grpID, name, groupType, category, req.Description, matchType, matchVal, color, username, now, now)
		if err != nil {
			respondError(w, http.StatusBadRequest, fmt.Sprintf("failed creating group: %v", err))
			return
		}

		grp := models.CustomEndpointGroup{
			ID:          grpID,
			Name:        name,
			GroupType:   groupType,
			Category:    category,
			Description: req.Description,
			MatchType:   matchType,
			MatchValue:  matchVal,
			Color:       color,
			CreatedBy:   username,
			CreatedAt:   now,
			UpdatedAt:   now,
		}

		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    userID,
			Username:  username,
			Action:    "ENDPOINT_GROUP_CREATED",
			TargetID:  grpID,
			Reason:    fmt.Sprintf("Created custom group %s with rule %s:%s", name, matchType, matchVal),
			Result:    "SUCCESS",
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
		})

		deps.WSHub.Broadcast("ENDPOINT_GROUP_CREATED", grp)
		respondJSON(w, http.StatusCreated, grp)
	}
}

func handleDeleteCustomGroup(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		if id == "" {
			respondError(w, http.StatusBadRequest, "group id is required")
			return
		}

		user := rbac.GetUserFromContext(r.Context())
		username := "admin"
		userID := "system"
		if user != nil {
			username = user.Username
			userID = user.ID
		}

		_, err := deps.DB.Exec("DELETE FROM custom_endpoint_groups WHERE id = ?", id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    userID,
			Username:  username,
			Action:    "ENDPOINT_GROUP_DELETED",
			TargetID:  id,
			Result:    "SUCCESS",
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
		})

		deps.WSHub.Broadcast("ENDPOINT_GROUP_DELETED", map[string]string{"id": id})
		respondJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}
}

func handleListAlarms(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sev := r.URL.Query().Get("severity")
		cleared := r.URL.Query().Get("cleared")
		query := "SELECT id, source_id, source_system, device_id, device_name, device_ip, severity, message, entity, first_seen_at, last_seen_at, acknowledged, cleared FROM alarms WHERE 1=1"
		var args []interface{}
		if sev != "" {
			query += " AND severity = ?"
			args = append(args, sev)
		}
		if cleared == "false" || cleared == "0" {
			query += " AND cleared = 0"
		}
		query += " ORDER BY last_seen_at DESC LIMIT 100"

		rows, err := deps.DB.Query(query, args...)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var alarms []models.Alarm
		for rows.Next() {
			var a models.Alarm
			_ = rows.Scan(&a.ID, &a.SourceID, &a.SourceSystem, &a.DeviceID, &a.DeviceName, &a.DeviceIP, &a.Severity, &a.Message, &a.Entity, &a.FirstSeenAt, &a.LastSeenAt, &a.Acknowledged, &a.Cleared)
			alarms = append(alarms, a)
		}
		respondJSON(w, http.StatusOK, alarms)
	}
}

func handleAcknowledgeAlarm(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		user := rbac.GetUserFromContext(r.Context())
		now := time.Now().UTC()

		_, err := deps.DB.Exec("UPDATE alarms SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = ? WHERE id = ?",
			user.Username, now, id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed acknowledging alarm")
			return
		}

		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    user.ID,
			Username:  user.Username,
			Action:    "ALARM_ACKNOWLEDGED",
			TargetID:  id,
			Result:    "SUCCESS",
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
		})

		deps.WSHub.Broadcast("ALARM_UPDATED", map[string]interface{}{"alarm_id": id, "acknowledged": true})
		respondJSON(w, http.StatusOK, map[string]string{"status": "acknowledged"})
	}
}

func handleListIncidents(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(`
			SELECT id, incident_number, title, description, severity, status, source_system, primary_device_id, affected_devices_count, assigned_to_username, created_at, updated_at
			FROM incidents
			ORDER BY created_at DESC LIMIT 50`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var incidents []models.Incident
		for rows.Next() {
			var inc models.Incident
			var user *string
			_ = rows.Scan(&inc.ID, &inc.IncidentNumber, &inc.Title, &inc.Description, &inc.Severity, &inc.Status, &inc.SourceSystem, &inc.PrimaryDeviceID, &inc.AffectedDevicesCount, &user, &inc.CreatedAt, &inc.UpdatedAt)
			if user != nil {
				inc.AssignedToUsername = *user
			}
			incidents = append(incidents, inc)
		}
		respondJSON(w, http.StatusOK, incidents)
	}
}

func handleGetIncident(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var inc models.Incident
		var user *string
		err := deps.DB.QueryRow(`
			SELECT id, incident_number, title, description, severity, status, source_system, primary_device_id, affected_devices_count, assigned_to_username, created_at, updated_at
			FROM incidents
			WHERE id = ?`, id).Scan(
			&inc.ID, &inc.IncidentNumber, &inc.Title, &inc.Description, &inc.Severity, &inc.Status,
			&inc.SourceSystem, &inc.PrimaryDeviceID, &inc.AffectedDevicesCount, &user, &inc.CreatedAt, &inc.UpdatedAt,
		)
		if err != nil {
			respondError(w, http.StatusNotFound, "incident not found")
			return
		}
		if user != nil {
			inc.AssignedToUsername = *user
		}

		// Fetch timeline events
		eRows, _ := deps.DB.Query("SELECT id, incident_id, username, event_type, notes, created_at FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC", id)
		if eRows != nil {
			defer eRows.Close()
			for eRows.Next() {
				var ev models.IncidentEvent
				_ = eRows.Scan(&ev.ID, &ev.IncidentID, &ev.Username, &ev.EventType, &ev.Notes, &ev.CreatedAt)
				inc.Events = append(inc.Events, ev)
			}
		}

		respondJSON(w, http.StatusOK, inc)
	}
}

func handleUpdateIncidentStatus(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		user := rbac.GetUserFromContext(r.Context())
		var req struct {
			Status string `json:"status"` // ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		now := time.Now().UTC()
		_, err := deps.DB.Exec("UPDATE incidents SET status = ?, updated_at = ? WHERE id = ?", req.Status, now, id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed updating incident status")
			return
		}

		// Record incident timeline event
		evID := "iev_" + uuid.New().String()[:8]
		_, _ = deps.DB.Exec("INSERT INTO incident_events (id, incident_id, username, event_type, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			evID, id, user.Username, "STATUS_CHANGE", fmt.Sprintf("Status changed to %s by %s", req.Status, user.Username), now)

		deps.WSHub.Broadcast("INCIDENT_UPDATED", map[string]interface{}{"incident_id": id, "status": req.Status})
		respondJSON(w, http.StatusOK, map[string]string{"status": req.Status})
	}
}

func handleAddIncidentNote(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		user := rbac.GetUserFromContext(r.Context())
		var req struct {
			Notes string `json:"notes"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Notes) == "" {
			respondError(w, http.StatusBadRequest, "notes cannot be empty")
			return
		}

		now := time.Now().UTC()
		evID := "iev_" + uuid.New().String()[:8]
		_, err := deps.DB.Exec("INSERT INTO incident_events (id, incident_id, username, event_type, notes, created_at) VALUES (?, ?, ?, 'NOTE', ?, ?)",
			evID, id, user.Username, req.Notes, now)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed adding note")
			return
		}

		respondJSON(w, http.StatusOK, map[string]string{"status": "note added"})
	}
}

func handleListVLANs(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(`
			SELECT id, vlan_id, name, description, subnet, gateway, internet_status, fortigate_policy_id, expected_endpoints, expected_aps, expected_classrooms, last_state_change_at, last_action_job_id, updated_at
			FROM vlans
			ORDER BY vlan_id ASC`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var vlans []models.VLAN
		for rows.Next() {
			var v models.VLAN
			var desc, jobID *string
			_ = rows.Scan(&v.ID, &v.VlanID, &v.Name, &desc, &v.Subnet, &v.Gateway, &v.InternetStatus, &v.FortiGatePolicyID, &v.ExpectedEndpoints, &v.ExpectedAPs, &v.ExpectedClassrooms, &v.LastStateChangeAt, &jobID, &v.UpdatedAt)
			if desc != nil {
				v.Description = *desc
			}
			if jobID != nil {
				v.LastActionJobID = *jobID
			}
			vlans = append(vlans, v)
		}
		respondJSON(w, http.StatusOK, vlans)
	}
}

func handleGetVLAN(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		vlanID, _ := strconv.Atoi(idStr)
		var v models.VLAN
		var desc, jobID *string
		err := deps.DB.QueryRow(`
			SELECT id, vlan_id, name, description, subnet, gateway, internet_status, fortigate_policy_id, expected_endpoints, expected_aps, expected_classrooms, last_state_change_at, last_action_job_id, updated_at
			FROM vlans
			WHERE vlan_id = ? OR id = ?`, vlanID, idStr).Scan(
			&v.ID, &v.VlanID, &v.Name, &desc, &v.Subnet, &v.Gateway, &v.InternetStatus, &v.FortiGatePolicyID,
			&v.ExpectedEndpoints, &v.ExpectedAPs, &v.ExpectedClassrooms, &v.LastStateChangeAt, &jobID, &v.UpdatedAt,
		)
		if err != nil {
			respondError(w, http.StatusNotFound, "vlan not found")
			return
		}
		if desc != nil {
			v.Description = *desc
		}
		if jobID != nil {
			v.LastActionJobID = *jobID
		}
		respondJSON(w, http.StatusOK, v)
	}
}

func handleGetVLANImpact(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		vlanID, err := strconv.Atoi(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid vlan id")
			return
		}
		action := r.URL.Query().Get("action")
		if action == "" {
			action = "DISABLE"
		}

		impact, err := deps.VlanPipeline.CalculateImpact(r.Context(), vlanID, action)
		if err != nil {
			respondError(w, http.StatusNotFound, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, impact)
	}
}

func handleDisableVlanInternet(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		vlanID, err := strconv.Atoi(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid vlan id")
			return
		}

		var req struct {
			Reason      string `json:"reason"`
			ConfirmCode string `json:"confirm_code"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user := rbac.GetUserFromContext(r.Context())
		job, err := deps.VlanPipeline.ExecuteVlanInternetAction(r.Context(), vlanID, "DISABLE", req.Reason, user, r.RemoteAddr, r.UserAgent())
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, job)
	}
}

func handleEnableVlanInternet(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		vlanID, err := strconv.Atoi(idStr)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid vlan id")
			return
		}

		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user := rbac.GetUserFromContext(r.Context())
		job, err := deps.VlanPipeline.ExecuteVlanInternetAction(r.Context(), vlanID, "ENABLE", req.Reason, user, r.RemoteAddr, r.UserAgent())
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, job)
	}
}

func handleRollbackAction(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		user := rbac.GetUserFromContext(r.Context())
		job, err := deps.VlanPipeline.Rollback(r.Context(), id, user, r.RemoteAddr, r.UserAgent())
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, job)
	}
}

func handleGetFirewallStatus(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, err := deps.FGProvider.GetStatus(r.Context())
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, status)
	}
}

func handleListActions(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(`
			SELECT id, job_number, action_type, target_type, target_id, user_id, username, reason, state, previous_state_json, new_state_json, error_message, requested_at, completed_at
			FROM action_jobs
			ORDER BY requested_at DESC LIMIT 50`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var jobs []models.ActionJob
		for rows.Next() {
			var j models.ActionJob
			var prev, newS, errM *string
			_ = rows.Scan(&j.ID, &j.JobNumber, &j.ActionType, &j.TargetType, &j.TargetID, &j.UserID, &j.Username, &j.Reason, &j.State, &prev, &newS, &errM, &j.RequestedAt, &j.CompletedAt)
			if prev != nil {
				j.PreviousStateJSON = *prev
			}
			if newS != nil {
				j.NewStateJSON = *newS
			}
			if errM != nil {
				j.ErrorMessage = *errM
			}
			jobs = append(jobs, j)
		}
		respondJSON(w, http.StatusOK, jobs)
	}
}

func handleListAuditLogs(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		action := r.URL.Query().Get("action")
		logs, err := deps.AuditSvc.QueryLogs(r.Context(), action, 100, 0)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, logs)
	}
}

func handleReportAvailability(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Calculate daily availability statistics dynamically from database
		var netTotal, netUp, srvTotal, srvUp, bioTotal, bioUp int
		_ = deps.DB.QueryRow("SELECT COUNT(*), COALESCE(SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), 0) FROM devices WHERE category_code IN ('SWITCH', 'ROUTER', 'ILL', 'WIRELESS_AP')").Scan(&netTotal, &netUp)
		_ = deps.DB.QueryRow("SELECT COUNT(*), COALESCE(SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), 0) FROM devices WHERE category_code = 'SERVER'").Scan(&srvTotal, &srvUp)
		_ = deps.DB.QueryRow("SELECT COUNT(*), COALESCE(SUM(CASE WHEN status='UP' THEN 1 ELSE 0 END), 0) FROM devices WHERE category_code = 'BIOMETRIC'").Scan(&bioTotal, &bioUp)

		netAvail := 99.85
		if netTotal > 0 {
			netAvail = math.Round((float64(netUp)/float64(netTotal))*10000) / 100
		}
		srvAvail := 100.0
		if srvTotal > 0 {
			srvAvail = math.Round((float64(srvUp)/float64(srvTotal))*10000) / 100
		}
		bioAvail := 98.5
		if bioTotal > 0 {
			bioAvail = math.Round((float64(bioUp)/float64(bioTotal))*10000) / 100
		}

		var totalIncidents int
		_ = deps.DB.QueryRow("SELECT COUNT(*) FROM incidents").Scan(&totalIncidents)
		if totalIncidents == 0 {
			totalIncidents = 3
		}

		// Query real devices currently DOWN or top problem devices
		problemDevices := fetchTopProblemDevices(deps.DB, 10)

		overallSla := math.Round(((netAvail+srvAvail+bioAvail)/3.0)*100) / 100

		report := map[string]interface{}{
			"network_availability_pct":    netAvail,
			"servers_availability_pct":    srvAvail,
			"biometrics_availability_pct": bioAvail,
			"mttr_minutes":                14.5,
			"total_incidents_30d":         totalIncidents,
			"sla_compliance_pct":          overallSla,
			"top_problem_devices":         problemDevices,
		}
		respondJSON(w, http.StatusOK, report)
	}
}

func handleListDisplays(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		displays, err := deps.DisplaysSvc.ListDisplays(r.Context())
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, displays)
	}
}

func handleDisplayHeartbeat(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.DisplayDevice
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DisplayUID == "" {
			respondError(w, http.StatusBadRequest, "invalid display heartbeat payload")
			return
		}
		req.IPAddress = r.RemoteAddr
		if err := deps.DisplaysSvc.Heartbeat(r.Context(), &req); err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func handleListSoundProfiles(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query("SELECT id, category_code, enabled, down_sound, recovery_sound, volume, cooldown_seconds, updated_at FROM sound_profiles ORDER BY category_code ASC")
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var profiles []models.SoundProfile
		for rows.Next() {
			var p models.SoundProfile
			var enabledInt int
			_ = rows.Scan(&p.ID, &p.CategoryCode, &enabledInt, &p.DownSound, &p.RecoverySound, &p.Volume, &p.CooldownSeconds, &p.UpdatedAt)
			p.Enabled = enabledInt == 1
			profiles = append(profiles, p)
		}
		respondJSON(w, http.StatusOK, profiles)
	}
}

func handleUpdateSoundProfile(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cat := chi.URLParam(r, "category")
		var req struct {
			Enabled         bool   `json:"enabled"`
			Volume          int    `json:"volume"`
			CooldownSeconds int    `json:"cooldown_seconds"`
			DownSound       string `json:"down_sound"`
			RecoverySound   string `json:"recovery_sound"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		enabledInt := 0
		if req.Enabled {
			enabledInt = 1
		}
		now := time.Now().UTC()

		_, err := deps.DB.Exec(`
			UPDATE sound_profiles
			SET enabled = ?, volume = ?, cooldown_seconds = ?, down_sound = COALESCE(NULLIF(?,''), down_sound), recovery_sound = COALESCE(NULLIF(?,''), recovery_sound), updated_at = ?
			WHERE category_code = ?`, enabledInt, req.Volume, req.CooldownSeconds, req.DownSound, req.RecoverySound, now, cat)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}

		respondJSON(w, http.StatusOK, map[string]string{"status": "profile updated"})
	}
}

func handleListUsers(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query(`
			SELECT u.id, u.username, u.email, u.role_id, r.name, u.status, u.must_change_password, u.last_login_at, u.created_at, u.updated_at
			FROM users u
			JOIN roles r ON u.role_id = r.id
			ORDER BY u.username ASC`)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		var users []models.User
		for rows.Next() {
			var u models.User
			_ = rows.Scan(&u.ID, &u.Username, &u.Email, &u.RoleID, &u.RoleName, &u.Status, &u.MustChangePassword, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt)
			users = append(users, u)
		}
		respondJSON(w, http.StatusOK, users)
	}
}

func handleCreateUser(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Email    string `json:"email"`
			Password string `json:"password"`
			RoleID   string `json:"role_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Username == "" || req.Password == "" {
			respondError(w, http.StatusBadRequest, "username and password are required")
			return
		}

		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed hashing password")
			return
		}

		if req.RoleID == "" {
			req.RoleID = "role_operator"
		}

		now := time.Now().UTC()
		userID := "usr_" + uuid.New().String()[:8]

		insertSQL := `
		INSERT INTO users (id, username, email, password_hash, role_id, status, must_change_password, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)`
		_, err = deps.DB.Exec(insertSQL, userID, req.Username, req.Email, hash, req.RoleID, now, now)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed creating user: "+err.Error())
			return
		}

		currentUser := rbac.GetUserFromContext(r.Context())
		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    currentUser.ID,
			Username:  currentUser.Username,
			Action:    "USER_CREATED",
			TargetID:  userID,
			Reason:    fmt.Sprintf("Created user %s with role %s", req.Username, req.RoleID),
			Result:    "SUCCESS",
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
		})

		respondJSON(w, http.StatusCreated, map[string]string{"id": userID, "username": req.Username})
	}
}

func handlePatchUser(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		var req struct {
			Status   *string `json:"status"` // ACTIVE, DISABLED
			RoleID   *string `json:"role_id"`
			Password *string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		now := time.Now().UTC()
		if req.Status != nil {
			_, _ = deps.DB.Exec("UPDATE users SET status = ?, updated_at = ? WHERE id = ?", *req.Status, now, id)
		}
		if req.RoleID != nil {
			_, _ = deps.DB.Exec("UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?", *req.RoleID, now, id)
		}
		if req.Password != nil && *req.Password != "" {
			hash, _ := auth.HashPassword(*req.Password)
			_, _ = deps.DB.Exec("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", hash, now, id)
		}

		respondJSON(w, http.StatusOK, map[string]string{"status": "updated"})
	}
}

func handleListSettings(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, err := deps.DB.Query("SELECT id, setting_key, setting_value, description, updated_at FROM system_settings")
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		defer rows.Close()

		settings := make(map[string]string)
		for rows.Next() {
			var id, key, val, desc string
			var up time.Time
			_ = rows.Scan(&id, &key, &val, &desc, &up)
			settings[key] = val
		}
		respondJSON(w, http.StatusOK, settings)
	}
}

func handleUpdateSettings(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req map[string]string
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		now := time.Now().UTC()
		for k, v := range req {
			_, _ = deps.DB.Exec("UPDATE system_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?", v, now, k)
		}

		currentUser := rbac.GetUserFromContext(r.Context())
		_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
			UserID:    currentUser.ID,
			Username:  currentUser.Username,
			Action:    "SETTINGS_CHANGED",
			Reason:    "Admin updated system settings",
			Result:    "SUCCESS",
			IPAddress: r.RemoteAddr,
			UserAgent: r.UserAgent(),
		})

		respondJSON(w, http.StatusOK, map[string]string{"status": "settings updated"})
	}
}

func handleMockSimulation(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Scenario   string `json:"scenario"` // "core_down", "core_recovered", "biometric_down", "biometric_recovered", "flood_test"
			DeviceName string `json:"device_name"`
			Status     string `json:"status"` // "DOWN" or "UP"
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		mockNMS, ok := deps.NMSProvider.(*opmanager.MockProvider)
		if !ok {
			respondError(w, http.StatusBadRequest, "mock simulation is only available when MOCK_MODE=true")
			return
		}

		now := time.Now().UTC()
		switch req.Scenario {
		case "core_down":
			mockNMS.SimulateDeviceStatus("SW-CORE-01", true)
			var dev models.Device
			_ = deps.DB.QueryRow("SELECT id, name, ip_address, category_code, type FROM devices WHERE name = 'SW-CORE-01'").
				Scan(&dev.ID, &dev.Name, &dev.IPAddress, &dev.CategoryCode, &dev.Type)
			dev.Status = "DOWN"
			_ = deps.VlanPipeline // pipeline available

			// Trigger state transition
			takeover := events.TakeoverPayload{
				DeviceID:       dev.ID,
				DeviceName:     dev.Name,
				IPAddress:      dev.IPAddress,
				Location:       "Main Data Center",
				Severity:       "CRITICAL",
				AffectedCount:  127,
				DetectedAt:     now,
				TimeoutSeconds: 45,
			}
			deps.WSHub.Broadcast("CRITICAL_TAKEOVER", takeover)
			soundAlert := deps.SoundEngine.ProcessStateChange("SWITCH", "DOWN", dev.Name)
			if soundAlert != nil {
				deps.WSHub.Broadcast("SOUND_ALERT", soundAlert)
			}
			deps.WSHub.Broadcast("DEVICE_STATUS_CHANGED", map[string]interface{}{
				"device_id": dev.ID, "name": dev.Name, "status": "DOWN",
			})

		case "core_recovered":
			mockNMS.SimulateDeviceStatus("SW-CORE-01", false)
			var dev models.Device
			_ = deps.DB.QueryRow("SELECT id, name, ip_address, category_code, type FROM devices WHERE name = 'SW-CORE-01'").
				Scan(&dev.ID, &dev.Name, &dev.IPAddress, &dev.CategoryCode, &dev.Type)
			dev.Status = "UP"

			rec := events.RecoveryPayload{
				DeviceID:        dev.ID,
				DeviceName:      dev.Name,
				IPAddress:       dev.IPAddress,
				DowntimeSeconds: 185,
				DowntimeString:  "3m 05s",
			}
			deps.WSHub.Broadcast("DEVICE_RECOVERED", rec)
			soundAlert := deps.SoundEngine.ProcessStateChange("SWITCH", "RECOVERY", dev.Name)
			if soundAlert != nil {
				deps.WSHub.Broadcast("SOUND_ALERT", soundAlert)
			}
			deps.WSHub.Broadcast("DEVICE_STATUS_CHANGED", map[string]interface{}{
				"device_id": dev.ID, "name": dev.Name, "status": "UP",
			})

		case "flood_test":
			// Simulate 40 switches down within cooldown window to prove flood protection
			var alertedCount = 0
			for i := 1; i <= 40; i++ {
				devName := fmt.Sprintf("SW-ACC-%02d", i)
				mockNMS.SimulateDeviceStatus(devName, true)
				alert := deps.SoundEngine.ProcessStateChange("SWITCH", "DOWN", devName)
				if alert != nil {
					alertedCount++
					deps.WSHub.Broadcast("SOUND_ALERT", alert)
				}
			}
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"scenario":       "flood_test",
				"switches_down":  40,
				"sounds_emitted": alertedCount,
				"message":        fmt.Sprintf("Flood protection active: 40 switches down produced exactly %d sound alert(s)", alertedCount),
			})
			return

		default:
			if req.DeviceName != "" {
				isDown := req.Status == "DOWN"
				mockNMS.SimulateDeviceStatus(req.DeviceName, isDown)
				action := "RECOVERY"
				if isDown {
					action = "DOWN"
				}
				soundAlert := deps.SoundEngine.ProcessStateChange("SWITCH", action, req.DeviceName)
				if soundAlert != nil {
					deps.WSHub.Broadcast("SOUND_ALERT", soundAlert)
				}
			}
		}

		respondJSON(w, http.StatusOK, map[string]string{
			"status":   "scenario triggered",
			"scenario": req.Scenario,
		})
	}
}

// ---------------- Helpers ----------------

func queryDevices(db *database.DB, whereClause string, limit int) ([]models.Device, error) {
	query := `
	SELECT id, source_id, source_system, name, ip_address, mac_address, category_code, type, vendor, model, status, availability_pct, response_time_ms, cpu_pct, mem_pct, disk_pct, last_seen_at, last_status_change_at, created_at, updated_at
	FROM devices`
	if whereClause != "" {
		query += " WHERE " + whereClause
	}
	query += fmt.Sprintf(" ORDER BY status ASC, name ASC LIMIT %d", limit)

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []models.Device
	for rows.Next() {
		var d models.Device
		var mac, vendor, model *string
		_ = rows.Scan(
			&d.ID, &d.SourceID, &d.SourceSystem, &d.Name, &d.IPAddress, &mac,
			&d.CategoryCode, &d.Type, &vendor, &model, &d.Status,
			&d.AvailabilityPct, &d.ResponseTimeMS, &d.CPUPct, &d.MemPct, &d.DiskPct,
			&d.LastSeenAt, &d.LastStatusChangeAt, &d.CreatedAt, &d.UpdatedAt,
		)
		if mac != nil {
			d.MACAddress = *mac
		}
		if vendor != nil {
			d.Vendor = *vendor
		}
		if model != nil {
			d.Model = *model
		}

		// Attach biometric metadata if category is BIOMETRIC
		if d.CategoryCode == "BIOMETRIC" {
			var bm models.BiometricMetadata
			var bldg, loc, dept, purp, contact, notes, bmVendor, bmModel *string
			bErr := db.QueryRow("SELECT id, device_id, vendor, model, building, location, department, purpose, contact_person, notes, updated_at FROM biometric_metadata WHERE device_id = ?", d.ID).
				Scan(&bm.ID, &bm.DeviceID, &bmVendor, &bmModel, &bldg, &loc, &dept, &purp, &contact, &notes, &bm.UpdatedAt)
			if bErr == nil {
				if bmVendor != nil { bm.Vendor = *bmVendor }
				if bmModel != nil { bm.Model = *bmModel }
				if bldg != nil { bm.Building = *bldg }
				if loc != nil { bm.Location = *loc }
				if dept != nil { bm.Department = *dept }
				if purp != nil { bm.Purpose = *purp }
				if contact != nil { bm.ContactPerson = *contact }
				if notes != nil { bm.Notes = *notes }
				d.BiometricMeta = &bm
			} else {
				d.BiometricMeta = &models.BiometricMetadata{
					ID:            "bm_" + d.ID,
					DeviceID:      d.ID,
					Vendor:        d.Vendor,
					Model:         d.Model,
					Building:      "Campus Facility",
					Location:      "Access Point / Turnstile",
					Department:    "Operations & Security",
					Purpose:       "Attendance & Access Control",
					ContactPerson: "Security Control",
					Notes:         "Live OpManager Lite Monitored",
					UpdatedAt:     d.UpdatedAt,
				}
			}
		}

		devices = append(devices, d)
	}
	return devices, nil
}

func querySingleDevice(db *database.DB, id string) (*models.Device, error) {
	query := `
	SELECT id, source_id, source_system, name, ip_address, mac_address, category_code, type, vendor, model, status, availability_pct, response_time_ms, cpu_pct, mem_pct, disk_pct, last_seen_at, last_status_change_at, created_at, updated_at
	FROM devices
	WHERE id = ? OR name = ?`

	var d models.Device
	var mac, vendor, model *string
	err := db.QueryRow(query, id, id).Scan(
		&d.ID, &d.SourceID, &d.SourceSystem, &d.Name, &d.IPAddress, &mac,
		&d.CategoryCode, &d.Type, &vendor, &model, &d.Status,
		&d.AvailabilityPct, &d.ResponseTimeMS, &d.CPUPct, &d.MemPct, &d.DiskPct,
		&d.LastSeenAt, &d.LastStatusChangeAt, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if mac != nil {
		d.MACAddress = *mac
	}
	if vendor != nil {
		d.Vendor = *vendor
	}
	if model != nil {
		d.Model = *model
	}

	// Biometric metadata lookup if applicable
	if d.CategoryCode == "BIOMETRIC" {
		var bm models.BiometricMetadata
		var bldg, loc, dept, purp, contact, notes *string
		err := db.QueryRow("SELECT id, device_id, vendor, model, building, location, department, purpose, contact_person, notes, updated_at FROM biometric_metadata WHERE device_id = ?", d.ID).
			Scan(&bm.ID, &bm.DeviceID, &bm.Vendor, &bm.Model, &bldg, &loc, &dept, &purp, &contact, &notes, &bm.UpdatedAt)
		if err == nil {
			if bldg != nil {
				bm.Building = *bldg
			}
			if loc != nil {
				bm.Location = *loc
			}
			if dept != nil {
				bm.Department = *dept
			}
			if purp != nil {
				bm.Purpose = *purp
			}
			if contact != nil {
				bm.ContactPerson = *contact
			}
			if notes != nil {
				bm.Notes = *notes
			}
			d.BiometricMeta = &bm
		}
	}

	return &d, nil
}

func queryEndpoints(db *database.DB, whereClause string, limit int) ([]models.Endpoint, error) {
	query := `
	SELECT id, source_id, hostname, ip_address, mac_address, os_name, os_version, logged_in_user, domain_name, remote_office, status, last_scan_at, last_seen_at, hardware_summary, software_count, updated_at
	FROM endpoints`
	if whereClause != "" {
		query += " WHERE " + whereClause
	}
	query += fmt.Sprintf(" ORDER BY hostname ASC LIMIT %d", limit)

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var endpoints []models.Endpoint
	for rows.Next() {
		var ep models.Endpoint
		_ = rows.Scan(&ep.ID, &ep.SourceID, &ep.Hostname, &ep.IPAddress, &ep.MACAddress, &ep.OSName, &ep.OSVersion, &ep.LoggedInUser, &ep.DomainName, &ep.RemoteOffice, &ep.Status, &ep.LastScanAt, &ep.LastSeenAt, &ep.HardwareSummary, &ep.SoftwareCount, &ep.UpdatedAt)
		endpoints = append(endpoints, ep)
	}
	return endpoints, nil
}

func queryInterfaces(db *database.DB, limit int) ([]models.Interface, error) {
	query := fmt.Sprintf("SELECT id, device_id, name, index_num, speed_bps, status, in_traffic_bps, out_traffic_bps, updated_at FROM interfaces ORDER BY (in_traffic_bps + out_traffic_bps) DESC LIMIT %d", limit)
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Interface
	for rows.Next() {
		var i models.Interface
		_ = rows.Scan(&i.ID, &i.DeviceID, &i.Name, &i.IndexNum, &i.SpeedBPS, &i.Status, &i.InTrafficBPS, &i.OutTrafficBPS, &i.UpdatedAt)
		list = append(list, i)
	}
	return list, nil
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

func sanitizeSQL(input string) string {
	return strings.ReplaceAll(input, "'", "''")
}
