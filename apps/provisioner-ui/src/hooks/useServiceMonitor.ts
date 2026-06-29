import { useState, useEffect, useCallback } from 'react';

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

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';

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
      const [servicesRes, connectivityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/monitoring/services-status`),
        fetch(`${API_BASE_URL}/monitoring/connectivity-matrix`),
      ]);

      if (!servicesRes.ok) {
        throw new Error(`Failed to fetch services status: ${servicesRes.status}`);
      }

      if (!connectivityRes.ok) {
        throw new Error(`Failed to fetch connectivity matrix: ${connectivityRes.status}`);
      }

      const servicesData: ServiceInfo[] = await servicesRes.json() || [];
      const connectivityData: ConnectivityEntry[] = await connectivityRes.json() || [];

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
