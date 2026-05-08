import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../utils/api';

export interface ProbeResult {
  source: string;
  target: string;
  latency_ms: number;
  status: 'up' | 'down' | 'timeout';
  timestamp: string;
  error_message?: string;
}

export interface TimeseriesPoint {
  timestamp: string;
  up: number;
  down: number;
  timeout: number;
  avg_latency_ms: number;
  min_latency_ms: number;
  max_latency_ms: number;
  total: number;
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
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [timeseriesRes] = await Promise.all([
        api.get<TimeseriesPoint[]>(
          `/dashboard/monitoring/services-timeseries?hours=${timeframeHours}&interval=1h`
        ),
      ]);
      setTimeseries(timeseriesRes || []);

      const allResults: ProbeResult[] = [];
      for (const service of services) {
        const data = await api.get<ProbeResult[]>(
          `/dashboard/monitoring/services-history?service=${service}&hours=2`
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
      console.error('Error fetching monitoring data:', err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [services.join(','), timeframeHours]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const heatmapData = useMemo(() => {
    const dataMap = new Map<string, {
      day: number;
      hour: number;
      totalLatency: number;
      totalWeight: number;
      probeCount: number;
      uptimePercent: number;
      minLatency: number;
      maxLatency: number;
      totalUp: number;
    }>();

    for (const point of timeseries) {
      const date = new Date(point.timestamp);
      const day = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      const key = `${day}-${hour}`;

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          day,
          hour,
          totalLatency: 0,
          totalWeight: 0,
          probeCount: 0,
          uptimePercent: 0,
          minLatency: Infinity,
          maxLatency: 0,
          totalUp: 0,
        });
      }

      const entry = dataMap.get(key)!;

      entry.probeCount += point.total;
      entry.totalLatency += point.avg_latency_ms * point.total;
      entry.totalWeight += point.total;
      entry.totalUp += point.up || 0;

      if (point.min_latency_ms > 0) {
        entry.minLatency = Math.min(entry.minLatency, point.min_latency_ms);
      }
      if (point.max_latency_ms > 0) {
        entry.maxLatency = Math.max(entry.maxLatency, point.max_latency_ms);
      }
    }

    return Array.from(dataMap.values()).map(entry => ({
      day: entry.day,
      hour: entry.hour,
      avgLatency: entry.totalWeight > 0 ? Math.round(entry.totalLatency / entry.totalWeight) : 0,
      probeCount: entry.probeCount,
      uptimePercent: entry.probeCount > 0 ? Math.round((entry.totalUp / entry.probeCount) * 100) : 0,
      minLatency: entry.minLatency === Infinity ? 0 : entry.minLatency,
      maxLatency: entry.maxLatency,
    })).sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.hour - b.hour;
    });
  }, [timeseries]);

  return {
    history,
    heatmapData,
    isLoading,
    error,
    refresh: fetchData,
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
