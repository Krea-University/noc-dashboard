package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/auth"
	"github.com/Krea-University/noc-dashboard/backend/internal/automation"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/fortigate"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

func setupVlanTestRouter(t *testing.T) (http.Handler, *database.DB, *auth.Service, string, string) {
	cfg := &config.Config{
		DBDriver:               "sqlite",
		DBName:                 ":memory:",
		SessionSecret:          "test_session_secret_32_bytes_long!!",
		JWTEmbedSecret:         "test_jwt_embed_secret_krea_erp_2026",
		BootstrapAdminUsername: "admin",
		BootstrapAdminPassword: "AdminPassword123!",
		BootstrapAdminEmail:    "admin@krea.edu.in",
		NOCAllowedOrigins:      []string{"http://localhost:5173"},
		NOCEmbedAllowedOrigins: []string{"https://erp.krea.edu.in"},
	}

	db, err := database.Connect(cfg)
	if err != nil {
		t.Fatalf("database connect failed: %v", err)
	}

	if err := db.RunMigrations("../../migrations"); err != nil {
		t.Fatalf("run migrations failed: %v", err)
	}

	authSvc := auth.NewService(db, cfg)
	if err := authSvc.BootstrapAdmin(); err != nil {
		t.Fatalf("bootstrap admin failed: %v", err)
	}

	auditSvc := audit.NewService(db)
	fgMock := fortigate.NewMockProvider()
	wsHub := websocket.NewHub()
	go wsHub.Run()
	pipeline := automation.NewPipeline(db, fgMock, auditSvc, wsHub)

	deps := &RouterDeps{
		Cfg:          cfg,
		DB:           db,
		AuthSvc:      authSvc,
		AuditSvc:     auditSvc,
		FGProvider:   fgMock,
		VlanPipeline: pipeline,
		WSHub:        wsHub,
	}

	router := SetupRouter(deps)

	adminUser, token, err := authSvc.Authenticate("admin", "AdminPassword123!", "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatalf("admin authentication failed: %v", err)
	}

	return router, db, authSvc, adminUser.ID, token
}

func TestVlanSyncAndAuthentication(t *testing.T) {
	router, db, _, _, token := setupVlanTestRouter(t)
	defer db.Close()

	// 1. Test POST /api/vlans/sync
	reqSync := httptest.NewRequest("POST", "/api/vlans/sync", nil)
	reqSync.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wSync := httptest.NewRecorder()
	router.ServeHTTP(wSync, reqSync)

	if wSync.Code != http.StatusOK {
		t.Fatalf("expected 200 from POST /api/vlans/sync, got %d: %s", wSync.Code, wSync.Body.String())
	}

	var syncResp struct {
		Status      string        `json:"status"`
		SyncedCount int           `json:"synced_count"`
		Vlans       []models.VLAN `json:"vlans"`
	}
	if err := json.NewDecoder(wSync.Body).Decode(&syncResp); err != nil {
		t.Fatalf("failed decoding sync response: %v", err)
	}
	if syncResp.SyncedCount == 0 || len(syncResp.Vlans) == 0 {
		t.Fatalf("expected synced vlans, got %d", syncResp.SyncedCount)
	}

	// 2. Test Disable without password -> Should fail 400 Bad Request
	bodyNoPass, _ := json.Marshal(map[string]string{
		"reason": "Testing without password",
	})
	reqNoPass := httptest.NewRequest("POST", "/api/vlans/160/internet/disable", bytes.NewBuffer(bodyNoPass))
	reqNoPass.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wNoPass := httptest.NewRecorder()
	router.ServeHTTP(wNoPass, reqNoPass)

	if wNoPass.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when missing password, got %d: %s", wNoPass.Code, wNoPass.Body.String())
	}

	// 3. Test Disable with wrong password -> Should fail 401 Unauthorized
	bodyWrongPass, _ := json.Marshal(map[string]string{
		"reason":   "Testing with wrong password",
		"password": "WrongPassword123!",
	})
	reqWrongPass := httptest.NewRequest("POST", "/api/vlans/160/internet/disable", bytes.NewBuffer(bodyWrongPass))
	reqWrongPass.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wWrongPass := httptest.NewRecorder()
	router.ServeHTTP(wWrongPass, reqWrongPass)

	if wWrongPass.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when wrong password, got %d: %s", wWrongPass.Code, wWrongPass.Body.String())
	}

	// 4. Test Disable with correct password -> Should succeed 200 OK
	bodyCorrectPass, _ := json.Marshal(map[string]string{
		"reason":   "Emergency Quarantine Procedure",
		"password": "AdminPassword123!",
	})
	reqCorrectPass := httptest.NewRequest("POST", "/api/vlans/160/internet/disable", bytes.NewBuffer(bodyCorrectPass))
	reqCorrectPass.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wCorrectPass := httptest.NewRecorder()
	router.ServeHTTP(wCorrectPass, reqCorrectPass)

	if wCorrectPass.Code != http.StatusOK {
		t.Fatalf("expected 200 with correct password, got %d: %s", wCorrectPass.Code, wCorrectPass.Body.String())
	}

	var job models.ActionJob
	if err := json.NewDecoder(wCorrectPass.Body).Decode(&job); err != nil {
		t.Fatalf("failed decoding action job: %v", err)
	}
	if job.State != "SUCCESS" {
		t.Fatalf("expected job state SUCCESS, got: %s", job.State)
	}

	// 5. Test Enable with correct password -> Should succeed 200 OK
	bodyEnable, _ := json.Marshal(map[string]string{
		"reason":   "Restoring Internet after examination",
		"password": "AdminPassword123!",
	})
	reqEnable := httptest.NewRequest("POST", "/api/vlans/160/internet/enable", bytes.NewBuffer(bodyEnable))
	reqEnable.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wEnable := httptest.NewRecorder()
	router.ServeHTTP(wEnable, reqEnable)

	if wEnable.Code != http.StatusOK {
		t.Fatalf("expected 200 with correct password for enable, got %d: %s", wEnable.Code, wEnable.Body.String())
	}
}
