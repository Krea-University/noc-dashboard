package auth

import (
	"context"
	"testing"
)

func TestVerifyTurnstileToken_EmptySecret(t *testing.T) {
	err := VerifyTurnstileToken(context.Background(), "", "some-token", "127.0.0.1", "login", nil)
	if err != nil {
		t.Fatalf("expected nil error when secret is empty, got %v", err)
	}
}

func TestVerifyTurnstileToken_MissingToken(t *testing.T) {
	err := VerifyTurnstileToken(context.Background(), "test-secret", "", "127.0.0.1", "login", nil)
	if err == nil {
		t.Fatalf("expected error for empty token")
	}
}

func TestVerifyTurnstileToken_DummyToken(t *testing.T) {
	err := VerifyTurnstileToken(context.Background(), "test-secret", "XXXX.DUMMY.TOKEN.XXXX", "127.0.0.1", "login", nil)
	if err != nil {
		t.Fatalf("expected nil error for dummy probe token, got %v", err)
	}
}
