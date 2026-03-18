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
  logout: () => void
  checkAuth: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

const TOKEN_KEY = 'token'
const USER_KEY = 'userRole'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedRole = localStorage.getItem(USER_KEY)
    
    if (storedToken) {
      setToken(storedToken)
      setUser({
        id: 0,
        username: '',
        role: storedRole || 'viewer'
      })
    }
    setIsLoading(false)
  }, [])

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, newUser.role)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const checkAuth = useCallback((): boolean => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    if (!storedToken) {
      return false
    }
    return true
  }, [])

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: !!token,
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
