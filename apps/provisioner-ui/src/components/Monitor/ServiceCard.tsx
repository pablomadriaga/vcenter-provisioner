import React from 'react';
import { ServiceInfo } from '../../hooks/useServiceMonitor';

interface ServiceCardProps {
  service: ServiceInfo;
  port: number;
}

const STATUS_COLORS: Record<string, string> = {
  up: 'bg-green-500',
  down: 'bg-red-500',
  unknown: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  up: 'UP',
  down: 'DOWN',
  unknown: 'UNKNOWN',
};

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, port }) => {
  const statusColor = STATUS_COLORS[service.status] || STATUS_COLORS.unknown;
  const statusLabel = STATUS_LABELS[service.status] || STATUS_LABELS.unknown;

  const formatTime = (timestamp: string): string => {
    if (!timestamp) return 'Never';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800 truncate" title={service.name}>
          {service.name}
        </h3>
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${statusColor}`} />
          <span className={`text-xs font-medium ${service.status === 'up' ? 'text-green-600' : service.status === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Latency</span>
          <span className={`font-medium ${service.latency_ms > 100 ? 'text-yellow-600' : service.latency_ms > 0 ? 'text-green-600' : 'text-gray-400'}`}>
            {service.latency_ms > 0 ? `${service.latency_ms}ms` : '-'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Port</span>
          <span className="font-medium text-gray-700">{port}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500">Last Check</span>
          <span className="text-gray-600">{formatTime(service.last_probe)}</span>
        </div>
      </div>

      {service.status === 'down' && service.last_probe && (
        <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-600">
          Failed check: {formatTime(service.last_probe)}
        </div>
      )}
    </div>
  );
};

export default ServiceCard;
