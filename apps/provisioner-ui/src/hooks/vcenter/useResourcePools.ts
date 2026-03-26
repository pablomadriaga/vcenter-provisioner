import { useState, useCallback, useRef } from 'react';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';

interface ResourcePoolInfo {
  name: string;
  path: string;
}

interface UseResourcePoolsOptions {
  clusterId?: string;
  timeout?: number;
}

interface UseResourcePoolsResult {
  pools: string[];
  loading: boolean;
  error: Error | null;
  retryable: boolean;
  fetch: () => Promise<void>;
  reset: () => void;
}

export function useResourcePools({
  clusterId,
  timeout = 10000,
}: UseResourcePoolsOptions = {}): UseResourcePoolsResult {
  const [pools, setPools] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryable, setRetryable] = useState(true);

  const cancelledRef = useRef(false);
  const fetchRef = useRef(0);

  const doFetch = useCallback(async () => {
    if (!clusterId) {
      setPools([]);
      setLoading(false);
      setError(null);
      return;
    }

    cancelledRef.current = false;
    fetchRef.current += 1;
    const currentFetch = fetchRef.current;

    setLoading(true);
    setError(null);

    const url = `${API_BASE_URL}/vcenter-data/resource-pools?cluster=${encodeURIComponent(clusterId)}`;
    const token = localStorage.getItem('token');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await window.fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        credentials: 'same-origin',
      });

      clearTimeout(timeoutId);

      if (cancelledRef.current || currentFetch !== fetchRef.current) {
        return;
      }

      if (response.status === 401) {
        setError(new Error('Unauthorized - Please log in again'));
        setRetryable(false);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const data = await response.json();
          if (data.error) errorMessage = data.error;
        } catch {
        }
        setError(new Error(errorMessage));
        setRetryable(response.status >= 500);
        setLoading(false);
        return;
      }

      const data: { resource_pools: ResourcePoolInfo[] } = await response.json();

      if (cancelledRef.current || currentFetch !== fetchRef.current) {
        return;
      }

      const poolNames = data.resource_pools?.map((rp) => rp.name) || [];
      setPools(poolNames);
      setLoading(false);
      setError(null);
    } catch (err: any) {
      if (cancelledRef.current || currentFetch !== fetchRef.current) {
        return;
      }

      if (err.name === 'AbortError') {
        setError(new Error('Request timeout'));
        setRetryable(true);
      } else {
        setError(new Error(err.message || 'Network error'));
        setRetryable(true);
      }
      setLoading(false);
    }
  }, [clusterId, timeout]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    setPools([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    pools,
    loading,
    error,
    retryable,
    fetch: doFetch,
    reset,
  };
}
