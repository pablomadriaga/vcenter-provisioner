package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

type VCenterConfig struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	URL        string `json:"url"`
	Credential string `json:"credential"`
	IsActive   bool   `json:"is_active"`
}

var (
	db               *sql.DB
	credentialMgrURL string
	once             sync.Once
)

func initDB() {
	connectionString := os.Getenv("DB_URL")
	if connectionString == "" {
		log.Fatal("[initDB] DB_URL environment variable is required")
	}

	var err error
	db, err = sql.Open("postgres", connectionString)
	if err != nil {
		log.Printf("[initDB] Error opening database: %v", err)
		return
	}

	if err = db.Ping(); err != nil {
		log.Printf("[initDB] Error connecting to database: %v", err)
		return
	}

	log.Printf("[initDB] Database connection established")
}

func getDB() *sql.DB {
	once.Do(initDB)
	return db
}

func getCredentialManagerURL() string {
	if credentialMgrURL != "" {
		return credentialMgrURL
	}
	return os.Getenv("CREDENTIAL_MANAGER_URL")
}

func fetchVCenterConfig(connectionID int) (*VCenterConfig, error) {
	credentialMgrURL := getCredentialManagerURL()
	if credentialMgrURL == "" {
		return nil, fmt.Errorf("CREDENTIAL_MANAGER_URL not configured")
	}

	// Use the endpoint that returns decrypted credentials
	url := fmt.Sprintf("%s/api/vcenters/%d/credentials", credentialMgrURL, connectionID)

	log.Printf("[fetchVCenterConfig] Fetching connection credentials from: %s", url)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	token := os.Getenv("INTERNAL_API_TOKEN")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch vCenter credentials: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("credential-manager returned status %d", resp.StatusCode)
	}

	var config VCenterConfig
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return nil, fmt.Errorf("failed to decode vCenter config: %w", err)
	}

	log.Printf("[fetchVCenterConfig] Successfully fetched credentials for connection %d: %s", connectionID, config.Name)
	return &config, nil
}

func parseVCenterURL(vcenterURL string) (string, string, string, error) {
	// Format: https://user:password@host/sdk
	vcenterURL = strings.TrimPrefix(vcenterURL, "https://")
	vcenterURL = strings.TrimSuffix(vcenterURL, "/sdk")

	parts := strings.SplitN(vcenterURL, "@", 2)
	if len(parts) != 2 {
		return "", "", "", fmt.Errorf("invalid vCenter URL format: missing @ separator")
	}

	credentials := strings.SplitN(parts[0], ":", 2)
	if len(credentials) != 2 {
		return "", "", "", fmt.Errorf("invalid vCenter URL format: missing credentials separator")
	}

	user := credentials[0]
	password := credentials[1]
	host := parts[1]

	return user, password, host, nil
}
