package zoom

import (
	"context"
	"sync"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// MockProvider provides realistic simulation of Zoom meetings for offline testing and demo displays.
type MockProvider struct {
	mu         sync.RWMutex
	cachedData *integrations.ZoomMeetingsResponseDTO
}

// NewMockProvider creates a new Zoom mock provider.
func NewMockProvider() *MockProvider {
	mp := &MockProvider{}
	mp.refreshMockData()
	return mp
}

func (m *MockProvider) Name() string {
	return "Zoom Pool Manager (Mock)"
}

func (m *MockProvider) TestConnection(ctx context.Context) error {
	return nil
}

func (m *MockProvider) refreshMockData() {
	now := time.Now().UTC()
	ist := time.FixedZone("IST", 5*3600+30*60)
	nowIST := now.In(ist)

	// Completed meeting (started 3 hrs ago, ended 2 hrs ago)
	mCompletedStart := nowIST.Add(-180 * time.Minute)
	mCompletedEnd := nowIST.Add(-120 * time.Minute)

	// Live / In Progress meeting (started 15 mins ago, ends in 45 mins)
	mLiveStart := nowIST.Add(-15 * time.Minute)
	mLiveEnd := nowIST.Add(45 * time.Minute)

	// Upcoming Today (starts in 40 mins)
	mUpcomingTodayStart := nowIST.Add(40 * time.Minute)
	mUpcomingTodayEnd := nowIST.Add(100 * time.Minute)

	// Upcoming Tomorrow (starts in 18 hours)
	mTomorrowStart := nowIST.Add(18 * time.Hour)
	mTomorrowEnd := nowIST.Add(19 * time.Hour)

	mockMeetings := []integrations.ZoomMeetingDTO{
		{
			ID:                1,
			PublicID:          "01M3PAE79B70VKHBRWPQ0CB8GW",
			Title:             "Krea ERP Architecture Review",
			Topic:             "Krea ERP Architecture Review",
			Description:       "Krea ERP Architecture & Infrastructure Review",
			MeetingType:       "meeting",
			Status:            "scheduled",
			IsLive:            true,
			StartsAt:          mLiveStart.Format(time.RFC3339),
			EndsAt:            mLiveEnd.Format(time.RFC3339),
			StartTime:         mLiveStart.Format(time.RFC3339),
			EndTime:           mLiveEnd.Format(time.RFC3339),
			DurationMinutes:   60,
			Duration:          60,
			StartsInMinutes:   -15,
			EndsInMinutes:     45,
			Timezone:          "Asia/Kolkata",
			ParticipantCount:  10,
			ParticipantsCount: 10,
			WaitingRoom:       true,
			JoinBeforeHost:    true,
			JbhTime:           15,
			RecordingMode:     "none",
			ZoomMeetingID:     "85267983429",
			MeetingID:         "85267983429",
			JoinURL:           "https://krea-edu-in.zoom.us/j/85267983429?pwd=QhjRblpPxFsaFi1r7TERAgjurmnhdp.1",
			Passcode:          "937942",
			Room:              "SDC ERP Room",
			Classroom:         "SDC ERP Room",
			CustomFields: map[string]any{
				"class_room": "SDC ERP Room",
			},
			CustomFieldsFormatted: []any{
				map[string]any{"key": "class_room", "name": "Class Room", "type": "dropdown", "value": "SDC ERP Room"},
			},
			Requester: map[string]any{
				"id":    1,
				"name":  "Super Administrator",
				"email": "erpadmin@krea.edu.in",
			},
			Owner: map[string]any{
				"id":    1,
				"name":  "Super Administrator",
				"email": "erpadmin@krea.edu.in",
			},
			HostResource: map[string]any{
				"id":    34,
				"name":  "Krea University",
				"email": "itadmin@krea.edu.in",
			},
			HostName:  "Super Administrator",
			HostEmail: "erpadmin@krea.edu.in",
		},
		{
			ID:                2,
			PublicID:          "01M3PAE79B70VKHBRWPQ0CB8GX",
			Title:             "CS 301: Distributed Systems Lecture",
			Topic:             "CS 301: Distributed Systems Lecture",
			Description:       "Distributed consensus and cloud architecture lecture",
			MeetingType:       "meeting",
			Status:            "scheduled",
			IsLive:            false,
			StartsAt:          mUpcomingTodayStart.Format(time.RFC3339),
			EndsAt:            mUpcomingTodayEnd.Format(time.RFC3339),
			StartTime:         mUpcomingTodayStart.Format(time.RFC3339),
			EndTime:           mUpcomingTodayEnd.Format(time.RFC3339),
			DurationMinutes:   60,
			Duration:          60,
			StartsInMinutes:   40,
			EndsInMinutes:     100,
			Timezone:          "Asia/Kolkata",
			ParticipantCount:  45,
			ParticipantsCount: 45,
			WaitingRoom:       false,
			JoinBeforeHost:    true,
			ZoomMeetingID:     "98140293810",
			MeetingID:         "98140293810",
			JoinURL:           "https://krea-edu-in.zoom.us/j/98140293810?pwd=test",
			Passcode:          "CS301Live",
			Room:              "Classroom 104 (Academic Block 1)",
			Classroom:         "CR-104",
			CustomFields: map[string]any{
				"class_room": "Classroom 104 (Academic Block 1)",
			},
			Requester: map[string]any{
				"name":  "Prof. Rajesh Kumar",
				"email": "rajesh.kumar@krea.edu.in",
			},
			HostName:  "Prof. Rajesh Kumar",
			HostEmail: "rajesh.kumar@krea.edu.in",
		},
		{
			ID:                3,
			PublicID:          "01M3PAE79B70VKHBRWPQ0CB8GY",
			Title:             "SIAS Executive Academic Council - Day 2",
			Topic:             "SIAS Executive Academic Council - Day 2",
			Description:       "Tomorrow's executive faculty alignment session",
			MeetingType:       "meeting",
			Status:            "scheduled",
			IsLive:            false,
			StartsAt:          mTomorrowStart.Format(time.RFC3339),
			EndsAt:            mTomorrowEnd.Format(time.RFC3339),
			StartTime:         mTomorrowStart.Format(time.RFC3339),
			EndTime:           mTomorrowEnd.Format(time.RFC3339),
			DurationMinutes:   60,
			Duration:          60,
			StartsInMinutes:   1080,
			EndsInMinutes:     1140,
			Timezone:          "Asia/Kolkata",
			ParticipantCount:  20,
			ParticipantsCount: 20,
			WaitingRoom:       true,
			ZoomMeetingID:     "94258120491",
			MeetingID:         "94258120491",
			JoinURL:           "https://krea-edu-in.zoom.us/j/94258120491",
			Passcode:          "Krea2026",
			Room:              "Executive Boardroom A",
			Classroom:         "Boardroom A",
			CustomFields: map[string]any{
				"class_room": "Executive Boardroom A",
			},
			Requester: map[string]any{
				"name":  "Dr. Lakshmi Raman",
				"email": "lakshmi.raman@krea.edu.in",
			},
			HostName:  "Dr. Lakshmi Raman",
			HostEmail: "lakshmi.raman@krea.edu.in",
		},
		{
			ID:                4,
			PublicID:          "01M3PAE79B70VKHBRWPQ0CB8GZ",
			Title:             "Morning IT Infrastructure & Security Briefing",
			Topic:             "Morning IT Infrastructure & Security Briefing",
			Description:       "Completed daily security standup",
			MeetingType:       "meeting",
			Status:            "ended",
			IsLive:            false,
			StartsAt:          mCompletedStart.Format(time.RFC3339),
			EndsAt:            mCompletedEnd.Format(time.RFC3339),
			StartTime:         mCompletedStart.Format(time.RFC3339),
			EndTime:           mCompletedEnd.Format(time.RFC3339),
			DurationMinutes:   60,
			Duration:          60,
			StartsInMinutes:   -180,
			EndsInMinutes:     -120,
			Timezone:          "Asia/Kolkata",
			ParticipantCount:  12,
			ParticipantsCount: 12,
			WaitingRoom:       false,
			ZoomMeetingID:     "91082917462",
			MeetingID:         "91082917462",
			JoinURL:           "https://krea-edu-in.zoom.us/j/91082917462",
			Passcode:          "NocOps26",
			Room:              "NOC Command Center",
			Classroom:         "NOC-01",
			CustomFields: map[string]any{
				"class_room": "NOC Command Center",
			},
			Requester: map[string]any{
				"name":  "Senthil Nathan",
				"email": "senthil.nathan@krea.edu.in",
			},
			HostName:  "Senthil Nathan",
			HostEmail: "senthil.nathan@krea.edu.in",
		},
	}

	m.cachedData = &integrations.ZoomMeetingsResponseDTO{
		Success:   true,
		Timestamp: nowIST.Format(time.RFC3339),
		QueryWindow: map[string]any{
			"from":       nowIST.Format(time.RFC3339),
			"to":         nowIST.Add(48 * time.Hour).Format(time.RFC3339),
			"hours_span": 48.0,
		},
		TotalCount:    len(mockMeetings),
		LiveCount:     1,
		UpcomingCount: 2,
		Meetings:      mockMeetings,
		LastSyncedAt:  now,
		IsStale:       false,
	}
}

func (m *MockProvider) GetMeetings(ctx context.Context, params map[string]string) (*integrations.ZoomMeetingsResponseDTO, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.refreshMockData()
	return m.cachedData, nil
}

func (m *MockProvider) GetCachedMeetings() *integrations.ZoomMeetingsResponseDTO {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.cachedData
}
