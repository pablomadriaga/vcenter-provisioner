package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestHealthCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/health", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, `{"status":"ok"}`, w.Body.String())
}

func TestRootEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, `{"message":"vCenter Provisioner: Orchestrator Service active."}`, w.Body.String())
}

func TestProvision_ValidRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)

	executeProvisioningFunc = func(state *ProvisionState, req ProvisionRequest) {}
	defer func() {
		executeProvisioningFunc = func(state *ProvisionState, req ProvisionRequest) {
			ExecuteProvisioning(state, req)
		}
	}()

	generateVMNameFunc = func(templateID int, manualValue string) (string, error) {
		return "pre1-pre2-manual-001", nil
	}
	defer func() {
		generateVMNameFunc = generateVMName
	}()

	router := setupRouter()

	payload := `{
		"template_id": 1,
		"manual_value": "manual",
		"vcenter_datacenter": "AR-BA-DC01",
		"vcenter_cluster": "Cluster01",
		"vcenter_resource_pool": "Production",
		"specs": {
			"cpu": 2,
			"ram": 4096,
			"storage": 100
		}
	}`

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/provision", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusAccepted, w.Code)

	var state ProvisionState
	err := json.Unmarshal(w.Body.Bytes(), &state)
	assert.NoError(t, err)
	assert.NotEmpty(t, state.ID)
	assert.NotEmpty(t, state.VMName)
	assert.Equal(t, "PENDING", state.Status)
	assert.Contains(t, state.Message, "Orchestrator received job")
	assert.NotZero(t, state.CreatedAt)
	assert.Equal(t, "pre1-pre2-manual-001", state.VMName)
}

func TestProvision_InvalidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	payload := `{invalid json}`

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/provision", strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestProvision_MissingRequiredFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	testCases := []struct {
		name    string
		payload string
	}{
		{
			name:    "Missing template_id",
			payload: `{"manual_value":"manual","vcenter_datacenter":"DC01","vcenter_cluster":"C01","vcenter_resource_pool":"RP"}`,
		},
		{
			name:    "Missing manual_value",
			payload: `{"template_id":1,"vcenter_datacenter":"DC01","vcenter_cluster":"C01","vcenter_resource_pool":"RP"}`,
		},
		{
			name:    "Missing vcenter_datacenter",
			payload: `{"template_id":1,"manual_value":"manual","vcenter_cluster":"C01","vcenter_resource_pool":"RP"}`,
		},
		{
			name:    "Missing vcenter_cluster",
			payload: `{"template_id":1,"manual_value":"manual","vcenter_datacenter":"DC01","vcenter_resource_pool":"RP"}`,
		},
		{
			name:    "Empty object",
			payload: `{}`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/provision", strings.NewReader(tc.payload))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusBadRequest, w.Code)
			assert.Contains(t, w.Body.String(), "error")
		})
	}
}

func TestProvision_WithSpecs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	generateVMNameFunc = func(templateID int, manualValue string) (string, error) {
		return "pre1-pre2-manual-001", nil
	}
	defer func() {
		generateVMNameFunc = generateVMName
	}()

	router := setupRouter()

	testCases := []struct {
		name    string
		payload string
		valid   bool
	}{
		{
			name:    "Valid specs",
			payload: `{"template_id":1,"manual_value":"manual","vcenter_datacenter":"DC","vcenter_cluster":"C","vcenter_resource_pool":"RP","specs":{"cpu":2,"ram":4096,"storage":100}}`,
			valid:   true,
		},
		{
			name:    "Minimal specs",
			payload: `{"template_id":1,"manual_value":"manual","vcenter_datacenter":"DC","vcenter_cluster":"C","vcenter_resource_pool":"RP","specs":{"cpu":1,"ram":512,"storage":10}}`,
			valid:   true,
		},
		{
			name:    "Maximum specs",
			payload: `{"template_id":1,"manual_value":"manual","vcenter_datacenter":"DC","vcenter_cluster":"C","vcenter_resource_pool":"RP","specs":{"cpu":16,"ram":65536,"storage":1000}}`,
			valid:   true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/provision", strings.NewReader(tc.payload))
			req.Header.Set("Content-Type", "application/json")
			router.ServeHTTP(w, req)

			if tc.valid {
				assert.Equal(t, http.StatusAccepted, w.Code)

				var state ProvisionState
				err := json.Unmarshal(w.Body.Bytes(), &state)
				assert.NoError(t, err)
				assert.NotEmpty(t, state.ID)
			}
		})
	}
}

func TestStatus_ExistingJob(t *testing.T) {
	gin.SetMode(gin.TestMode)

	generateVMNameFunc = func(templateID int, manualValue string) (string, error) {
		return "pre1-pre2-manual-001", nil
	}
	defer func() {
		generateVMNameFunc = generateVMName
	}()

	router := setupRouter()

	createPayload := `{
		"template_id": 1,
		"manual_value": "manual",
		"vcenter_datacenter": "DC01",
		"vcenter_cluster": "C01",
		"vcenter_resource_pool": "RP"
	}`

	createW := httptest.NewRecorder()
	createReq, _ := http.NewRequest("POST", "/provision", strings.NewReader(createPayload))
	createReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(createW, createReq)

	var createState ProvisionState
	err := json.Unmarshal(createW.Body.Bytes(), &createState)
	assert.NoError(t, err)

	statusW := httptest.NewRecorder()
	statusReq, _ := http.NewRequest("GET", "/status/"+createState.ID, nil)
	router.ServeHTTP(statusW, statusReq)

	assert.Equal(t, http.StatusOK, statusW.Code)

	var statusState ProvisionState
	err = json.Unmarshal(statusW.Body.Bytes(), &statusState)
	assert.NoError(t, err)
	assert.Equal(t, createState.ID, statusState.ID)
	assert.Equal(t, createState.VMName, statusState.VMName)
}

func TestStatus_NonExistentJob(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := setupRouter()

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/status/non-existent-job-id", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.JSONEq(t, `{"error":"Job not found"}`, w.Body.String())
}

func TestProvisionRequest_Struct(t *testing.T) {
	req := ProvisionRequest{
		TemplateID:          1,
		ManualValue:         "manual",
		VCenterDatacenter:   "DC01",
		VCenterCluster:      "C01",
		VCenterResourcePool: "RP",
		Specs: &VMSpecs{
			CPU:     2,
			RAM:     4096,
			Storage: 100,
		},
	}

	assert.Equal(t, 1, req.TemplateID)
	assert.Equal(t, "manual", req.ManualValue)
	assert.Equal(t, "DC01", req.VCenterDatacenter)
	assert.Equal(t, "C01", req.VCenterCluster)
	assert.Equal(t, "RP", req.VCenterResourcePool)
	assert.Equal(t, 2, req.Specs.CPU)
	assert.Equal(t, 4096, req.Specs.RAM)
	assert.Equal(t, 100, req.Specs.Storage)
}

func TestGenerateVMName_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oldURL := TypingServiceURL
	defer func() {
		TypingServiceURL = oldURL
	}()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"full_name": "pre1-pre2-manual-001"})
	})

	ts := httptest.NewServer(handler)
	defer ts.Close()

	TypingServiceURL = ts.URL

	name, err := generateVMName(1, "manual")
	assert.NoError(t, err)
	assert.Equal(t, "pre1-pre2-manual-001", name)
}

func TestGenerateVMName_HTTPError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	oldURL := TypingServiceURL
	defer func() {
		TypingServiceURL = oldURL
	}()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	ts := httptest.NewServer(handler)
	defer ts.Close()

	TypingServiceURL = ts.URL

	name, err := generateVMName(1, "manual")
	assert.Error(t, err)
	assert.Empty(t, name)
}

func TestProvisionState_Struct(t *testing.T) {
	state := ProvisionState{
		ID:        "job-123",
		VMName:    "pre1-pre2-manual-001",
		Status:    "READY",
		Message:   "VM provisioned successfully",
		CreatedAt: time.Now(),
	}

	assert.Equal(t, "job-123", state.ID)
	assert.Equal(t, "pre1-pre2-manual-001", state.VMName)
	assert.Equal(t, "READY", state.Status)
	assert.Equal(t, "VM provisioned successfully", state.Message)
	assert.NotZero(t, state.CreatedAt)
}
