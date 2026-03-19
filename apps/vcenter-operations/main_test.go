package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestGetPort_FromEnvVariable(t *testing.T) {
	os.Setenv("PORT", "9090")
	defer os.Unsetenv("PORT")

	result := getPort()
	assert.Equal(t, "9090", result)
}

func TestGetPort_DefaultValue(t *testing.T) {
	os.Unsetenv("PORT")
	defer os.Unsetenv("PORT")

	result := getPort()
	assert.Equal(t, "8081", result)
}

func TestStartServer_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	srv := startServer("9091", router)

	assert.NotNil(t, srv)
	assert.Equal(t, ":9091", srv.Addr)
}

func TestStartServer_ConcurrentVMCreation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	srv := startServer("9092", router)
	defer srv.Close()

	time.Sleep(100 * time.Millisecond)

	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			requestBody := VMCreateRequest{
				Name:         fmt.Sprintf("SRV-TEST-%03d", i),
				Datacenter:   "DC01",
				Cluster:      "Cluster01",
				ResourcePool: "RP01",
			}
			jsonBody, _ := json.Marshal(requestBody)

			resp, err := http.Post("http://localhost:9092/create-vm", "application/json", bytes.NewBuffer(jsonBody))
			assert.NoError(t, err)
			assert.Equal(t, 200, resp.StatusCode)
			resp.Body.Close()
		}()
	}
	wg.Wait()
}

func TestSetupSignals_CreatesChannel(t *testing.T) {
	quit := setupSignals()

	assert.NotNil(t, quit)
}

func TestSetupSignals_NotifiesSIGINT(t *testing.T) {
	quit := setupSignals()

	go func() {
		time.Sleep(50 * time.Millisecond)
		quit <- syscall.SIGINT
	}()

	sig := <-quit
	assert.Equal(t, syscall.SIGINT, sig)
}

func TestSetupSignals_NotifiesSIGTERM(t *testing.T) {
	quit := setupSignals()

	go func() {
		time.Sleep(50 * time.Millisecond)
		quit <- syscall.SIGTERM
	}()

	sig := <-quit
	assert.Equal(t, syscall.SIGTERM, sig)
}

func TestMain_FullFlow(t *testing.T) {
	os.Setenv("PORT", "9093")
	defer os.Unsetenv("PORT")

	port := getPort()
	assert.Equal(t, "9093", port)

	r := setupRouter()
	assert.NotNil(t, r)

	quit := setupSignals()
	assert.NotNil(t, quit)
}

func TestHealthEndpoint_Returns200(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "ok", response["status"])
}

func TestCreateVMEndpoint_ValidRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	requestBody := VMCreateRequest{
		Name:         "SRV-TEST-001",
		Datacenter:   "DC01",
		Cluster:      "Cluster01",
		ResourcePool: "RP01",
	}
	jsonBody, _ := json.Marshal(requestBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/create-vm", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "task_id")
	assert.Contains(t, response, "status")
	assert.Equal(t, "queued", response["status"])
}

func TestCreateVMEndpoint_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/create-vm", bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "error")
}

func TestRootEndpoint_ReturnsServiceMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "application/json")

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Contains(t, response, "message")
}

func TestCreateVMEndpoint_WithVMClassSpecs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	requestBody := VMCreateRequest{
		Name:         "SRV-GOLD-001",
		Datacenter:   "DC01",
		Cluster:      "Cluster01",
		ResourcePool: "Production",
	}
	requestBody.Specs.CPU = 8
	requestBody.Specs.RAM = 16384
	requestBody.Specs.Storage = 500
	requestBody.Specs.CPUReservationPercent = 50
	requestBody.Specs.RAMReservationPercent = 50
	requestBody.Specs.ProvisioningType = "thick"
	requestBody.Specs.StoragePolicy = "Gold-Policy"

	jsonBody, _ := json.Marshal(requestBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/create-vm", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)

	appliedSpecs, ok := response["applied_specs"].(map[string]interface{})
	assert.True(t, ok, "applied_specs should be a map")
	assert.Equal(t, float64(8), appliedSpecs["cpu_cores"])
	assert.Equal(t, float64(16384), appliedSpecs["memory_mb"])
	assert.Equal(t, float64(500), appliedSpecs["storage_gb"])
	assert.Equal(t, float64(50), appliedSpecs["cpu_reservation_percent"])
	assert.Equal(t, float64(50), appliedSpecs["ram_reservation_percent"])
	assert.Equal(t, "thick", appliedSpecs["provisioning_type"])
	assert.Equal(t, "Gold-Policy", appliedSpecs["storage_policy"])
}

func TestCreateVMEndpoint_ThinProvisioning(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	requestBody := VMCreateRequest{
		Name:         "SRV-SILVER-001",
		Datacenter:   "DC01",
		Cluster:      "Cluster01",
		ResourcePool: "Development",
	}
	requestBody.Specs.CPU = 4
	requestBody.Specs.RAM = 8192
	requestBody.Specs.Storage = 200
	requestBody.Specs.ProvisioningType = "thin"
	requestBody.Specs.StoragePolicy = "Silver-Policy"

	jsonBody, _ := json.Marshal(requestBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/create-vm", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	appliedSpecs := response["applied_specs"].(map[string]interface{})
	assert.Equal(t, "thin", appliedSpecs["provisioning_type"])
	assert.Equal(t, "Silver-Policy", appliedSpecs["storage_policy"])
}
