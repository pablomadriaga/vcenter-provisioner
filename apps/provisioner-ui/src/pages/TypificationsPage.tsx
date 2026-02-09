import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { PageLayout, Card, Button, FormGroup, Input } from '../components'
import { useToast } from '../components/Toast'
import { getTypificationErrors, TypificationFormData } from '../utils/schemas'
import { useApiErrorHandler } from '../utils/errorHandler'

interface Typification {
  id: number
  name: string
  prefijo1: string
  prefijo2: string
  seq_digits: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

function TypificationsPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { handleFormError } = useApiErrorHandler()
  const [typifications, setTypifications] = useState<Typification[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTypification, setEditingTypification] = useState<Typification | null>(null)
  const [formData, setFormData] = useState<TypificationFormData>({
    name: '',
    prefijo1: '',
    prefijo2: '',
    seq_digits: 1
  })
  const [editReason, setEditReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TypificationFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return
    }
    fetchTypifications()
  }, [navigate])

  const verifyAuth = () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return false
    }
    return true
  }

  const fetchTypifications = async () => {
    try {
      setLoading(true)
      const data: Typification[] = await api.get('/typing/templates')
      setTypifications(data)
    } catch (err) {
      showError('Failed to load', 'Unable to fetch typifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof TypificationFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = e.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!verifyAuth()) {
      return
    }

    const errors = getTypificationErrors(formData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)

    try {
      if (editingTypification) {
        await api.put(`/typing/templates/${editingTypification.id}`, {
          ...formData,
          edit_reason: editReason
        })
        success('Updated!', 'Typification has been updated successfully.')
      } else {
        await api.post('/typing/templates', formData)
        success('Created!', 'New typification has been created.')
      }

      setShowCreateForm(false)
      setEditingTypification(null)
      setEditReason('')
      setFormData({ name: '', prefijo1: '', prefijo2: '', seq_digits: 1 })
      fetchTypifications()
    } catch (err) {
      const errors = handleFormError(err)
      if (errors._form) {
        setFieldErrors({ name: errors._form })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (typification: Typification) => {
    setEditingTypification(typification)
    setFormData({
      name: typification.name,
      prefijo1: typification.prefijo1,
      prefijo2: typification.prefijo2,
      seq_digits: typification.seq_digits
    })
    setShowCreateForm(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleGoHome = () => {
    navigate('/dashboard')
  }

  const previewName = () => {
    if (formData.prefijo1 && formData.prefijo2) {
      const seqStr = '1'.padStart(formData.seq_digits, '0')
      return `${formData.prefijo1}-${formData.prefijo2}-{MANUAL}-${seqStr}`
    }
    return '...'
  }

  return (
    <PageLayout
      headerProps={{
        onLogout: handleLogout,
        title: 'vCenter Provisioner - Typifications'
      }}
    >
      {showCreateForm && (
        <Card className="mb-6">
          <Card.Header
            title={editingTypification ? 'Edit Typification' : 'Create New Typification'}
          />

          <form onSubmit={handleSubmit}>
            <FormGroup label="Name" required error={fieldErrors.name}>
              <Input
                value={formData.name}
                onChange={handleInputChange('name')}
                placeholder="e.g., tp-haki"
                disabled={isSubmitting}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              />
              {fieldErrors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </FormGroup>

            <FormGroup label="Prefix 1" required error={fieldErrors.prefijo1}>
              <Input
                value={formData.prefijo1}
                onChange={handleInputChange('prefijo1')}
                placeholder="e.g., pre1"
                disabled={isSubmitting}
                maxLength={20}
                aria-describedby={fieldErrors.prefijo1 ? 'prefix1-error' : 'prefix1-hint'}
              />
              <p id="prefix1-hint" className="mt-1 text-xs text-gray-500">
                Letters and numbers only
              </p>
              {fieldErrors.prefijo1 && (
                <p id="prefix1-error" className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.prefijo1}
                </p>
              )}
            </FormGroup>

            <FormGroup label="Prefix 2" required error={fieldErrors.prefijo2}>
              <Input
                value={formData.prefijo2}
                onChange={handleInputChange('prefijo2')}
                placeholder="e.g., prefijo2"
                disabled={isSubmitting}
                maxLength={20}
                aria-describedby={fieldErrors.prefijo2 ? 'prefix2-error' : 'prefix2-hint'}
              />
              <p id="prefix2-hint" className="mt-1 text-xs text-gray-500">
                Letters and numbers only
              </p>
              {fieldErrors.prefijo2 && (
                <p id="prefix2-error" className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.prefijo2}
                </p>
              )}
            </FormGroup>

            <FormGroup label="Sequence Digits" error={fieldErrors.seq_digits}>
              <select
                value={formData.seq_digits}
                onChange={handleInputChange('seq_digits')}
                disabled={isSubmitting}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-describedby={fieldErrors.seq_digits ? 'seq-error' : undefined}
              >
                <option value={1}>1 digit</option>
                <option value={2}>2 digits</option>
                <option value={3}>3 digits</option>
                <option value={4}>4 digits</option>
                <option value={5}>5 digits</option>
                <option value={6}>6 digits</option>
              </select>
              {fieldErrors.seq_digits && (
                <p id="seq-error" className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.seq_digits}
                </p>
              )}
            </FormGroup>

            {editingTypification && (
              <FormGroup label="Edit Reason (required)" required error={!editReason.trim() ? 'Reason is required' : undefined}>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Please provide a reason for editing this typification..."
                  disabled={isSubmitting}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  aria-required="true"
                />
              </FormGroup>
            )}

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-gray-900">
              <strong>Preview:</strong> {previewName()}
            </div>

            <div className="flex space-x-3">
              <Button type="submit" loading={isSubmitting} fullWidth>
                {isSubmitting ? 'Saving...' : (editingTypification ? 'Update' : 'Create')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreateForm(false)
                  setEditingTypification(null)
                  setEditReason('')
                  setFormData({ name: '', prefijo1: '', prefijo2: '', seq_digits: 1 })
                  setFieldErrors({})
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Typifications List</h2>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="small"
              onClick={handleGoHome}
            >
              🏠 Home
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={() => {
                setShowCreateForm(true)
                setFieldErrors({})
              }}
            >
              + New Typification
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4" role="status" aria-label="Loading typifications">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : typifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No typifications yet</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first typification</p>
            <Button
              variant="primary"
              onClick={() => {
                setShowCreateForm(true)
                setFieldErrors({})
              }}
            >
              Create Typification
            </Button>
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-label="Typifications">
            {typifications.map(typification => (
              <div
                key={typification.id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                role="listitem"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{typification.name}</h3>
                    <div className="text-sm text-gray-600 mt-1">
                      <strong>Pattern:</strong> <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">{typification.prefijo1}-{typification.prefijo2}-{'{MANUAL}'}-{''.padStart(typification.seq_digits, '0')}</code>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Created: {new Date(typification.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleEdit(typification)}
                    aria-label={`Edit ${typification.name}`}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  )
}

export default TypificationsPage
