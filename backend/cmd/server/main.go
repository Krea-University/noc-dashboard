package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	_ "time/tzdata"

	"github.com/Krea-University/noc-dashboard/backend/internal/api"
	"github.com/Krea-University/noc-dashboard/backend/internal/audit"
	"github.com/Krea-University/noc-dashboard/backend/internal/auth"
	"github.com/Krea-University/noc-dashboard/backend/internal/automation"
	"github.com/Krea-University/noc-dashboard/backend/internal/collectors"
	"github.com/Krea-University/noc-dashboard/backend/internal/config"
	"github.com/Krea-University/noc-dashboard/backend/internal/database"
	"github.com/Krea-University/noc-dashboard/backend/internal/displays"
	"github.com/Krea-University/noc-dashboard/backend/internal/events"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/endpointcentral"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/fortigate"
	"github.com/Krea-University/noc-dashboard/backend/internal/integrations/opmanager"
	"github.com/Krea-University/noc-dashboard/backend/internal/sound"
	"github.com/Krea-University/noc-dashboard/backend/internal/websocket"
)

func main() {
	// Configure structured logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	slog.Info("initializing KREA IT Operations Command Center")

	// 1. Load configuration
	cfg, err := config.Load(".env")
	if err != nil {
		slog.Error("failed loading configuration", "error", err)
		os.Exit(1)
	}
	if cfg.LogLevel == "debug" {
		logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
		slog.SetDefault(logger)
	}

	// 2. Database Connection
	db, err := database.Connect(cfg)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// 3. Run Database Migrations
	migrationsDir := "migrations"
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = "../migrations" // fallback for cmd/server relative run
	}
	if err := db.RunMigrations(migrationsDir); err != nil {
		slog.Error("database migrations failed", "error", err)
		os.Exit(1)
	}

	// In production mode, automatically purge all mock and seeded operational data
	if strings.ToLower(cfg.AppEnv) == "production" || !cfg.MockMode {
		slog.Info("production mode active: purging all seeding and mock operational data from database...")
		if err := db.PurgeSeedData(context.Background()); err != nil {
			slog.Warn("seed purge completed with warning", "error", err)
		} else {
			slog.Info("production database clean: all seeding and mock data successfully removed")
		}
	}

	// 4. Initialize Core Services
	authSvc := auth.NewService(db, cfg)
	if err := authSvc.BootstrapAdmin(); err != nil {
		slog.Error("failed bootstrapping admin account", "error", err)
	}

	auditSvc := audit.NewService(db)
	displaysSvc := displays.NewService(db)
	soundEngine := sound.NewEngine(db)
	wsHub := websocket.NewHub()
	go wsHub.Run()

	eventsEngine := events.NewEngine(db, soundEngine, wsHub)

	// 5. Select Integrations (Real or Mock)
	var nms integrations.NMSProvider
	var epc integrations.EndpointProvider
	var fg integrations.FirewallProvider

	if cfg.MockMode || cfg.OpManagerAPIKey == "" {
		slog.Info("running with OpManager MockProvider (realistic simulation mode)")
		nms = opmanager.NewMockProvider()
	} else {
		slog.Info("running with live OpManager Client", "url", cfg.OpManagerURL)
		nms = opmanager.NewClient(cfg)
	}

	if cfg.MockMode || cfg.EndpointCentralAPIKey == "" {
		slog.Info("running with Endpoint Central MockProvider")
		epc = endpointcentral.NewMockProvider()
	} else {
		slog.Info("running with live Endpoint Central Client", "url", cfg.EndpointCentralURL)
		epc = endpointcentral.NewClient(cfg)
	}

	if cfg.MockMode || cfg.FortiGateAPIToken == "" {
		slog.Info("running with FortiGate MockProvider (safe network simulation)")
		fg = fortigate.NewMockProvider()
	} else {
		slog.Info("running with live FortiGate Client", "url", cfg.FortiGateURL)
		fg = fortigate.NewClient(cfg)
	}

	// 6. Automation Pipeline
	vlanPipeline := automation.NewPipeline(db, fg, auditSvc, wsHub)

	// 7. Background Collectors
	collectorManager := collectors.NewManager(cfg, db, eventsEngine, nms, epc, fg)
	collectorManager.Start()
	defer collectorManager.Stop()

	// 8. HTTP Router & Server
	routerDeps := &api.RouterDeps{
		Cfg:          cfg,
		DB:           db,
		AuthSvc:      authSvc,
		AuditSvc:     auditSvc,
		DisplaysSvc:  displaysSvc,
		VlanPipeline: vlanPipeline,
		SoundEngine:  soundEngine,
		WSHub:        wsHub,
		NMSProvider:  nms,
		EPCProvider:  epc,
		FGProvider:   fg,
	}

	handler := api.SetupRouter(routerDeps)
	server := &http.Server{
		Addr:         ":" + cfg.AppPort,
		Handler:      handler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("KREA IT NOC server listening", "port", cfg.AppPort, "url", fmt.Sprintf("http://localhost:%s", cfg.AppPort))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server listen error", "error", err)
			os.Exit(1)
		}
	}()

	// 9. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("server shutdown failed", "error", err)
	}
	slog.Info("server exited cleanly")
}
