import { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';

export interface ProbeResult {
  source: string;
  target: string;
  latency_ms: number;
  status: 'up' | 'down' | 'timeout';
  timestamp: string;
  error_message?: string;
}

export interface HeatmapDataPoint {
  day: number;
  hour: number;
  avgLatency: number;
  probeCount: number;
  uptimePercent: number;
  minLatency: number;
  maxLatency: number;
}

export interface UseMonitoringHistoryReturn {
  history: ProbeResult[];
  heatmapData: HeatmapDataPoint[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function getDayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex] || '';
}

export function useMonitoringHistory(
  services: string[],
  timeframeHours: number = 168
): UseMonitoringHistoryReturn {
  const [history, setHistory] = useState<ProbeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const allResults: ProbeResult[] = [];

      for (const service of services) {
        const data = await api.get<ProbeResult[]>(
          `/dashboard/monitoring/services-history?service=${service}&hours=${timeframeHours}`
        );

        if (!data) {
          console.warn(`Failed to fetch history for ${service}`);
          continue;
        }

        allResults.push(...data);
      }

      setHistory(allResults);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('Error fetching monitoring history:', err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [services.join(','), timeframeHours]);

  const heatmapData = useMemo(() => {
    const dataMap = new Map<string, HeatmapDataPoint>();

    for (const result of history) {
      const date = new Date(result.timestamp);
      const day = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      const key = `${day}-${hour}`;

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          day,
          hour,
          avgLatency: 0,
          probeCount: 0,
          uptimePercent: 0,
          minLatency: Infinity,
          maxLatency: 0,
        });
      }

      const point = dataMap.get(key)!;
      point.probeCount++;

      if (result.latency_ms > 0) {
        point.avgLatency = Math.round(
          (point.avgLatency * (point.probeCount - 1) + result.latency_ms) / point.probeCount
        );
        point.minLatency = Math.min(point.minLatency, result.latency_ms);
        point.maxLatency = Math.max(point.maxLatency, result.latency_ms);
      }

      if (result.status === 'up') {
        point.uptimePercent = Math.round(
          ((point.uptimePercent / 100) * (point.probeCount - 1) + 1) / point.probeCount * 100
        );
      }
    }

    return Array.from(dataMap.values()).sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.hour - b.hour;
    });
  }, [history]);

  return {
    history,
    heatmapData,
    isLoading,
    error,
    refresh: fetchHistory,
  };
}

export function useServiceUptime(
  serviceName: string,
  history: ProbeResult[]
): { uptime: number; total: number; up: number; down: number } {
  return useMemo(() => {
    const serviceHistory = history.filter(h => h.target === serviceName);
    const up = serviceHistory.filter(h => h.status === 'up').length;
    const down = serviceHistory.filter(h => h.status !== 'up').length;
    const total = serviceHistory.length;

    return {
      uptime: total > 0 ? Math.round((up / total) * 100) : 0,
      total,
      up,
      down,
    };
  }, [serviceName, history]);
}

export function useGlobalUptime(
  history: ProbeResult[]
): { uptime: number; total: number; up: number; down: number } {
  return useMemo(() => {
    const up = history.filter(h => h.status === 'up').length;
    const down = history.filter(h => h.status !== 'up').length;
    const total = history.length;

    return {
      uptime: total > 0 ? Math.round((up / total) * 100) : 0,
      total,
      up,
      down,
    };
  }, [history]);
}
