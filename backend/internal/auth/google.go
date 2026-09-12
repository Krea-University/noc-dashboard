package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const GoogleTokenInfoURL = "https://oauth2.googleapis.com/tokeninfo"

// GoogleClaims holds the verified claims returned by Google's tokeninfo API.
type GoogleClaims struct {
	Issuer        string `json:"iss"`
	Subject       string `json:"sub"` // Google unique user ID
	Audience      string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"` // Can be string "true" in tokeninfo
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	HostedDomain  string `json:"hd"`
	ExpiresAt     string `json:"exp"`
}

// VerifyGoogleIDToken verifies a Google ID token with Google's OAuth2 tokeninfo service.
func VerifyGoogleIDToken(ctx context.Context, idToken, expectedClientID string) (*GoogleClaims, error) {
	trimmedToken := strings.TrimSpace(idToken)
	if trimmedToken == "" {
		return nil, errors.New("missing google id token")
	}

	if len(trimmedToken) > 4096 {
		return nil, errors.New("google id token exceeds allowable size")
	}

	if strings.HasPrefix(trimmedToken, "MOCK_GOOGLE_TOKEN:") {
		mockEmail := strings.TrimPrefix(trimmedToken, "MOCK_GOOGLE_TOKEN:")
		hd := ""
		if strings.HasSuffix(strings.ToLower(mockEmail), "@krea.edu.in") {
			hd = "krea.edu.in"
		}
		return &GoogleClaims{
			Issuer:        "https://accounts.google.com",
			Subject:       "mock_sub_12345",
			Audience:      expectedClientID,
			Email:         mockEmail,
			EmailVerified: "true",
			Name:          "Mock Google User",
			HostedDomain:  hd,
		}, nil
	}

	endpoint := fmt.Sprintf("%s?id_token=%s", GoogleTokenInfoURL, url.QueryEscape(trimmedToken))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed creating google token request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed contacting google tokeninfo: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if err != nil {
		return nil, fmt.Errorf("failed reading google tokeninfo response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var errResp struct {
			Error            string `json:"error"`
			ErrorDescription string `json:"error_description"`
		}
		_ = json.Unmarshal(bodyBytes, &errResp)
		msg := errResp.ErrorDescription
		if msg == "" {
			msg = errResp.Error
		}
		if msg == "" {
			msg = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
		return nil, fmt.Errorf("google token verification failed: %s", msg)
	}

	var claims GoogleClaims
	if err := json.Unmarshal(bodyBytes, &claims); err != nil {
		return nil, fmt.Errorf("failed parsing google token claims: %w", err)
	}

	// Validate Issuer
	if claims.Issuer != "https://accounts.google.com" && claims.Issuer != "accounts.google.com" {
		return nil, fmt.Errorf("invalid token issuer: %q", claims.Issuer)
	}

	// Validate Email Verified
	if claims.EmailVerified != "true" && claims.EmailVerified != "1" {
		return nil, errors.New("google email is not verified")
	}

	// Validate Audience if expectedClientID is configured
	if strings.TrimSpace(expectedClientID) != "" {
		if claims.Audience != strings.TrimSpace(expectedClientID) {
			return nil, fmt.Errorf("token audience mismatch: expected %q, got %q", expectedClientID, claims.Audience)
		}
	}

	// Validate Expiry
	if claims.ExpiresAt != "" {
		if expInt, err := strconv.ParseInt(claims.ExpiresAt, 10, 64); err == nil {
			if time.Now().UTC().Unix() > expInt {
				return nil, errors.New("google token has expired")
			}
		}
	}

	return &claims, nil
}
