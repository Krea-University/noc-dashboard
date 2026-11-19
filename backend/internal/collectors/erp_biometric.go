package collectors

import (
	"context"
	"log/slog"
	"time"
)

// runERPBiometricCollector polls the Krea OneERP biometric NOC API: the
// device snapshot every PollERPBiometricInterval, and the faceless list every
// PollERPFacelessInterval (it changes only when someone is re-captured).
func (m *CollectorManager) runERPBiometricCollector() {
	defer m.wg.Done()

	devEvery := m.cfg.PollERPBiometricInterval
	if devEvery < 15*time.Second {
		devEvery = 60 * time.Second
	}
	faceEvery := m.cfg.PollERPFacelessInterval
	if faceEvery < time.Minute {
		faceEvery = 15 * time.Minute
	}
	devTicker := time.NewTicker(devEvery)
	defer devTicker.Stop()
	faceTicker := time.NewTicker(faceEvery)
	defer faceTicker.Stop()

	// Initial sync
	m.syncERPBiometrics()
	m.syncERPFaceless()

	for {
		select {
		case <-m.stopChan:
			return
		case <-devTicker.C:
			m.syncERPBiometrics()
		case <-faceTicker.C:
			m.syncERPFaceless()
		}
	}
}

// syncERPBiometrics refreshes the device snapshot and broadcasts it. The
// snapshot has no personal data, so it is safe for every WebSocket client,
// including unauthenticated wall displays.
func (m *CollectorManager) syncERPBiometrics() {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	snapshot, err := m.erpProvider.GetDevices(ctx)
	now := time.Now().UTC()
	if err != nil {
		slog.Warn("erp biometric collector warning", "error", err)
		m.updateIntegrationStatus("erp", "DEGRADED", err.Error(), now)
	} else {
		m.updateIntegrationStatus("erp", "CONNECTED", "", now)
	}

	if snapshot != nil && m.wsHub != nil {
		m.wsHub.Broadcast("ERP_BIOMETRICS_UPDATED", snapshot)
	}
}

// syncERPFaceless refreshes the cached faceless list served to signed-in
// operators. It is never broadcast: the list holds names and roll numbers.
func (m *CollectorManager) syncERPFaceless() {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	if _, err := m.erpProvider.GetFaceless(ctx); err != nil {
		slog.Warn("erp faceless collector warning", "error", err)
	}
}
