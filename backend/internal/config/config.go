package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration loaded from .env and environment variables.
type Config struct {
	AppName    string
	AppEnv     string
	AppPort    string
	AppBaseURL string

	// Database
	DBDriver   string // "mysql" or "sqlite"
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string

	// Security
	SessionSecret  string
	JWTEmbedSecret string

	// Initial Bootstrap Admin
	BootstrapAdminUsername string
	BootstrapAdminPassword string
	BootstrapAdminEmail    string

	// OpManager
	OpManagerURL       string
	OpManagerAPIKey    string
	OpManagerVerifyTLS bool

	// Endpoint Central
	EndpointCentralURL       string
	EndpointCentralAPIKey    string
	EndpointCentralVerifyTLS bool

	// FortiGate
	FortiGateURL       string
	FortiGateAPIToken  string
	FortiGateVerifyTLS bool

	// Biometric
	BiometricDeviceGroup string

	// Polling Intervals
	PollOpManagerDevicesInterval time.Duration
	PollOpManagerAlarmsInterval  time.Duration
	PollOpManagerMetricsInterval time.Duration
	PollEndpointCentralInterval  time.Duration
	PollFortiGateInterval        time.Duration

	// TV Settings
	TVRotationInterval       time.Duration
	DisplayIdleTimeoutMinutes int

	// Sound
	SoundAlertsEnabled bool

	// Observability
	LogLevel string

	// Security Origins
	NOCAllowedOrigins      []string
	NOCEmbedAllowedOrigins []string

	// Cloudflare Turnstile Bot Protection
	TurnstileSiteKey    string
	TurnstileSecretKey  string
	TurnstileHostnames  []string

	// Google Identity Services (GIS) Sign-In
	GoogleClientID string

	// Mode
	MockMode bool
}

// Load loads configuration from an optional .env file and environment variables.
func Load(envPath string) (*Config, error) {
	loadDotEnv(envPath)

	cfg := &Config{
		AppName:    getEnv("APP_NAME", "KREA IT NOC"),
		AppEnv:     getEnv("APP_ENV", "production"),
		AppPort:    getEnv("APP_PORT", "8080"),
		AppBaseURL: getEnv("APP_BASE_URL", "http://localhost:8080"),

		DBDriver:   getEnv("DB_DRIVER", "sqlite"),
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "3306"),
		DBName:     getEnv("DB_NAME", "krea_noc.db"),
		DBUser:     getEnv("DB_USER", "krea_noc"),
		DBPassword: getEnv("DB_PASSWORD", "krea_secure_db_pass_2026"),

		SessionSecret:  getEnv("SESSION_SECRET", "krea_super_secret_session_key_min_32_bytes_long_2026"),
		JWTEmbedSecret: getEnv("JWT_EMBED_SECRET", "krea_embed_jwt_shared_secret_for_erp_integration_2026"),

		BootstrapAdminUsername: getEnv("BOOTSTRAP_ADMIN_USERNAME", "admin"),
		BootstrapAdminPassword: getEnv("BOOTSTRAP_ADMIN_PASSWORD", "KreaAdmin@2026!"),
		BootstrapAdminEmail:    getEnv("BOOTSTRAP_ADMIN_EMAIL", "noc-admin@krea.edu.in"),

		OpManagerURL:       getEnv("OPMANAGER_URL", "https://nms.krea.edu.in"),
		OpManagerAPIKey:    getEnv("OPMANAGER_API_KEY", ""),
		OpManagerVerifyTLS: getEnvBool("OPMANAGER_VERIFY_TLS", false),

		EndpointCentralURL:       getEnv("ENDPOINT_CENTRAL_URL", "https://endpointcentral.krea.edu.in:8383"),
		EndpointCentralAPIKey:    getEnv("ENDPOINT_CENTRAL_API_KEY", ""),
		EndpointCentralVerifyTLS: getEnvBool("ENDPOINT_CENTRAL_VERIFY_TLS", false),

		FortiGateURL:       getEnv("FORTIGATE_URL", "https://fortigate.internal"),
		FortiGateAPIToken:  getEnv("FORTIGATE_API_TOKEN", ""),
		FortiGateVerifyTLS: getEnvBool("FORTIGATE_VERIFY_TLS", false),

		BiometricDeviceGroup: getEnv("BIOMETRIC_DEVICE_GROUP", "Biometric Devices"),

		PollOpManagerDevicesInterval: time.Duration(getEnvInt("POLL_OPMANAGER_DEVICES_SECONDS", 60)) * time.Second,
		PollOpManagerAlarmsInterval:  time.Duration(getEnvInt("POLL_OPMANAGER_ALARMS_SECONDS", 30)) * time.Second,
		PollOpManagerMetricsInterval: time.Duration(getEnvInt("POLL_OPMANAGER_METRICS_SECONDS", 60)) * time.Second,
		PollEndpointCentralInterval:  time.Duration(getEnvInt("POLL_ENDPOINT_CENTRAL_SECONDS", 120)) * time.Second,
		PollFortiGateInterval:        time.Duration(getEnvInt("POLL_FORTIGATE_SECONDS", 60)) * time.Second,

		TVRotationInterval:        time.Duration(getEnvInt("TV_ROTATION_SECONDS", 30)) * time.Second,
		DisplayIdleTimeoutMinutes: getEnvInt("DISPLAY_IDLE_TIMEOUT_MINUTES", 30),

		SoundAlertsEnabled: getEnvBool("SOUND_ALERTS_ENABLED", true),
		LogLevel:           getEnv("LOG_LEVEL", "info"),

		NOCAllowedOrigins:      splitAndTrim(getEnv("NOC_ALLOWED_ORIGINS", "https://erp.krea.edu.in,http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080")),
		NOCEmbedAllowedOrigins: splitAndTrim(getEnv("NOC_EMBED_ALLOWED_ORIGINS", "https://erp.krea.edu.in,http://localhost:5173")),

		TurnstileSiteKey:   getEnv("TURNSTILE_SITE_KEY", "0x4AAAAAAExldpVxn_Cfx4o7"),
		TurnstileSecretKey: getEnv("TURNSTILE_SECRET_KEY", "0x4AAAAAAExldgkxpZiriTiET5EUmmzQmQg"),
		TurnstileHostnames: splitAndTrim(getEnv("TURNSTILE_HOSTNAMES", "")),

		GoogleClientID: getEnv("GOOGLE_CLIENT_ID", ""),

		MockMode: getEnvBool("MOCK_MODE", strings.ToLower(getEnv("APP_ENV", "production")) != "production"),
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvBool(key string, defaultVal bool) bool {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return strings.ToLower(val) == "true" || val == "1" || strings.ToLower(val) == "yes"
	}
	return defaultVal
}

func splitAndTrim(val string) []string {
	parts := strings.Split(val, ",")
	res := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			res = append(res, trimmed)
		}
	}
	return res
}

func loadDotEnv(filepath string) {
	if filepath == "" {
		filepath = ".env"
	}
	f, err := os.Open(filepath)
	if err != nil {
		f, err = os.Open("../" + filepath)
		if err != nil {
			return
		}
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			val = strings.Trim(val, `"'`)
			if _, exists := os.LookupEnv(key); !exists {
				os.Setenv(key, val)
			}
		}
	}
}
