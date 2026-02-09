import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { PageLayout, Card, Button, FormGroup, Input, Modal } from '../components'
import { useToast } from '../components/Toast'
import { getVMClassErrors, VMClassFormData } from '../utils/schemas'
import { useApiErrorHandler } from '../utils/errorHandler'

interface VMClass {
  id: number
  name: string
  description: string
  cpu_cores: number
  memory_mb: number
  storage_gb: number
  cpu_reservation_percent?: number
  memory_reservation_percent?: number
  provisioning_type: string
  storage_policy: string
  is_locked: boolean
  is_active: boolean
}

function VMClassesPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const { handleFormError } = useApiErrorHandler()
  const [vmClasses, setVmClasses] = useState<VMClass[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingVmClass, setEditingVmClass] = useState<VMClass | null>(null)
  const [formData, setFormData] = useState<VMClassFormData>({
    name: '',
    description: '',
    cpu_cores: 4,
    memory_mb: 8192,
    storage_gb: 200,
    cpu_reservation_percent: 0,
    memory_reservation_percent: 0,
    provisioning_type: 'thin',
    storage_policy: ''
  })
  const [editReason, setEditReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof VMClassFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return
    }
    fetchVmClasses()
  }, [navigate])

  const verifyAuth = () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return false
    }
    return true
  }

  const fetchVmClasses = async () => {
    try {
      setLoading(true)
      const data: VMClass[] = await api.get('/api/vm-classes')
      setVmClasses(data)
    } catch (err) {
      showError('Failed to load', 'Unable to fetch VM classes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof VMClassFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!verifyAuth()) {
      return
    }

    const errors = getVMClassErrors(formData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)

    try {
      if (editingVmClass) {
        await api.put(`/api/typing/vm-classes/${editingVmClass.id}`, {
          ...formData,
          edit_reason: editReason
        })
        success('Updated!', 'VM class has been updated successfully.')
      } else {
        await api.post('/api/typing/vm-classes', formData)
        success('Created!', 'New VM class has been created.')
      }

      setShowCreateForm(false)
      setEditingVmClass(null)
      setEditReason('')
      setFormData({
        name: '',
        description: '',
        cpu_cores: 4,
        memory_mb: 8192,
        storage_gb: 200,
        cpu_reservation_percent: 0,
        memory_reservation_percent: 0,
        provisioning_type: 'thin',
        storage_policy: ''
      })
      fetchVmClasses()
    } catch (err) {
      const apiErrors = handleFormError(err)
      if (apiErrors._form) {
        setFieldErrors({ name: apiErrors._form })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (vmClass: VMClass) => {
    setEditingVmClass(vmClass)
    setFormData({
      name: vmClass.name,
      description: vmClass.description,
      cpu_cores: vmClass.cpu_cores,
      memory_mb: vmClass.memory_mb,
      storage_gb: vmClass.storage_gb,
      cpu_reservation_percent: vmClass.cpu_reservation_percent || 0,
      memory_reservation_percent: vmClass.memory_reservation_percent || 0,
      provisioning_type: vmClass.provisioning_type as 'thick' | 'thin',
      storage_policy: vmClass.storage_policy
    })
    setShowCreateForm(true)
  }

  const handleDelete = async (id: number, name: string) => {
    if (!verifyAuth()) return

    if (!confirm(`Are you sure you want to delete "${name}"?`)) return

    setLoading(true)
    try {
      await api.delete(`/api/typing/vm-classes/${id}`)
      success('Deleted!', `"${name}" has been deleted.`)
      fetchVmClasses()
    } catch (err) {
      handleFormError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLock = async (id: number, name: string) => {
    if (!verifyAuth()) return

    try {
      await api.post(`/api/typing/vm-classes/${id}/lock`)
      success('Locked!', `"${name}" has been locked.`)
      fetchVmClasses()
    } catch (err) {
      handleFormError(err)
    }
  }

  const handleUnlock = async (id: number, name: string) => {
    if (!verifyAuth()) return

    try {
      await api.post(`/api/typing/vm-classes/${id}/unlock`)
      success('Unlocked!', `"${name}" has been unlocked.`)
      fetchVmClasses()
    } catch (err) {
      handleFormError(err)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleGoHome = () => {
    navigate('/dashboard')
  }

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(0)} GB`
    }
    return `${mb} MB`
  }

  const filteredClasses = vmClasses.filter(vmClass =>
    vmClass.name.toLowerCase().includes(filter.toLowerCase()) ||
    vmClass.description.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <PageLayout
      headerProps={{
        onLogout: handleLogout,
        title: 'vCenter Provisioner - VM Classes'
      }}
    >
      {showCreateForm && (
        <Modal
          isOpen={showCreateForm}
          onClose={() => {
            setShowCreateForm(false)
            setEditingVmClass(null)
            setEditReason('')
            setFormData({
              name: '',
              description: '',
              cpu_cores: 4,
              memory_mb: 8192,
              storage_gb: 200,
              cpu_reservation_percent: 0,
              memory_reservation_percent: 0,
              provisioning_type: 'thin',
              storage_policy: ''
            })
            setFieldErrors({})
          }}
          title={editingVmClass ? 'Edit VM Class' : 'Create New VM Class'}
          size="large"
        >
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormGroup label="Name" required error={fieldErrors.name}>
                <Input
                  value={formData.name}
                  onChange={handleInputChange('name')}
                  placeholder="e.g., Gold, Silver, Bronze"
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                />
                {fieldErrors.name && (
                  <p id="name-error" className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </FormGroup>

              <FormGroup label="Storage Policy" error={fieldErrors.storage_policy}>
                <Input
                  value={formData.storage_policy}
                  onChange={handleInputChange('storage_policy')}
                  placeholder="e.g., Gold-Policy"
                  disabled={isSubmitting}
                  maxLength={100}
                />
              </FormGroup>
            </div>

            <FormGroup label="Description" required error={fieldErrors.description}>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the use case for this VM class..."
                disabled={isSubmitting}
                rows={2}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-describedby={fieldErrors.description ? 'desc-error' : 'desc-hint'}
              />
              <p id="desc-hint" className="mt-1 text-xs text-gray-500">
                Minimum 10 characters
              </p>
              {fieldErrors.description && (
                <p id="desc-error" className="mt-1 text-sm text-red-600" role="alert">
                  {fieldErrors.description}
                </p>
              )}
            </FormGroup>

            <div className="grid grid-cols-3 gap-4">
              <FormGroup label="CPU Cores" error={fieldErrors.cpu_cores}>
                <Input
                  type="number"
                  value={formData.cpu_cores}
                  onChange={handleInputChange('cpu_cores')}
                  min={1}
                  max={256}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.cpu_cores ? 'cpu-error' : undefined}
                />
                {fieldErrors.cpu_cores && (
                  <p id="cpu-error" className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.cpu_cores}
                  </p>
                )}
              </FormGroup>

              <FormGroup label="Memory (MB)" error={fieldErrors.memory_mb}>
                <Input
                  type="number"
                  value={formData.memory_mb}
                  onChange={handleInputChange('memory_mb')}
                  min={512}
                  step={512}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.memory_mb ? 'mem-error' : undefined}
                />
                {fieldErrors.memory_mb && (
                  <p id="mem-error" className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.memory_mb}
                  </p>
                )}
              </FormGroup>

              <FormGroup label="Storage (GB)" error={fieldErrors.storage_gb}>
                <Input
                  type="number"
                  value={formData.storage_gb}
                  onChange={handleInputChange('storage_gb')}
                  min={1}
                  max={16384}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.storage_gb ? 'storage-error' : undefined}
                />
                {fieldErrors.storage_gb && (
                  <p id="storage-error" className="mt-1 text-sm text-red-600" role="alert">
                    {fieldErrors.storage_gb}
                  </p>
                )}
              </FormGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="CPU Reservation (%)">
                <Input
                  type="number"
                  value={formData.cpu_reservation_percent}
                  onChange={handleInputChange('cpu_reservation_percent')}
                  min={0}
                  max={100}
                  disabled={isSubmitting}
                />
              </FormGroup>

              <FormGroup label="Memory Reservation (%)">
                <Input
                  type="number"
                  value={formData.memory_reservation_percent}
                  onChange={handleInputChange('memory_reservation_percent')}
                  min={0}
                  max={100}
                  disabled={isSubmitting}
                />
              </FormGroup>
            </div>

            <FormGroup label="Provisioning Type" error={fieldErrors.provisioning_type}>
              <select
                value={formData.provisioning_type}
                onChange={handleInputChange('provisioning_type')}
                disabled={isSubmitting}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="thin">Thin</option>
                <option value="thick">Thick</option>
              </select>
            </FormGroup>

            {editingVmClass && (
              <FormGroup label="Edit Reason (required)" required error={!editReason.trim() ? 'Reason is required' : undefined}>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Please provide a reason for editing this VM class..."
                  disabled={isSubmitting}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  aria-required="true"
                />
              </FormGroup>
            )}

            <div className="flex space-x-3 mt-4">
              <Button type="submit" loading={isSubmitting} fullWidth>
                {isSubmitting ? 'Saving...' : (editingVmClass ? 'Update' : 'Create')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">VM Classes List</h2>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex space-x-2">
              <Button variant="secondary" size="small" onClick={handleGoHome}>
                🏠 Home
              </Button>
              <Button
                variant="primary"
                size="small"
                onClick={() => {
                  setShowCreateForm(true)
                  setEditingVmClass(null)
                  setFormData({
                    name: '',
                    description: '',
                    cpu_cores: 4,
                    memory_mb: 8192,
                    storage_gb: 200,
                    cpu_reservation_percent: 0,
                    memory_reservation_percent: 0,
                    provisioning_type: 'thin',
                    storage_policy: ''
                  })
                  setFieldErrors({})
                }}
              >
                + New VM Class
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4" role="status" aria-label="Loading VM classes">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No VM classes yet</h3>
            <p className="text-gray-500 mb-4">Get started by creating your first VM class</p>
            <Button
              variant="primary"
              onClick={() => {
                setShowCreateForm(true)
                setFieldErrors({})
              }}
            >
              Create VM Class
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredClasses.map(vmClass => (
              <div
                key={vmClass.id}
                className={`p-4 border border-gray-200 rounded-lg ${vmClass.is_active ? 'bg-gray-50' : 'bg-gray-100 opacity-60'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">{vmClass.name}</h3>
                      {vmClass.is_locked && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{vmClass.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span><strong>CPU:</strong> {vmClass.cpu_cores} cores</span>
                      <span><strong>RAM:</strong> {formatMemory(vmClass.memory_mb)}</span>
                      <span><strong>Storage:</strong> {vmClass.storage_gb} GB</span>
                      <span><strong>Type:</strong> {vmClass.provisioning_type}</span>
                      {vmClass.cpu_reservation_percent !== undefined && (
                        <span><strong>CPU Res:</strong> {vmClass.cpu_reservation_percent}%</span>
                      )}
                      {vmClass.memory_reservation_percent !== undefined && (
                        <span><strong>Mem Res:</strong> {vmClass.memory_reservation_percent}%</span>
                      )}
                    </div>
                    {vmClass.storage_policy && (
                      <p className="text-xs text-gray-500 mt-2">
                        <strong>Policy:</strong> {vmClass.storage_policy}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!vmClass.is_locked && (
                      <Button variant="secondary" size="small" onClick={() => handleLock(vmClass.id, vmClass.name)}>
                        Lock
                      </Button>
                    )}
                    {vmClass.is_locked && (
                      <Button variant="primary" size="small" onClick={() => handleUnlock(vmClass.id, vmClass.name)}>
                        Unlock
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleEdit(vmClass)}
                      disabled={vmClass.is_locked}
                      aria-label={`Edit ${vmClass.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleDelete(vmClass.id, vmClass.name)}
                      disabled={vmClass.is_locked}
                      aria-label={`Delete ${vmClass.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageLayout>
  )
}

export default VMClassesPage
