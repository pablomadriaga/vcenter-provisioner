package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

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

func getPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	return port
}

func startServer(port string, r *gin.Engine) *http.Server {
	srv := &http.Server{Addr: ":" + port, Handler: r}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()
	return srv
}

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

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "vCenter Integration Service",
			"version": "1.0.0",
			"status":  "active",
		})
	})

	r.GET("/connection/test", func(c *gin.Context) {
		client := NewClient()
		info, err := client.TestConnection()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"connected": false,
				"error":     err.Error(),
			})
			return
		}

		if info.Error != "" {
			c.JSON(http.StatusInternalServerError, gin.H{
				"connected":     false,
				"error":         info.Error,
				"url":           info.URL,
				"response_time": info.ResponseTime,
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"connected":     true,
			"url":           info.URL,
			"version":       info.Version,
			"build":         info.Build,
			"datacenter":    info.Datacenter,
			"response_time": info.ResponseTime + "ms",
		})
	})

	r.GET("/vms", func(c *gin.Context) {
		client := NewClient()
		vms, err := client.GetVMs()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"count": len(vms),
			"vms":   vms,
		})
	})

	r.GET("/datacenters", func(c *gin.Context) {
		client := NewClient()
		dcs, err := client.GetDatacenters()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"count":       len(dcs),
			"datacenters": dcs,
		})
	})

	r.GET("/clusters", func(c *gin.Context) {
		client := NewClient()
		clusters, err := client.GetClusters()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"count":    len(clusters),
			"clusters": clusters,
		})
	})

	r.GET("/datastores", func(c *gin.Context) {
		client := NewClient()
		ds, err := client.GetDatastores()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"count":      len(ds),
			"datastores": ds,
		})
	})

	r.POST("/create-vm", func(c *gin.Context) {
		var req VMCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if os.Getenv("VCENTER_MOCK") == "true" {
			log.Printf("[vCenter Mock] Received request to create VM:")
			log.Printf("  Name: %s", req.Name)
			log.Printf("  Location: %s/%s/%s", req.Datacenter, req.Cluster, req.ResourcePool)
			log.Printf("  Specs: CPU=%d, RAM=%dMB, Storage=%dGB", req.Specs.CPU, req.Specs.RAM, req.Specs.Storage)
			log.Printf("  Reservations: CPU=%d%%, RAM=%d%%", req.Specs.CPUReservationPercent, req.Specs.RAMReservationPercent)
			log.Printf("  Provisioning: %s, StoragePolicy: %s", req.Specs.ProvisioningType, req.Specs.StoragePolicy)

			c.JSON(http.StatusOK, gin.H{
				"task_id": "task-vcenter-mock-" + fmt.Sprintf("%d", 0),
				"status":  "queued",
				"message": "VM Creation Job initiated in vCenter (mock mode)",
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
			return
		}

		log.Printf("[vCenter] Creating VM via real vCenter API")
		client := NewClient()
		result, err := client.CreateVM(req)

		if err != nil || result.Status == "error" {
			log.Printf("[vCenter] Error creating VM: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"task_id": "",
				"status":  "error",
				"message": result.Error,
				"error":   err.Error(),
			})
			return
		}

		log.Printf("[vCenter] VM creation result: %s", result.Message)
		c.JSON(http.StatusOK, gin.H{
			"task_id": result.TaskID,
			"status":  result.Status,
			"vm_ref":  result.VMRef,
			"message": result.Message,
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

	return r
}

func main() {
	port := getPort()
	r := setupRouter()
	_ = startServer(port, r)
	quit := setupSignals()
	<-quit
}
