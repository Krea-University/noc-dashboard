package automation_test

import (
	"context"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/automation"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/fortigate"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

func setupPipelineDB(t *testing.T) *database.DB {
	cfg := &config.Config{
		DBDriver: "sqlite",
		DBName:   ":memory:",
	}
	db, err := database.Connect(cfg)
	if err != nil {
		t.Fatalf("failed connecting test db: %v", err)
	}

	createSQL := `
	CREATE TABLE vlans (
		id VARCHAR(36) PRIMARY KEY,
		vlan_id INTEGER UNIQUE NOT NULL,
		name VARCHAR(64) NOT NULL,
		description VARCHAR(255),
		subnet VARCHAR(64) NOT NULL,
		gateway VARCHAR(45) NOT NULL,
		internet_status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
		fortigate_policy_id INTEGER,
		expected_endpoints INTEGER DEFAULT 0,
		expected_aps INTEGER DEFAULT 0,
		expected_classrooms INTEGER DEFAULT 0,
		last_state_change_at DATETIME,
		last_action_job_id VARCHAR(36),
		updated_at DATETIME NOT NULL
	);
	CREATE TABLE action_jobs (
		id VARCHAR(36) PRIMARY KEY,
		job_number VARCHAR(32) UNIQUE NOT NULL,
		action_type VARCHAR(32) NOT NULL,
		target_type VARCHAR(32) NOT NULL,
		target_id VARCHAR(64) NOT NULL,
		user_id VARCHAR(36) NOT NULL,
		username VARCHAR(64) NOT NULL,
		reason TEXT NOT NULL,
		state VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
		previous_state_json TEXT,
		new_state_json TEXT,
		api_request_json TEXT,
		api_response_json TEXT,
		verification_result_json TEXT,
		error_message TEXT,
		requested_at DATETIME NOT NULL,
		started_at DATETIME,
		completed_at DATETIME
	);
	CREATE TABLE audit_logs (
		id VARCHAR(36) PRIMARY KEY,
		user_id VARCHAR(36),
		username VARCHAR(64) NOT NULL,
		action VARCHAR(64) NOT NULL,
		target_type VARCHAR(32),
		target_id VARCHAR(64),
		ip_address VARCHAR(45),
		user_agent TEXT,
		previous_state_json TEXT,
		new_state_json TEXT,
		result VARCHAR(20) NOT NULL,
		reason TEXT,
		metadata_json TEXT,
		timestamp DATETIME NOT NULL
	);
	INSERT INTO vlans VALUES ('vlan_120', 120, 'Students', 'Hostel BYOD', '10.120.0.0/19', '10.120.0.1', 'ENABLED', 1201, 850, 48, 24, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP);`

	_, err = db.Exec(createSQL)
	if err != nil {
		t.Fatalf("failed setup tables: %v", err)
	}

	return db
}

func TestVlanPipelineExecutionAndRollback(t *testing.T) {
	db := setupPipelineDB(t)
	defer db.Close()

	fgMock := fortigate.NewMockProvider()
	auditSvc := audit.NewService(db)
	wsHub := websocket.NewHub()
	go wsHub.Run()

	pipeline := automation.NewPipeline(db, fgMock, auditSvc, wsHub)
	ctx := context.Background()

	netOpUser := &models.User{
		ID:          "usr_net_op",
		Username:    "net_operator",
		RoleName:    "NETWORK_OPERATOR",
		Permissions: []string{"vlan.internet.disable", "vlan.internet.enable"},
	}

	viewerUser := &models.User{
		ID:          "usr_viewer",
		Username:    "viewer",
		RoleName:    "VIEWER",
		Permissions: []string{"dashboard.view"},
	}

	// 1. Unauthorized user attempt -> MUST FAIL
	_, err := pipeline.ExecuteVlanInternetAction(ctx, 120, "DISABLE", "Valid reason", viewerUser, "127.0.0.1", "curl")
	if err == nil {
		t.Fatal("expected unauthorized user to fail")
	}

	// 2. Empty reason -> MUST FAIL
	_, err = pipeline.ExecuteVlanInternetAction(ctx, 120, "DISABLE", "   ", netOpUser, "127.0.0.1", "curl")
	if err == nil {
		t.Fatal("expected empty reason to fail")
	}

	// 3. Impact estimation check
	impact, err := pipeline.CalculateImpact(ctx, 120, "DISABLE")
	if err != nil {
		t.Fatalf("failed calculating impact: %v", err)
	}
	if impact.ExpectedEndpoints != 850 || impact.ExpectedAPs != 48 {
		t.Errorf("unexpected impact: %+v", impact)
	}

	// 4. Authorized execution of DISABLE
	job, err := pipeline.ExecuteVlanInternetAction(ctx, 120, "DISABLE", "Campus exam security lockdown", netOpUser, "10.0.0.1", "Mozilla")
	if err != nil {
		t.Fatalf("failed disabling vlan internet: %v", err)
	}

	if job.State != "SUCCESS" {
		t.Errorf("expected job state SUCCESS, got: %s", job.State)
	}

	// Verify local DB status updated
	var liveStatus string
	_ = db.QueryRow("SELECT internet_status FROM vlans WHERE vlan_id = 120").Scan(&liveStatus)
	if liveStatus != "DISABLED" {
		t.Errorf("expected vlan status DISABLED in DB, got: %s", liveStatus)
	}

	// Verify audit log written
	var auditCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE action = 'VLAN_INTERNET_DISABLE' AND result = 'SUCCESS'").Scan(&auditCount)
	if auditCount != 1 {
		t.Errorf("expected 1 audit log, got %d", auditCount)
	}

	// 5. Test Rollback -> restores previous state (ENABLED)
	rollbackJob, err := pipeline.Rollback(ctx, job.ID, netOpUser, "10.0.0.1", "Mozilla")
	if err != nil {
		t.Fatalf("failed rollback: %v", err)
	}
	if rollbackJob.State != "SUCCESS" {
		t.Errorf("expected rollback job SUCCESS, got: %s", rollbackJob.State)
	}

	_ = db.QueryRow("SELECT internet_status FROM vlans WHERE vlan_id = 120").Scan(&liveStatus)
	if liveStatus != "ENABLED" {
		t.Errorf("expected vlan status restored to ENABLED after rollback, got: %s", liveStatus)
	}
}
