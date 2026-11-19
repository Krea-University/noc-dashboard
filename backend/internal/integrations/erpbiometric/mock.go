package erpbiometric

import (
	"context"
	"time"

	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
)

// MockProvider serves a fixed ERP biometric snapshot for offline development.
// It covers every state the UI shows: healthy, open outage, ZK offline and
// not linked to a ZK terminal. People are clearly fake.
type MockProvider struct{}

func NewMockProvider() *MockProvider { return &MockProvider{} }

func (m *MockProvider) Name() string                             { return "Krea OneERP Biometrics (mock)" }
func (m *MockProvider) TestConnection(ctx context.Context) error { return nil }

func (m *MockProvider) GetDevices(ctx context.Context) (*integrations.ERPBiometricSnapshotDTO, error) {
	return m.GetCachedDevices(), nil
}

func (m *MockProvider) GetCachedDevices() *integrations.ERPBiometricSnapshotDTO {
	now := time.Now()
	ts := func(d time.Duration) string { return now.Add(-d).Format("2006-01-02 15:04:05") }
	zk := func(id int64, alias string, online bool, area string) *integrations.ERPZKTerminalDTO {
		return &integrations.ERPZKTerminalDTO{TerminalID: id, Alias: alias, Online: online, LastActivity: ts(time.Minute),
			Area: area, UserCount: 900, FPCount: 12, FaceCount: 880, Firmware: "Ver 8.0.4.2"}
	}

	s := &integrations.ERPBiometricSnapshotDTO{
		GeneratedAt: now.Format(time.RFC3339),
		Devices: []integrations.ERPBiometricDeviceDTO{
			{DeviceID: "1", Name: "Main Gate In", Type: "student_in", IP: "10.10.3.11", Serial: "MOCK0001", Rooms: "Main Gate",
				Status: "online", LastSync: ts(time.Minute), ZK: zk(101, "Main Gate In", true, "Krea Area")},
			{DeviceID: "2", Name: "Main Gate Out", Type: "student_out", IP: "10.10.3.12", Serial: "MOCK0002", Rooms: "Main Gate",
				Status: "online", LastSync: ts(time.Minute), ZK: zk(102, "Main Gate Out", true, "Krea Area")},
			{DeviceID: "3", Name: "JSW-2E", Type: "student_attendance", IP: "10.10.4.21", Serial: "MOCK0003", Rooms: "JSW-2E",
				Status: "offline", LastSync: ts(3 * time.Hour), DownSince: ts(3 * time.Hour), ZK: zk(103, "JSW-2E", false, "Krea Area")},
			{DeviceID: "4", Name: "JSW-2F", Type: "student_attendance", IP: "10.10.4.22", Serial: "MOCK0004", Rooms: "JSW-2F",
				Status: "offline", LastSync: ts(40 * time.Minute), DownSince: ts(40 * time.Minute), ZK: zk(104, "JSW-2F", true, "Krea Area")},
			{DeviceID: "5", Name: "Dining Hall 1", Type: "dining_transaction", IP: "10.10.5.31", Serial: "MOCK0005", Rooms: "Dining Hall",
				Status: "online", LastSync: ts(2 * time.Minute)},
			{DeviceID: "6", Name: "Exam Office", Type: "staff_attendance", IP: "10.10.6.41", Serial: "MOCK0006", Rooms: "Exam Office",
				Status: "online", LastSync: ts(time.Minute), ZK: zk(106, "Exam Office", true, "Exam Office")},
		},
	}
	for _, d := range s.Devices {
		s.Summary.Total++
		if d.Status == "online" {
			s.Summary.Online++
		} else {
			s.Summary.Offline++
		}
		if d.DownSince != "" {
			s.Summary.OpenOutages++
		}
		if d.ZK != nil {
			if d.ZK.Online {
				s.Summary.ZKOnline++
			} else {
				s.Summary.ZKOffline++
			}
		}
	}
	f := m.GetCachedFaceless()
	s.Faceless.AsOf, s.Faceless.Summary = f.AsOf, f.Summary
	s.FetchedAt = now.UTC()
	return s
}

func (m *MockProvider) GetFaceless(ctx context.Context) (*integrations.ERPFacelessListDTO, error) {
	return m.GetCachedFaceless(), nil
}

func (m *MockProvider) GetCachedFaceless() *integrations.ERPFacelessListDTO {
	people := []integrations.ERPFacelessPersonDTO{
		{BiometricID: "9001", Name: "Demo Student One", Code: "DEMO2026-001", Type: "student", Reason: "old_face_template", ZKFace: "Ver 39:1"},
		{BiometricID: "9002", Name: "Demo Student Two", Code: "DEMO2026-002", Type: "student", Reason: "old_face_template", ZKFace: "Ver 39:1"},
		{BiometricID: "9003", Name: "Demo Staff One", Code: "DEMO-STAFF-1", Type: "staff", Reason: "no_face", ZKFace: "-"},
		{BiometricID: "100000000", Name: "-", Code: "", Type: "not_in_erp", Reason: "no_face", ZKFace: "-"},
	}
	l := &integrations.ERPFacelessListDTO{AsOf: time.Now().Format(time.RFC3339), People: people, FetchedAt: time.Now().UTC()}
	for _, p := range people {
		l.Summary.Total++
		if p.Reason == "no_face" {
			l.Summary.NoFace++
		} else {
			l.Summary.OldFaceTemplate++
		}
		switch p.Type {
		case "student":
			l.Summary.Students++
		case "staff":
			l.Summary.Staff++
		default:
			l.Summary.NotInERP++
		}
	}
	return l
}
