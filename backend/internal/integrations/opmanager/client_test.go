package opmanager

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
)

func TestOpManagerClientParsing(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/json/device/listDevices":
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`[
				{"deviceName":"10.10.100.146","displayName":"SAC-GF-DIST","ipaddress":"10.10.100.146","category":"Switch","type":"Avaya ERS 3626GTS","vendorName":"Avaya","statusStr":"Clear","statusNum":"5"},
				{"deviceName":"10.10.24.11","displayName":"10.10.24.11","ipaddress":"10.10.24.11","category":"IoT","type":"Zk-Teco","vendorName":"Zk Teco","statusStr":"Clear","statusNum":"5"}
			]`))
		case "/api/json/alarm/listAlarms":
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`[
				{"alarmId":"4516","displayName":"NAB_GF_COFFE SHOP","severityString":"Trouble","message":"Interface is down","entity":"IF-1","alarmcode":"IF-DOWN"}
			]`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer ts.Close()

	cfg := &config.Config{
		OpManagerURL:       ts.URL,
		OpManagerAPIKey:    "test_key",
		OpManagerVerifyTLS: false,
	}
	client := NewClient(cfg)

	if err := client.TestConnection(context.Background()); err != nil {
		t.Fatalf("TestConnection failed: %v", err)
	}

	devs, err := client.GetDevices(context.Background())
	if err != nil {
		t.Fatalf("GetDevices failed: %v", err)
	}
	if len(devs) != 2 {
		t.Fatalf("expected 2 devices, got %d", len(devs))
	}
	if devs[0].Name != "SAC-GF-DIST" || devs[0].CategoryCode != "SWITCH" {
		t.Errorf("unexpected dev 0: %+v", devs[0])
	}
	if devs[1].CategoryCode != "BIOMETRIC" || devs[1].Vendor != "ZKTeco" {
		t.Errorf("unexpected biometric dev: %+v", devs[1])
	}

	alarms, err := client.GetAlarms(context.Background())
	if err != nil {
		t.Fatalf("GetAlarms failed: %v", err)
	}
	if len(alarms) != 1 || alarms[0].Severity != "MAJOR" {
		t.Errorf("unexpected alarms: %+v", alarms)
	}
}
