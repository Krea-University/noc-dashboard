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

func TestIsHostnameAllowed(t *testing.T) {
	tests := []struct {
		name     string
		host     string
		allowed  []string
		expected bool
	}{
		{"empty allowed allows all", "sc-noc.krea.edu.in", nil, true},
		{"empty allowed slice allows all", "sc-noc.krea.edu.in", []string{}, true},
		{"exact match", "sc-noc.krea.edu.in", []string{"sc-noc.krea.edu.in", "localhost"}, true},
		{"case insensitive match", "SC-NOC.KREA.EDU.IN", []string{"sc-noc.krea.edu.in"}, true},
		{"wildcard match subdomain", "sc-noc.krea.edu.in", []string{"*.krea.edu.in"}, true},
		{"wildcard match apex", "krea.edu.in", []string{"*.krea.edu.in"}, true},
		{"dot wildcard match", "noc.krea.edu.in", []string{".krea.edu.in"}, true},
		{"universal wildcard", "any-random-host.com", []string{"*"}, true},
		{"rejection of non-allowed host", "evil-phishing.com", []string{"sc-noc.krea.edu.in", "localhost"}, false},
		{"rejection of different domain with wildcard", "attacker.edu.in", []string{"*.krea.edu.in"}, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := IsHostnameAllowed(tc.host, tc.allowed)
			if got != tc.expected {
				t.Errorf("IsHostnameAllowed(%q, %v) = %v; expected %v", tc.host, tc.allowed, got, tc.expected)
			}
		})
	}
}
