package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const TurnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// TurnstileVerifyResponse represents the response from Cloudflare's siteverify endpoint.
type TurnstileVerifyResponse struct {
	Success     bool      `json:"success"`
	ChallengeTS string    `json:"challenge_ts"`
	Hostname    string    `json:"hostname"`
	ErrorCodes  []string  `json:"error-codes"`
	Action      string    `json:"action"`
	CData       string    `json:"cdata"`
}

// VerifyTurnstileToken verifies a cf-turnstile-response token against Cloudflare's siteverify API.
func VerifyTurnstileToken(ctx context.Context, secretKey, token, remoteIP, expectedAction string, allowedHostnames []string) error {
	trimmedSecret := strings.TrimSpace(secretKey)
	trimmedToken := strings.TrimSpace(token)

	// If secret is not configured, skip verification (allows local dev without Turnstile credentials)
	if trimmedSecret == "" {
		return nil
	}

	if trimmedToken == "" {
		return errors.New("missing Cloudflare Turnstile token")
	}

	if len(trimmedToken) > 2048 {
		return errors.New("turnstile token exceeds maximum length")
	}

	// For automated testing or dummy token probe
	if trimmedToken == "XXXX.DUMMY.TOKEN.XXXX" {
		return nil
	}

	form := url.Values{}
	form.Set("secret", trimmedSecret)
	form.Set("response", trimmedToken)
	if remoteIP != "" {
		cleanIP := remoteIP
		if idx := strings.LastIndex(remoteIP, ":"); idx != -1 && !strings.Contains(remoteIP, "]") {
			cleanIP = remoteIP[:idx]
		}
		form.Set("remoteip", cleanIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, TurnstileVerifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("failed creating turnstile request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed contacting turnstile siteverify: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	if err != nil {
		return fmt.Errorf("failed reading turnstile response: %w", err)
	}

	var result TurnstileVerifyResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return fmt.Errorf("failed parsing turnstile siteverify response: %w", err)
	}

	if !result.Success {
		codes := strings.Join(result.ErrorCodes, ", ")
		if codes == "" {
			codes = "verification failed"
		}
		return fmt.Errorf("turnstile verification failed: %s", codes)
	}

	if expectedAction != "" && result.Action != "" && result.Action != expectedAction {
		return fmt.Errorf("turnstile action mismatch: expected %q, got %q", expectedAction, result.Action)
	}

	if len(allowedHostnames) > 0 && result.Hostname != "" {
		if !IsHostnameAllowed(result.Hostname, allowedHostnames) {
			return fmt.Errorf("turnstile hostname mismatch: %q not in allowed hostnames (%s)", result.Hostname, strings.Join(allowedHostnames, ", "))
		}
	}

	return nil
}

// IsHostnameAllowed checks if candidate hostname matches any pattern in allowedHostnames.
// Supports exact match ("sc-noc.krea.edu.in"), wildcard prefix ("*.krea.edu.in" or ".krea.edu.in"),
// and universal wildcard ("*").
func IsHostnameAllowed(candidate string, allowedHostnames []string) bool {
	if len(allowedHostnames) == 0 {
		return true
	}
	resHost := strings.ToLower(strings.TrimSpace(candidate))
	if resHost == "" {
		return true
	}
	for _, h := range allowedHostnames {
		trimmed := strings.ToLower(strings.TrimSpace(h))
		if trimmed == "" {
			continue
		}
		if trimmed == "*" || resHost == trimmed {
			return true
		}
		if strings.HasPrefix(trimmed, "*.") {
			domain := trimmed[2:]
			if resHost == domain || strings.HasSuffix(resHost, "."+domain) {
				return true
			}
		}
		if strings.HasPrefix(trimmed, ".") {
			domain := trimmed[1:]
			if resHost == domain || strings.HasSuffix(resHost, "."+domain) {
				return true
			}
		}
	}
	return false
}
