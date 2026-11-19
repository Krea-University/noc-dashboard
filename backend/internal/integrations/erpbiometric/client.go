// Package erpbiometric reads biometric device status from the Krea OneERP NOC
// API (read-only). See erp_go docs/25_NOC_API.md.
package erpbiometric

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

const (
	devicesPath  = "/v2/noc/biometric/devices"
	facelessPath = "/v2/noc/biometric/faceless"
)

// Client calls the ERP NOC API and keeps the last good response of each
// endpoint, served marked stale when the ERP cannot be reached.
type Client struct {
	baseURL    string
	apiToken   string
	httpClient *http.Client

	mu       sync.RWMutex
	devices  *integrations.ERPBiometricSnapshotDTO
	faceless *integrations.ERPFacelessListDTO
}

// NewClient creates the ERP biometric client from config.
func NewClient(cfg *config.Config) *Client {
	return &Client{
		baseURL:  strings.TrimRight(cfg.ERPNOCBaseURL, "/"),
		apiToken: cfg.ERPNOCToken,
		// The ERP may call the ZK portal before answering (cached 60 s on its side).
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *Client) Name() string { return "Krea OneERP Biometrics" }

func (c *Client) TestConnection(ctx context.Context) error {
	var data integrations.ERPBiometricSnapshotDTO
	return c.get(ctx, devicesPath, &data)
}

// get calls one ERP NOC endpoint and decodes the ERP envelope
// {"ok":true,"data":...} or {"ok":false,"err-msg":...,"err-code":...}.
func (c *Client) get(ctx context.Context, path string, out any) error {
	if c.baseURL == "" {
		return fmt.Errorf("ERP_NOC_BASE_URL is not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return fmt.Errorf("creating erp request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("erp request failed: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return fmt.Errorf("reading erp response: %w", err)
	}

	var env struct {
		OK      bool            `json:"ok"`
		Data    json.RawMessage `json:"data"`
		ErrMsg  string          `json:"err-msg"`
		ErrCode int             `json:"err-code"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		return fmt.Errorf("erp returned HTTP %d with a non-JSON body", resp.StatusCode)
	}
	if !env.OK {
		code := env.ErrCode
		if code == 0 {
			code = resp.StatusCode
		}
		return fmt.Errorf("erp error %d: %s", code, env.ErrMsg)
	}
	if err := json.Unmarshal(env.Data, out); err != nil {
		return fmt.Errorf("decoding erp data: %w", err)
	}
	return nil
}

// GetDevices fetches the device snapshot. On failure it returns the last good
// snapshot marked stale (or an empty stale one) together with the error.
func (c *Client) GetDevices(ctx context.Context) (*integrations.ERPBiometricSnapshotDTO, error) {
	var data integrations.ERPBiometricSnapshotDTO
	if err := c.get(ctx, devicesPath, &data); err != nil {
		slog.Warn("erp biometric devices fetch failed, serving cache", "error", err)
		return c.staleDevices(err), err
	}
	if data.Devices == nil {
		data.Devices = []integrations.ERPBiometricDeviceDTO{}
	}
	data.FetchedAt = time.Now().UTC()
	c.mu.Lock()
	c.devices = &data
	c.mu.Unlock()
	return &data, nil
}

// GetFaceless fetches the people without a usable face (personal data).
func (c *Client) GetFaceless(ctx context.Context) (*integrations.ERPFacelessListDTO, error) {
	var raw struct {
		AsOf    string                              `json:"as_of"`
		Summary integrations.ERPFacelessSummaryDTO  `json:"summary"`
		People  []integrations.ERPFacelessPersonDTO `json:"people"`
		Error   string                              `json:"error"`
	}
	if err := c.get(ctx, facelessPath, &raw); err != nil {
		slog.Warn("erp faceless list fetch failed, serving cache", "error", err)
		return c.staleFaceless(err), err
	}
	if raw.People == nil {
		raw.People = []integrations.ERPFacelessPersonDTO{}
	}
	data := &integrations.ERPFacelessListDTO{
		AsOf:      raw.AsOf,
		Summary:   raw.Summary,
		People:    raw.People,
		SourceErr: raw.Error,
		FetchedAt: time.Now().UTC(),
	}
	c.mu.Lock()
	c.faceless = data
	c.mu.Unlock()
	return data, nil
}

// GetCachedDevices returns the last snapshot without a network call.
func (c *Client) GetCachedDevices() *integrations.ERPBiometricSnapshotDTO {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.devices == nil {
		return &integrations.ERPBiometricSnapshotDTO{Devices: []integrations.ERPBiometricDeviceDTO{}, IsStale: true}
	}
	return c.devices
}

// GetCachedFaceless returns the last list without a network call.
func (c *Client) GetCachedFaceless() *integrations.ERPFacelessListDTO {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.faceless == nil {
		return &integrations.ERPFacelessListDTO{People: []integrations.ERPFacelessPersonDTO{}, IsStale: true}
	}
	return c.faceless
}

func (c *Client) staleDevices(err error) *integrations.ERPBiometricSnapshotDTO {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.devices == nil {
		return &integrations.ERPBiometricSnapshotDTO{Devices: []integrations.ERPBiometricDeviceDTO{}, IsStale: true, Error: err.Error()}
	}
	s := *c.devices
	s.IsStale, s.Error = true, err.Error()
	c.devices = &s
	return &s
}

func (c *Client) staleFaceless(err error) *integrations.ERPFacelessListDTO {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.faceless == nil {
		return &integrations.ERPFacelessListDTO{People: []integrations.ERPFacelessPersonDTO{}, IsStale: true, Error: err.Error()}
	}
	s := *c.faceless
	s.IsStale, s.Error = true, err.Error()
	c.faceless = &s
	return &s
}
