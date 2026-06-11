import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { api } from '../../src/utils/api'

const mockedApi = vi.mocked(api)

const mockServicesResponse = [
  { name: 'api-gateway', status: 'up', latency_ms: 5, last_probe: '2026-03-18T10:00:00Z' },
  { name: 'auth-service', status: 'up', latency_ms: 3, last_probe: '2026-03-18T10:00:00Z' },
  { name: 'monitoring-service', status: 'up', latency_ms: 2, last_probe: '2026-03-18T10:00:00Z' },
]

const mockConnectivityResponse = [
  { source: 'api-gateway', target: 'auth-service', reachable: true, latency_ms: 5, samples: 1, timestamp: '2026-03-18T10:00:00Z' },
  { source: 'api-gateway', target: 'monitoring-service', reachable: true, latency_ms: 3, samples: 1, timestamp: '2026-03-18T10:00:00Z' },
]

import { useServiceMonitor } from '../../src/hooks/useServiceMonitor'

describe('useServiceMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial state', () => {
    it('should return initial state with empty arrays', () => {
      const { result } = renderHook(() => useServiceMonitor(60000, false))
      
      expect(result.current.services).toEqual([])
      expect(result.current.connectivity).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('Data fetching', () => {
    it('should fetch services and connectivity data', async () => {
      mockedApi.get
        .mockResolvedValueOnce(mockServicesResponse)
        .mockResolvedValueOnce(mockConnectivityResponse)

      const { result } = renderHook(() => useServiceMonitor(60000, true))

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServicesResponse)
      }, { timeout: 5000 })

      expect(result.current.connectivity).toEqual(mockConnectivityResponse)
      expect(result.current.error).toBeNull()
    })

    it('should handle null response gracefully', async () => {
      mockedApi.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const { result } = renderHook(() => useServiceMonitor(60000, true))

      await waitFor(() => {
        expect(result.current.services).toEqual([])
      }, { timeout: 5000 })
    })

    it('should call refresh function manually', async () => {
      mockedApi.get
        .mockResolvedValueOnce(mockServicesResponse)
        .mockResolvedValueOnce(mockConnectivityResponse)

      const { result } = renderHook(() => useServiceMonitor(60000, false))

      await act(async () => {
        await result.current.refresh()
      })

      await waitFor(() => {
        expect(result.current.services.length).toBeGreaterThan(0)
      }, { timeout: 5000 })
    })
  })

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockedApi.get.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useServiceMonitor(60000, true))

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      }, { timeout: 5000 })

      expect(result.current.services).toEqual([])
      expect(result.current.connectivity).toEqual([])
    })

    it('should handle non-ok response', async () => {
      mockedApi.get.mockRejectedValue(new Error('Failed to fetch services status: 500'))

      const { result } = renderHook(() => useServiceMonitor(60000, true))

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to fetch services status: 500')
      }, { timeout: 5000 })
    })
  })
})
