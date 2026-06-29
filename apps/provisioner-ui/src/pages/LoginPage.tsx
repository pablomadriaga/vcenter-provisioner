import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { Card, Button, Input } from '../components'
import { useToast } from '../components/Toast'

interface LoginFormData {
  username: string
  password: string
}

function LoginPage() {
  const navigate = useNavigate()
  const { error: showError } = useToast()
  const [formData, setFormData] = useState<LoginFormData>({ username: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({})
  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: keyof LoginFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }))
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    const errors: Partial<Record<keyof LoginFormData, string>> = {}
    if (!formData.username.trim()) {
      errors.username = 'Username is required'
    }
    if (!formData.password) {
      errors.password = 'Password is required'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    try {
      const response: { token: string; user: { id: number; username: string; role: string } } = await api.post('/auth/login', formData)
      localStorage.setItem('token', response.token)
      localStorage.setItem('userRole', response.user.role)
      navigate('/dashboard')
    } catch (err) {
      showError('Login Failed', 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md" padding="large">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">vCenter Provisioner</h1>
          <p className="text-gray-500 mt-2">Sign in to manage your VMs</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            <Input
              id="username"
              type="text"
              label="Username"
              value={formData.username}
              onChange={handleInputChange('username')}
              placeholder="Enter your username"
              disabled={loading}
              autoComplete="username"
              error={fieldErrors.username}
              required
            />

            <Input
              id="password"
              type="password"
              label="Password"
              value={formData.password}
              onChange={handleInputChange('password')}
              placeholder="Enter your password"
              disabled={loading}
              autoComplete="current-password"
              error={fieldErrors.password}
              required
            />

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              fullWidth
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 text-center">
            <span className="font-medium">Demo Credentials:</span>
            <br />
            <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">admin / password123</code>
          </p>
        </div>
      </Card>
    </div>
  )
}

export default LoginPage
