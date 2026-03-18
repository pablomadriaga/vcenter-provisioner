package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/vmware/govmomi"
	"github.com/vmware/govmomi/find"
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

type ConnectionInfo struct {
	Connected    bool   `json:"connected"`
	URL          string `json:"url"`
	Version      string `json:"version"`
	Build        string `json:"build"`
	Datacenter   string `json:"datacenter"`
	ResponseTime string `json:"response_time_ms"`
	Error        string `json:"error,omitempty"`
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
