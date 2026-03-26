package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func init() {
	initLogger()
}

type VMCreateRequest struct {
	Name            string `json:"name"`
	Datacenter      string `json:"datacenter"`
	Cluster         string `json:"cluster"`
	ResourcePool    string `json:"resource_pool"`
	VCenterHost     string `json:"vcenter_host"`
	VCenterUser     string `json:"vcenter_user"`
	VCenterPass     string `json:"vcenter_pass"`
	VCenterInsecure bool   `json:"vcenter_insecure"`
	Specs           struct {
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
		vcenterHost := c.Query("vcenter_host")
		vcenterUser := c.Query("vcenter_user")
		vcenterPass := c.Query("vcenter_pass")
		insecure := c.Query("insecure") == "true"

		client := NewClient()
		if vcenterHost != "" && vcenterUser != "" && vcenterPass != "" {
			host := vcenterHost
			if strings.HasPrefix(host, "https://") {
				host = strings.TrimPrefix(host, "https://")
			} else if strings.HasPrefix(host, "http://") {
				host = strings.TrimPrefix(host, "http://")
			}
			if idx := strings.Index(host, "/"); idx > 0 {
				host = host[:idx]
			}
			log.Printf("[DEBUG] Using dynamic credentials for datacenters: host=%s, user=%s", host, vcenterUser)
			client.SetCredentials(host, vcenterUser, vcenterPass, insecure)
		}

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
		vcenterHost := c.Query("vcenter_host")
		vcenterUser := c.Query("vcenter_user")
		vcenterPass := c.Query("vcenter_pass")
		insecure := c.Query("insecure") == "true"

		client := NewClient()
		if vcenterHost != "" && vcenterUser != "" && vcenterPass != "" {
			host := vcenterHost
			if strings.HasPrefix(host, "https://") {
				host = strings.TrimPrefix(host, "https://")
			} else if strings.HasPrefix(host, "http://") {
				host = strings.TrimPrefix(host, "http://")
			}
			if idx := strings.Index(host, "/"); idx > 0 {
				host = host[:idx]
			}
			log.Printf("[DEBUG] Using dynamic credentials for clusters: host=%s, user=%s", host, vcenterUser)
			client.SetCredentials(host, vcenterUser, vcenterPass, insecure)
		}

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

	r.GET("/clusters-debug", func(c *gin.Context) {
		vcenterHost := c.Query("vcenter_host")
		vcenterUser := c.Query("vcenter_user")
		vcenterPass := c.Query("vcenter_pass")
		insecure := c.Query("insecure") == "true"

		client := NewClient()
		if vcenterHost != "" && vcenterUser != "" && vcenterPass != "" {
			host := vcenterHost
			if strings.HasPrefix(host, "https://") {
				host = strings.TrimPrefix(host, "https://")
			} else if strings.HasPrefix(host, "http://") {
				host = strings.TrimPrefix(host, "http://")
			}
			if idx := strings.Index(host, "/"); idx > 0 {
				host = host[:idx]
			}
			log.Printf("[DEBUG] Using dynamic credentials for clusters-debug: host=%s, user=%s", host, vcenterUser)
			client.SetCredentials(host, vcenterUser, vcenterPass, insecure)
		}

		clusters, err := client.GetClustersDebug()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"count":    len(clusters),
			"clusters": clusters,
		})
	})

	r.GET("/resource-pools", func(c *gin.Context) {
		cluster := c.Query("cluster")
		if cluster == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cluster query parameter is required"})
			return
		}

		const (
			maxRetries = 3
			timeout    = 10 * time.Second
			retryDelay = 1 * time.Second
		)

		var pools []ResourcePoolInfo
		var lastErr error

		for attempt := 0; attempt < maxRetries; attempt++ {
			ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)

			done := make(chan struct{})
			var err error

			go func() {
				client := NewClient()
				pools, err = client.GetResourcePools(cluster)
				close(done)
			}()

			select {
			case <-done:
				cancel()
				if err == nil {
					c.JSON(http.StatusOK, gin.H{
						"count":          len(pools),
						"resource_pools": pools,
					})
					return
				}
				lastErr = err
				log.Printf("[ResourcePools] Attempt %d/%d failed: %v", attempt+1, maxRetries, err)

			case <-ctx.Done():
				cancel()
				lastErr = fmt.Errorf("request timeout after %v", timeout)
				log.Printf("[ResourcePools] Attempt %d/%d timed out", attempt+1, maxRetries)
			}

			if attempt < maxRetries-1 {
				delay := retryDelay * time.Duration(1<<uint(attempt))
				select {
				case <-time.After(delay):
				case <-c.Request.Context().Done():
					return
				}
			}
		}

		log.Printf("[ResourcePools] All %d attempts failed: %v", maxRetries, lastErr)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":       "Failed to fetch resource pools from vCenter",
			"details":     lastErr.Error(),
			"retryable":   true,
			"max_retries": maxRetries,
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

	r.GET("/storage-policies", func(c *gin.Context) {
		vcenterID := c.Query("vcenter_connection_id")

		if vcenterID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "vcenter_connection_id is required"})
			return
		}

		connID := 0
		fmt.Sscanf(vcenterID, "%d", &connID)
		if connID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid vcenter_connection_id"})
			return
		}

		log.Printf("[storage-policies] Fetching storage policies for connection ID: %d", connID)

		// Fetch vCenter configuration from credential-manager
		vcenterConfig, err := fetchVCenterConfig(connID)
		if err != nil {
			log.Printf("[storage-policies] Error fetching vCenter config: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to fetch vCenter config: %v", err)})
			return
		}

		if vcenterConfig == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "vCenter connection not found"})
			return
		}

		// Get host from URL (format: https://host)
		host := strings.TrimPrefix(vcenterConfig.URL, "https://")
		host = strings.TrimSuffix(host, "/")

		// Parse credentials (format: user:password)
		credParts := strings.SplitN(vcenterConfig.Credential, ":", 2)
		if len(credParts) != 2 {
			log.Printf("[storage-policies] Error: invalid credential format")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid credential format"})
			return
		}
		user := credParts[0]
		password := credParts[1]

		log.Printf("[storage-policies] Connecting to vCenter: %s with user: %s", host, user)

		// Create vCenter client with user's credentials
		vcenterClient := NewClient()
		vcenterClient.ctx = context.Background()

		client, err := NewClientWithCredentials(host, user, password, true)
		if err != nil {
			log.Printf("[storage-policies] Error connecting to vCenter: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to connect to vCenter: %v", err)})
			return
		}
		vcenterClient.client = client
		vcenterClient.url = host

		policies, err := vcenterClient.GetStoragePolicies()
		if err != nil {
			log.Printf("[storage-policies] Error getting storage policies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to get storage policies: %v", err)})
			return
		}

		log.Printf("[storage-policies] Found %d storage policies", len(policies))

		// Logout from vCenter
		client.Logout(context.Background())

		c.JSON(http.StatusOK, gin.H{
			"count":            len(policies),
			"storage_policies": policies,
		})
	})

	r.POST("/create-vm", func(c *gin.Context) {
		var req VMCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		Info(c.Request.Context(), "create-vm request received",
			slog.String("vm_name", req.Name),
			slog.String("datacenter", req.Datacenter),
			slog.String("cluster", req.Cluster),
		)

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
		if req.VCenterHost != "" && req.VCenterUser != "" && req.VCenterPass != "" {
			host := req.VCenterHost
			if strings.HasPrefix(host, "https://") {
				host = strings.TrimPrefix(host, "https://")
			} else if strings.HasPrefix(host, "http://") {
				host = strings.TrimPrefix(host, "http://")
			}
			if idx := strings.Index(host, "/"); idx > 0 {
				host = host[:idx]
			}
			log.Printf("[vCenter] Using credentials from request: host=%s, user=%s", host, req.VCenterUser)
			client.SetCredentials(host, req.VCenterUser, req.VCenterPass, req.VCenterInsecure)
		}
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
