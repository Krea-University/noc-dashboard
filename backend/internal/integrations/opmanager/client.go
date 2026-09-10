package opmanager

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// Client communicates with ManageEngine OpManager REST API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new OpManager API client.
func NewClient(cfg *config.Config) *Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !cfg.OpManagerVerifyTLS,
		},
		MaxIdleConns:        20,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression: false,
	}

	return &Client{
		baseURL: cfg.OpManagerURL,
		apiKey:  cfg.OpManagerAPIKey,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

func (c *Client) Name() string {
	return "OpManager"
}

func (c *Client) TestConnection(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/api/json/device/listDevices?apiKey=%s&rows=1", c.baseURL, url.QueryEscape(c.apiKey))
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("opmanager connection test failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("opmanager returned HTTP status: %d", resp.StatusCode)
	}
	return nil
}

type rawOpDevice struct {
	Name           string      `json:"name"`
	DeviceName     string      `json:"deviceName"`
	DisplayName    string      `json:"displayName"`
	IPAddress      string      `json:"ipAddress"`
	Ipaddress      string      `json:"ipaddress"`
	Category       string      `json:"category"`
	Type           string      `json:"type"`
	Vendor         string      `json:"vendor"`
	VendorName     string      `json:"vendorName"`
	Status         string      `json:"status"`
	StatusStr      string      `json:"statusStr"`
	StatusNum      interface{} `json:"statusNum"`
	NumericStatus  interface{} `json:"numericStatus"`
	ResponseTime   string      `json:"responseTime"`
	ID             interface{} `json:"id"`
	Moid           interface{} `json:"moid"`
	InterfaceCount int         `json:"interfaceCount"`
}

func (c *Client) GetDevices(ctx context.Context) ([]integrations.DeviceDTO, error) {
	reqURL := fmt.Sprintf("%s/api/json/device/listDevices?apiKey=%s", c.baseURL, url.QueryEscape(c.apiKey))
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed fetching opmanager devices: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Support both array and object responses
	var rawList []rawOpDevice
	if err := json.Unmarshal(body, &rawList); err != nil {
		var wrapper struct {
			Devices []rawOpDevice `json:"devices"`
		}
		if err2 := json.Unmarshal(body, &wrapper); err2 != nil {
			return nil, fmt.Errorf("failed parsing opmanager response: %w", err)
		}
		rawList = wrapper.Devices
	}

	var dtos []integrations.DeviceDTO
	now := time.Now().UTC()

	for _, d := range rawList {
		name := d.DisplayName
		if name == "" {
			name = d.DeviceName
		}
		if name == "" {
			name = d.Name
		}
		if name == "" {
			continue
		}

		ip := d.IPAddress
		if ip == "" {
			ip = d.Ipaddress
		}

		vendor := d.VendorName
		if vendor == "" {
			vendor = d.Vendor
		}

		// Status calculation
		status := "UP"
		statusNumStr := fmt.Sprintf("%v", d.StatusNum)
		if statusNumStr == "1" || d.StatusStr == "Critical" || d.StatusStr == "Down" || d.Status == "Down" || d.Status == "Critical" {
			status = "DOWN"
		} else if statusNumStr == "2" || statusNumStr == "3" || d.StatusStr == "Trouble" || d.StatusStr == "Attention" || d.Status == "Warning" {
			status = "WARNING"
		} else if statusNumStr == "5" || d.StatusStr == "Clear" {
			status = "UP"
		}

		// Category classification
		catCode := "SWITCH"
		devType := d.Type
		if d.Category == "IoT" || strings.Contains(strings.ToLower(d.Type), "zk") || strings.Contains(strings.ToLower(vendor), "zk") {
			catCode = "BIOMETRIC"
			if devType == "" || strings.EqualFold(devType, "zk-teco") {
				devType = "Biometric Attendance"
			}
			vendor = "ZKTeco"
		} else if d.Category == "Server" || strings.Contains(strings.ToLower(d.Type), "server") {
			catCode = "SERVER"
		} else if d.Category == "Wireless Access Point" {
			catCode = "SWITCH"
			if devType == "" {
				devType = "Access Point"
			}
		} else if d.Category == "Firewall" {
			catCode = "SWITCH"
			if devType == "" {
				devType = "Firewall"
			}
		}

		dtos = append(dtos, integrations.DeviceDTO{
			SourceID:     name,
			Name:         name,
			IPAddress:    ip,
			CategoryCode: catCode,
			Type:         devType,
			Vendor:       vendor,
			Status:       status,
			LastSeenAt:   now,
		})
	}

	return dtos, nil
}

func (c *Client) GetDevice(ctx context.Context, sourceID string) (*integrations.DeviceDTO, error) {
	devices, err := c.GetDevices(ctx)
	if err != nil {
		return nil, err
	}
	for _, d := range devices {
		if d.SourceID == sourceID || d.Name == sourceID {
			return &d, nil
		}
	}
	return nil, fmt.Errorf("device not found: %s", sourceID)
}

type rawOpAlarm struct {
	AlarmID        interface{} `json:"alarmId"`
	DeviceName     string      `json:"deviceName"`
	DisplayName    string      `json:"displayName"`
	IPAddress      string      `json:"ipAddress"`
	Severity       string      `json:"severity"`
	SeverityString string      `json:"severityString"`
	StatusStr      string      `json:"statusStr"`
	StatusNum      interface{} `json:"statusNum"`
	Message        string      `json:"message"`
	Entity         string      `json:"entity"`
	AlarmCode      string      `json:"alarmcode"`
	ModTimeLong    int64       `json:"modTimeLong"`
}

func (c *Client) GetAlarms(ctx context.Context) ([]integrations.AlarmDTO, error) {
	reqURL := fmt.Sprintf("%s/api/json/alarm/listAlarms?apiKey=%s", c.baseURL, url.QueryEscape(c.apiKey))
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed fetching opmanager alarms: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rawAlarms []rawOpAlarm
	if err := json.Unmarshal(body, &rawAlarms); err != nil {
		var wrapper struct {
			Alarms []rawOpAlarm `json:"alarms"`
		}
		if err2 := json.Unmarshal(body, &wrapper); err2 != nil {
			return nil, fmt.Errorf("failed parsing opmanager alarms: %w", err)
		}
		rawAlarms = wrapper.Alarms
	}

	var dtos []integrations.AlarmDTO
	now := time.Now().UTC()

	for _, a := range rawAlarms {
		devName := a.DisplayName
		if devName == "" {
			devName = a.DeviceName
		}

		alarmID := fmt.Sprintf("%v", a.AlarmID)
		if alarmID == "" || alarmID == "0" || alarmID == "<nil>" {
			alarmID = fmt.Sprintf("alm_%s_%s", devName, a.AlarmCode)
		}

		sev := a.SeverityString
		if sev == "" {
			sev = a.StatusStr
		}
		severityNorm := "INFO"
		switch strings.ToLower(sev) {
		case "critical", "down":
			severityNorm = "CRITICAL"
		case "trouble", "major":
			severityNorm = "MAJOR"
		case "attention", "warning":
			severityNorm = "WARNING"
		case "clear":
			severityNorm = "CLEAR"
		}

		seenAt := now
		if a.ModTimeLong > 0 {
			seenAt = time.UnixMilli(a.ModTimeLong).UTC()
		}

		dtos = append(dtos, integrations.AlarmDTO{
			SourceID:    alarmID,
			DeviceName:  devName,
			Severity:    severityNorm,
			Message:     a.Message,
			Entity:      a.Entity,
			FirstSeenAt: seenAt,
			LastSeenAt:  seenAt,
		})
	}

	return dtos, nil
}
