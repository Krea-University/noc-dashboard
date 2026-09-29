package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/zoom"
)

func TestZoomMeetingsEndpoint(t *testing.T) {
	mockZoom := zoom.NewMockProvider()

	deps := &RouterDeps{
		Cfg: &config.Config{
			AppName:           "KREA IT NOC",
			NOCAllowedOrigins: []string{"*"},
		},
		ZoomProvider: mockZoom,
	}

	handler := SetupRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/zoom/meetings?to_time=23:59:59", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var res integrations.ZoomMeetingsResponseDTO
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed unmarshaling response: %v", err)
	}

	if !res.Success {
		t.Errorf("expected success to be true")
	}
	if res.TotalCount < 1 || len(res.Meetings) < 1 {
		t.Errorf("expected at least 1 meeting, got %d", res.TotalCount)
	}
	if res.Meetings[0].Topic == "" {
		t.Errorf("expected meeting topic to be populated")
	}
}

func TestZoomMeetingsEndpointNilProvider(t *testing.T) {
	deps := &RouterDeps{
		Cfg: &config.Config{
			AppName:           "KREA IT NOC",
			NOCAllowedOrigins: []string{"*"},
		},
		ZoomProvider: nil,
	}

	handler := SetupRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/zoom/meetings", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 for nil provider, got %d", rr.Code)
	}
}

type staticZoomProvider struct {
	data *integrations.ZoomMeetingsResponseDTO
}

func (s *staticZoomProvider) Name() string { return "StaticZoom" }
func (s *staticZoomProvider) GetMeetings(ctx context.Context, params map[string]string) (*integrations.ZoomMeetingsResponseDTO, error) {
	return s.data, nil
}
func (s *staticZoomProvider) GetCachedMeetings() *integrations.ZoomMeetingsResponseDTO {
	return s.data
}
func (s *staticZoomProvider) TestConnection(ctx context.Context) error { return nil }

func TestZoomMeetingsEndpointQueryParams(t *testing.T) {
	sampleResp := &integrations.ZoomMeetingsResponseDTO{
		Success:       true,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		TotalCount:    1,
		LiveCount:     1,
		UpcomingCount: 0,
		Meetings: []integrations.ZoomMeetingDTO{
			{
				ID:        1,
				Topic:     "Live Exam Proctoring",
				StartTime: "2026-09-29T10:00:00+05:30",
				Status:    "started",
			},
		},
	}

	deps := &RouterDeps{
		Cfg: &config.Config{
			AppName:           "KREA IT NOC",
			NOCAllowedOrigins: []string{"*"},
		},
		ZoomProvider: &staticZoomProvider{data: sampleResp},
	}

	handler := SetupRouter(deps)

	req := httptest.NewRequest(http.MethodGet, "/api/zoom/meetings?hours=4&status=started", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var res integrations.ZoomMeetingsResponseDTO
	if err := json.Unmarshal(rr.Body.Bytes(), &res); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if res.Meetings[0].Topic != "Live Exam Proctoring" {
		t.Errorf("unexpected meeting topic: %s", res.Meetings[0].Topic)
	}
}
