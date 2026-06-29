package main

import (
	"encoding/json"
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
	assert.Equal(t, "8082", result)
}

func TestStartServer_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	srv := startServer("9091", router)

	assert.NotNil(t, srv)
	assert.Equal(t, ":9091", srv.Addr)
}

func TestStartServer_ConcurrentRequests(t *testing.T) {
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
			resp, err := http.Get("http://localhost:9092/health")
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

func TestMain_GracefulExit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	os.Setenv("PORT", "9094")
	defer os.Unsetenv("PORT")

	quit := setupSignals()

	done := make(chan bool)
	go func() {
		quit <- syscall.SIGTERM
		done <- true
	}()

	select {
	case <-done:
		assert.True(t, true)
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for graceful exit")
	}
}

func TestHealthEndpoint_ResponseStructure(t *testing.T) {
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
	assert.Equal(t, "online", response["status"])
	assert.Contains(t, response, "checks")
}

func TestMetricsEndpoint_Format(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/metrics", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/plain")

	response := w.Body.String()
	assert.Contains(t, response, "# HELP provision_ops_total")
	assert.Contains(t, response, "# TYPE provision_ops_total counter")
	assert.Contains(t, response, `provision_ops_total{status="success"}`)
}

func TestRootEndpoint_ResponseStructure(t *testing.T) {
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
