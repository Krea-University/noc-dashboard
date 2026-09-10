package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

const (
	SessionCookieName = "krea_noc_session"
	SessionDuration   = 24 * time.Hour
	EmbedSessionDuration = 2 * time.Hour
)

// Service handles authentication, password hashing, and session management.
type Service struct {
	db  *database.DB
	cfg *config.Config
}

// NewService creates a new Auth Service.
func NewService(db *database.DB, cfg *config.Config) *Service {
	return &Service{db: db, cfg: cfg}
}

// BootstrapAdmin ensures that at least one admin account exists on startup.
func (s *Service) BootstrapAdmin() error {
	var count int
	err := s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed checking user count: %w", err)
	}

	if count > 0 {
		return nil
	}

	slog.Info("no users found; bootstrapping initial administrator account",
		"username", s.cfg.BootstrapAdminUsername, "email", s.cfg.BootstrapAdminEmail)

	hash, err := HashPassword(s.cfg.BootstrapAdminPassword)
	if err != nil {
		return fmt.Errorf("failed hashing bootstrap password: %w", err)
	}

	adminID := "usr_admin_" + uuid.New().String()[:8]
	now := time.Now().UTC()

	insertSQL := `
	INSERT INTO users (id, username, email, password_hash, role_id, status, must_change_password, created_at, updated_at)
	VALUES (?, ?, ?, ?, 'role_admin', 'ACTIVE', 1, ?, ?)`

	_, err = s.db.Exec(insertSQL, adminID, s.cfg.BootstrapAdminUsername, s.cfg.BootstrapAdminEmail, hash, now, now)
	if err != nil {
		return fmt.Errorf("failed creating bootstrap admin user: %w", err)
	}

	slog.Info("initial administrator account created successfully", "username", s.cfg.BootstrapAdminUsername)
	return nil
}

// HashPassword hashes a raw password using bcrypt with cost 12.
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(bytes), err
}

// CheckPassword verifies a raw password against its bcrypt hash.
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Authenticate checks user credentials and creates a session.
func (s *Service) Authenticate(username, password, ip, userAgent string) (*models.User, string, error) {
	user, err := s.GetUserByUsername(username)
	if err != nil {
		return nil, "", errors.New("invalid username or password")
	}

	if user.Status != "ACTIVE" {
		return nil, "", errors.New("user account is disabled")
	}

	if !CheckPassword(password, user.PasswordHash) {
		return nil, "", errors.New("invalid username or password")
	}

	// Update last login
	now := time.Now().UTC()
	_, _ = s.db.Exec("UPDATE users SET last_login_at = ? WHERE id = ?", now, user.ID)

	// Create session
	token, session, err := s.CreateSession(user.ID, "noc:full", SessionDuration, ip, userAgent)
	if err != nil {
		return nil, "", fmt.Errorf("failed creating session: %w", err)
	}
	_ = session

	return user, token, nil
}

// CreateSession generates a secure session token and persists it.
func (s *Service) CreateSession(userID, scope string, duration time.Duration, ip, userAgent string) (string, *models.Session, error) {
	rawToken := make([]byte, 32)
	if _, err := rand.Read(rawToken); err != nil {
		return "", nil, err
	}
	tokenStr := hex.EncodeToString(rawToken)
	tokenHash := hashToken(tokenStr)

	sessionID := "sess_" + uuid.New().String()
	now := time.Now().UTC()
	expiresAt := now.Add(duration)

	insertSQL := `
	INSERT INTO sessions (id, user_id, token_hash, scope, expires_at, ip_address, user_agent, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(insertSQL, sessionID, userID, tokenHash, scope, expiresAt, ip, userAgent, now)
	if err != nil {
		return "", nil, err
	}

	session := &models.Session{
		ID:        sessionID,
		UserID:    userID,
		Scope:     scope,
		ExpiresAt: expiresAt,
		IPAddress: ip,
		UserAgent: userAgent,
		CreatedAt: now,
	}

	return tokenStr, session, nil
}

// ValidateSession verifies a token and returns the corresponding User and session scope.
func (s *Service) ValidateSession(tokenStr string) (*models.User, string, error) {
	tokenHash := hashToken(tokenStr)
	now := time.Now().UTC()

	var session models.Session
	query := `
	SELECT id, user_id, scope, expires_at, ip_address, created_at
	FROM sessions
	WHERE token_hash = ? AND expires_at > ?`

	err := s.db.QueryRow(query, tokenHash, now).Scan(
		&session.ID, &session.UserID, &session.Scope, &session.ExpiresAt, &session.IPAddress, &session.CreatedAt)
	if err != nil {
		return nil, "", errors.New("invalid or expired session")
	}

	user, err := s.GetUserByID(session.UserID)
	if err != nil {
		return nil, "", errors.New("user not found")
	}

	if user.Status != "ACTIVE" {
		return nil, "", errors.New("account disabled")
	}

	return user, session.Scope, nil
}

// DeleteSession revokes a session token.
func (s *Service) DeleteSession(tokenStr string) error {
	tokenHash := hashToken(tokenStr)
	_, err := s.db.Exec("DELETE FROM sessions WHERE token_hash = ?", tokenHash)
	return err
}

// GetUserByID retrieves a user with their role and permissions.
func (s *Service) GetUserByID(userID string) (*models.User, error) {
	query := `
	SELECT u.id, u.username, u.email, u.password_hash, u.role_id, r.name, u.status, u.must_change_password, u.last_login_at, u.created_at, u.updated_at
	FROM users u
	JOIN roles r ON u.role_id = r.id
	WHERE u.id = ?`

	user := &models.User{}
	var lastLogin sqlNullTime
	err := s.db.QueryRow(query, userID).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.RoleID,
		&user.RoleName, &user.Status, &user.MustChangePassword, &lastLogin, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if lastLogin.Valid {
		user.LastLoginAt = &lastLogin.Time
	}

	perms, err := s.GetUserPermissions(user.RoleID)
	if err == nil {
		user.Permissions = perms
	}

	return user, nil
}

// GetUserByUsername retrieves a user by username.
func (s *Service) GetUserByUsername(username string) (*models.User, error) {
	query := `
	SELECT u.id, u.username, u.email, u.password_hash, u.role_id, r.name, u.status, u.must_change_password, u.last_login_at, u.created_at, u.updated_at
	FROM users u
	JOIN roles r ON u.role_id = r.id
	WHERE u.username = ?`

	user := &models.User{}
	var lastLogin sqlNullTime
	err := s.db.QueryRow(query, username).Scan(
		&user.ID, &user.Username, &user.Email, &user.PasswordHash, &user.RoleID,
		&user.RoleName, &user.Status, &user.MustChangePassword, &lastLogin, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if lastLogin.Valid {
		user.LastLoginAt = &lastLogin.Time
	}

	perms, err := s.GetUserPermissions(user.RoleID)
	if err == nil {
		user.Permissions = perms
	}

	return user, nil
}

// GetUserPermissions returns all permission codes assigned to a role.
func (s *Service) GetUserPermissions(roleID string) ([]string, error) {
	rows, err := s.db.Query(`
	SELECT p.code
	FROM permissions p
	JOIN role_permissions rp ON p.id = rp.permission_id
	WHERE rp.role_id = ?`, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			perms = append(perms, code)
		}
	}
	return perms, nil
}

// ValidateERPJWTEmbedToken verifies an incoming short-lived JWT token from KREA Flutter ERP.
func (s *Service) ValidateERPJWTEmbedToken(tokenString string) (sub string, scope string, err error) {
	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.cfg.JWTEmbedSecret), nil
	})

	if err != nil || !token.Valid {
		return "", "", fmt.Errorf("invalid or expired JWT embed token: %w", err)
	}

	// Validate Issuer and Audience
	iss, _ := claims["iss"].(string)
	aud, _ := claims["aud"].(string)
	if iss != "krea-erp" || aud != "krea-noc" {
		return "", "", fmt.Errorf("invalid token claims: issuer or audience mismatch")
	}

	sub, _ = claims["sub"].(string)
	scope, _ = claims["scope"].(string)
	if scope == "" {
		scope = "noc:view"
	}

	return sub, scope, nil
}

// SetSessionCookie writes a secure, HttpOnly session cookie to the response.
func SetSessionCookie(w http.ResponseWriter, token string, duration time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(duration),
		MaxAge:   int(duration.Seconds()),
		HttpOnly: true,
		Secure:   false, // Can be true in pure HTTPS
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearSessionCookie clears the session cookie.
func ClearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

type sqlNullTime struct {
	Time  time.Time
	Valid bool
}

func (nt *sqlNullTime) Scan(value interface{}) error {
	if value == nil {
		nt.Time, nt.Valid = time.Time{}, false
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		nt.Time, nt.Valid = v, true
		return nil
	case string:
		// Attempt parsing standard timestamps
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			nt.Time, nt.Valid = t, true
			return nil
		}
		t, err = time.Parse("2006-01-02 15:04:05", v)
		if err == nil {
			nt.Time, nt.Valid = t, true
			return nil
		}
	}
	nt.Valid = false
	return nil
}
