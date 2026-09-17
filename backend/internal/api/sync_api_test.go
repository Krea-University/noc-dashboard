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
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/endpointcentral"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/fortigate"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/opmanager"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

func setupSyncTestRouter(t *testing.T) (http.Handler, *database.DB, string) {
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
	nmsMock := opmanager.NewMockProvider()
	epcMock := endpointcentral.NewMockProvider()
	wsHub := websocket.NewHub()
	go wsHub.Run()

	pipeline := automation.NewPipeline(db, fgMock, auditSvc, wsHub)
	syncEngine := automation.NewSyncReconciliationEngine(db, nmsMock, epcMock, fgMock, auditSvc, wsHub)

	deps := &RouterDeps{
		Cfg:          cfg,
		DB:           db,
		AuthSvc:      authSvc,
		AuditSvc:     auditSvc,
		FGProvider:   fgMock,
		NMSProvider:  nmsMock,
		EPCProvider:  epcMock,
		VlanPipeline: pipeline,
		SyncEngine:   syncEngine,
		WSHub:        wsHub,
	}

	router := SetupRouter(deps)

	_, token, err := authSvc.Authenticate("admin", "AdminPassword123!", "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatalf("admin authentication failed: %v", err)
	}

	return router, db, token
}

func TestInfrastructureSyncPreviewAPI(t *testing.T) {
	router, _, token := setupSyncTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/infrastructure/sync/preview", nil)
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var preview automation.SyncPreviewResult
	if err := json.Unmarshal(rr.Body.Bytes(), &preview); err != nil {
		t.Fatalf("failed unmarshaling preview response: %v", err)
	}

	if preview.UpstreamSummary.OpManagerDevices == 0 {
		t.Errorf("expected > 0 opmanager devices in upstream summary, got 0")
	}

	t.Logf("Preview returned: %d to add, %d to update, %d to remove",
		preview.Counts.AddCount, preview.Counts.UpdateCount, preview.Counts.RemoveCount)
}

func TestInfrastructureSyncExecuteAPI(t *testing.T) {
	router, db, token := setupSyncTestRouter(t)

	execPayload := automation.SyncExecuteRequest{
		RemoveMode: "decommission",
		Reason:     "Automated test reconciliation",
	}
	body, _ := json.Marshal(execPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/infrastructure/sync/execute", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result automation.SyncExecuteResult
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed unmarshaling execute response: %v", err)
	}

	if result.Status != "SUCCESS" {
		t.Errorf("expected SUCCESS status, got %s", result.Status)
	}
	if result.AddedCount == 0 && result.UpdatedCount == 0 {
		t.Errorf("expected added or updated devices, got added=%d, updated=%d", result.AddedCount, result.UpdatedCount)
	}

	// Verify in DB that devices were inserted
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM devices").Scan(&count)
	if err != nil {
		t.Fatalf("db query failed: %v", err)
	}
	if count == 0 {
		t.Errorf("expected devices table to have records after sync, got %d", count)
	}

	t.Logf("Sync executed successfully: JobID=%s, Added=%d, Updated=%d, DBTotal=%d",
		result.JobID, result.AddedCount, result.UpdatedCount, count)
}
