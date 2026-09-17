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
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

func TestAuthPolicyPasswordLoginDisabled(t *testing.T) {
	cfg := &config.Config{
		DBDriver:                 "sqlite",
		DBName:                   ":memory:",
		SessionSecret:            "test_session_secret_32_bytes_long!!",
		JWTEmbedSecret:           "test_jwt_embed_secret_krea_erp_2026",
		BootstrapAdminUsername:   "admin",
		BootstrapAdminPassword:   "AdminPassword123!",
		BootstrapAdminEmail:      "admin@krea.edu.in",
		NOCAllowedOrigins:        []string{"http://localhost:5173"},
		NOCEmbedAllowedOrigins:   []string{"https://erp.krea.edu.in"},
		GoogleClientID:           "test-google-client-id.apps.googleusercontent.com",
		AuthPasswordLoginEnabled: true,
	}

	db, err := database.Connect(cfg)
	if err != nil {
		t.Fatalf("database connect failed: %v", err)
	}
	defer db.Close()

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

	// 1. Initial State: password login is enabled
	reqConf := httptest.NewRequest("GET", "/api/auth/config", nil)
	rrConf := httptest.NewRecorder()
	router.ServeHTTP(rrConf, reqConf)

	if rrConf.Code != http.StatusOK {
		t.Fatalf("expected 200 from /api/auth/config, got %d", rrConf.Code)
	}

	var confResp map[string]interface{}
	_ = json.Unmarshal(rrConf.Body.Bytes(), &confResp)
	if confResp["password_login_enabled"] != true {
		t.Errorf("expected password_login_enabled to be true, got %v", confResp["password_login_enabled"])
	}

	// 2. Admin logs in and updates setting to disable password login (Google Only)
	_, token, err := authSvc.Authenticate("admin", "AdminPassword123!", "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatalf("admin auth failed: %v", err)
	}

	settingsPayload, _ := json.Marshal(map[string]string{
		"auth_password_login_enabled": "false",
		"auth_mode":                   "google_only",
	})
	reqUpdate := httptest.NewRequest("PUT", "/api/settings", bytes.NewBuffer(settingsPayload))
	reqUpdate.Header.Set("Content-Type", "application/json")
	reqUpdate.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	rrUpdate := httptest.NewRecorder()
	router.ServeHTTP(rrUpdate, reqUpdate)

	if rrUpdate.Code != http.StatusOK {
		t.Fatalf("expected 200 from PUT /api/settings, got %d: %s", rrUpdate.Code, rrUpdate.Body.String())
	}

	// 3. Verify /api/auth/config now returns password_login_enabled: false and google_only: true
	rrConf2 := httptest.NewRecorder()
	router.ServeHTTP(rrConf2, reqConf)

	var confResp2 map[string]interface{}
	_ = json.Unmarshal(rrConf2.Body.Bytes(), &confResp2)
	if confResp2["password_login_enabled"] != false {
		t.Errorf("expected password_login_enabled to be false, got %v", confResp2["password_login_enabled"])
	}
	if confResp2["google_only"] != true {
		t.Errorf("expected google_only to be true, got %v", confResp2["google_only"])
	}

	// 4. Attempt to login with password -> MUST be rejected with 403 Forbidden
	loginPayload, _ := json.Marshal(map[string]string{
		"username": "admin",
		"password": "AdminPassword123!",
	})
	reqLogin := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(loginPayload))
	reqLogin.Header.Set("Content-Type", "application/json")
	rrLogin := httptest.NewRecorder()
	router.ServeHTTP(rrLogin, reqLogin)

	if rrLogin.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when password login disabled, got %d: %s", rrLogin.Code, rrLogin.Body.String())
	}

	t.Logf("Auth policy test passed: config=%+v, blocked_response=%s", confResp2, rrLogin.Body.String())
}
