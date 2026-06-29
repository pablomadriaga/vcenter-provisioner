package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

// Configuration
var (
	port           = getEnv("PORT", "8082")
	redisAddr      = getEnv("REDIS_ADDR", "redis:6379")
	pgConnString   = getEnv("DATABASE_URL", "postgresql://antigravity:password123@db:5432/vcenter_provisioner?sslmode=disable")
	servicesString = getEnv("SERVICES", "api-gateway,auth-service,typing-service,vm-orchestrator,vcenter-integration,vcenter-config,stats-service,monitoring-service,backup-service")
)

// ServiceInfo holds information about a monitored service
type ServiceInfo struct {
	Name        string `json:"name"`
	Status      string `json:"status"`
	LatencyMs   int    `json:"latency_ms"`
	LastProbe   string `json:"last_probe"`
	LastSuccess string `json:"last_success"`
	LastFailure string `json:"last_failure"`
	Failures    int    `json:"consecutive_failures"`
}

// ProbeResult represents the result of a network probe
type ProbeResult struct {
	Source    string `json:"source"`
	Target    string `json:"target"`
	LatencyMs int    `json:"latency_ms"`
	Status    string `json:"status"` // "up", "down", "timeout"
	ErrorMsg  string `json:"error_message,omitempty"`
	Timestamp string `json:"timestamp"`
}

// ConnectivityEntry represents a connectivity matrix entry
type ConnectivityEntry struct {
	Source    string `json:"source"`
	Target    string `json:"target"`
	Reachable bool   `json:"reachable"`
	LatencyMs int    `json:"latency_ms"`
	Samples   int    `json:"samples"`
	Timestamp string `json:"timestamp"`
}

var (
	rdb *redis.Client
	db  *sql.DB
	ctx = context.Background()
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Initialize Redis connection
func initRedis() error {
	rdb = redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: "",
		DB:       0,
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("Connected to Redis at %s", redisAddr)
	return nil
}

// Initialize PostgreSQL connection
func initPostgreSQL() error {
	var err error
	db, err = sql.Open("postgres", pgConnString)
	if err != nil {
		return fmt.Errorf("failed to open PostgreSQL connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to ping PostgreSQL: %w", err)
	}

	log.Printf("Connected to PostgreSQL at %s", pgConnString)
	return nil
}

// Initialize database schema
func initSchema() error {
	schema := `
		CREATE SCHEMA IF NOT EXISTS monitoring;

		CREATE TABLE IF NOT EXISTS monitoring.probes (
			id SERIAL PRIMARY KEY,
			probe_source VARCHAR(100) NOT NULL,
			probe_target VARCHAR(100) NOT NULL,
			latency_ms INTEGER,
			status VARCHAR(20) NOT NULL,
			error_message TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_probes_source ON monitoring.probes(probe_source, created_at);
		CREATE INDEX IF NOT EXISTS idx_probes_target ON monitoring.probes(probe_target, created_at);
		CREATE INDEX IF NOT EXISTS idx_probes_created ON monitoring.probes(created_at);

		CREATE TABLE IF NOT EXISTS monitoring.service_status (
			service_name VARCHAR(100) PRIMARY KEY,
			status VARCHAR(20) NOT NULL,
			last_probe_at TIMESTAMP WITH TIME ZONE,
			last_success_at TIMESTAMP WITH TIME ZONE,
			last_failure_at TIMESTAMP WITH TIME ZONE,
			consecutive_failures INTEGER DEFAULT 0,
			avg_latency_ms INTEGER,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		CREATE TABLE IF NOT EXISTS monitoring.connectivity_matrix (
			id SERIAL PRIMARY KEY,
			source_service VARCHAR(100) NOT NULL,
			target_service VARCHAR(100) NOT NULL,
			is_reachable BOOLEAN NOT NULL,
			latency_ms INTEGER,
			sample_size INTEGER DEFAULT 1,
			recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_connectivity_source ON monitoring.connectivity_matrix(source_service, recorded_at);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	log.Println("Database schema initialized")
	return nil
}

// StoreProbeResult stores a probe result in Redis and PostgreSQL
func storeProbeResult(result ProbeResult) error {
	// Store in Redis with TTL using Hash
	redisKey := fmt.Sprintf("monitoring:probe:%s", result.Target)
	probeData := map[string]interface{}{
		"status":       result.Status,
		"latency_ms":   result.LatencyMs,
		"probe_source": result.Source,
		"timestamp":    result.Timestamp,
	}

	pipe := rdb.Pipeline()

	// Use HSet for hash storage
	pipe.HSet(ctx, redisKey, probeData)
	pipe.Expire(ctx, redisKey, 60*time.Second)

	// Update service list
	pipe.SAdd(ctx, "monitoring:services", result.Target)

	// Store connectivity matrix entry
	connKey := fmt.Sprintf("monitoring:connectivity:%s:%s", result.Source, result.Target)
	connData := map[string]interface{}{
		"reachable":  result.Status == "up",
		"latency_ms": result.LatencyMs,
		"samples":    1,
		"timestamp":  result.Timestamp,
	}

	pipe.HSet(ctx, connKey, connData)
	pipe.Expire(ctx, connKey, 60*time.Second)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to store in Redis: %w", err)
	}

	// Async store in PostgreSQL for historical data
	go func() {
		_, err := db.Exec(`
			INSERT INTO monitoring.probes (probe_source, probe_target, latency_ms, status, error_message, created_at)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, result.Source, result.Target, result.LatencyMs, result.Status, result.ErrorMsg, result.Timestamp)

		if err != nil {
			log.Printf("Failed to store probe in PostgreSQL: %v", err)
		}

		// Update service status
		if result.Status == "up" {
			_, err = db.Exec(`
				INSERT INTO monitoring.service_status (service_name, status, last_probe_at, last_success_at, consecutive_failures, avg_latency_ms, updated_at)
				VALUES ($1, $2, $3, $4, 0, $5, $3)
				ON CONFLICT (service_name) DO UPDATE SET
					status = EXCLUDED.status,
					last_probe_at = EXCLUDED.last_probe_at,
					last_success_at = EXCLUDED.last_success_at,
					consecutive_failures = 0,
					avg_latency_ms = EXCLUDED.avg_latency_ms,
					updated_at = EXCLUDED.updated_at
			`, result.Target, result.Status, time.Now(), time.Now(), result.LatencyMs)
		} else {
			_, err = db.Exec(`
				INSERT INTO monitoring.service_status (service_name, status, last_probe_at, last_failure_at, consecutive_failures, avg_latency_ms, updated_at)
				VALUES ($1, $2, $3, $4, 1, $5, $3)
				ON CONFLICT (service_name) DO UPDATE SET
					status = EXCLUDED.status,
					last_probe_at = EXCLUDED.last_probe_at,
					last_failure_at = EXCLUDED.last_failure_at,
					consecutive_failures = monitoring.service_status.consecutive_failures + 1,
					avg_latency_ms = GREATEST(1, (monitoring.service_status.avg_latency_ms + $5) / 2),
					updated_at = EXCLUDED.updated_at
			`, result.Target, result.Status, time.Now(), time.Now(), result.LatencyMs)
		}

		if err != nil {
			log.Printf("Failed to update service status in PostgreSQL: %v", err)
		}
	}()

	return nil
}

// GetServicesStatus returns the current status of all services from Redis
func getServicesStatus() ([]ServiceInfo, error) {
	services := parseServices()
	var results []ServiceInfo

	for _, service := range services {
		data, err := rdb.HGetAll(ctx, fmt.Sprintf("monitoring:probe:%s", service)).Result()
		if err != nil {
			log.Printf("Failed to get probe data for %s: %v", service, err)
			results = append(results, ServiceInfo{
				Name:   service,
				Status: "unknown",
			})
			continue
		}

		status := "down"
		if data["status"] == "up" {
			status = "up"
		}

		latency := 0
		if data["latency_ms"] != "" {
			fmt.Sscanf(data["latency_ms"], "%d", &latency)
		}

		results = append(results, ServiceInfo{
			Name:      service,
			Status:    status,
			LatencyMs: latency,
			LastProbe: data["timestamp"],
		})
	}

	return results, nil
}

// GetServicesHistory returns historical probe data from PostgreSQL
func getServicesHistory(service string, since time.Time) ([]ProbeResult, error) {
	var results []ProbeResult

	rows, err := db.Query(`
		SELECT probe_source, probe_target, latency_ms, status, COALESCE(error_message, ''), created_at
		FROM monitoring.probes
		WHERE probe_target = $1 AND created_at > $2
		ORDER BY created_at DESC
	`, service, since)

	if err != nil {
		return nil, fmt.Errorf("failed to query history: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var result ProbeResult
		var timestamp time.Time
		if err := rows.Scan(&result.Source, &result.Target, &result.LatencyMs, &result.Status, &result.ErrorMsg, &timestamp); err != nil {
			continue
		}
		result.Timestamp = timestamp.Format(time.RFC3339)
		results = append(results, result)
	}

	return results, nil
}

// GetConnectivityMatrix returns the current connectivity matrix from Redis
func getConnectivityMatrix() ([]ConnectivityEntry, error) {
	services := parseServices()
	var entries []ConnectivityEntry

	for _, source := range services {
		for _, target := range services {
			if source == target {
				continue
			}

			data, err := rdb.HGetAll(ctx, fmt.Sprintf("monitoring:connectivity:%s:%s", source, target)).Result()
			if err != nil || len(data) == 0 {
				continue
			}

			var entry ConnectivityEntry
			entry.Source = source
			entry.Target = target
			entry.Reachable = data["reachable"] == "true"
			fmt.Sscanf(data["latency_ms"], "%d", &entry.LatencyMs)
			fmt.Sscanf(data["samples"], "%d", &entry.Samples)
			entry.Timestamp = data["timestamp"]
			entries = append(entries, entry)
		}
	}

	return entries, nil
}

func parseServices() []string {
	var services []string
	for _, s := range splitServices(servicesString) {
		if s = trimSpace(s); s != "" {
			services = append(services, s)
		}
	}
	return services
}

func splitServices(s string) []string {
	var result []string
	prev := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			result = append(result, s[prev:i])
			prev = i + 1
		}
	}
	result = append(result, s[prev:])
	return result
}

func trimSpace(s string) string {
	start := 0
	end := len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

// Handlers
func handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "online",
		"checks": gin.H{
			"redis":    "ok",
			"postgres": "ok",
		},
	})
}

func handleProbeResult(c *gin.Context) {
	var result ProbeResult
	if err := c.ShouldBindJSON(&result); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if result.Timestamp == "" {
		result.Timestamp = time.Now().Format(time.RFC3339)
	}

	if err := storeProbeResult(result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "stored"})
}

func handleServicesStatus(c *gin.Context) {
	results, err := getServicesStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func handleServicesHistory(c *gin.Context) {
	service := c.Query("service")
	if service == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service parameter required"})
		return
	}

	since := time.Hour
	if hoursStr := c.Query("hours"); hoursStr != "" {
		var hours int
		fmt.Sscanf(hoursStr, "%d", &hours)
		since = time.Duration(hours) * time.Hour
	}

	results, err := getServicesHistory(service, time.Now().Add(-since))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func handleConnectivityMatrix(c *gin.Context) {
	entries, err := getConnectivityMatrix()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, entries)
}

func handleMetrics(c *gin.Context) {
	results, _ := getServicesStatus()

	upCount := 0
	downCount := 0
	totalLatency := 0

	for _, s := range results {
		if s.Status == "up" {
			upCount++
			totalLatency += s.LatencyMs
		} else if s.Status == "down" {
			downCount++
		}
	}

	avgLatency := 0
	if upCount > 0 {
		avgLatency = totalLatency / upCount
	}

	c.String(http.StatusOK,
		"# HELP monitoring_services_up Number of services up\n"+
			"# TYPE monitoring_services_up gauge\n"+
			"monitoring_services_up %d\n"+
			"# HELP monitoring_services_down Number of services down\n"+
			"# TYPE monitoring_services_down gauge\n"+
			"monitoring_services_down %d\n"+
			"# HELP monitoring_avg_latency_ms Average latency in milliseconds\n"+
			"# TYPE monitoring_avg_latency_ms gauge\n"+
			"monitoring_avg_latency_ms %d\n",
		upCount, downCount, avgLatency)
}

func handleRoot(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "vCenter Provisioner: Monitoring Sentinel active",
		"version": "2.0.0",
	})
}

func setupRouter() *gin.Engine {
	r := gin.Default()

	r.GET("/health", handleHealth)
	r.POST("/api/probe-result", handleProbeResult)
	r.GET("/api/services-status", handleServicesStatus)
	r.GET("/api/services-history", handleServicesHistory)
	r.GET("/api/connectivity-matrix", handleConnectivityMatrix)
	r.GET("/metrics", handleMetrics)
	r.GET("/", handleRoot)

	return r
}

func main() {
	log.Println("Starting Monitoring Sentinel v2.0...")

	if err := initRedis(); err != nil {
		log.Fatalf("Failed to initialize Redis: %v", err)
	}

	if err := initPostgreSQL(); err != nil {
		log.Fatalf("Failed to initialize PostgreSQL: %v", err)
	}

	if err := initSchema(); err != nil {
		log.Fatalf("Failed to initialize schema: %v", err)
	}

	r := setupRouter()
	port := getEnv("PORT", "8082")

	srv := &http.Server{Addr: ":" + port, Handler: r}
	go func() {
		log.Printf("Server listening on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	srv.Close()
}
