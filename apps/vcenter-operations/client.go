package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/vmware/govmomi"
	"github.com/vmware/govmomi/find"
	"github.com/vmware/govmomi/object"
	"github.com/vmware/govmomi/pbm"
	pbmTypes "github.com/vmware/govmomi/pbm/types"
	"github.com/vmware/govmomi/vim25/mo"
	vim25Types "github.com/vmware/govmomi/vim25/types"
)

type vCenterClient struct {
	client   *govmomi.Client
	url      string
	ctx      context.Context
	host     string
	user     string
	password string
	insecure bool
}

func (c *vCenterClient) SetCredentials(host, user, password string, insecure bool) {
	c.host = host
	c.user = user
	c.password = password
	c.insecure = insecure
}

type VMInfo struct {
	Name          string `json:"name"`
	PowerState    string `json:"power_state"`
	IPAddress     string `json:"ip_address"`
	CPU           int    `json:"cpu"`
	MemoryMB      int    `json:"memory_mb"`
	Datastore     string `json:"datastore"`
	Cluster       string `json:"cluster"`
	GuestFullName string `json:"guest_full_name"`
	VMXPath       string `json:"vmx_path"`
	ToolsStatus   string `json:"tools_status"`
}

type DatacenterInfo struct {
	Name string `json:"name"`
}

type ClusterInfo struct {
	Name          string `json:"name"`
	HostCount     int    `json:"host_count"`
	VMCount       int    `json:"vm_count"`
	TotalCPUCores int    `json:"total_cpu_cores"`
	TotalMemoryGB int    `json:"total_memory_gb"`
	FreeMemoryGB  int    `json:"free_memory_gb"`
}

type DatastoreInfo struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	CapacityGB  int64  `json:"capacity_gb"`
	FreeSpaceGB int64  `json:"free_space_gb"`
	Accessible  bool   `json:"accessible"`
}

type ResourcePoolInfo struct {
	Name              string `json:"name"`
	Path              string `json:"path"`
	CPUReservation    int64  `json:"cpu_reservation"`
	MemoryReservation int64  `json:"memory_reservation"`
}

type StoragePolicyInfo struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

type ConnectionInfo struct {
	Connected    bool   `json:"connected"`
	URL          string `json:"url"`
	Version      string `json:"version"`
	Build        string `json:"build"`
	Datacenter   string `json:"datacenter"`
	ResponseTime string `json:"response_time_ms"`
	Error        string `json:"error,omitempty"`
}

type VMCreateResult struct {
	TaskID  string `json:"task_id"`
	Status  string `json:"status"`
	VMRef   string `json:"vm_ref,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

func NewClient() *vCenterClient {
	return &vCenterClient{
		ctx: context.Background(),
	}
}

func NewClientWithCredentials(host, user, password string, insecure bool) (*govmomi.Client, error) {
	vcenterURL := fmt.Sprintf("https://%s:%s@%s/sdk", user, password, host)

	u, err := url.Parse(vcenterURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse vCenter URL: %w", err)
	}

	ctx := context.Background()
	client, err := govmomi.NewClient(ctx, u, insecure)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to vCenter: %w", err)
	}

	return client, nil
}

func (c *vCenterClient) Connect() error {
	host := c.host
	user := c.user
	password := c.password
	insecure := c.insecure

	if host == "" {
		host = os.Getenv("VCENTER_HOST")
	}
	if user == "" {
		user = os.Getenv("VCENTER_USER")
	}
	if password == "" {
		password = os.Getenv("VCENTER_PASSWORD")
	}
	insecureStr := os.Getenv("VCENTER_INSECURE")
	if !c.insecure && insecureStr == "true" {
		insecure = true
	}

	if host == "" {
		return fmt.Errorf("VCENTER_HOST environment variable is required")
	}
	if user == "" {
		return fmt.Errorf("VCENTER_USER environment variable is required")
	}
	if password == "" {
		return fmt.Errorf("VCENTER_PASSWORD environment variable is required")
	}

	vcenterURL := fmt.Sprintf("https://%s:%s@%s/sdk", user, password, host)

	u, err := url.Parse(vcenterURL)
	if err != nil {
		return fmt.Errorf("failed to parse vCenter URL: %w", err)
	}

	client, err := govmomi.NewClient(c.ctx, u, insecure)
	if err != nil {
		return fmt.Errorf("failed to connect to vCenter: %w", err)
	}
	c.client = client
	c.url = host

	return nil
}

func (c *vCenterClient) TestConnection() (*ConnectionInfo, error) {
	start := time.Now()
	err := c.Connect()
	if err != nil {
		return &ConnectionInfo{
			Connected: false,
			URL:       c.url,
			Error:     err.Error(),
		}, nil
	}
	defer c.client.Logout(c.ctx)

	about := c.client.ServiceContent.About

	finder := find.NewFinder(c.client.Client)
	dc, err := finder.Datacenter(c.ctx, "*")
	dcName := ""
	if err == nil {
		dcName = dc.Name()
	}

	return &ConnectionInfo{
		Connected:    true,
		URL:          c.url,
		Version:      about.Version,
		Build:        about.Build,
		Datacenter:   dcName,
		ResponseTime: fmt.Sprintf("%.2f", float64(time.Since(start).Microseconds())/1000.0),
	}, nil
}

func (c *vCenterClient) GetVMs() ([]VMInfo, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var vms []VMInfo

	finder := find.NewFinder(c.client.Client)

	vmsList, err := finder.VirtualMachineList(c.ctx, "/*/vm/**")
	if err != nil {
		return nil, fmt.Errorf("failed to list VMs: %w", err)
	}

	for _, vm := range vmsList {
		var vmMo mo.VirtualMachine
		err = vm.Properties(c.ctx, vm.Reference(), []string{"summary"}, &vmMo)
		if err != nil {
			continue
		}

		vmInfo := VMInfo{
			Name:          vmMo.Summary.Config.Name,
			PowerState:    powerStateToString(vmMo.Summary.Runtime.PowerState),
			IPAddress:     vmMo.Summary.Guest.IpAddress,
			CPU:           int(vmMo.Summary.Config.NumCpu),
			MemoryMB:      int(vmMo.Summary.Config.MemorySizeMB),
			GuestFullName: vmMo.Summary.Config.GuestFullName,
			VMXPath:       vmMo.Summary.Config.VmPathName,
			ToolsStatus:   toolsStatusToString(vmMo.Summary.Guest.ToolsStatus),
		}
		vms = append(vms, vmInfo)
	}

	return vms, nil
}

func (c *vCenterClient) GetDatacenters() ([]DatacenterInfo, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var datacenters []DatacenterInfo

	finder := find.NewFinder(c.client.Client)

	dcs, err := finder.DatacenterList(c.ctx, "*")
	if err != nil {
		return nil, fmt.Errorf("failed to list datacenters: %w", err)
	}

	for _, dc := range dcs {
		datacenters = append(datacenters, DatacenterInfo{
			Name: dc.Name(),
		})
	}

	return datacenters, nil
}

func (c *vCenterClient) GetClusters() ([]ClusterInfo, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var clusters []ClusterInfo

	finder := find.NewFinder(c.client.Client)

	clustersList, err := finder.ClusterComputeResourceList(c.ctx, "/*/host/**")
	if err != nil {
		return nil, fmt.Errorf("failed to list clusters: %w", err)
	}

	for _, cluster := range clustersList {
		clusters = append(clusters, ClusterInfo{
			Name: cluster.Name(),
		})
	}

	return clusters, nil
}

func (c *vCenterClient) GetClustersDebug() ([]map[string]interface{}, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var result []map[string]interface{}

	finder := find.NewFinder(c.client.Client)

	clustersList, err := finder.ClusterComputeResourceList(c.ctx, "/*/host/**")
	if err != nil {
		return nil, fmt.Errorf("failed to list clusters: %w", err)
	}

	for _, cluster := range clustersList {
		clusterInfo := map[string]interface{}{
			"name":           cluster.Name(),
			"moid":           cluster.Reference().Value,
			"type":           cluster.Reference().Type,
			"inventory_path": cluster.InventoryPath,
		}
		result = append(result, clusterInfo)
	}

	return result, nil
}

func (c *vCenterClient) ListAllInventory() (map[string][]map[string]interface{}, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	result := make(map[string][]map[string]interface{})
	finder := find.NewFinder(c.client.Client)

	dcs, err := finder.DatacenterList(c.ctx, "*")
	if err != nil {
		Warn(c.ctx, "failed to list datacenters", WithErr(err))
	} else {
		for _, dc := range dcs {
			result["datacenters"] = append(result["datacenters"], map[string]interface{}{
				"name": dc.Name(),
				"moid": dc.Reference().Value,
			})
		}
		Info(c.ctx, "found datacenters", slog.Int("count", len(dcs)))
	}

	clusters, err := finder.ClusterComputeResourceList(c.ctx, "/*/host/**")
	if err != nil {
		Warn(c.ctx, "failed to list clusters", WithErr(err))
	} else {
		for _, cluster := range clusters {
			result["clusters"] = append(result["clusters"], map[string]interface{}{
				"name": cluster.Name(),
				"moid": cluster.Reference().Value,
			})
		}
		Info(c.ctx, "found clusters", slog.Int("count", len(clusters)))
	}

	datastores, err := finder.DatastoreList(c.ctx, "/*/datastore/**")
	if err != nil {
		Warn(c.ctx, "failed to list datastores", WithErr(err))
	} else {
		for _, ds := range datastores {
			result["datastores"] = append(result["datastores"], map[string]interface{}{
				"name": ds.Name(),
				"moid": ds.Reference().Value,
			})
		}
		Info(c.ctx, "found datastores", slog.Int("count", len(datastores)))
	}

	return result, nil
}

func (c *vCenterClient) GetResourcePools(clusterIdentifier string) ([]ResourcePoolInfo, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var pools []ResourcePoolInfo

	finder := find.NewFinder(c.client.Client)

	allClusters, err := finder.ClusterComputeResourceList(c.ctx, "/*/host/**")
	if err != nil {
		return nil, fmt.Errorf("failed to list clusters: %w", err)
	}

	var cluster *object.ClusterComputeResource
	var found bool

	for _, clusterItem := range allClusters {
		if clusterItem.Name() == clusterIdentifier {
			cluster = clusterItem
			found = true
			break
		}

		if strings.Contains(clusterItem.Reference().Value, clusterIdentifier) {
			cluster = clusterItem
			found = true
			break
		}
	}

	if !found {
		return nil, fmt.Errorf("cluster '%s' not found", clusterIdentifier)
	}

	poolList, err := cluster.ResourcePool(c.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource pool for cluster '%s': %w", clusterIdentifier, err)
	}

	var rpMo mo.ResourcePool
	err = poolList.Properties(c.ctx, poolList.Reference(), []string{"name", "config"}, &rpMo)
	if err == nil {
		cpuRes := int64(0)
		memRes := int64(0)
		if rpMo.Config.CpuAllocation.Reservation != nil {
			cpuRes = *rpMo.Config.CpuAllocation.Reservation
		}
		if rpMo.Config.MemoryAllocation.Reservation != nil {
			memRes = *rpMo.Config.MemoryAllocation.Reservation
		}
		pools = append(pools, ResourcePoolInfo{
			Name:              rpMo.Name,
			Path:              poolList.String(),
			CPUReservation:    cpuRes,
			MemoryReservation: memRes,
		})
	}

	return pools, nil
}

func (c *vCenterClient) GetDatastores() ([]DatastoreInfo, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var datastores []DatastoreInfo

	finder := find.NewFinder(c.client.Client)

	dsList, err := finder.DatastoreList(c.ctx, "/*/datastore/**")
	if err != nil {
		return nil, fmt.Errorf("failed to list datastores: %w", err)
	}

	for _, ds := range dsList {
		var dsMo mo.Datastore
		err = ds.Properties(c.ctx, ds.Reference(), []string{"summary"}, &dsMo)
		if err != nil {
			continue
		}

		dsInfo := DatastoreInfo{
			Name:        dsMo.Summary.Name,
			Type:        dsMo.Summary.Type,
			CapacityGB:  dsMo.Summary.Capacity / 1024 / 1024 / 1024,
			FreeSpaceGB: dsMo.Summary.FreeSpace / 1024 / 1024 / 1024,
			Accessible:  dsMo.Summary.Accessible,
		}
		datastores = append(datastores, dsInfo)
	}

	return datastores, nil
}

func (c *vCenterClient) GetStoragePolicies() ([]StoragePolicyInfo, error) {
	if c.client == nil {
		err := c.Connect()
		if err != nil {
			return nil, err
		}
		defer c.client.Logout(c.ctx)
	}

	pbmClient, err := pbm.NewClient(c.ctx, c.client.Client)
	if err != nil {
		return nil, fmt.Errorf("failed to create PBM client: %w", err)
	}

	resourceType := pbmTypes.PbmProfileResourceType{
		ResourceType: string(pbmTypes.PbmProfileResourceTypeEnumSTORAGE),
	}

	profileIDs, err := pbmClient.QueryProfile(c.ctx, resourceType, "")
	if err != nil {
		return nil, fmt.Errorf("failed to query storage profiles: %w", err)
	}

	if len(profileIDs) == 0 {
		return []StoragePolicyInfo{}, nil
	}

	profiles, err := pbmClient.RetrieveContent(c.ctx, profileIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve profile content: %w", err)
	}

	var policies []StoragePolicyInfo
	for _, profile := range profiles {
		if profile == nil {
			continue
		}
		policies = append(policies, StoragePolicyInfo{
			Name:        profile.GetPbmProfile().Name,
			Description: profile.GetPbmProfile().Description,
		})
	}

	return policies, nil
}

func (c *vCenterClient) CreateVM(req VMCreateRequest) (*VMCreateResult, error) {
	err := c.Connect()
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to connect to vCenter: %v", err),
		}, err
	}
	defer c.client.Logout(c.ctx)

	log.Printf("[vCenter] Creating VM: %s", req.Name)
	log.Printf("[vCenter] Location: %s/%s/%s", req.Datacenter, req.Cluster, req.ResourcePool)

	finder := find.NewFinder(c.client.Client)

	dc, err := finder.Datacenter(c.ctx, req.Datacenter)
	if err != nil {
		Warn(c.ctx, "datacenter not found, trying to list available datacenters",
			slog.String("requested", req.Datacenter), WithErr(err))

		dcs, listErr := finder.DatacenterList(c.ctx, "*")
		if listErr == nil && len(dcs) > 0 {
			availableDCs := make([]string, len(dcs))
			for i, d := range dcs {
				availableDCs[i] = d.Name()
			}
			Warn(c.ctx, "available datacenters", slog.Any("datacenters", availableDCs))
		}

		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("datacenter '%s' not found: %v", req.Datacenter, err),
		}, err
	}
	finder.SetDatacenter(dc)
	log.Printf("[vCenter] Found datacenter: %s", dc.Name())

	clusterPath := fmt.Sprintf("%s/host/%s", dc.Name(), req.Cluster)
	cluster, err := finder.ClusterComputeResource(c.ctx, clusterPath)
	if err != nil {
		Warn(c.ctx, "cluster not found by path, trying MOID fallback",
			slog.String("path", clusterPath), WithErr(err))

		if strings.HasPrefix(req.Cluster, "domain-") {
			moid := req.Cluster
			cluster, err = finder.ClusterComputeResource(c.ctx, moid)
			if err == nil {
				Info(c.ctx, "found cluster by MOID",
					slog.String("moid", moid), slog.String("name", cluster.Name()))
			}
		}

		if err != nil {
			clusters, listErr := finder.ClusterComputeResourceList(c.ctx, "/*/host/**")
			if listErr == nil && len(clusters) > 0 {
				availableClusters := make([]map[string]string, len(clusters))
				for i, cl := range clusters {
					availableClusters[i] = map[string]string{
						"name": cl.Name(),
						"moid": cl.Reference().Value,
					}
				}
				Warn(c.ctx, "available clusters", slog.Any("clusters", availableClusters))
			}
			return &VMCreateResult{
				Status: "error",
				Error:  fmt.Sprintf("cluster '%s' not found: %v", req.Cluster, err),
			}, err
		}
	}
	log.Printf("[vCenter] Found cluster: %s", cluster.Name())

	clusterName := cluster.Name()

	var pool *object.ResourcePool
	rp, poolErr := cluster.ResourcePool(c.ctx)
	if poolErr == nil && rp != nil {
		pool = rp
		log.Printf("[vCenter] Using cluster resource pool: %s", pool.Name())
	} else {
		Warn(c.ctx, "could not get cluster resource pool, trying root",
			slog.String("cluster", clusterName), WithErr(poolErr))

		poolPath := fmt.Sprintf("%s/host/%s/Resources", dc.Name(), clusterName)
		pool, poolErr = finder.ResourcePool(c.ctx, poolPath)
		if poolErr != nil {
			Warn(c.ctx, "root Resources pool not found, trying without path",
				slog.String("path", poolPath), WithErr(poolErr))

			pools, listErr := finder.ResourcePoolList(c.ctx, fmt.Sprintf("%s/host/%s/**", dc.Name(), clusterName))
			if listErr == nil && len(pools) > 0 {
				pool = pools[0]
				log.Printf("[vCenter] Using first available resource pool: %s", pool.Name())
			} else {
				return &VMCreateResult{
					Status: "error",
					Error:  fmt.Sprintf("no resource pool found in cluster '%s': %v", clusterName, poolErr),
				}, poolErr
			}
		}
	}

	dsPath := fmt.Sprintf("%s/datastore/nfs", dc.Name())
	ds, err := finder.Datastore(c.ctx, dsPath)
	if err != nil {
		Warn(c.ctx, "datastore 'nfs' not found, trying first available",
			slog.String("datacenter", dc.Name()), WithErr(err))

		datastores, dsErr := finder.DatastoreList(c.ctx, fmt.Sprintf("%s/datastore/*", dc.Name()))
		if dsErr == nil && len(datastores) > 0 {
			availableDS := make([]string, len(datastores))
			for i, d := range datastores {
				availableDS[i] = d.Name()
			}
			Warn(c.ctx, "available datastores", slog.Any("datastores", availableDS))

			ds = datastores[0]
			log.Printf("[vCenter] Using first available datastore: %s", ds.Name())
		}

		if ds == nil {
			return &VMCreateResult{
				Status: "error",
				Error:  fmt.Sprintf("no datastore found in datacenter '%s': %v", dc.Name(), err),
			}, err
		}
	}

	dsName := "unknown"
	if ds != nil {
		if n := ds.Name(); n != "" {
			dsName = n
		} else {
			var dsMo mo.Datastore
			if err := ds.Properties(c.ctx, ds.Reference(), []string{"name"}, &dsMo); err == nil && dsMo.Name != "" {
				dsName = dsMo.Name
			}
		}
	}
	log.Printf("[vCenter] Using datastore: %s", dsName)

	networkName := "VLAN1004"
	netPath := fmt.Sprintf("%s/network/%s", dc.Name(), networkName)
	network, err := finder.Network(c.ctx, netPath)
	if err != nil {
		Warn(c.ctx, "network not found",
			slog.String("network", networkName), WithErr(err))
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("network 'VLAN1004' not found in datacenter '%s': %v", dc.Name(), err),
		}, err
	}
	log.Printf("[vCenter] Found network: VLAN1004")

	folders, err := dc.Folders(c.ctx)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to get datacenter folders: %v", err),
		}, err
	}
	vmFolder := folders.VmFolder
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to get VM folder: %v", err),
		}, err
	}

	var devices object.VirtualDeviceList

	scsi, err := devices.CreateSCSIController("scsi")
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to create SCSI controller: %v", err),
		}, err
	}

	thinProvisioned := req.Specs.ProvisioningType == "thin"

	cpu := req.Specs.CPU
	ram := req.Specs.RAM
	storage := req.Specs.Storage

	if cpu == 0 || ram == 0 || storage == 0 {
		Warn(c.ctx, "VM specs not provided, cannot create VM",
			slog.Int("cpu", cpu),
			slog.Int("ram", ram),
			slog.Int("storage", storage),
			slog.String("error", "specs are required"))
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("VM specs (CPU, RAM, Storage) are required but got cpu=%d, ram=%d, storage=%d", cpu, ram, storage),
		}, fmt.Errorf("missing VM specs")
	}

	Warn(c.ctx, "creating disk",
		slog.String("datastore_name", dsName),
		slog.Int("storage_gb", storage),
		slog.String("vm_name", req.Name),
		slog.String("provisioning", req.Specs.ProvisioningType))

	disk := &vim25Types.VirtualDisk{
		CapacityInKB: int64(storage) * 1024 * 1024,
		VirtualDevice: vim25Types.VirtualDevice{
			Backing: &vim25Types.VirtualDiskFlatVer2BackingInfo{
				VirtualDeviceFileBackingInfo: vim25Types.VirtualDeviceFileBackingInfo{
					FileName: fmt.Sprintf("[%s] %s/%s.vmdk", dsName, req.Name, req.Name),
				},
				DiskMode:        string(vim25Types.VirtualDiskModePersistent),
				ThinProvisioned: &thinProvisioned,
			},
		},
	}
	devices = append(devices, scsi)
	devices.AssignController(disk, scsi.(*vim25Types.VirtualLsiLogicController))
	devices = append(devices, disk)

	nicBacking, err := network.EthernetCardBackingInfo(c.ctx)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to get network backing: %v", err),
		}, err
	}

	nic, err := devices.CreateEthernetCard("vmxnet3", nicBacking)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to create network adapter: %v", err),
		}, err
	}
	devices = append(devices, nic)

	createDevSpecs, err := devices.ConfigSpec(vim25Types.VirtualDeviceConfigSpecOperationAdd)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to create device config spec: %v", err),
		}, err
	}

	guestID := string(vim25Types.VirtualMachineGuestOsIdentifierOtherLinuxGuest)

	spec := vim25Types.VirtualMachineConfigSpec{
		Name:         req.Name,
		GuestId:      guestID,
		NumCPUs:      int32(cpu),
		MemoryMB:     int64(ram),
		DeviceChange: createDevSpecs,
		Files: &vim25Types.VirtualMachineFileInfo{
			VmPathName: fmt.Sprintf("[%s] %s", dsName, req.Name),
		},
	}

	if req.Specs.CPUReservationPercent > 0 || req.Specs.RAMReservationPercent > 0 {
		cpuReservation := int64(cpu) * 100 * int64(req.Specs.CPUReservationPercent) / 100
		memReservation := int64(ram) * int64(req.Specs.RAMReservationPercent) / 100
		spec.CpuAllocation = &vim25Types.ResourceAllocationInfo{
			Reservation: &cpuReservation,
		}
		spec.MemoryAllocation = &vim25Types.ResourceAllocationInfo{
			Reservation: &memReservation,
		}
	}

	log.Printf("[vCenter] Creating VM with: CPU=%d, RAM=%dMB, Storage=%dGB, Provisioning=%s",
		cpu, ram, storage, req.Specs.ProvisioningType)

	task, err := vmFolder.CreateVM(c.ctx, spec, pool, nil)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to create VM task: %v", err),
		}, err
	}

	result, err := task.WaitForResult(c.ctx, nil)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("VM creation task failed: %v", err),
		}, err
	}

	vmRef := ""
	if result != nil {
		if ref, ok := result.Result.(vim25Types.ManagedObjectReference); ok {
			vmRef = ref.Value
		}
	}

	log.Printf("[vCenter] VM created successfully: %s (ref: %s)", req.Name, vmRef)

	return &VMCreateResult{
		TaskID:  task.Reference().Value,
		Status:  "created",
		VMRef:   vmRef,
		Message: fmt.Sprintf("VM %s created successfully", req.Name),
	}, nil
}

func powerStateToString(state vim25Types.VirtualMachinePowerState) string {
	switch state {
	case vim25Types.VirtualMachinePowerStatePoweredOn:
		return "poweredOn"
	case vim25Types.VirtualMachinePowerStatePoweredOff:
		return "poweredOff"
	case vim25Types.VirtualMachinePowerStateSuspended:
		return "suspended"
	default:
		return "unknown"
	}
}

func toolsStatusToString(status vim25Types.VirtualMachineToolsStatus) string {
	return string(status)
}
