package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
	"github.com/Krea-University/noc-dashboard/backend/internal/rbac"
)

// handleGetERPBiometrics serves the last Krea OneERP biometric snapshot.
// It holds device data and face counts only, so wall displays may read it.
func handleGetERPBiometrics(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if deps.ERPBiometric == nil {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"enabled": false,
				"devices": []interface{}{},
			})
			return
		}
		snapshot := deps.ERPBiometric.GetCachedDevices()
		respondJSON(w, http.StatusOK, struct {
			Enabled bool `json:"enabled"`
			*integrations.ERPBiometricSnapshotDTO
		}{true, snapshot})
	}
}

// handleGetERPFaceless serves the people without a usable face. This is
// personal data (names, roll numbers): only signed-in operators (OPERATOR and
// above, devices.edit_metadata) with a full session may read it - never wall
// displays (no session), VIEWERs, or ERP embeds (noc:view) - and every read
// is audited.
func handleGetERPFaceless(deps *RouterDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := rbac.GetUserFromContext(r.Context())
		if user == nil {
			respondError(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if rbac.GetScopeFromContext(r.Context()) == "noc:view" {
			respondError(w, http.StatusForbidden, "this session is view-only and cannot read personal data")
			return
		}
		if !rbac.HasPermission(user, "devices.edit_metadata") {
			respondError(w, http.StatusForbidden, "forbidden: insufficient permissions")
			return
		}
		if deps.ERPBiometric == nil {
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"enabled": false,
				"people":  []interface{}{},
			})
			return
		}

		list := deps.ERPBiometric.GetCachedFaceless()
		if deps.AuditSvc != nil {
			_ = deps.AuditSvc.Log(r.Context(), &models.AuditLog{
				UserID:     user.ID,
				Username:   user.Username,
				Action:     "ERP_FACELESS_VIEWED",
				TargetType: "erp_biometric",
				IPAddress:  getClientIP(r),
				UserAgent:  r.UserAgent(),
				Result:     "SUCCESS",
				Reason:     fmt.Sprintf("viewed %d people without a usable face", len(list.People)),
				Timestamp:  time.Now().UTC(),
			})
		}

		w.Header().Set("Cache-Control", "no-store")
		respondJSON(w, http.StatusOK, struct {
			Enabled bool `json:"enabled"`
			*integrations.ERPFacelessListDTO
		}{true, list})
	}
}
