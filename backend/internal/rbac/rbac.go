package rbac

import (
	"context"
	"net/http"
	"strings"

	"github.com/Krea-University/noc-dashboard/backend/internal/auth"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

type contextKey string

const (
	UserContextKey  contextKey = "auth_user"
	ScopeContextKey contextKey = "auth_scope"
)

// HasPermission checks if the given user has the requested permission code.
func HasPermission(user *models.User, permissionCode string) bool {
	if user == nil {
		return false
	}
	// Administrator has all permissions implicitly
	if user.RoleName == "ADMINISTRATOR" {
		return true
	}
	for _, p := range user.Permissions {
		if p == permissionCode || p == "*" {
			return true
		}
	}
	return false
}

// RequireAuth middleware verifies that an active session cookie or Bearer token is present.
func RequireAuth(authSvc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr == "" {
				http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
				return
			}

			user, scope, err := authSvc.ValidateSession(tokenStr)
			if err != nil {
				http.Error(w, `{"error":"invalid or expired session"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			ctx = context.WithValue(ctx, ScopeContextKey, scope)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth middleware extracts user and scope if session token is present,
// but allows unauthenticated access for read-only NOC wall displays and status dashboards.
func OptionalAuth(authSvc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr != "" {
				user, scope, err := authSvc.ValidateSession(tokenStr)
				if err == nil && user != nil {
					ctx := context.WithValue(r.Context(), UserContextKey, user)
					ctx = context.WithValue(ctx, ScopeContextKey, scope)
					r = r.WithContext(ctx)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequirePermission ensures the authenticated user has the specified permission AND the session scope permits it.
func RequirePermission(permissionCode string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(UserContextKey).(*models.User)
			if !ok || user == nil {
				http.Error(w, `{"error":"authentication required"}`, http.StatusUnauthorized)
				return
			}

			scope, _ := r.Context().Value(ScopeContextKey).(string)

			// If this is a network control permission, check that scope is not restricted to view-only
			if strings.HasPrefix(permissionCode, "vlan.internet.") || strings.HasPrefix(permissionCode, "fortigate.manage") {
				if scope == "noc:view" {
					http.Error(w, `{"error":"forbidden: current session scope does not permit network control"}`, http.StatusForbidden)
					return
				}
			}

			if !HasPermission(user, permissionCode) {
				http.Error(w, `{"error":"forbidden: insufficient permissions"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetUserFromContext extracts the user from the request context.
func GetUserFromContext(ctx context.Context) *models.User {
	if u, ok := ctx.Value(UserContextKey).(*models.User); ok {
		return u
	}
	return nil
}

// GetScopeFromContext extracts the session scope from the request context.
func GetScopeFromContext(ctx context.Context) string {
	if s, ok := ctx.Value(ScopeContextKey).(string); ok {
		return s
	}
	return "noc:full"
}

func extractToken(r *http.Request) string {
	// First check session cookie
	if cookie, err := r.Cookie(auth.SessionCookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}

	// Next check Authorization header (Bearer token)
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// Also support ?token query parameter for WebSocket handshakes
	if queryToken := r.URL.Query().Get("token"); queryToken != "" {
		return queryToken
	}

	return ""
}
