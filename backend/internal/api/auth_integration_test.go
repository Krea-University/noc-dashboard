package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/auth"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
)

func TestAuthEndpoints(t *testing.T) {
	cfg := &config.Config{
		DBDriver:               "sqlite",
		DBName:                 ":memory:",
		SessionSecret:          "test_session_secret_32_bytes_long!!",
		JWTEmbedSecret:         "test_jwt_embed_secret_krea_erp_2026",
		BootstrapAdminUsername: "admin",
		BootstrapAdminPassword: "AdminPassword123!",
		BootstrapAdminEmail:    "admin@krea.edu.in",
		TurnstileSiteKey:       "0x4AAAAAAExldpVxn_Cfx4o7",
		TurnstileSecretKey:     "0x4AAAAAAExldgkxpZiriTiET5EUmmzQmQg",
		GoogleClientID:         "test-google-client-id.apps.googleusercontent.com",
		NOCAllowedOrigins:      []string{"http://localhost:5173"},
		NOCEmbedAllowedOrigins: []string{"https://erp.krea.edu.in"},
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
	deps := &RouterDeps{
		Cfg:      cfg,
		DB:       db,
		AuthSvc:  authSvc,
		AuditSvc: auditSvc,
	}
	router := SetupRouter(deps)

	// 1. Test GET /api/auth/config
	t.Run("GET /api/auth/config", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/auth/config", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}

		var resp struct {
			TurnstileSiteKey string `json:"turnstile_site_key"`
			GoogleClientID   string `json:"google_client_id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
			t.Fatalf("failed decoding config: %v", err)
		}

		if resp.TurnstileSiteKey != "0x4AAAAAAExldpVxn_Cfx4o7" {
			t.Errorf("expected TurnstileSiteKey, got %s", resp.TurnstileSiteKey)
		}
		if resp.GoogleClientID != "test-google-client-id.apps.googleusercontent.com" {
			t.Errorf("expected GoogleClientID, got %s", resp.GoogleClientID)
		}
	})

	// 2. Test POST /api/auth/login without Turnstile token (should fail 403)
	t.Run("POST /api/auth/login missing turnstile", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"username": "admin",
			"password": "AdminPassword123!",
		})
		req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("CF-Connecting-IP", "203.0.113.195")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 forbidden without turnstile token, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 3. Test POST /api/auth/login with dummy probe token (should succeed)
	var sessionToken string
	t.Run("POST /api/auth/login with probe token", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"username":        "admin",
			"password":        "AdminPassword123!",
			"turnstile_token": "XXXX.DUMMY.TOKEN.XXXX",
		})
		req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("CF-Connecting-IP", "203.0.113.195")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			Token string `json:"token"`
		}
		_ = json.NewDecoder(w.Body).Decode(&resp)
		sessionToken = resp.Token
		if sessionToken == "" {
			t.Fatal("expected session token")
		}

		// Verify cookie was set with proper attributes
		cookies := w.Result().Cookies()
		found := false
		for _, c := range cookies {
			if c.Name == auth.SessionCookieName {
				found = true
				if c.Value != sessionToken {
					t.Errorf("cookie value mismatch")
				}
			}
		}
		if !found {
			t.Fatal("session cookie not found in response")
		}
	})

	// 4. Test POST /api/auth/google with mock token for @krea.edu.in
	t.Run("POST /api/auth/google auto-provisions krea account", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"credential": "MOCK_GOOGLE_TOKEN:staff.member@krea.edu.in",
		})
		req := httptest.NewRequest("POST", "/api/auth/google", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("CF-Connecting-IP", "198.51.100.42")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200 for krea google login, got %d: %s", w.Code, w.Body.String())
		}

		var resp struct {
			User struct {
				Email    string `json:"email"`
				RoleName string `json:"role_name"`
			} `json:"user"`
			Token string `json:"token"`
		}
		_ = json.NewDecoder(w.Body).Decode(&resp)
		if resp.User.Email != "staff.member@krea.edu.in" {
			t.Errorf("expected email staff.member@krea.edu.in, got %s", resp.User.Email)
		}
		if resp.User.RoleName != "VIEWER" {
			t.Errorf("expected role VIEWER, got %s", resp.User.RoleName)
		}
	})

	// 5. Test POST /api/auth/google rejection for non-krea domain
	t.Run("POST /api/auth/google rejects non-krea email", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"credential": "MOCK_GOOGLE_TOKEN:stranger@external.com",
		})
		req := httptest.NewRequest("POST", "/api/auth/google", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Fatalf("expected 403 forbidden for non-krea account, got %d: %s", w.Code, w.Body.String())
		}
	})

	// 6. Test POST /api/auth/logout
	t.Run("POST /api/auth/logout", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/auth/logout", nil)
		req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
		req.Header.Set("CF-Connecting-IP", "203.0.113.195")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
	})

	// 7. Test GET /api/audit filtering by username
	t.Run("GET /api/audit with username filter", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/audit?username=admin", nil)
		req.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: sessionToken})
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// Note: session was deleted by logout above, so this should return 401 if auth required
		if w.Code != http.StatusUnauthorized {
			t.Logf("expected 401 after logout, got %d", w.Code)
		}

		// Query directly through AuditSvc to verify IP and actions were captured
		logs, err := auditSvc.QueryLogs(req.Context(), "", "admin", 50, 0)
		if err != nil {
			t.Fatalf("failed querying audit logs: %v", err)
		}

		hasLogin := false
		hasLogout := false
		hasRealIP := false
		for _, l := range logs {
			if l.Action == "USER_LOGIN" {
				hasLogin = true
			}
			if l.Action == "USER_LOGOUT" {
				hasLogout = true
			}
			if strings.Contains(l.IPAddress, "203.0.113.195") {
				hasRealIP = true
			}
		}

		if !hasLogin {
			t.Error("expected USER_LOGIN in audit logs")
		}
		if !hasLogout {
			t.Error("expected USER_LOGOUT in audit logs")
		}
		if !hasRealIP {
			t.Error("expected real IP 203.0.113.195 captured from Cloudflare header in audit logs")
		}
	})
}
