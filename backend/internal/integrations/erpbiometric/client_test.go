package erpbiometric

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
)

const devicesBody = `{"ok":true,"data":{"generated_at":"2026-11-19T13:05:00+05:30",
 "summary":{"total":2,"online":1,"offline":1,"open_outages":1,"zk_online":1,"zk_offline":0},
 "devices":[
  {"device_id":"22","name":"JSW-2E","type":"student_attendance","ip":"10.10.4.21","serial":"S1","rooms":"JSW-2E",
   "status":"online","last_sync":"2026-11-19 13:04:41","down_since":"",
   "zk":{"terminal_id":41,"alias":"JSW-2E","online":true,"last_activity":"2026-11-19 13:04:58","area":"Krea Area",
         "user_count":912,"fp_count":14,"face_count":887,"firmware":"Ver 8"}},
  {"device_id":"23","name":"JSW-2F","type":"student_attendance","ip":"10.10.4.22","serial":"","rooms":"",
   "status":"offline","last_sync":"","down_since":"2026-11-19 10:00:00","zk":null}],
 "zk_error":"",
 "faceless":{"as_of":"2026-11-19T13:00:12+05:30","summary":{"total":87,"no_face":2,"old_face_template":85,"students":86,"staff":0,"not_in_erp":1},"error":""}}}`

const facelessBody = `{"ok":true,"data":{"as_of":"2026-11-19T13:00:12+05:30",
 "summary":{"total":1,"no_face":0,"old_face_template":1,"students":1,"staff":0,"not_in_erp":0},
 "people":[{"biometric_id":"2462","name":"Test Person","code":"ROLL-1","type":"student","reason":"old_face_template","zk_face":"Ver 39:1"}],
 "error":""}}`

// fakeERP answers like the ERP NOC API; status 0 closes the connection.
func fakeERP(t *testing.T, routes map[string]func() (int, string)) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"ok":false,"err-msg":"Unauthorized","err-code":401}`))
			return
		}
		h, ok := routes[r.URL.Path]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		code, body := h()
		if code == 0 {
			hj, _ := w.(http.Hijacker)
			conn, _, _ := hj.Hijack()
			_ = conn.Close()
			return
		}
		w.WriteHeader(code)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return NewClient(&config.Config{ERPNOCBaseURL: srv.URL + "/", ERPNOCToken: "tok"})
}

func TestGetDevicesParsesSnapshot(t *testing.T) {
	c := fakeERP(t, map[string]func() (int, string){devicesPath: func() (int, string) { return 200, devicesBody }})

	s, err := c.GetDevices(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if s.IsStale || len(s.Devices) != 2 || s.Summary.OpenOutages != 1 || s.Faceless.Summary.Total != 87 {
		t.Fatalf("snapshot = %+v", s)
	}
	if d := s.Devices[0]; d.ZK == nil || d.ZK.TerminalID != 41 || d.ZK.Area != "Krea Area" || !d.ZK.Online {
		t.Fatalf("device 22 zk = %+v", d.ZK)
	}
	if d := s.Devices[1]; d.ZK != nil || d.DownSince == "" || d.Status != "offline" {
		t.Fatalf("device 23 = %+v", d)
	}
}

func TestERPErrorEnvelope(t *testing.T) {
	c := fakeERP(t, map[string]func() (int, string){
		devicesPath: func() (int, string) { return 200, `{"ok":false,"err-msg":"NOC API is not configured","err-code":503}` },
	})
	s, err := c.GetDevices(context.Background())
	if err == nil || !strings.Contains(err.Error(), "503") || !strings.Contains(err.Error(), "not configured") {
		t.Fatalf("err = %v", err)
	}
	if !s.IsStale || len(s.Devices) != 0 {
		t.Fatalf("want empty stale snapshot, got %+v", s)
	}

	bad := NewClient(&config.Config{ERPNOCBaseURL: c.baseURL, ERPNOCToken: "wrong"})
	if _, err := bad.GetDevices(context.Background()); err == nil || !strings.Contains(err.Error(), "401") {
		t.Fatalf("wrong token err = %v", err)
	}
}

func TestServesLastGoodSnapshotWhenERPIsDown(t *testing.T) {
	up := true
	c := fakeERP(t, map[string]func() (int, string){devicesPath: func() (int, string) {
		if up {
			return 200, devicesBody
		}
		return 0, ""
	}})
	if _, err := c.GetDevices(context.Background()); err != nil {
		t.Fatal(err)
	}

	up = false
	s, err := c.GetDevices(context.Background())
	if err == nil {
		t.Fatal("want an error while the ERP is down")
	}
	if !s.IsStale || len(s.Devices) != 2 || s.Error == "" {
		t.Fatalf("want last good snapshot marked stale, got stale=%v devices=%d error=%q", s.IsStale, len(s.Devices), s.Error)
	}
	if cached := c.GetCachedDevices(); !cached.IsStale {
		t.Fatal("cached snapshot should be marked stale too")
	}
}

func TestGetFaceless(t *testing.T) {
	c := fakeERP(t, map[string]func() (int, string){facelessPath: func() (int, string) { return 200, facelessBody }})
	l, err := c.GetFaceless(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(l.People) != 1 || l.People[0].Code != "ROLL-1" || l.People[0].Reason != "old_face_template" || l.Summary.Total != 1 {
		t.Fatalf("list = %+v", l)
	}
}
