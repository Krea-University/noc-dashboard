package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
)

func TestAuthAndJWTEmbed(t *testing.T) {
	cfg := &config.Config{
		DBDriver:       "sqlite",
		DBName:         ":memory:",
		SessionSecret:  "test_session_secret_32_bytes_long!!",
		JWTEmbedSecret: "test_jwt_embed_secret_krea_erp_2026",
	}

	db, err := database.Connect(cfg)
	if err != nil {
		t.Fatalf("database connect failed: %v", err)
	}
	defer db.Close()

	if err := db.RunMigrations("../../migrations"); err != nil {
		t.Fatalf("run migrations failed: %v", err)
	}

	authSvc := NewService(db, cfg)

	// 1. Password Hashing Test
	plainPass := "SecretTestPass@2026!"
	hash, err := HashPassword(plainPass)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	if !CheckPassword(plainPass, hash) {
		t.Fatal("CheckPassword returned false for valid password")
	}
	if CheckPassword("WrongPassword", hash) {
		t.Fatal("CheckPassword returned true for wrong password")
	}

	// 2. Valid ERP JWT Test
	validClaims := jwt.MapClaims{
		"iss":   "krea-erp",
		"aud":   "krea-noc",
		"sub":   "faculty_dean_01",
		"scope": "noc:view",
		"exp":   time.Now().Add(5 * time.Minute).Unix(),
	}
	validTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims)
	validTokenStr, err := validTokenObj.SignedString([]byte(cfg.JWTEmbedSecret))
	if err != nil {
		t.Fatalf("failed signing valid JWT: %v", err)
	}

	sub, scope, err := authSvc.ValidateERPJWTEmbedToken(validTokenStr)
	if err != nil {
		t.Fatalf("ValidateERPJWTEmbedToken failed on valid token: %v", err)
	}
	if sub != "faculty_dean_01" || scope != "noc:view" {
		t.Fatalf("unexpected claims: sub=%s, scope=%s", sub, scope)
	}

	// 3. Expired ERP JWT Test
	expiredClaims := jwt.MapClaims{
		"iss":   "krea-erp",
		"aud":   "krea-noc",
		"sub":   "faculty_dean_01",
		"scope": "noc:view",
		"exp":   time.Now().Add(-5 * time.Minute).Unix(),
	}
	expiredTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
	expiredTokenStr, err := expiredTokenObj.SignedString([]byte(cfg.JWTEmbedSecret))
	if err != nil {
		t.Fatalf("failed signing expired JWT: %v", err)
	}

	_, _, err = authSvc.ValidateERPJWTEmbedToken(expiredTokenStr)
	if err == nil {
		t.Fatal("expected expired JWT to fail validation, but succeeded")
	}

	// 4. Invalid Signature ERP JWT Test
	invalidSigTokenStr, err := validTokenObj.SignedString([]byte("wrong_secret_1234567890"))
	if err != nil {
		t.Fatalf("failed signing with wrong key: %v", err)
	}

	_, _, err = authSvc.ValidateERPJWTEmbedToken(invalidSigTokenStr)
	if err == nil {
		t.Fatal("expected invalid signature JWT to fail validation, but succeeded")
	}

	// 5. Invalid Issuer / Audience ERP JWT Test
	wrongAudClaims := jwt.MapClaims{
		"iss":   "wrong-issuer",
		"aud":   "wrong-audience",
		"sub":   "attacker",
		"scope": "noc:view",
		"exp":   time.Now().Add(5 * time.Minute).Unix(),
	}
	wrongAudTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, wrongAudClaims)
	wrongAudTokenStr, _ := wrongAudTokenObj.SignedString([]byte(cfg.JWTEmbedSecret))

	_, _, err = authSvc.ValidateERPJWTEmbedToken(wrongAudTokenStr)
	if err == nil {
		t.Fatal("expected mismatched issuer/audience JWT to fail, but succeeded")
	}
}
