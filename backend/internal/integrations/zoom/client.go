package zoom

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// Client interacts with the KREA Zoom Pool Manager NOC Wallboard API.
type Client struct {
	endpointURL string
	apiToken    string
	httpClient  *http.Client
	mu          sync.RWMutex
	cachedData  *integrations.ZoomMeetingsResponseDTO
}

// NewClient creates a new resilient Zoom NOC API client.
func NewClient(cfg *config.Config) *Client {
	endpoint := cfg.ZoomNOCURL
	if endpoint == "" {
		endpoint = "https://zoom.krea.edu.in/api/v1/noc/meetings"
	}

	transport := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: false,
		},
		MaxIdleConns:        10,
		IdleConnTimeout:     60 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	return &Client{
		endpointURL: endpoint,
		apiToken:    cfg.ZoomNOCToken,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   15 * time.Second,
		},
	}
}

func (c *Client) Name() string {
	return "Zoom Pool Manager"
}

func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.GetMeetings(ctx, map[string]string{"hours": "1"})
	return err
}

// GetMeetings queries the live Zoom NOC endpoint and updates local cache.
func (c *Client) GetMeetings(ctx context.Context, params map[string]string) (*integrations.ZoomMeetingsResponseDTO, error) {
	reqURL, err := url.Parse(c.endpointURL)
	if err != nil {
		return c.fallbackCache(fmt.Errorf("invalid zoom endpoint url: %w", err))
	}

	q := reqURL.Query()
	for k, v := range params {
		if v != "" {
			q.Set(k, v)
		}
	}
	reqURL.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL.String(), nil)
	if err != nil {
		return c.fallbackCache(fmt.Errorf("failed creating zoom request: %w", err))
	}

	// Supply token via headers as per specification
	req.Header.Set("Accept", "application/json")
	if c.apiToken != "" {
		req.Header.Set("X-NOC-Token", c.apiToken)
		req.Header.Set("X-API-KEY", c.apiToken)
		req.Header.Set("Authorization", "Bearer "+c.apiToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		slog.Warn("zoom noc api request failed, falling back to cache", "error", err, "url", reqURL.String())
		return c.fallbackCache(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		slog.Warn("zoom noc api returned non-200 status", "status", resp.StatusCode, "body", string(body))
		return c.fallbackCache(fmt.Errorf("zoom api returned HTTP %d: %s", resp.StatusCode, string(body)))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.fallbackCache(fmt.Errorf("failed reading zoom response body: %w", err))
	}

	// Parse incoming JSON
	var raw struct {
		Success       bool                      `json:"success"`
		Timestamp     string                    `json:"timestamp"`
		QueryWindow   map[string]any            `json:"query_window"`
		TotalCount    int                       `json:"total_count"`
		LiveCount     int                       `json:"live_count"`
		UpcomingCount int                       `json:"upcoming_count"`
		Meetings      []integrations.ZoomMeetingDTO `json:"meetings"`
	}

	if err := json.Unmarshal(body, &raw); err != nil {
		slog.Warn("failed unmarshaling zoom api response, falling back to cache", "error", err)
		return c.fallbackCache(err)
	}

	// Also parse raw map for any unmapped fields per meeting
	var rawMaps struct {
		Meetings []map[string]any `json:"meetings"`
	}
	_ = json.Unmarshal(body, &rawMaps)

	for i := range raw.Meetings {
		mtg := &raw.Meetings[i]
		if i < len(rawMaps.Meetings) {
			mtg.RawData = rawMaps.Meetings[i]
		}

		// Normalize Topic / Title
		if mtg.Topic == "" && mtg.Title != "" {
			mtg.Topic = mtg.Title
		} else if mtg.Title == "" && mtg.Topic != "" {
			mtg.Title = mtg.Topic
		}

		// Normalize Start times
		if mtg.StartTime == "" && mtg.StartsAt != "" {
			mtg.StartTime = mtg.StartsAt
		} else if mtg.StartsAt == "" && mtg.StartTime != "" {
			mtg.StartsAt = mtg.StartTime
		}

		// Normalize End times
		if mtg.EndTime == "" && mtg.EndsAt != "" {
			mtg.EndTime = mtg.EndsAt
		} else if mtg.EndsAt == "" && mtg.EndTime != "" {
			mtg.EndsAt = mtg.EndTime
		}

		// Normalize Duration
		if mtg.Duration == 0 && mtg.DurationMinutes > 0 {
			mtg.Duration = mtg.DurationMinutes
		} else if mtg.DurationMinutes == 0 && mtg.Duration > 0 {
			mtg.DurationMinutes = mtg.Duration
		}

		// Normalize Meeting ID
		if mtg.MeetingID == "" && mtg.ZoomMeetingID != "" {
			mtg.MeetingID = mtg.ZoomMeetingID
		} else if mtg.ZoomMeetingID == "" && mtg.MeetingID != "" {
			mtg.ZoomMeetingID = mtg.MeetingID
		}

		// Normalize Participant Count
		if mtg.ParticipantsCount == 0 && mtg.ParticipantCount > 0 {
			mtg.ParticipantsCount = mtg.ParticipantCount
		} else if mtg.ParticipantCount == 0 && mtg.ParticipantsCount > 0 {
			mtg.ParticipantCount = mtg.ParticipantsCount
		}

		// Normalize Room from custom fields
		if mtg.Room == "" {
			if mtg.Classroom != "" {
				mtg.Room = mtg.Classroom
			} else if mtg.CustomFields != nil {
				if cr, ok := mtg.CustomFields["class_room"].(string); ok && cr != "" {
					mtg.Room = cr
					mtg.Classroom = cr
				}
			}
		}

		// Normalize Host Name and Email from requester/owner/host_resource
		if mtg.HostName == "" {
			if mtg.Requester != nil {
				if n, ok := mtg.Requester["name"].(string); ok && n != "" {
					mtg.HostName = n
				}
			}
			if mtg.HostName == "" && mtg.HostResource != nil {
				if n, ok := mtg.HostResource["name"].(string); ok && n != "" {
					mtg.HostName = n
				}
			}
		}
		if mtg.HostEmail == "" {
			if mtg.Requester != nil {
				if e, ok := mtg.Requester["email"].(string); ok && e != "" {
					mtg.HostEmail = e
				}
			}
			if mtg.HostEmail == "" && mtg.HostResource != nil {
				if e, ok := mtg.HostResource["email"].(string); ok && e != "" {
					mtg.HostEmail = e
				}
			}
		}

		// In-progress detection: if marked live or currently in start-end window
		if mtg.IsLive || (mtg.StartsInMinutes <= 0 && mtg.EndsInMinutes > 0) {
			mtg.IsLive = true
		}
	}

	result := &integrations.ZoomMeetingsResponseDTO{
		Success:       raw.Success,
		Timestamp:     raw.Timestamp,
		QueryWindow:   raw.QueryWindow,
		TotalCount:    raw.TotalCount,
		LiveCount:     raw.LiveCount,
		UpcomingCount: raw.UpcomingCount,
		Meetings:      raw.Meetings,
		LastSyncedAt:  time.Now().UTC(),
		IsStale:       false,
	}

	// Save to local cache
	c.mu.Lock()
	c.cachedData = result
	c.mu.Unlock()

	return result, nil
}

// GetCachedMeetings returns the currently cached meetings without network call.
func (c *Client) GetCachedMeetings() *integrations.ZoomMeetingsResponseDTO {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.cachedData == nil {
		return &integrations.ZoomMeetingsResponseDTO{
			Success:       true,
			Timestamp:     time.Now().UTC().Format(time.RFC3339),
			TotalCount:    0,
			LiveCount:     0,
			UpcomingCount: 0,
			Meetings:      []integrations.ZoomMeetingDTO{},
			LastSyncedAt:  time.Now().UTC(),
			IsStale:       false,
		}
	}
	return c.cachedData
}

// fallbackCache handles network failures by returning the last known state marked as stale.
func (c *Client) fallbackCache(originalErr error) (*integrations.ZoomMeetingsResponseDTO, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.cachedData != nil {
		// Clone and set IsStale = true
		staleCopy := *c.cachedData
		staleCopy.IsStale = true
		slog.Warn("serving stale zoom meetings data due to upstream error", "err", originalErr)
		return &staleCopy, nil
	}

	// Empty fallback if never successfully loaded
	return &integrations.ZoomMeetingsResponseDTO{
		Success:       false,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		TotalCount:    0,
		LiveCount:     0,
		UpcomingCount: 0,
		Meetings:      []integrations.ZoomMeetingDTO{},
		LastSyncedAt:  time.Time{},
		IsStale:       true,
	}, nil
}
