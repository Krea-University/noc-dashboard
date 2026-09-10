package endpointcentral

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// Client communicates with ManageEngine Endpoint Central REST API.
type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Endpoint Central API client.
func NewClient(cfg *config.Config) *Client {
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: !cfg.EndpointCentralVerifyTLS,
		},
		MaxIdleConns:    10,
		IdleConnTimeout: 90 * time.Second,
	}

	return &Client{
		baseURL: cfg.EndpointCentralURL,
		apiKey:  cfg.EndpointCentralAPIKey,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

func (c *Client) Name() string {
	return "Endpoint Central"
}

func (c *Client) TestConnection(ctx context.Context) error {
	reqURL := fmt.Sprintf("%s/api/1.3/som/computers?page=1", c.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("endpoint central connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("endpoint central returned HTTP status: %d", resp.StatusCode)
	}
	return nil
}

type rawComputerItem struct {
	ResourceID           interface{} `json:"resource_id"`
	ResourceName         string      `json:"resource_name"`
	ComputerName         string      `json:"computer_name"`
	FqdnName             string      `json:"fqdn_name"`
	IPAddress            string      `json:"ip_address"`
	MACAddress           string      `json:"mac_address"`
	OSName               string      `json:"os_name"`
	OSVersion            string      `json:"os_version"`
	AgentLoggedOnUsers   string      `json:"agent_logged_on_users"`
	User                 string      `json:"logged_on_users"`
	DomainNetbiosName    string      `json:"domain_netbios_name"`
	Domain               string      `json:"domain"`
	BranchOfficeName     string      `json:"branch_office_name"`
	ComputerLiveStatus   int         `json:"computer_live_status"`
	Status               string      `json:"computer_status"`
	AgentLastContactTime int64       `json:"agent_last_contact_time"`
}

func (c *Client) GetComputers(ctx context.Context) ([]integrations.EndpointDTO, error) {
	var endpoints []integrations.EndpointDTO
	now := time.Now().UTC()

	// Paginate through Endpoint Central SOM computers
	for page := 1; page <= 25; page++ {
		reqURL := fmt.Sprintf("%s/api/1.3/som/computers?page=%d", c.baseURL, page)
		req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", c.apiKey)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if len(endpoints) > 0 {
				break
			}
			return nil, fmt.Errorf("failed fetching endpoint computers: %w", err)
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			break
		}

		// Try SOM response structure
		var somResp struct {
			MessageResponse struct {
				Total     int               `json:"total"`
				Page      int               `json:"page"`
				Limit     int               `json:"limit"`
				Computers []rawComputerItem `json:"computers"`
			} `json:"message_response"`
		}

		var pageComputers []rawComputerItem
		if err := json.Unmarshal(body, &somResp); err == nil && len(somResp.MessageResponse.Computers) > 0 {
			pageComputers = somResp.MessageResponse.Computers
		} else {
			// Try fallback legacy format
			var rawFallback struct {
				Computers []rawComputerItem `json:"computers"`
			}
			if err2 := json.Unmarshal(body, &rawFallback); err2 == nil && len(rawFallback.Computers) > 0 {
				pageComputers = rawFallback.Computers
			}
		}

		if len(pageComputers) == 0 {
			break
		}

		for _, comp := range pageComputers {
			hostname := comp.ResourceName
			if hostname == "" {
				hostname = comp.ComputerName
			}
			if hostname == "" {
				hostname = comp.FqdnName
			}
			if hostname == "" {
				continue
			}

			user := comp.AgentLoggedOnUsers
			if user == "" || user == "--" {
				user = comp.User
			}

			domain := comp.DomainNetbiosName
			if domain == "" {
				domain = comp.Domain
			}

			status := "ONLINE"
			if comp.ComputerLiveStatus == 2 || comp.Status == "2" || comp.Status == "Down" {
				status = "OFFLINE"
			}

			lastSeen := now
			if comp.AgentLastContactTime > 0 {
				lastSeen = time.UnixMilli(comp.AgentLastContactTime).UTC()
			}

			endpoints = append(endpoints, integrations.EndpointDTO{
				SourceID:     fmt.Sprintf("%v", comp.ResourceID),
				Hostname:     hostname,
				IPAddress:    comp.IPAddress,
				MACAddress:   comp.MACAddress,
				OSName:       comp.OSName,
				OSVersion:    comp.OSVersion,
				LoggedInUser: user,
				DomainName:   domain,
				RemoteOffice: comp.BranchOfficeName,
				Status:       status,
				LastSeenAt:   lastSeen,
			})
		}

		// Check if we retrieved all records
		if somResp.MessageResponse.Total > 0 && len(endpoints) >= somResp.MessageResponse.Total {
			break
		}
	}

	return endpoints, nil
}

func (c *Client) GetComputer(ctx context.Context, sourceID string) (*integrations.EndpointDTO, error) {
	computers, err := c.GetComputers(ctx)
	if err != nil {
		return nil, err
	}
	for _, comp := range computers {
		if comp.SourceID == sourceID || comp.Hostname == sourceID {
			return &comp, nil
		}
	}
	return nil, fmt.Errorf("endpoint not found: %s", sourceID)
}
