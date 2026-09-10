package automation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/rbac"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

// ImpactEstimateDTO summarizes the expected blast radius before confirming a network action.
type ImpactEstimateDTO struct {
	VlanID             int    `json:"vlan_id"`
	VlanName           string `json:"vlan_name"`
	TargetAction       string `json:"target_action"` // DISABLE or ENABLE
	ExpectedEndpoints  int    `json:"expected_endpoints"`
	ExpectedAPs        int    `json:"expected_aps"`
	ExpectedClassrooms int    `json:"expected_classrooms"`
	InternalNetwork    string `json:"internal_network"` // AVAILABLE
	InternetAccess     string `json:"internet_access"`  // WILL BE BLOCKED or WILL BE RESTORED
}

// Pipeline coordinates safe, verified network configuration changes on FortiGate.
type Pipeline struct {
	db          *database.DB
	fgProvider  integrations.FirewallProvider
	auditSvc    *audit.Service
	wsHub       *websocket.Hub
	mu          sync.Mutex
}

// NewPipeline creates a new FortiGate automation pipeline.
func NewPipeline(
	db *database.DB,
	fgProvider integrations.FirewallProvider,
	auditSvc *audit.Service,
	wsHub *websocket.Hub,
) *Pipeline {
	return &Pipeline{
		db:         db,
		fgProvider: fgProvider,
		auditSvc:   auditSvc,
		wsHub:      wsHub,
	}
}

// CalculateImpact estimates the operational blast radius of toggling a VLAN.
func (p *Pipeline) CalculateImpact(ctx context.Context, vlanID int, action string) (*ImpactEstimateDTO, error) {
	var vlan models.VLAN
	query := `
	SELECT vlan_id, name, internet_status, expected_endpoints, expected_aps, expected_classrooms
	FROM vlans
	WHERE vlan_id = ?`
	err := p.db.QueryRow(query, vlanID).Scan(
		&vlan.VlanID, &vlan.Name, &vlan.InternetStatus,
		&vlan.ExpectedEndpoints, &vlan.ExpectedAPs, &vlan.ExpectedClassrooms,
	)
	if err != nil {
		return nil, fmt.Errorf("vlan not found: %d", vlanID)
	}

	internetText := "WILL BE BLOCKED"
	if strings.ToUpper(action) == "ENABLE" {
		internetText = "WILL BE RESTORED"
	}

	return &ImpactEstimateDTO{
		VlanID:             vlan.VlanID,
		VlanName:           vlan.Name,
		TargetAction:       strings.ToUpper(action),
		ExpectedEndpoints:  vlan.ExpectedEndpoints,
		ExpectedAPs:        vlan.ExpectedAPs,
		ExpectedClassrooms: vlan.ExpectedClassrooms,
		InternalNetwork:    "AVAILABLE",
		InternetAccess:     internetText,
	}, nil
}

// ExecuteVlanInternetAction runs the 12-step pipeline for disabling or enabling VLAN internet.
func (p *Pipeline) ExecuteVlanInternetAction(ctx context.Context, vlanID int, action string, reason string, user *models.User, ip, userAgent string) (*models.ActionJob, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	actionUpper := strings.ToUpper(action)
	if actionUpper != "DISABLE" && actionUpper != "ENABLE" {
		return nil, errors.New("invalid action: must be DISABLE or ENABLE")
	}

	// 1. Authenticate user & validate permission
	if user == nil {
		return nil, errors.New("authentication required")
	}
	requiredPerm := "vlan.internet.disable"
	if actionUpper == "ENABLE" {
		requiredPerm = "vlan.internet.enable"
	}
	if !rbac.HasPermission(user, requiredPerm) {
		return nil, fmt.Errorf("permission denied: %s required", requiredPerm)
	}

	// 2. Require reason
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("a non-empty operational justification reason is strictly required")
	}

	// 3. Validate target VLAN & fetch current state
	var vlan models.VLAN
	query := `
	SELECT id, vlan_id, name, internet_status, fortigate_policy_id
	FROM vlans
	WHERE vlan_id = ?`
	err := p.db.QueryRow(query, vlanID).Scan(
		&vlan.ID, &vlan.VlanID, &vlan.Name, &vlan.InternetStatus, &vlan.FortiGatePolicyID,
	)
	if err != nil {
		return nil, fmt.Errorf("vlan not found: %d", vlanID)
	}

	previousState := vlan.InternetStatus
	desiredState := "DISABLED"
	if actionUpper == "ENABLE" {
		desiredState = "ENABLED"
	}

	// 4. Create Action Job in QUEUED state
	jobID := "job_" + uuid.New().String()[:8]
	jobNum := fmt.Sprintf("ACT-%d-%06d-%s", time.Now().Year(), time.Now().UnixNano()%1000000, uuid.New().String()[:4])
	now := time.Now().UTC()

	prevStateJSON, _ := json.Marshal(map[string]interface{}{
		"vlan_id":         vlan.VlanID,
		"name":            vlan.Name,
		"internet_status": previousState,
		"policy_id":       vlan.FortiGatePolicyID,
	})

	job := &models.ActionJob{
		ID:                jobID,
		JobNumber:         jobNum,
		ActionType:        "VLAN_INTERNET_" + actionUpper,
		TargetType:        "VLAN",
		TargetID:          fmt.Sprintf("%d", vlan.VlanID),
		UserID:            user.ID,
		Username:          user.Username,
		Reason:            reason,
		State:             "QUEUED",
		PreviousStateJSON: string(prevStateJSON),
		RequestedAt:       now,
	}

	insertSQL := `
	INSERT INTO action_jobs (id, job_number, action_type, target_type, target_id, user_id, username, reason, state, previous_state_json, requested_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = p.db.Exec(insertSQL, job.ID, job.JobNumber, job.ActionType, job.TargetType, job.TargetID, job.UserID, job.Username, job.Reason, job.State, job.PreviousStateJSON, job.RequestedAt)
	if err != nil {
		return nil, fmt.Errorf("failed creating action job: %w", err)
	}

	p.wsHub.Broadcast("ACTION_STARTED", job)

	// Step 5: VALIDATING
	p.updateJobState(job.ID, "VALIDATING", "", "")

	// Step 6: EXECUTING via FortiGate Provider
	p.updateJobState(job.ID, "EXECUTING", "", "")
	var fgResult *integrations.FortiGateActionResult
	if actionUpper == "DISABLE" {
		fgResult, err = p.fgProvider.DisableInternet(ctx, vlan.VlanID, vlan.FortiGatePolicyID, reason)
	} else {
		fgResult, err = p.fgProvider.EnableInternet(ctx, vlan.VlanID, vlan.FortiGatePolicyID, reason)
	}

	if err != nil {
		p.failJob(job, fmt.Sprintf("FortiGate API execution failed: %v", err), user, ip, userAgent)
		return job, err
	}

	// Step 7: MANDATORY POST-EXECUTION VERIFICATION
	p.updateJobState(job.ID, "VERIFYING", fgResult.RawResponse, "")

	verifiedStatus, isVerified, verErr := p.fgProvider.VerifyInternetState(ctx, vlan.VlanID, vlan.FortiGatePolicyID)
	if verErr != nil || !isVerified || verifiedStatus != desiredState {
		errText := fmt.Sprintf("Mandatory verification failed: expected %s but live firewall status is %s", desiredState, verifiedStatus)
		p.failJob(job, errText, user, ip, userAgent)
		return job, errors.New(errText)
	}

	// Step 8: Verification PASSED -> mark SUCCESS
	completedTime := time.Now().UTC()
	newStateJSON, _ := json.Marshal(map[string]interface{}{
		"vlan_id":         vlan.VlanID,
		"internet_status": desiredState,
		"verified_status": verifiedStatus,
	})

	updateSuccessSQL := `
	UPDATE action_jobs
	SET state = 'SUCCESS', new_state_json = ?, api_response_json = ?, verification_result_json = ?, completed_at = ?
	WHERE id = ?`
	_, _ = p.db.Exec(updateSuccessSQL, string(newStateJSON), fgResult.RawResponse, verifiedStatus, completedTime, job.ID)

	// Step 9: Update local VLAN state in DB
	_, _ = p.db.Exec(`
		UPDATE vlans
		SET internet_status = ?, last_state_change_at = ?, last_action_job_id = ?, updated_at = ?
		WHERE vlan_id = ?`, desiredState, completedTime, job.ID, completedTime, vlan.VlanID)

	// Step 10: Immutable Audit Log
	_ = p.auditSvc.Log(ctx, &models.AuditLog{
		UserID:            user.ID,
		Username:          user.Username,
		Action:            job.ActionType,
		TargetType:        "VLAN",
		TargetID:          fmt.Sprintf("%d", vlan.VlanID),
		IPAddress:         ip,
		UserAgent:         userAgent,
		PreviousStateJSON: job.PreviousStateJSON,
		NewStateJSON:      string(newStateJSON),
		Result:            "SUCCESS",
		Reason:            reason,
		MetadataJSON:      fgResult.RawResponse,
		Timestamp:         completedTime,
	})

	job.State = "SUCCESS"
	job.NewStateJSON = string(newStateJSON)
	job.CompletedAt = &completedTime

	// Step 11: Broadcast completion
	p.wsHub.Broadcast("ACTION_COMPLETED", job)
	p.wsHub.Broadcast("VLAN_UPDATED", map[string]interface{}{
		"vlan_id":         vlan.VlanID,
		"internet_status": desiredState,
	})

	slog.Info("VLAN internet action completed and verified successfully",
		"vlan_id", vlan.VlanID, "action", actionUpper, "job", job.JobNumber)

	return job, nil
}

// Rollback restores the previous state of a completed action job.
func (p *Pipeline) Rollback(ctx context.Context, jobID string, user *models.User, ip, userAgent string) (*models.ActionJob, error) {
	var job models.ActionJob
	query := `
	SELECT id, job_number, action_type, target_id, previous_state_json, state
	FROM action_jobs
	WHERE id = ?`
	err := p.db.QueryRow(query, jobID).Scan(
		&job.ID, &job.JobNumber, &job.ActionType, &job.TargetID, &job.PreviousStateJSON, &job.State,
	)
	if err != nil {
		return nil, fmt.Errorf("job not found: %s", jobID)
	}

	if job.State != "SUCCESS" {
		return nil, errors.New("cannot rollback an uncompleted or failed job")
	}

	var prevData struct {
		VlanID         int    `json:"vlan_id"`
		InternetStatus string `json:"internet_status"`
	}
	if err := json.Unmarshal([]byte(job.PreviousStateJSON), &prevData); err != nil {
		return nil, fmt.Errorf("failed parsing previous state for rollback: %w", err)
	}

	rollbackAction := "ENABLE"
	if prevData.InternetStatus == "DISABLED" {
		rollbackAction = "DISABLE"
	}

	reason := fmt.Sprintf("Rollback of action job %s", job.JobNumber)
	return p.ExecuteVlanInternetAction(ctx, prevData.VlanID, rollbackAction, reason, user, ip, userAgent)
}

func (p *Pipeline) updateJobState(jobID, state, apiResp, verResult string) {
	now := time.Now().UTC()
	_, _ = p.db.Exec("UPDATE action_jobs SET state = ?, api_response_json = ?, started_at = COALESCE(started_at, ?) WHERE id = ?",
		state, apiResp, now, jobID)
	p.wsHub.Broadcast("ACTION_UPDATED", map[string]string{"job_id": jobID, "state": state})
}

func (p *Pipeline) failJob(job *models.ActionJob, errText string, user *models.User, ip, userAgent string) {
	completedTime := time.Now().UTC()
	_, _ = p.db.Exec("UPDATE action_jobs SET state = 'FAILED', error_message = ?, completed_at = ? WHERE id = ?",
		errText, completedTime, job.ID)

	job.State = "FAILED"
	job.ErrorMessage = errText
	job.CompletedAt = &completedTime

	_ = p.auditSvc.Log(context.Background(), &models.AuditLog{
		UserID:            user.ID,
		Username:          user.Username,
		Action:            job.ActionType,
		TargetType:        job.TargetType,
		TargetID:          job.TargetID,
		IPAddress:         ip,
		UserAgent:         userAgent,
		PreviousStateJSON: job.PreviousStateJSON,
		Result:            "FAILURE",
		Reason:            job.Reason,
		MetadataJSON:      errText,
		Timestamp:         completedTime,
	})

	p.wsHub.Broadcast("ACTION_FAILED", job)
}
