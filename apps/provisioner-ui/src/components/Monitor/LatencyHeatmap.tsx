import React, { useState, useMemo } from 'react';
import { HeatmapDataPoint } from '../../hooks/useMonitoringHistory';
import { getDayName } from '../../hooks/useMonitoringHistory';

interface LatencyHeatmapProps {
  data: HeatmapDataPoint[];
  selectedService: string | 'global';
  onServiceChange: (service: string | 'global') => void;
  availableServices: string[];
  timeframe: number;
  onTimeframeChange: (hours: number) => void;
  isLoading: boolean;
}

const TIMEFRAME_OPTIONS = [
  { value: 24, label: '24 Hours' },
  { value: 168, label: '7 Days' },
  { value: 720, label: '30 Days' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = Array.from({ length: 7 }, (_, i) => i);

const getLatencyColor = (latency: number): string => {
  if (latency === 0 || latency === Infinity) return '#e5e7eb';
  if (latency < 50) return '#10b981';
  if (latency < 100) return '#f59e0b';
  if (latency < 200) return '#f97316';
  return '#ef4444';
};

const getLatencyLabel = (latency: number): string => {
  if (latency === 0 || latency === Infinity) return 'N/A';
  return `${latency}ms`;
};

export const LatencyHeatmap: React.FC<LatencyHeatmapProps> = ({
  data,
  selectedService,
  onServiceChange,
  availableServices,
  timeframe,
  onTimeframeChange,
  isLoading,
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapDataPoint | null>(null);

  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapDataPoint>();
    for (const point of data) {
      map.set(`${point.day}-${point.hour}`, point);
    }
    return map;
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Latency Heatmap</h3>
          <p className="text-sm text-gray-500">
            Average latency by day and hour
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={selectedService}
            onChange={(e) => onServiceChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="global">All Services</option>
            {availableServices.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>

          <select
            value={timeframe}
            onChange={(e) => onTimeframeChange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {TIMEFRAME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex">
                <div className="w-16 shrink-0" />
                <div className="flex">
                  {HOURS.filter((h) => h % 3 === 0).map((hour) => (
                    <div
                      key={hour}
                      className="text-xs text-gray-500 text-center"
                      style={{ width: '32px' }}
                    >
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center">
                    <div className="w-16 shrink-0 text-xs text-gray-600 font-medium">
                      {getDayName(day)}
                    </div>
                    <div className="flex gap-1">
                      {HOURS.map((hour) => {
                        const key = `${day}-${hour}`;
                        const point = dataMap.get(key);
                        const latency = point?.avgLatency || 0;
                        const count = point?.probeCount || 0;

                        return (
                          <div
                            key={key}
                            className="w-7 h-7 rounded cursor-pointer transition-all hover:scale-110 hover:shadow-md relative"
                            style={{ backgroundColor: getLatencyColor(latency) }}
                            onMouseEnter={() => setHoveredCell(point || null)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {point && point.probeCount > 0 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[8px] font-medium text-white opacity-80">
                                  {count > 9 ? '9+' : count}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Latency:</span>
            </div>
            <div className="flex gap-1">
              {[
                { color: '#10b981', label: '<50ms' },
                { color: '#f59e0b', label: '50-100ms' },
                { color: '#f97316', label: '100-200ms' },
                { color: '#ef4444', label: '>200ms' },
                { color: '#e5e7eb', label: 'N/A' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {hoveredCell && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {getDayName(hoveredCell.day)} at {hoveredCell.hour}:00
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedService === 'global' ? 'All services' : selectedService}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: getLatencyColor(hoveredCell.avgLatency) }}>
                    {getLatencyLabel(hoveredCell.avgLatency)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Avg latency
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Min</p>
                  <p className="font-medium">
                    {hoveredCell.minLatency === Infinity ? 'N/A' : `${hoveredCell.minLatency}ms`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Max</p>
                  <p className="font-medium">
                    {hoveredCell.maxLatency === 0 ? 'N/A' : `${hoveredCell.maxLatency}ms`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Probes</p>
                  <p className="font-medium">{hoveredCell.probeCount}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LatencyHeatmap;
