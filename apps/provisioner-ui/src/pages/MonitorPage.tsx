import { useState, useMemo } from 'react';
import { PageLayout } from '../components/Layout/PageLayout';
import {
  ServiceCard,
  ServiceDiagram,
  LatencyHeatmap,
  UptimeGauge,
  LatencySparkline,
} from '../components/Monitor';
import { useServiceMonitor } from '../hooks/useServiceMonitor';
import {
  useMonitoringHistory,
  useServiceUptime,
  useGlobalUptime,
} from '../hooks/useMonitoringHistory';

const PORT_MAP: Record<string, number> = {
  'api-gateway': 3000,
  'auth-service': 3001,
  'typing-service': 8000,
  'vm-orchestrator': 8080,
  'vcenter-integration': 8081,
  'vcenter-config': 8082,
  'stats-service': 8001,
  'monitoring-service': 8082,
  'backup-service': 8002,
  'provisioner-ui': 5173,
};

function MonitorPage() {
  const { services, connectivity, isLoading, error, lastUpdated, refresh } = useServiceMonitor(60000, true);

  const [heatmapTimeframe, setHeatmapTimeframe] = useState(168);
  const [selectedService, setSelectedService] = useState<string | 'global'>('global');

  const serviceNames = useMemo(() => {
    return (services || []).map((s) => s.name).filter((n) => n !== 'monitoring-service');
  }, [services]);

  const { history, heatmapData, isLoading: historyLoading } = useMonitoringHistory(
    serviceNames,
    heatmapTimeframe
  );

  const globalUptime = useGlobalUptime(history);
  const selectedServiceUptime = useServiceUptime(
    selectedService === 'global' ? serviceNames[0] || '' : selectedService,
    history
  );

  const upCount = (services || []).filter((s) => s.status === 'up').length;
  const downCount = (services || []).filter((s) => s.status === 'down').length;

  return (
    <PageLayout
      headerProps={{
        title: 'vCenter Provisioner - Monitor',
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse" />
              <span className="text-sm text-gray-600">{upCount} Up</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
              <span className="text-sm text-gray-600">{downCount} Down</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : 'Not updated'}
            </span>
            <button
              onClick={() => refresh()}
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <LatencyHeatmap
              data={heatmapData}
              selectedService={selectedService}
              onServiceChange={setSelectedService}
              availableServices={serviceNames}
              timeframe={heatmapTimeframe}
              onTimeframeChange={setHeatmapTimeframe}
              isLoading={historyLoading}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <UptimeGauge
                uptime={globalUptime.uptime}
                label="Global Uptime"
                size="lg"
                showDetails
                details={{
                  up: globalUptime.up,
                  down: globalUptime.down,
                  total: globalUptime.total,
                }}
              />

              {selectedService !== 'global' && (
                <UptimeGauge
                  uptime={selectedServiceUptime.uptime}
                  label={`${selectedService} Uptime`}
                  size="lg"
                  showDetails
                  details={{
                    up: selectedServiceUptime.up,
                    down: selectedServiceUptime.down,
                    total: selectedServiceUptime.total,
                  }}
                />
              )}

              {selectedService === 'global' && (
                <div className="bg-white rounded-xl shadow-md p-6 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">
                    Select a service from the heatmap to view its uptime
                  </p>
                </div>
              )}
            </div>

            {selectedService !== 'global' && (
              <LatencySparkline
                data={history}
                serviceName={selectedService}
                height={200}
              />
            )}
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Service Map</h3>
              <ServiceDiagram connectivity={connectivity} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Services</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 max-h-[600px] overflow-y-auto">
                {services.map((service) => (
                  <ServiceCard
                    key={service.name}
                    service={service}
                    port={PORT_MAP[service.name] || 0}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default MonitorPage;
