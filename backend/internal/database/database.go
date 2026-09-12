package database

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"

	"github.com/Krea-University/noc-dashboard/backend/internal/config"
)

// DB wraps the native sql.DB instance with helper methods.
type DB struct {
	*sql.DB
	Driver string
}

// Connect establishes a connection pool to MySQL/MariaDB or SQLite based on configuration.
func Connect(cfg *config.Config) (*DB, error) {
	var db *sql.DB
	var err error

	driver := strings.ToLower(cfg.DBDriver)
	if driver == "mysql" || driver == "mariadb" {
		driver = "mysql"
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4&loc=UTC",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)

		slog.Info("connecting to MySQL/MariaDB database", "host", cfg.DBHost, "port", cfg.DBPort, "db", cfg.DBName)
		db, err = sql.Open("mysql", dsn)
		if err != nil {
			return nil, fmt.Errorf("failed to open mysql connection: %w", err)
		}
	} else {
		// Default SQLite for standalone zero-dependency run
		driver = "sqlite"
		dbPath := cfg.DBName
		if dbPath != ":memory:" && !strings.HasPrefix(dbPath, "file:") && !strings.HasSuffix(dbPath, ".db") {
			dbPath = dbPath + ".db"
		}
		slog.Info("connecting to SQLite database", "path", dbPath)
		db, err = sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
		if err != nil {
			return nil, fmt.Errorf("failed to open sqlite connection: %w", err)
		}
	}

	// Configure connection pooling
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	slog.Info("database connection established successfully", "driver", driver)
	return &DB{DB: db, Driver: driver}, nil
}

// RunMigrations applies pending SQL migrations from the migrations directory.
func (db *DB) RunMigrations(migrationsDir string) error {
	slog.Info("checking database migrations", "dir", migrationsDir)

	// Ensure migration tracking table exists
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(255) PRIMARY KEY,
		applied_at DATETIME NOT NULL
	);`
	if _, err := db.Exec(createTableSQL); err != nil {
		return fmt.Errorf("failed to ensure schema_migrations table: %w", err)
	}

	// Find all .sql migration files
	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var sqlFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".sql") {
			sqlFiles = append(sqlFiles, f.Name())
		}
	}
	sort.Strings(sqlFiles)

	for _, filename := range sqlFiles {
		var applied string
		row := db.QueryRow("SELECT version FROM schema_migrations WHERE version = ?", filename)
		if err := row.Scan(&applied); err == nil {
			// Already applied
			continue
		}

		slog.Info("applying migration", "file", filename)
		content, err := os.ReadFile(filepath.Join(migrationsDir, filename))
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", filename, err)
		}
		content = bytes.TrimPrefix(content, []byte("\xef\xbb\xbf"))

		// Execute migration statements
		statements := splitSQLStatements(string(content))
		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin migration transaction: %w", err)
		}

		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}

			if db.Driver == "sqlite" && strings.Contains(strings.ToUpper(stmt), "INET_ATON") {
				continue
			}

			// Dialect compatibility: Adapt SQLite 'ON CONFLICT ... DO NOTHING' to MySQL/MariaDB 'INSERT IGNORE'
			if db.Driver == "mysql" {
				if strings.Contains(strings.ToUpper(stmt), "ON CONFLICT") {
					re := regexp.MustCompile(`(?i)\s*ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+NOTHING`)
					stmt = re.ReplaceAllString(stmt, "")
					trimmedUpper := strings.ToUpper(strings.TrimSpace(stmt))
					if strings.HasPrefix(trimmedUpper, "INSERT INTO") {
						stmt = strings.Replace(stmt, "INSERT INTO", "INSERT IGNORE INTO", 1)
						stmt = strings.Replace(stmt, "insert into", "INSERT IGNORE INTO", 1)
					}
				}
			}

			if _, err := tx.Exec(stmt); err != nil {
				tx.Rollback()
				return fmt.Errorf("failed executing migration %s statement [%s]: %w", filename, stmt, err)
			}
		}

		// Record migration as applied
		if _, err := tx.Exec("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", filename, time.Now().UTC()); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record applied migration: %w", err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", filename, err)
		}

		slog.Info("successfully applied migration", "file", filename)
	}

	return nil
}

// PurgeSeedData removes all mock and seeded operational data from the database.
// This is executed automatically when the application runs in production mode.
func (db *DB) PurgeSeedData(ctx context.Context) error {
	queries := []string{
		// 1. Purge seeded mock audit logs (preserve real operator audit records)
		`DELETE FROM audit_logs WHERE id LIKE 'aud_vlan_%' OR id LIKE 'aud_mock_%' OR username IN ('demo', 'mock_user')`,

		// 2. Purge seeded mock alarms
		`DELETE FROM alarms WHERE source_id LIKE 'mock_%' OR source_id LIKE 'opm_alm_%' OR id IN ('alm_01', 'alm_02', 'alm_03', 'alm_04') OR id LIKE 'alm_mock_%'`,

		// 3. Purge seeded mock incidents and timelines
		`DELETE FROM incident_timeline WHERE incident_id IN ('inc_01', 'inc_02') OR incident_id LIKE 'inc_mock_%'`,
		`DELETE FROM incidents WHERE id IN ('inc_01', 'inc_02') OR id LIKE 'inc_mock_%'`,

		// 4. Purge seeded mock action jobs
		`DELETE FROM action_jobs WHERE id LIKE 'job_mock_%' OR id IN ('job_01', 'job_02') OR username IN ('demo', 'mock_user')`,

		// 5. Purge seeded mock endpoints
		`DELETE FROM endpoints WHERE source_system = 'mock' OR source_id LIKE 'epc_mock_%' OR id IN ('ep_01', 'ep_02', 'ep_03', 'ep_04', 'ep_05', 'ep_06')`,

		// 6. Purge seeded mock biometric metadata
		`DELETE FROM biometric_metadata WHERE id IN ('bmd_01', 'bmd_03', 'bmd_20') OR device_id LIKE 'dev_bio_%'`,

		// 7. Purge seeded mock interfaces
		`DELETE FROM interfaces WHERE id IN ('if_01', 'if_02', 'if_03', 'if_04') OR device_id LIKE 'dev_core_%' OR device_id LIKE 'dev_dist_%' OR device_id LIKE 'dev_acc_%' OR device_id LIKE 'dev_srv_%'`,

		// 8. Purge seeded mock devices & telemetry
		`DELETE FROM device_telemetry WHERE device_id LIKE 'dev_core_%' OR device_id LIKE 'dev_dist_%' OR device_id LIKE 'dev_acc_%' OR device_id LIKE 'dev_srv_%' OR device_id LIKE 'dev_bio_%'`,
		`DELETE FROM devices WHERE source_system = 'mock' OR id LIKE 'dev_core_%' OR id LIKE 'dev_dist_%' OR id LIKE 'dev_acc_%' OR id LIKE 'dev_srv_%' OR id LIKE 'dev_bio_%'`,
	}

	for _, q := range queries {
		if _, err := db.ExecContext(ctx, q); err != nil {
			slog.Warn("purge seed query executed with warning", "query", q, "error", err)
		}
	}

	slog.Info("production database purged: all seeding and mock operational data cleared")
	return nil
}

func splitSQLStatements(sqlScript string) []string {
	var statements []string
	var current strings.Builder

	lines := strings.Split(sqlScript, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		current.WriteString(line)
		current.WriteString("\n")
		if strings.HasSuffix(trimmed, ";") {
			statements = append(statements, current.String())
			current.Reset()
		}
	}
	if current.Len() > 0 {
		stmt := strings.TrimSpace(current.String())
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}
	return statements
}
