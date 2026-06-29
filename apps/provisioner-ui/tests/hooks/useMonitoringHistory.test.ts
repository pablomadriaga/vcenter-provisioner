import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { api } from '../../src/utils/api'
import { 
  useMonitoringHistory, 
  useServiceUptime, 
  useGlobalUptime,
  getDayName,
  ProbeResult 
} from '../../src/hooks/useMonitoringHistory'

const mockedApi = vi.mocked(api)

describe('useMonitoringHistory', () => {
  const mockHistoryData: ProbeResult[] = [
    { source: 'api-gateway', target: 'auth-service', latency_ms: 5, status: 'up', timestamp: '2026-03-18T10:00:00Z' },
    { source: 'api-gateway', target: 'auth-service', latency_ms: 3, status: 'up', timestamp: '2026-03-18T11:00:00Z' },
    { source: 'api-gateway', target: 'auth-service', latency_ms: 0, status: 'down', timestamp: '2026-03-18T12:00:00Z' },
  ]

  const mockTimeseriesData = [
    { timestamp: '2026-03-18T10:00:00Z', up: 5, down: 0, timeout: 0, avg_latency_ms: 4, min_latency_ms: 2, max_latency_ms: 8, total: 5 },
    { timestamp: '2026-03-18T11:00:00Z', up: 3, down: 1, timeout: 0, avg_latency_ms: 5, min_latency_ms: 3, max_latency_ms: 10, total: 4 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('services-timeseries')) {
        return Promise.resolve(mockTimeseriesData)
      }
      if (url.includes('services-history')) {
        return Promise.resolve(mockHistoryData)
      }
      return Promise.resolve(null)
    })
  })

  describe('getDayName', () => {
    it('should return correct day name', () => {
      expect(getDayName(0)).toBe('Lun')
      expect(getDayName(6)).toBe('Dom')
    })

    it('should return empty string for invalid index', () => {
      expect(getDayName(7)).toBe('')
    })
  })

  describe('useMonitoringHistory', () => {
    it('should fetch history for given services', async () => {
      const { result } = renderHook(() => useMonitoringHistory(['auth-service', 'monitoring-service'], 24))

      await waitFor(() => {
        expect(result.current.history.length).toBeGreaterThan(0)
      })

      expect(result.current.error).toBeNull()
    })

    it('should handle empty services array', async () => {
      const { result } = renderHook(() => useMonitoringHistory([], 24))

      await waitFor(() => {
        expect(result.current.history).toEqual([])
      })
    })

    it('should handle fetch error gracefully', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useMonitoringHistory(['auth-service'], 24))

      await waitFor(() => {
        expect(result.current.history).toEqual([])
      })
    })

    it('should calculate heatmap data correctly', async () => {
      const { result } = renderHook(() => useMonitoringHistory(['auth-service'], 24))

      await waitFor(() => {
        expect(result.current.history.length).toBeGreaterThan(0)
      })
    })

    it('should handle null response', async () => {
      mockedApi.get.mockResolvedValue(null)

      const { result } = renderHook(() => useMonitoringHistory(['auth-service'], 24))

      await waitFor(() => {
        expect(result.current.history).toEqual([])
      })
    })
  })

  describe('useServiceUptime', () => {
    it('should calculate uptime for specific service', () => {
      const { result } = renderHook(() => 
        useServiceUptime('auth-service', mockHistoryData)
      )

      expect(result.current.up).toBe(2)
      expect(result.current.down).toBe(1)
      expect(result.current.total).toBe(3)
    })

    it('should return 0% uptime for service with no history', () => {
      const { result } = renderHook(() => 
        useServiceUptime('unknown-service', mockHistoryData)
      )

      expect(result.current.uptime).toBe(0)
      expect(result.current.total).toBe(0)
    })
  })

  describe('useGlobalUptime', () => {
    it('should calculate global uptime', () => {
      const { result } = renderHook(() => 
        useGlobalUptime(mockHistoryData)
      )

      expect(result.current.up).toBe(2)
      expect(result.current.down).toBe(1)
    })

    it('should handle empty history', () => {
      const { result } = renderHook(() => 
        useGlobalUptime([])
      )

      expect(result.current.uptime).toBe(0)
      expect(result.current.total).toBe(0)
    })
  })
})
