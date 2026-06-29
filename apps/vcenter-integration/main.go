package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

type VMCreateRequest struct {
	Name         string `json:"name"`
	Datacenter   string `json:"datacenter"`
	Cluster      string `json:"cluster"`
	ResourcePool string `json:"resource_pool"`
	Specs        struct {
		CPU                   int    `json:"cpu"`
		RAM                   int    `json:"ram"`
		Storage               int    `json:"storage"`
		CPUReservationPercent int    `json:"cpu_reservation_percent"`
		RAMReservationPercent int    `json:"ram_reservation_percent"`
		ProvisioningType      string `json:"provisioning_type"`
		StoragePolicy         string `json:"storage_policy"`
	} `json:"specs"`
}

// GetPort retrieves the server port from environment variables or returns default port.
// If PORT environment variable is empty, returns "8081" as default.
//
// Returns:
//
//	string: The port number as string.
func getPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	return port
}

// StartServer initializes and starts the HTTP server with graceful error handling.
// The server runs in a goroutine to allow signal handling to proceed concurrently.
//
// Parameters:
//
//	port: The port number to bind the server to.
//	r: The Gin router with all routes configured.
//
// Returns:
//
//	*http.Server: The configured server instance.
func startServer(port string, r *gin.Engine) *http.Server {
	srv := &http.Server{Addr: ":" + port, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()
	return srv
}

// SetupSignals configures signal handling for graceful shutdown.
// Listens for SIGINT and SIGTERM signals and blocks until one is received.
//
// Returns:
//
//	chan os.Signal: A channel that will receive shutdown signals.
func setupSignals() chan os.Signal {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	return quit
}

func setupRouter() *gin.Engine {
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	r.POST("/create-vm", func(c *gin.Context) {
		var req VMCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		log.Printf("[vCenter Mock] Received request to create VM:")
		log.Printf("  Name: %s", req.Name)
		log.Printf("  Location: %s/%s/%s", req.Datacenter, req.Cluster, req.ResourcePool)
		log.Printf("  Specs: CPU=%d, RAM=%dMB, Storage=%dGB", req.Specs.CPU, req.Specs.RAM, req.Specs.Storage)
		log.Printf("  Reservations: CPU=%d%%, RAM=%d%%", req.Specs.CPUReservationPercent, req.Specs.RAMReservationPercent)
		log.Printf("  Provisioning: %s, StoragePolicy: %s", req.Specs.ProvisioningType, req.Specs.StoragePolicy)

		time.Sleep(2 * time.Second)

		c.JSON(http.StatusOK, gin.H{
			"task_id": "task-vcenter-" + fmt.Sprintf("%d", time.Now().Unix()),
			"status":  "queued",
			"message": "VM Creation Job initiated in vCenter",
			"applied_specs": gin.H{
				"cpu_cores":               req.Specs.CPU,
				"memory_mb":               req.Specs.RAM,
				"storage_gb":              req.Specs.Storage,
				"cpu_reservation_percent": req.Specs.CPUReservationPercent,
				"ram_reservation_percent": req.Specs.RAMReservationPercent,
				"provisioning_type":       req.Specs.ProvisioningType,
				"storage_policy":          req.Specs.StoragePolicy,
			},
		})
	})

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "vCenter Provisioner: vCenter Integration Adapter (Mock) active."})
	})

	return r
}

func main() {
	port := getPort()
	r := setupRouter()
	_ = startServer(port, r)
	quit := setupSignals()
	<-quit
}
