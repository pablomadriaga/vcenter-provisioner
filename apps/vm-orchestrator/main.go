package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Service URLs (Internal Docker Network)
var (
	TypingServiceURL     = os.Getenv("TYPING_SERVICE_URL")
	VCenterOperationsURL = os.Getenv("VCENTER_OPERATIONS_URL")
	CredentialManagerURL = os.Getenv("CREDENTIAL_MANAGER_URL")
	StatsServiceURL      = os.Getenv("STATS_SERVICE_URL")
)

func init() {
	if TypingServiceURL == "" {
		TypingServiceURL = "http://typing-service:8000"
	}
	// Backwards compatibility: support old env var names
	if VCenterOperationsURL == "" {
		VCenterOperationsURL = os.Getenv("VCENTER_INTEGRATION_URL")
	}
	if VCenterOperationsURL == "" {
		VCenterOperationsURL = "http://vcenter-operations:8091"
	}
	if CredentialManagerURL == "" {
		CredentialManagerURL = os.Getenv("VCENTER_CONFIG_URL")
	}
	if CredentialManagerURL == "" {
		CredentialManagerURL = "http://credential-manager:8090"
	}
	if StatsServiceURL == "" {
		StatsServiceURL = "http://stats-service:8001"
	}
}

type ProvisionRequest struct {
	TemplateID          int      `json:"template_id" binding:"required"`
	ManualValue         string   `json:"manual_value" binding:"required"`
	VCenterConnectionID int      `json:"vcenter_connection_id"`
	VCenterDatacenter   string   `json:"vcenter_datacenter"`
	VCenterCluster      string   `json:"vcenter_cluster"`
	VCenterResourcePool string   `json:"vcenter_resource_pool"`
	VMClassID           *int     `json:"vm_class_id,omitempty"`
	Specs               *VMSpecs `json:"specs,omitempty"`
}

type VMSpecs struct {
	CPU                   int    `json:"cpu"`
	RAM                   int    `json:"ram"`
	Storage               int    `json:"storage"`
	CPUReservationPercent int    `json:"cpu_reservation_percent"`
	RAMReservationPercent int    `json:"ram_reservation_percent"`
	ProvisioningType      string `json:"provisioning_type"`
	StoragePolicy         string `json:"storage_policy"`
}

type ProvisionState struct {
	ID        string    `json:"id"`
	VMName    string    `json:"vm_name"`
	Status    string    `json:"status"` // PENDING, INFRA_CREATING, READY, FAILED
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// In-memory store for Lab simplicity (In Prod use Redis)
var states = make(map[string]*ProvisionState)

// Variable to allow mocking of generateVMName in tests
var generateVMNameFunc = generateVMName

// Variable to allow mocking of executeProvisioning in tests
var executeProvisioningFunc = func(state *ProvisionState, req ProvisionRequest) {
	ExecuteProvisioning(state, req)
}

func setupRouter() *gin.Engine {
	r := gin.Default()
	r.Use(cors.Default())

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Submitting a new Provisioning Job
	r.POST("/provision", func(c *gin.Context) {
		var req ProvisionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 1. Call Typing Service for Name Generation
		name, err := generateVMNameFunc(req.TemplateID, req.ManualValue)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate VM name", "details": err.Error()})
			return
		}

		// 2. Initialize State
		jobID := fmt.Sprintf("job-%d", time.Now().UnixNano())
		state := &ProvisionState{
			ID:        jobID,
			VMName:    name,
			Status:    "PENDING",
			Message:   "Orchestrator received job",
			CreatedAt: time.Now(),
		}
		states[jobID] = state

		// 3. Trigger Async Execution (Simulating Work)
		go executeProvisioningFunc(state, req)

		c.JSON(http.StatusAccepted, state)
	})

	r.GET("/status/:id", func(c *gin.Context) {
		id := c.Param("id")
		state, ok := states[id]
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}
		c.JSON(http.StatusOK, state)
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "vCenter Provisioner: Orchestrator Service active."})
	})

	return r
}

func generateVMName(templateID int, manualValue string) (string, error) {
	payload, _ := json.Marshal(map[string]string{"manual_value": manualValue})
	resp, err := http.Post(fmt.Sprintf("%s/generate-name/%d", TypingServiceURL, templateID), "application/json", bytes.NewBuffer(payload))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("typing service returned %d", resp.StatusCode)
	}

	var result struct {
		FullName string `json:"full_name"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.FullName, nil
}

func fetchVMClass(vmClassID int) (*VMSpecs, error) {
	resp, err := http.Get(fmt.Sprintf("%s/vm-classes/%d", TypingServiceURL, vmClassID))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("vm class not found: %d", resp.StatusCode)
	}

	var vmClass struct {
		CpuCores                 int    `json:"cpu_cores"`
		MemoryMb                 int    `json:"memory_mb"`
		StorageGb                int    `json:"storage_gb"`
		CpuReservationPercent    int    `json:"cpu_reservation_percent"`
		MemoryReservationPercent int    `json:"memory_reservation_percent"`
		ProvisioningType         string `json:"provisioning_type"`
		StoragePolicy            string `json:"storage_policy"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vmClass); err != nil {
		return nil, err
	}

	return &VMSpecs{
		CPU:                   vmClass.CpuCores,
		RAM:                   vmClass.MemoryMb,
		Storage:               vmClass.StorageGb,
		CPUReservationPercent: vmClass.CpuReservationPercent,
		RAMReservationPercent: vmClass.MemoryReservationPercent,
		ProvisioningType:      vmClass.ProvisioningType,
		StoragePolicy:         vmClass.StoragePolicy,
	}, nil
}

type VCenterCredentials struct {
	ID                int    `json:"id"`
	Name              string `json:"name"`
	URL               string `json:"url"`
	ConnectionType    string `json:"connection_type"`
	DefaultDatacenter string `json:"default_datacenter"`
	DefaultCluster    string `json:"default_cluster"`
}

func fetchVCenterCredentials(connectionID int) (*VCenterCredentials, error) {
	resp, err := http.Get(fmt.Sprintf("%s/api/vcenters/%d", CredentialManagerURL, connectionID))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to credential-manager: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("vCenter connection not found: %d", connectionID)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("credential-manager returned error: %d", resp.StatusCode)
	}

	var creds VCenterCredentials
	if err := json.NewDecoder(resp.Body).Decode(&creds); err != nil {
		return nil, fmt.Errorf("failed to decode credentials: %v", err)
	}

	return &creds, nil
}

type ProvisionLogPayload struct {
	JobID       string `json:"job_id"`
	VMName      string `json:"vm_name"`
	Status      string `json:"status"`
	VMClassID   *int   `json:"vm_class_id,omitempty"`
	VMClassName string `json:"vm_class_name,omitempty"`
	VCenterID   *int   `json:"vcenter_id,omitempty"`
	VCenterName string `json:"vcenter_name,omitempty"`
	ErrorReason string `json:"error_reason,omitempty"`
}

func sendToStatsService(state *ProvisionState, req ProvisionRequest, vcenterCreds *VCenterCredentials, success bool, errorReason string) {
	payload := ProvisionLogPayload{
		JobID:     state.ID,
		VMName:    state.VMName,
		Status:    state.Status,
		VMClassID: req.VMClassID,
	}

	if vcenterCreds != nil {
		payload.VCenterID = &vcenterCreds.ID
		payload.VCenterName = vcenterCreds.Name
	}

	if !success {
		payload.ErrorReason = errorReason
	}

	jsonPayload, _ := json.Marshal(payload)

	resp, err := http.Post(
		fmt.Sprintf("%s/api/provision-logs", StatsServiceURL),
		"application/json",
		bytes.NewBuffer(jsonPayload),
	)
	if err != nil {
		log.Printf("Warning: Failed to send stats to stats-service: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		log.Printf("Warning: Stats service returned %d", resp.StatusCode)
	}
}

func buildFinalSpecs(req ProvisionRequest) VMSpecs {
	specs := VMSpecs{}

	if req.VMClassID != nil {
		vmClassSpecs, err := fetchVMClass(*req.VMClassID)
		if err != nil {
			log.Printf("Warning: Failed to fetch VM Class %d: %v", *req.VMClassID, err)
		} else {
			specs = *vmClassSpecs
		}
	}

	if req.Specs != nil {
		if req.Specs.CPU > 0 {
			specs.CPU = req.Specs.CPU
		}
		if req.Specs.RAM > 0 {
			specs.RAM = req.Specs.RAM
		}
		if req.Specs.Storage > 0 {
			specs.Storage = req.Specs.Storage
		}
		if req.Specs.CPUReservationPercent > 0 {
			specs.CPUReservationPercent = req.Specs.CPUReservationPercent
		}
		if req.Specs.RAMReservationPercent > 0 {
			specs.RAMReservationPercent = req.Specs.RAMReservationPercent
		}
		if req.Specs.ProvisioningType != "" {
			specs.ProvisioningType = req.Specs.ProvisioningType
		}
		if req.Specs.StoragePolicy != "" {
			specs.StoragePolicy = req.Specs.StoragePolicy
		}
	}

	return specs
}

func ExecuteProvisioning(state *ProvisionState, req ProvisionRequest) {
	state.Status = "INFRA_CREATING"

	specs := buildFinalSpecs(req)

	var datacenter = req.VCenterDatacenter
	var cluster = req.VCenterCluster
	var connectionID = req.VCenterConnectionID
	var vcenterCreds *VCenterCredentials

	if connectionID > 0 {
		var err error
		vcenterCreds, err = fetchVCenterCredentials(connectionID)
		if err != nil {
			state.Status = "FAILED"
			state.Message = fmt.Sprintf("Failed to fetch vCenter credentials: %v", err)
			sendToStatsService(state, req, vcenterCreds, false, state.Message)
			return
		}

		if datacenter == "" {
			datacenter = vcenterCreds.DefaultDatacenter
		}
		if cluster == "" {
			cluster = vcenterCreds.DefaultCluster
		}

		log.Printf("Using vCenter connection: %s (%s)", vcenterCreds.Name, vcenterCreds.URL)
	}

	if datacenter == "" || cluster == "" {
		state.Status = "FAILED"
		state.Message = "vCenter datacenter and cluster are required"
		sendToStatsService(state, req, vcenterCreds, false, state.Message)
		return
	}

	state.Message = fmt.Sprintf(
		"Creating VM %s in %s/%s with specs: CPU=%d, RAM=%dMB, Storage=%dGB, Provisioning=%s, StoragePolicy=%s",
		state.VMName, datacenter, cluster,
		specs.CPU, specs.RAM, specs.Storage, specs.ProvisioningType, specs.StoragePolicy,
	)

	payload, _ := json.Marshal(map[string]interface{}{
		"name":          state.VMName,
		"datacenter":    datacenter,
		"cluster":       cluster,
		"resource_pool": req.VCenterResourcePool,
		"specs": map[string]interface{}{
			"cpu":                     specs.CPU,
			"ram":                     specs.RAM,
			"storage":                 specs.Storage,
			"cpu_reservation_percent": specs.CPUReservationPercent,
			"ram_reservation_percent": specs.RAMReservationPercent,
			"provisioning_type":       specs.ProvisioningType,
			"storage_policy":          specs.StoragePolicy,
		},
	})

	resp, err := http.Post(
		fmt.Sprintf("%s/create-vm", VCenterOperationsURL),
		"application/json",
		bytes.NewBuffer(payload),
	)
	if err != nil {
		state.Status = "FAILED"
		state.Message = fmt.Sprintf("Failed to contact vCenter operations: %v", err)
		sendToStatsService(state, req, vcenterCreds, false, state.Message)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		state.Status = "FAILED"
		state.Message = fmt.Sprintf("vCenter operations returned error: %d", resp.StatusCode)
		sendToStatsService(state, req, vcenterCreds, false, state.Message)
		return
	}

	state.Status = "READY"
	state.Message = fmt.Sprintf(
		"VM %s provisioned successfully: CPU=%d, RAM=%dMB, Storage=%dGB, Reservations=%d%%/%d%%, Provisioning=%s, Policy=%s",
		state.VMName, specs.CPU, specs.RAM, specs.Storage,
		specs.CPUReservationPercent, specs.RAMReservationPercent,
		specs.ProvisioningType, specs.StoragePolicy,
	)
	sendToStatsService(state, req, vcenterCreds, true, "")
}

func executeProvisioning(state *ProvisionState, req ProvisionRequest) {
	ExecuteProvisioning(state, req)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := setupRouter()

	srv := &http.Server{Addr: ":" + port, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")
}
