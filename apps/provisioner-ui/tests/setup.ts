import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('../src/utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  setOnUnauthorizedCallback: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    isUnauthorized: boolean
    isNetworkError: boolean
    constructor(message: string, status: number, isUnauthorized = false, isNetworkError = false) {
      super(message)
      this.status = status
      this.isUnauthorized = isUnauthorized
      this.isNetworkError = isNetworkError
    }
  },
}))
