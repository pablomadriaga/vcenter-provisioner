import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react'
import { api } from '../utils/api'

interface User {
  id: number
  username: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, user: User, refreshToken?: string) => void
  logout: () => Promise<void>
  checkAuth: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (token) {
      checkSession()
    } else {
      setIsLoading(false)
    }
  }, [])

  const checkSession = useCallback(async () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    try {
      const data = await api.get<{ user: User; token?: string }>('/auth/me')
      setUser(data.user)
      setToken(data.token || storedToken)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback((newToken: string, newUser: User, refreshToken?: string) => {
    localStorage.setItem('token', newToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      setToken(null)
      setUser(null)
    }
  }, [])

  const checkAuth = useCallback((): boolean => {
    return !!user && !!token
  }, [user, token])

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    checkAuth
  }), [user, token, isLoading, login, logout, checkAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { AuthContext }
