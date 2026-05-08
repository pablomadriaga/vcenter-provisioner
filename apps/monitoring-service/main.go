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
	pgConnString   = getEnvRequired("DATABASE_URL")
	servicesString = getEnv("SERVICES", "api-gateway,auth-service,typing-service,vm-orchestrator,vcenter-operations,credential-manager,stats-service,monitoring-service,backup-service,provisioner-ui")
)

func getEnvRequired(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return value
}

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

		CREATE INDEX IF NOT EXISTS idx_probes_target_created ON monitoring.probes(probe_target, created_at) INCLUDE (status, latency_ms);
		CREATE INDEX IF NOT EXISTS idx_probes_created ON monitoring.probes(created_at) INCLUDE (status, latency_ms);
		DROP INDEX IF EXISTS idx_probes_source;

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

// StoreProbeResult stores a probe result — PostgreSQL first (durable), Redis second (best-effort cache)
func storeProbeResult(result ProbeResult) error {
	now := time.Now()

	// 1. PostgreSQL write (synchronous — source of truth)
	_, pgErr := db.Exec(`
		INSERT INTO monitoring.probes (probe_source, probe_target, latency_ms, status, error_message, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, result.Source, result.Target, result.LatencyMs, result.Status, result.ErrorMsg, result.Timestamp)

	if pgErr != nil {
		return fmt.Errorf("failed to store probe in PostgreSQL: %w", pgErr)
	}

	// Update service_status
	if result.Status == "up" {
		_, pgErr = db.Exec(`
			INSERT INTO monitoring.service_status (service_name, status, last_probe_at, last_success_at, consecutive_failures, avg_latency_ms, updated_at)
			VALUES ($1, $2, $3, $4, 0, $5, $3)
			ON CONFLICT (service_name) DO UPDATE SET
				status = EXCLUDED.status,
				last_probe_at = EXCLUDED.last_probe_at,
				last_success_at = EXCLUDED.last_success_at,
				consecutive_failures = 0,
				avg_latency_ms = EXCLUDED.avg_latency_ms,
				updated_at = EXCLUDED.updated_at
		`, result.Target, result.Status, now, now, result.LatencyMs)
	} else {
		_, pgErr = db.Exec(`
			INSERT INTO monitoring.service_status (service_name, status, last_probe_at, last_failure_at, consecutive_failures, avg_latency_ms, updated_at)
			VALUES ($1, $2, $3, $4, 1, $5, $3)
			ON CONFLICT (service_name) DO UPDATE SET
				status = EXCLUDED.status,
				last_probe_at = EXCLUDED.last_probe_at,
				last_failure_at = EXCLUDED.last_failure_at,
				consecutive_failures = monitoring.service_status.consecutive_failures + 1,
				avg_latency_ms = GREATEST(1, (monitoring.service_status.avg_latency_ms + $5) / 2),
				updated_at = EXCLUDED.updated_at
		`, result.Target, result.Status, now, now, result.LatencyMs)
	}

	if pgErr != nil {
		log.Printf("Failed to update service status in PostgreSQL: %v", pgErr)
	}

	// 2. Redis write (best-effort cache — failure is non-fatal)
	pipe := rdb.Pipeline()
	redisKey := fmt.Sprintf("monitoring:probe:%s", result.Target)
	pipe.HSet(ctx, redisKey, map[string]interface{}{
		"status":       result.Status,
		"latency_ms":   result.LatencyMs,
		"probe_source": result.Source,
		"timestamp":    result.Timestamp,
	})
	pipe.Expire(ctx, redisKey, 60*time.Second)
	pipe.SAdd(ctx, "monitoring:services", result.Source, result.Target)
	connKey := fmt.Sprintf("monitoring:connectivity:%s:%s", result.Source, result.Target)
	pipe.HSet(ctx, connKey, map[string]interface{}{
		"reachable":  result.Status == "up",
		"latency_ms": result.LatencyMs,
		"samples":    1,
		"timestamp":  result.Timestamp,
	})
	pipe.Expire(ctx, connKey, 60*time.Second)

	if _, redisErr := pipe.Exec(ctx); redisErr != nil {
		log.Printf("Failed to update Redis cache (non-fatal): %v", redisErr)
	}

	return nil
}

// GetServicesStatus returns the current status of all services from Redis (cache layer)
// Falls back to "unknown" if no Redis data is available (PG is source of truth)
func getServicesStatus() ([]ServiceInfo, error) {
	services := parseServices()
	var results []ServiceInfo

	for _, service := range services {
		data, err := rdb.HGetAll(ctx, fmt.Sprintf("monitoring:probe:%s", service)).Result()
		if err != nil || len(data) == 0 {
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

// GetServicesTimeseries returns time-bucketed probe data from PostgreSQL
func getServicesTimeseries(service string, since time.Time, interval string) ([]map[string]interface{}, error) {
	// Map interval to PostgreSQL date_trunc unit
	truncUnit := "hour"
	switch interval {
	case "1m", "minute":
		truncUnit = "minute"
	case "5m":
		truncUnit = "minute" // Will group by minute, filter in app if needed
	case "1h", "hour":
		truncUnit = "hour"
	case "1d", "day":
		truncUnit = "day"
	}

	query := `
		SELECT 
			date_trunc($1, created_at) as bucket,
			COUNT(*) FILTER (WHERE status = 'up') as up,
			COUNT(*) FILTER (WHERE status = 'down') as down,
			COUNT(*) FILTER (WHERE status = 'timeout') as timeout,
			AVG(latency_ms) as avg_latency,
			MIN(latency_ms) as min_latency,
			MAX(latency_ms) as max_latency,
			COUNT(*) as total
		FROM monitoring.probes
		WHERE created_at > $2
	`
	args := []interface{}{truncUnit, since}
	
	if service != "" {
		query += `AND probe_target = $3 `
		args = append(args, service)
	}

	query += `
	GROUP BY bucket
	ORDER BY bucket ASC
	`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query timeseries: %w", err)
	}
	defer rows.Close()

	results := []map[string]interface{}{}
	for rows.Next() {
		var bucket time.Time
		var up, down, timeout, total int64
		var avgLatency, minLatency, maxLatency float64
		
		if err := rows.Scan(&bucket, &up, &down, &timeout, &avgLatency, &minLatency, &maxLatency, &total); err != nil {
			continue
		}

		results = append(results, map[string]interface{}{
			"timestamp":      bucket.Format(time.RFC3339),
			"up":             up,
			"down":           down,
			"timeout":        timeout,
			"avg_latency_ms": int(avgLatency),
			"min_latency_ms": int(minLatency),
			"max_latency_ms": int(maxLatency),
			"total":          total,
		})
	}

	return results, nil
}

// GetServicesSummary returns aggregated stats for a time window
func getServicesSummary(service string, windowHours int) (map[string]interface{}, error) {
	since := time.Now().Add(-time.Duration(windowHours) * time.Hour)
	
	query := `
		SELECT 
			COUNT(*) FILTER (WHERE status = 'up') as up_count,
			COUNT(*) FILTER (WHERE status = 'down') as down_count,
			COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count,
			AVG(latency_ms) FILTER (WHERE status = 'up') as avg_latency_up,
			COUNT(*) as total
		FROM monitoring.probes
		WHERE created_at > $1
	`
	
	args := []interface{}{since}
	if service != "" {
		query += `AND probe_target = $2`
		args = append(args, service)
	}

	row := db.QueryRow(query, args...)
	
	var upCount, downCount, timeoutCount, total int64
	var avgLatencyUp float64
	
	err := row.Scan(&upCount, &downCount, &timeoutCount, &avgLatencyUp, &total)
	if err != nil {
		return nil, fmt.Errorf("failed to query summary: %w", err)
	}

	uptimePct := 0.0
	if total > 0 {
		uptimePct = float64(upCount) / float64(total) * 100
	}

	return map[string]interface{}{
		"service":         service,
		"window_hours":    windowHours,
		"up_count":       upCount,
		"down_count":     downCount,
		"timeout_count":  timeoutCount,
		"avg_latency_ms": int(avgLatencyUp),
		"total":          total,
		"uptime_percent": uptimePct,
	}, nil
}

// GetConnectivityMatrix returns the current connectivity matrix from Redis
func getConnectivityMatrix() ([]ConnectivityEntry, error) {
	// Use Redis SMembers to get dynamic list of services (populated by storeProbeResult)
	services, err := rdb.SMembers(ctx, "monitoring:services").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get services from Redis: %w", err)
	}

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

// HandleServicesTimeseries returns time-bucketed probe data
func handleServicesTimeseries(c *gin.Context) {
	service := c.DefaultQuery("service", "")
	hoursStr := c.DefaultQuery("hours", "24")
	interval := c.DefaultQuery("interval", "1h")

	hours := 24
	fmt.Sscanf(hoursStr, "%d", &hours)

	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	results, err := getServicesTimeseries(service, since, interval)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

// HandleServicesSummary returns aggregated stats for a time window
func handleServicesSummary(c *gin.Context) {
	service := c.DefaultQuery("service", "")
	windowStr := c.DefaultQuery("window", "24")
	
	window := 24
	fmt.Sscanf(windowStr, "%d", &window)

	results, err := getServicesSummary(service, window)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
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
	r.GET("/api/services-timeseries", handleServicesTimeseries)
	r.GET("/api/services-summary", handleServicesSummary)
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
