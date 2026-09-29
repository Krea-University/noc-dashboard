package zoom

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
)

func TestZoomClientParsingAndHeaders(t *testing.T) {
	var receivedToken string
	var receivedQuery string

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedToken = r.Header.Get("X-NOC-Token")
		receivedQuery = r.URL.RawQuery

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"success": true,
			"timestamp": "2026-09-29T11:38:01+05:30",
			"query_window": {
				"from": "2026-09-29T11:38:01+05:30",
				"to": "2026-09-29T23:59:59+05:30",
				"hours_span": 12.4
			},
			"total_count": 2,
			"live_count": 1,
			"upcoming_count": 1,
			"meetings": [
				{
					"id": 501,
					"meeting_id": "942 5812 0491",
					"topic": "Academic Council Meeting",
					"start_time": "2026-09-29T11:30:00+05:30",
					"end_time": "2026-09-29T12:30:00+05:30",
					"duration": 60,
					"status": "started",
					"host_name": "Dr. Raman",
					"host_email": "raman@krea.edu.in",
					"join_url": "https://zoom.krea.edu.in/j/94258120491",
					"classroom": "Boardroom A"
				},
				{
					"id": 502,
					"meeting_id": "981 4029 3810",
					"topic": "CS Lecture",
					"start_time": "2026-09-29T14:00:00+05:30",
					"end_time": "2026-09-29T15:00:00+05:30",
					"duration": 60,
					"status": "scheduled",
					"host_name": "Prof. Kumar",
					"host_email": "kumar@krea.edu.in",
					"classroom": "CR-102"
				}
			]
		}`))
	}))
	defer ts.Close()

	cfg := &config.Config{
		ZoomNOCURL:   ts.URL,
		ZoomNOCToken: "test_token_123",
	}

	client := NewClient(cfg)

	resp, err := client.GetMeetings(context.Background(), map[string]string{
		"to_time": "23:59:59",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if receivedToken != "test_token_123" {
		t.Errorf("expected X-NOC-Token to be 'test_token_123', got '%s'", receivedToken)
	}
	if receivedQuery != "to_time=23%3A59%3A59" {
		t.Errorf("unexpected query: %s", receivedQuery)
	}
	if resp.TotalCount != 2 || resp.LiveCount != 1 || resp.UpcomingCount != 1 {
		t.Errorf("unexpected counts: %+v", resp)
	}
	if len(resp.Meetings) != 2 {
		t.Fatalf("expected 2 meetings, got %d", len(resp.Meetings))
	}
	if resp.Meetings[0].Topic != "Academic Council Meeting" || resp.Meetings[0].Room != "Boardroom A" {
		t.Errorf("unexpected meeting 0 mapping: %+v", resp.Meetings[0])
	}
}

func TestZoomClientResilienceFallback(t *testing.T) {
	callCount := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		if callCount == 1 {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"success": true,
				"timestamp": "2026-09-29T11:38:01+05:30",
				"total_count": 1,
				"live_count": 1,
				"upcoming_count": 0,
				"meetings": [
					{"id": 1, "topic": "Synced Meeting", "status": "started"}
				]
			}`))
			return
		}
		// Second call fails with 503 Service Unavailable
		http.Error(w, "upstream service temporarily down", http.StatusServiceUnavailable)
	}))
	defer ts.Close()

	cfg := &config.Config{
		ZoomNOCURL:   ts.URL,
		ZoomNOCToken: "resilience_token",
	}

	client := NewClient(cfg)

	// First call succeeds
	res1, err := client.GetMeetings(context.Background(), nil)
	if err != nil {
		t.Fatalf("first call failed: %v", err)
	}
	if res1.IsStale || res1.TotalCount != 1 {
		t.Fatalf("expected fresh state, got: %+v", res1)
	}

	// Second call fails upstream, should return last cached state with IsStale = true
	res2, err := client.GetMeetings(context.Background(), nil)
	if err != nil {
		t.Fatalf("resilient fallback should not return error: %v", err)
	}
	if !res2.IsStale {
		t.Errorf("expected IsStale to be true during upstream failure")
	}
	if res2.TotalCount != 1 || res2.Meetings[0].Topic != "Synced Meeting" {
		t.Errorf("expected cached meeting data to be preserved, got: %+v", res2)
	}
}

func TestZoomMockProvider(t *testing.T) {
	mock := NewMockProvider()
	data, err := mock.GetMeetings(context.Background(), nil)
	if err != nil {
		t.Fatalf("mock provider failed: %v", err)
	}
	if data.TotalCount == 0 || len(data.Meetings) == 0 {
		t.Errorf("expected mock meetings, got 0")
	}
	cached := mock.GetCachedMeetings()
	if cached == nil || cached.TotalCount == 0 {
		t.Errorf("expected cached mock meetings")
	}
}
