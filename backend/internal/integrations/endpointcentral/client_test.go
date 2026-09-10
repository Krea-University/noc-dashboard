package endpointcentral

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
)

func TestEndpointCentralClientParsing(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/1.3/som/computers" {
			authHeader := r.Header.Get("Authorization")
			if authHeader != "test_api_key_123" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{
				"message_type": "computers",
				"message_response": {
					"total": 1,
					"limit": 25,
					"page": 1,
					"computers": [
						{
							"resource_id": 311,
							"resource_name": "Endpointcentral",
							"ip_address": "10.10.3.212",
							"mac_address": "bc:24:11:86:87:b8",
							"os_name": "Windows Server 2019 Standard",
							"os_version": "10.0.17763",
							"agent_logged_on_users": "Administrator",
							"domain_netbios_name": "WORKGROUP",
							"branch_office_name": "Local Office",
							"computer_live_status": 1,
							"agent_last_contact_time": 1789018505000
						}
					]
				}
			}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer ts.Close()

	cfg := &config.Config{
		EndpointCentralURL:       ts.URL,
		EndpointCentralAPIKey:    "test_api_key_123",
		EndpointCentralVerifyTLS: false,
	}
	client := NewClient(cfg)

	if err := client.TestConnection(context.Background()); err != nil {
		t.Fatalf("TestConnection failed: %v", err)
	}

	comps, err := client.GetComputers(context.Background())
	if err != nil {
		t.Fatalf("GetComputers failed: %v", err)
	}
	if len(comps) != 1 {
		t.Fatalf("expected 1 computer, got %d", len(comps))
	}
	if comps[0].Hostname != "Endpointcentral" || comps[0].Status != "ONLINE" {
		t.Errorf("unexpected comp: %+v", comps[0])
	}
}
