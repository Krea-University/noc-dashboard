package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/auth"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

func setupTestRouter(t *testing.T) (http.Handler, *database.DB, *auth.Service, string, string) {
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

	deps := &RouterDeps{
		Cfg:      cfg,
		DB:       db,
		AuthSvc:  authSvc,
		AuditSvc: auditSvc,
	}

	router := SetupRouter(deps)

	// Authenticate admin to get a valid session token
	adminUser, token, err := authSvc.Authenticate("admin", "AdminPassword123!", "127.0.0.1", "test-agent")
	if err != nil {
		t.Fatalf("admin authentication failed: %v", err)
	}

	return router, db, authSvc, adminUser.ID, token
}

func TestUserManagementEndpoints(t *testing.T) {
	router, db, _, adminID, token := setupTestRouter(t)
	defer db.Close()

	// 1. Test GET /api/roles
	reqRoles := httptest.NewRequest("GET", "/api/roles", nil)
	reqRoles.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wRoles := httptest.NewRecorder()
	router.ServeHTTP(wRoles, reqRoles)

	if wRoles.Code != http.StatusOK {
		t.Fatalf("expected 200 from GET /api/roles, got %d: %s", wRoles.Code, wRoles.Body.String())
	}
	var roles []models.Role
	if err := json.NewDecoder(wRoles.Body).Decode(&roles); err != nil || len(roles) == 0 {
		t.Fatalf("failed decoding roles response: %v, len=%d", err, len(roles))
	}

	// 2. Test POST /api/users (Create a new operator)
	newUser := map[string]interface{}{
		"username": "op_test1",
		"email":    "op_test1@krea.edu.in",
		"password": "Password123!",
		"role_id":  "role_operator",
	}
	body, _ := json.Marshal(newUser)
	reqCreate := httptest.NewRequest("POST", "/api/users", bytes.NewReader(body))
	reqCreate.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wCreate := httptest.NewRecorder()
	router.ServeHTTP(wCreate, reqCreate)

	if wCreate.Code != http.StatusCreated {
		t.Fatalf("expected 201 from POST /api/users, got %d: %s", wCreate.Code, wCreate.Body.String())
	}
	var createdResp map[string]interface{}
	_ = json.NewDecoder(wCreate.Body).Decode(&createdResp)
	createdID, _ := createdResp["id"].(string)
	if createdID == "" {
		t.Fatal("expected user ID in creation response")
	}

	// 3. Test POST /api/users duplicate check
	reqDup := httptest.NewRequest("POST", "/api/users", bytes.NewReader(body))
	reqDup.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wDup := httptest.NewRecorder()
	router.ServeHTTP(wDup, reqDup)

	if wDup.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for duplicate username, got %d", wDup.Code)
	}

	// 4. Test GET /api/users
	reqList := httptest.NewRequest("GET", "/api/users", nil)
	reqList.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wList := httptest.NewRecorder()
	router.ServeHTTP(wList, reqList)

	if wList.Code != http.StatusOK {
		t.Fatalf("expected 200 from GET /api/users, got %d", wList.Code)
	}
	var userList []models.User
	_ = json.NewDecoder(wList.Body).Decode(&userList)
	if len(userList) < 2 {
		t.Fatalf("expected at least 2 users, got %d", len(userList))
	}

	// 5. Test PATCH /api/users/{id} (Update email and role)
	updatePayload := map[string]interface{}{
		"email":   "op_updated@krea.edu.in",
		"role_id": "role_net_op",
	}
	upBody, _ := json.Marshal(updatePayload)
	reqPatch := httptest.NewRequest("PATCH", "/api/users/"+createdID, bytes.NewReader(upBody))
	reqPatch.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wPatch := httptest.NewRecorder()
	router.ServeHTTP(wPatch, reqPatch)

	if wPatch.Code != http.StatusOK {
		t.Fatalf("expected 200 from PATCH /api/users/%s, got %d: %s", createdID, wPatch.Code, wPatch.Body.String())
	}

	// Verify update took effect
	var updatedEmail, updatedRole string
	_ = db.QueryRow("SELECT email, role_id FROM users WHERE id = ?", createdID).Scan(&updatedEmail, &updatedRole)
	if updatedEmail != "op_updated@krea.edu.in" || updatedRole != "role_net_op" {
		t.Fatalf("user was not updated correctly in db: email=%s, role=%s", updatedEmail, updatedRole)
	}

	// 6. Test Self-Lockout Protection (Admin cannot disable own account)
	selfDisable := map[string]string{"status": "DISABLED"}
	sdBody, _ := json.Marshal(selfDisable)
	reqSelf := httptest.NewRequest("PATCH", "/api/users/"+adminID, bytes.NewReader(sdBody))
	reqSelf.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wSelf := httptest.NewRecorder()
	router.ServeHTTP(wSelf, reqSelf)

	if wSelf.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request when admin tries to disable self, got %d", wSelf.Code)
	}

	// 7. Test POST /api/users/{id}/reset-password
	resetPayload := map[string]interface{}{
		"new_password": "NewSecretPassword123!",
	}
	rpBody, _ := json.Marshal(resetPayload)
	reqReset := httptest.NewRequest("POST", "/api/users/"+createdID+"/reset-password", bytes.NewReader(rpBody))
	reqReset.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wReset := httptest.NewRecorder()
	router.ServeHTTP(wReset, reqReset)

	if wReset.Code != http.StatusOK {
		t.Fatalf("expected 200 from POST /api/users/%s/reset-password, got %d: %s", createdID, wReset.Code, wReset.Body.String())
	}

	// 8. Test DELETE /api/users/{id}
	reqDel := httptest.NewRequest("DELETE", "/api/users/"+createdID, nil)
	reqDel.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: token})
	wDel := httptest.NewRecorder()
	router.ServeHTTP(wDel, reqDel)

	if wDel.Code != http.StatusOK {
		t.Fatalf("expected 200 from DELETE /api/users/%s, got %d: %s", createdID, wDel.Code, wDel.Body.String())
	}

	// Verify user deleted
	var deletedCheck int
	_ = db.QueryRow("SELECT COUNT(*) FROM users WHERE id = ?", createdID).Scan(&deletedCheck)
	if deletedCheck != 0 {
		t.Fatal("user was not deleted from database")
	}

	// 9. Test Audit Logs (Verify audit trail captured user actions)
	var auditCount int
	_ = db.QueryRow("SELECT COUNT(*) FROM audit_logs WHERE action IN ('USER_CREATED', 'USER_UPDATED', 'USER_PASSWORD_RESET', 'USER_DELETED')").Scan(&auditCount)
	if auditCount < 4 {
		t.Fatalf("expected at least 4 user audit log entries, got %d", auditCount)
	}
}
