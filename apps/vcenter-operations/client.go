package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"time"

	"github.com/vmware/govmomi"
	"github.com/vmware/govmomi/find"
	"github.com/vmware/govmomi/object"
	"github.com/vmware/govmomi/vim25/mo"
	"github.com/vmware/govmomi/vim25/types"
)

type vCenterClient struct {
	client *govmomi.Client
	url    string
	ctx    context.Context
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

func (c *vCenterClient) Connect() error {
	host := os.Getenv("VCENTER_HOST")
	user := os.Getenv("VCENTER_USER")
	password := os.Getenv("VCENTER_PASSWORD")
	insecure := os.Getenv("VCENTER_INSECURE")

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

	client, err := govmomi.NewClient(c.ctx, u, insecure == "true")
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

func (c *vCenterClient) GetResourcePools(clusterName string) ([]ResourcePoolInfo, error) {
	err := c.Connect()
	if err != nil {
		return nil, err
	}
	defer c.client.Logout(c.ctx)

	var pools []ResourcePoolInfo

	finder := find.NewFinder(c.client.Client)

	clusterPath := fmt.Sprintf("/*/host/%s", clusterName)
	cluster, err := finder.ClusterComputeResource(c.ctx, clusterPath)
	if err != nil {
		return nil, fmt.Errorf("failed to find cluster '%s': %w", clusterName, err)
	}

	poolList, err := cluster.ResourcePool(c.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get resource pool for cluster '%s': %w", clusterName, err)
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
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("cluster '%s' not found: %v", req.Cluster, err),
		}, err
	}
	log.Printf("[vCenter] Found cluster: %s", cluster.Name())

	resourcePool := req.ResourcePool
	if resourcePool == "" {
		resourcePool = "Resources"
		log.Printf("[vCenter] No resource pool specified, using root pool: Resources")
	}

	poolPath := fmt.Sprintf("%s/host/%s/Resources/%s", dc.Name(), req.Cluster, resourcePool)
	pool, err := finder.ResourcePool(c.ctx, poolPath)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("resource pool '%s' not found: %v", resourcePool, err),
		}, err
	}
	log.Printf("[vCenter] Found resource pool: %s", resourcePool)

	dsPath := fmt.Sprintf("%s/datastore/nfs", dc.Name())
	_, err = finder.Datastore(c.ctx, dsPath)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("datastore 'nfs' not found in datacenter '%s': %v", dc.Name(), err),
		}, err
	}
	log.Printf("[vCenter] Found datastore: nfs")

	netPath := fmt.Sprintf("%s/network/%s", dc.Name(), "VLAN1004")
	network, err := finder.Network(c.ctx, netPath)
	if err != nil {
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
	disk := &types.VirtualDisk{
		CapacityInKB: int64(req.Specs.Storage) * 1024 * 1024,
		VirtualDevice: types.VirtualDevice{
			Backing: &types.VirtualDiskFlatVer2BackingInfo{
				VirtualDeviceFileBackingInfo: types.VirtualDeviceFileBackingInfo{
					FileName: fmt.Sprintf("[nfs] %s/%s.vmdk", req.Name, req.Name),
				},
				DiskMode:        string(types.VirtualDiskModePersistent),
				ThinProvisioned: &thinProvisioned,
			},
		},
	}
	devices = append(devices, scsi)
	devices.AssignController(disk, scsi.(*types.VirtualLsiLogicController))
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

	createDevSpecs, err := devices.ConfigSpec(types.VirtualDeviceConfigSpecOperationAdd)
	if err != nil {
		return &VMCreateResult{
			Status: "error",
			Error:  fmt.Sprintf("failed to create device config spec: %v", err),
		}, err
	}

	guestID := string(types.VirtualMachineGuestOsIdentifierOtherLinuxGuest)

	spec := types.VirtualMachineConfigSpec{
		Name:         req.Name,
		GuestId:      guestID,
		NumCPUs:      int32(req.Specs.CPU),
		MemoryMB:     int64(req.Specs.RAM),
		DeviceChange: createDevSpecs,
		Files: &types.VirtualMachineFileInfo{
			VmPathName: fmt.Sprintf("[nfs] %s", req.Name),
		},
	}

	if req.Specs.CPUReservationPercent > 0 || req.Specs.RAMReservationPercent > 0 {
		cpuReservation := int64(req.Specs.CPU) * 100 * int64(req.Specs.CPUReservationPercent) / 100
		memReservation := int64(req.Specs.RAM) * int64(req.Specs.RAMReservationPercent) / 100
		spec.CpuAllocation = &types.ResourceAllocationInfo{
			Reservation: &cpuReservation,
		}
		spec.MemoryAllocation = &types.ResourceAllocationInfo{
			Reservation: &memReservation,
		}
	}

	log.Printf("[vCenter] Creating VM with: CPU=%d, RAM=%dMB, Storage=%dGB, Provisioning=%s",
		req.Specs.CPU, req.Specs.RAM, req.Specs.Storage, req.Specs.ProvisioningType)

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
		if ref, ok := result.Result.(types.ManagedObjectReference); ok {
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

func powerStateToString(state types.VirtualMachinePowerState) string {
	switch state {
	case types.VirtualMachinePowerStatePoweredOn:
		return "poweredOn"
	case types.VirtualMachinePowerStatePoweredOff:
		return "poweredOff"
	case types.VirtualMachinePowerStateSuspended:
		return "suspended"
	default:
		return "unknown"
	}
}

func toolsStatusToString(status types.VirtualMachineToolsStatus) string {
	return string(status)
}
