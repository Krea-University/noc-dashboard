package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/erpbiometric"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/rbac"
)

func TestERPBiometricsEndpointIsPublicAndHasNoPeople(t *testing.T) {
	deps := &RouterDeps{
		Cfg:          &config.Config{AppName: "KREA IT NOC", NOCAllowedOrigins: []string{"*"}},
		ERPBiometric: erpbiometric.NewMockProvider(),
	}
	rr := httptest.NewRecorder()
	SetupRouter(deps).ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/api/erp/biometrics", nil))

	if rr.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rr.Code, rr.Body.String())
	}
	var res struct {
		Enabled bool `json:"enabled"`
		Devices []struct {
			DeviceID string `json:"device_id"`
		} `json:"devices"`
		Faceless struct {
			Summary struct {
				Total int `json:"total"`
			} `json:"summary"`
		} `json:"faceless"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatal(err)
	}
	if !res.Enabled || len(res.Devices) == 0 || res.Faceless.Summary.Total == 0 {
		t.Fatalf("unexpected snapshot: %s", rr.Body.String())
	}
	// Wall displays read this route: it must never carry names or roll numbers.
	if body := rr.Body.String(); strings.Contains(body, "Demo Student") || strings.Contains(body, `"people"`) {
		t.Fatalf("public snapshot leaks personal data: %s", body)
	}
}

func TestERPFacelessAccess(t *testing.T) {
	deps := &RouterDeps{ERPBiometric: erpbiometric.NewMockProvider()}
	operator := &models.User{ID: "u1", Username: "op", RoleName: "OPERATOR", Permissions: []string{"devices.view", "devices.edit_metadata"}}
	noPerm := &models.User{ID: "u2", Username: "viewer", RoleName: "VIEWER", Permissions: []string{"dashboard.view", "devices.view"}}

	cases := []struct {
		name  string
		user  *models.User
		scope string
		want  int
	}{
		{"no session (wall display)", nil, "", http.StatusUnauthorized},
		{"ERP embed, view-only scope", operator, "noc:view", http.StatusForbidden},
		{"read-only VIEWER role", noPerm, "noc:full", http.StatusForbidden},
		{"operator, full session", operator, "noc:full", http.StatusOK},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/erp/biometrics/faceless", nil)
			if tc.user != nil {
				ctx := context.WithValue(req.Context(), rbac.UserContextKey, tc.user)
				ctx = context.WithValue(ctx, rbac.ScopeContextKey, tc.scope)
				req = req.WithContext(ctx)
			}
			rr := httptest.NewRecorder()
			handleGetERPFaceless(deps)(rr, req)

			if rr.Code != tc.want {
				t.Fatalf("status %d, want %d: %s", rr.Code, tc.want, rr.Body.String())
			}
			hasNames := strings.Contains(rr.Body.String(), "Demo Student")
			if tc.want == http.StatusOK {
				if !hasNames || rr.Header().Get("Cache-Control") != "no-store" {
					t.Fatalf("operator should get the list uncached, got %s", rr.Body.String())
				}
			} else if hasNames {
				t.Fatalf("denied request leaked names: %s", rr.Body.String())
			}
		})
	}
}
