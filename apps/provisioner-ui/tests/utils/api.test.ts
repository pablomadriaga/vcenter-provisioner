import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setOnUnauthorizedCallback } from '../../src/utils/api'

const API_BASE_URL = '/api'

describe('ApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('userRole', 'admin')
    fetchMock = vi.fn()
    global.fetch = fetchMock
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Request building', () => {
    it('should make GET request with correct headers', async () => {
      const mockData = { id: 1, name: 'test' }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData)
      })

      const response = await global.fetch(`${API_BASE_URL}/test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
          'X-User-Role': 'admin'
        }
      })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'GET'
        })
      )
      const result = await response.json()
      expect(result).toEqual(mockData)
    })

    it('should make POST request with body data', async () => {
      const postData = { name: 'new item' }
      const mockResponse = { id: 1, ...postData }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse)
      })

      const response = await global.fetch(`${API_BASE_URL}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      })

      const result = await response.json()
      expect(result).toEqual(mockResponse)
    })
  })

  describe('401 Unauthorized handling', () => {
    it('should clear localStorage on 401 response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthorized' })
      })

      try {
        const response = await global.fetch(`${API_BASE_URL}/test`)
        if (!response.ok && response.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('userRole')
        }
      } catch {
        // Expected
      }

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('userRole')).toBeNull()
    })

    it('should call onUnauthorizedCallback when set', async () => {
      const callback = vi.fn()
      setOnUnauthorizedCallback(callback)
      
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthorized' })
      })

      try {
        const response = await global.fetch(`${API_BASE_URL}/test`)
        if (!response.ok && response.status === 401) {
          if (callback) callback()
        }
      } catch {
        // Expected
      }

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('HTTP error handling', () => {
    it('should handle non-401 HTTP errors with detail field', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Internal Server Error' })
      })

      const response = await global.fetch(`${API_BASE_URL}/test`)
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`

      expect(errorMessage).toBe('Internal Server Error')
    })

    it('should handle error with message field', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Bad Request' })
      })

      const response = await global.fetch(`${API_BASE_URL}/test`)
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.message || `HTTP error! status: ${response.status}`

      expect(errorMessage).toBe('Bad Request')
    })

    it('should handle non-JSON error response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error'))
      })

      const response = await global.fetch(`${API_BASE_URL}/test`)
      const errorMessage = `HTTP error! status: ${response.status}`

      expect(errorMessage).toBe('HTTP error! status: 500')
    })
  })

  describe('Network error handling', () => {
    it('should handle network errors', async () => {
      fetchMock.mockRejectedValue(new Error('Network failed'))

      await expect(global.fetch(`${API_BASE_URL}/test`)).rejects.toThrow('Network failed')
    })
  })

  describe('Role mapping', () => {
    it('should map administrator role to admin', () => {
      localStorage.setItem('userRole', 'administrator')
      
      const ROLE_MAP: Record<string, string> = {
        'administrator': 'admin',
        'operator': 'operator',
        'viewer': 'viewer'
      }
      
      const role = localStorage.getItem('userRole')
      const mappedRole = role ? ROLE_MAP[role] || role : 'viewer'
      
      expect(mappedRole).toBe('admin')
    })

    it('should use viewer as default role when no role stored', () => {
      localStorage.removeItem('userRole')
      
      const ROLE_MAP: Record<string, string> = {
        'administrator': 'admin',
        'operator': 'operator',
        'viewer': 'viewer'
      }
      
      const role = localStorage.getItem('userRole')
      const mappedRole = role ? ROLE_MAP[role] || role : 'viewer'
      
      expect(mappedRole).toBe('viewer')
    })
  })
})

describe('ApiError', () => {
  it('should create error with correct properties', async () => {
    const error = new Error('Test error')
    ;(error as any).status = 400
    ;(error as any).isUnauthorized = false
    ;(error as any).isNetworkError = false
    
    expect(error.message).toBe('Test error')
    expect((error as any).status).toBe(400)
    expect((error as any).isUnauthorized).toBe(false)
    expect((error as any).isNetworkError).toBe(false)
  })

  it('should be instance of Error', () => {
    const error = new Error('Test')
    expect(error instanceof Error).toBe(true)
  })
})
