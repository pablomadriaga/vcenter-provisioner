import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react'

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
  login: (token: string, user: User) => void
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
      const response = await fetch('/auth/me', {
        method: 'GET',
        headers: { Authorization: `Bearer ${storedToken}` }
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setToken(data.token || storedToken)
      } else {
        localStorage.removeItem('token')
        setUser(null)
        setToken(null)
      }
    } catch (err) {
      localStorage.removeItem('token')
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    const storedToken = localStorage.getItem('token')
    try {
      if (storedToken) {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${storedToken}` }
        })
      }
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      localStorage.removeItem('token')
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
