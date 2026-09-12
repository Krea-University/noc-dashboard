package auth

import (
	"context"
	"testing"
)

func TestVerifyGoogleIDToken_Empty(t *testing.T) {
	_, err := VerifyGoogleIDToken(context.Background(), "", "client-123")
	if err == nil {
		t.Fatalf("expected error for empty token")
	}
}

func TestVerifyGoogleIDToken_MockToken(t *testing.T) {
	claims, err := VerifyGoogleIDToken(context.Background(), "MOCK_GOOGLE_TOKEN:admin@krea.edu.in", "client-123")
	if err != nil {
		t.Fatalf("unexpected error for mock token: %v", err)
	}

	if claims.Email != "admin@krea.edu.in" {
		t.Errorf("expected email admin@krea.edu.in, got %s", claims.Email)
	}
	if claims.HostedDomain != "krea.edu.in" {
		t.Errorf("expected hosted domain krea.edu.in, got %s", claims.HostedDomain)
	}
}
