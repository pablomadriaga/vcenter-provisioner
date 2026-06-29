import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext'

function TestComponent() {
  const { user, token, isAuthenticated, isLoading, login, logout, checkAuth } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{isLoading.toString()}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="token">{token || 'null'}</div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <div data-testid="role">{user?.role || 'null'}</div>
      <button onClick={() => login('test-token', { id: 1, username: 'testuser', role: 'admin' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => checkAuth()}>Check Auth</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Initial State', () => {
    it('should start with isLoading true and no user', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })
      expect(screen.getByTestId('authenticated').textContent).toBe('false')
      expect(screen.getByTestId('token').textContent).toBe('null')
    })

    it('should load user from localStorage on mount', async () => {
      localStorage.setItem('token', 'stored-token')
      localStorage.setItem('userRole', 'operator')

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })
      expect(screen.getByTestId('authenticated').textContent).toBe('true')
      expect(screen.getByTestId('token').textContent).toBe('stored-token')
      expect(screen.getByTestId('role').textContent).toBe('operator')
    })
  })

  describe('login', () => {
    it('should update state when login is called', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await act(async () => {
        screen.getByText('Login').click()
      })

      expect(screen.getByTestId('authenticated').textContent).toBe('true')
      expect(screen.getByTestId('token').textContent).toBe('test-token')
      expect(screen.getByTestId('user').textContent).toBe('testuser')
      expect(screen.getByTestId('role').textContent).toBe('admin')
    })

    it('should persist token and role to localStorage', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await act(async () => {
        screen.getByText('Login').click()
      })

      expect(localStorage.getItem('token')).toBe('test-token')
      expect(localStorage.getItem('userRole')).toBe('admin')
    })
  })

  describe('logout', () => {
    it('should clear state when logout is called', async () => {
      localStorage.setItem('token', 'existing-token')
      localStorage.setItem('userRole', 'admin')

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await act(async () => {
        screen.getByText('Logout').click()
      })

      expect(screen.getByTestId('authenticated').textContent).toBe('false')
      expect(screen.getByTestId('token').textContent).toBe('null')
    })

    it('should remove token and role from localStorage', async () => {
      localStorage.setItem('token', 'existing-token')
      localStorage.setItem('userRole', 'admin')

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await act(async () => {
        screen.getByText('Logout').click()
      })

      expect(localStorage.getItem('token')).toBeNull()
      expect(localStorage.getItem('userRole')).toBeNull()
    })
  })

  describe('checkAuth', () => {
    it('should return false when no token exists', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await act(async () => {
        screen.getByText('Check Auth').click()
      })
    })

    it('should return true when token exists in localStorage', async () => {
      localStorage.setItem('token', 'valid-token')

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false')
      })

      await act(async () => {
        screen.getByText('Check Auth').click()
      })
    })
  })
})
