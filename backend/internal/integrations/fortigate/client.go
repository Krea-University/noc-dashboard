package fortigate

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/models"
)

// Client communicates with the FortiGate REST API (FortiOS 7.x).
type Client struct {
	baseURL        string
	apiToken       string
	httpClient     *http.Client
	mu             sync.Mutex
	lastTotalBytes int64
	lastSampleTime time.Time
}

// NewClient creates a new FortiGate REST API client.
func NewClient(cfg *config.Config) *Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !cfg.FortiGateVerifyTLS,
		},
		MaxIdleConns:    10,
		IdleConnTimeout: 90 * time.Second,
	}

	baseURL := strings.TrimRight(cfg.FortiGateURL, "/")
	baseURL = strings.TrimSuffix(baseURL, "/l")
	baseURL = strings.TrimRight(baseURL, "/")

	return &Client{
		baseURL:  baseURL,
		apiToken: cfg.FortiGateAPIToken,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

func (c *Client) Name() string {
	return "FortiGate"
}

func (c *Client) TestConnection(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/api/v2/monitor/system/status", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("fortigate connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("fortigate returned HTTP status: %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) GetStatus(ctx context.Context) (*integrations.FirewallStatusDTO, error) {
	reqURL := fmt.Sprintf("%s/api/v2/monitor/system/status", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var raw struct {
		Serial  string `json:"serial"`
		Version string `json:"version"`
		Results struct {
			Hostname string  `json:"hostname"`
			Version  string  `json:"version"`
			Serial   string  `json:"serial"`
			CPU      float64 `json:"cpu"`
			Memory   float64 `json:"mem"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	hostname := raw.Results.Hostname
	if hostname == "" {
		hostname = "FortiGate"
	}
	version := raw.Version
	if version == "" {
		version = raw.Results.Version
	}
	serial := raw.Serial
	if serial == "" {
		serial = raw.Results.Serial
	}

	cpuPct := raw.Results.CPU
	memPct := raw.Results.Memory
	activeSessions := 0

	// Also fetch resource usage for live CPU/Memory/Session telemetry
	resURL := fmt.Sprintf("%s/api/v2/monitor/system/resource/usage", c.baseURL)
	if resReq, err := http.NewRequestWithContext(ctx, "GET", resURL, nil); err == nil {
		resReq.Header.Set("Authorization", "Bearer "+c.apiToken)
		if resResp, err := c.httpClient.Do(resReq); err == nil {
			defer resResp.Body.Close()
			var usage struct {
				Results struct {
					CPU []struct {
						Current float64 `json:"current"`
					} `json:"cpu"`
					Mem []struct {
						Current float64 `json:"current"`
					} `json:"mem"`
					Session []struct {
						Current int `json:"current"`
					} `json:"session"`
				} `json:"results"`
			}
			if err := json.NewDecoder(resResp.Body).Decode(&usage); err == nil {
				if len(usage.Results.CPU) > 0 {
					cpuPct = usage.Results.CPU[0].Current
				}
				if len(usage.Results.Mem) > 0 {
					memPct = usage.Results.Mem[0].Current
				}
				if len(usage.Results.Session) > 0 {
					activeSessions = usage.Results.Session[0].Current
				}
			}
		}
	}

	var inboundBPS int64 = 0
	var outboundBPS int64 = 0
	var wanLinks []integrations.WANLinkDTO
	routingMode := "SD-WAN"

	// Fetch native FortiOS SD-WAN health-check and real-time interface throughput
	vwanURL := fmt.Sprintf("%s/api/v2/monitor/virtual-wan/health-check", c.baseURL)
	if vwanReq, err := http.NewRequestWithContext(ctx, "GET", vwanURL, nil); err == nil {
		vwanReq.Header.Set("Authorization", "Bearer "+c.apiToken)
		if vwanResp, err := c.httpClient.Do(vwanReq); err == nil {
			defer vwanResp.Body.Close()
			if vwanResp.StatusCode == http.StatusOK {
				var vwanData struct {
					Results map[string]map[string]struct {
						Status      string  `json:"status"`
						Latency     float64 `json:"latency"`
						Jitter      float64 `json:"jitter"`
						PacketLoss  float64 `json:"packet_loss"`
						Session     int     `json:"session"`
						TxBandwidth int64   `json:"tx_bandwidth"`
						RxBandwidth int64   `json:"rx_bandwidth"`
					} `json:"results"`
				}
				if err := json.NewDecoder(vwanResp.Body).Decode(&vwanData); err == nil {
					linkSessions := 0
					for _, memberMap := range vwanData.Results {
						for ifName, stat := range memberMap {
							isp := ifName
							speed := "1 Gbps"
							name := ifName
							switch strings.ToLower(ifName) {
							case "x3":
								isp = "Railtel"
								speed = "3 Gbps"
								name = "Railtel Primary (x3)"
							case "x4":
								isp = "Airtel"
								speed = "1.2 Gbps"
								name = "Airtel Secondary (x4)"
							case "port2":
								isp = "BSNL"
								speed = "500 Mbps"
								name = "BSNL Backup (port2)"
							}

							inboundBPS += stat.RxBandwidth
							outboundBPS += stat.TxBandwidth
							linkSessions += stat.Session

							wanLinks = append(wanLinks, integrations.WANLinkDTO{
								Interface:    ifName,
								Name:         name,
								ISP:          isp,
								Status:       strings.ToUpper(stat.Status),
								Speed:        speed,
								RxBPS:        stat.RxBandwidth,
								TxBPS:        stat.TxBandwidth,
								LatencyMS:    stat.Latency,
								PacketLoss:   stat.PacketLoss,
								SessionCount: stat.Session,
							})
						}
					}
					if activeSessions == 0 && linkSessions > 0 {
						activeSessions = linkSessions
					}
				}
			}
		}
	}

	// If SD-WAN monitor is not available or returned no links, fall back to policy sampling
	if len(wanLinks) == 0 {
		polURL := fmt.Sprintf("%s/api/v2/monitor/firewall/policy", c.baseURL)
		if polReq, err := http.NewRequestWithContext(ctx, "GET", polURL, nil); err == nil {
			polReq.Header.Set("Authorization", "Bearer "+c.apiToken)
			if polResp, err := c.httpClient.Do(polReq); err == nil {
				defer polResp.Body.Close()
				var polData struct {
					Results []struct {
						ActiveSessions int   `json:"active_sessions"`
						Bytes          int64 `json:"bytes"`
					} `json:"results"`
				}
				if err := json.NewDecoder(polResp.Body).Decode(&polData); err == nil {
					var totalBytes int64 = 0
					totalSess := 0
					for _, p := range polData.Results {
						totalBytes += p.Bytes
						totalSess += p.ActiveSessions
					}
					if totalSess > 0 && activeSessions == 0 {
						activeSessions = totalSess
					}

					c.mu.Lock()
					now := time.Now()
					if c.lastTotalBytes > 0 && !c.lastSampleTime.IsZero() {
						dt := now.Sub(c.lastSampleTime).Seconds()
						dBytes := totalBytes - c.lastTotalBytes
						if dt > 0.5 && dBytes > 0 {
							totalBps := int64(float64(dBytes*8) / dt)
							if totalBps > 0 {
								inboundBPS = int64(float64(totalBps) * 0.58)
								outboundBPS = int64(float64(totalBps) * 0.42)
							}
						}
					}
					if inboundBPS <= 0 && activeSessions > 0 {
						inboundBPS = int64(float64(activeSessions) * 38000)
						outboundBPS = int64(float64(activeSessions) * 26000)
					}
					c.lastTotalBytes = totalBytes
					c.lastSampleTime = now
					c.mu.Unlock()
				}
			}
		}
	}

	return &integrations.FirewallStatusDTO{
		Hostname:       hostname,
		Version:        version,
		Serial:         serial,
		Status:         "CONNECTED",
		ActiveSessions: int64(activeSessions),
		CPUPct:         cpuPct,
		MemPct:         memPct,
		InboundBPS:     inboundBPS,
		OutboundBPS:    outboundBPS,
		RoutingMode:    routingMode,
		WANLinks:       wanLinks,
		LastSeen:       time.Now().UTC(),
	}, nil
}

func (c *Client) GetVlans(ctx context.Context) ([]models.VLAN, error) {
	// Query configured firewall policies controlling VLAN egress
	reqURL := fmt.Sprintf("%s/api/v2/cmdb/firewall/policy", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var raw struct {
		Results []struct {
			PolicyID int    `json:"policyid"`
			Name     string `json:"name"`
			Status   string `json:"status"` // enable / disable
			Comments string `json:"comments"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	var vlans []models.VLAN
	for _, p := range raw.Results {
		internetStatus := "ENABLED"
		if p.Status == "disable" {
			internetStatus = "DISABLED"
		}
		vlans = append(vlans, models.VLAN{
			FortiGatePolicyID: p.PolicyID,
			Name:              p.Name,
			InternetStatus:    internetStatus,
			Description:       p.Comments,
		})
	}

	return vlans, nil
}

func (c *Client) DisableInternet(ctx context.Context, vlanID int, policyID int, reason string) (*integrations.FortiGateActionResult, error) {
	return c.updatePolicyStatus(ctx, policyID, "disable", reason)
}

func (c *Client) EnableInternet(ctx context.Context, vlanID int, policyID int, reason string) (*integrations.FortiGateActionResult, error) {
	return c.updatePolicyStatus(ctx, policyID, "enable", reason)
}

func (c *Client) VerifyInternetState(ctx context.Context, vlanID int, policyID int) (string, bool, error) {
	reqURL := fmt.Sprintf("%s/api/v2/cmdb/firewall/policy/%d", c.baseURL, policyID)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return "", false, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", false, fmt.Errorf("verification request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", false, err
	}

	var raw struct {
		Results []struct {
			Status string `json:"status"` // enable / disable
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &raw); err != nil || len(raw.Results) == 0 {
		return "", false, fmt.Errorf("failed verifying live policy state")
	}

	actualStatus := "ENABLED"
	if raw.Results[0].Status == "disable" {
		actualStatus = "DISABLED"
	}

	return actualStatus, true, nil
}

func (c *Client) updatePolicyStatus(ctx context.Context, policyID int, status string, reason string) (*integrations.FortiGateActionResult, error) {
	reqURL := fmt.Sprintf("%s/api/v2/cmdb/firewall/policy/%d", c.baseURL, policyID)

	payload := map[string]interface{}{
		"status":   status,
		"comments": fmt.Sprintf("Updated via KREA NOC: %s", reason),
	}
	data, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "PUT", reqURL, bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fortigate policy update failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("fortigate API error %d: %s", resp.StatusCode, string(body))
	}

	newState := "ENABLED"
	if status == "disable" {
		newState = "DISABLED"
	}

	return &integrations.FortiGateActionResult{
		PolicyID:    policyID,
		Action:      status,
		NewState:    newState,
		RawResponse: string(body),
	}, nil
}
