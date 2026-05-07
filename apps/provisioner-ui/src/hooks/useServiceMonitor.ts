import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export interface ServiceInfo {
  name: string;
  status: 'up' | 'down' | 'unknown';
  latency_ms: number;
  last_probe: string;
}

export interface ConnectivityEntry {
  source: string;
  target: string;
  reachable: boolean;
  latency_ms: number;
  samples: number;
  timestamp: string;
}

interface UseServiceMonitorReturn {
  services: ServiceInfo[];
  connectivity: ConnectivityEntry[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useServiceMonitor(
  pollIntervalMs: number = 60000,
  autoPoll: boolean = true
): UseServiceMonitorReturn {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [connectivity, setConnectivity] = useState<ConnectivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [servicesData, connectivityData] = await Promise.all([
        api.get<ServiceInfo[]>('/dashboard/monitoring/services-status'),
        api.get<ConnectivityEntry[]>('/dashboard/monitoring/connectivity-matrix'),
      ]);

      setServices(servicesData || []);
      setConnectivity(connectivityData || []);

      setServices(servicesData);
      setConnectivity(connectivityData);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching monitoring data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoPoll) {
      fetchData();
      const intervalId = setInterval(fetchData, pollIntervalMs);
      return () => clearInterval(intervalId);
    }
  }, [fetchData, pollIntervalMs, autoPoll]);

  return {
    services,
    connectivity,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchData,
  };
}
