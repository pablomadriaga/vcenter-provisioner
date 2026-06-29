import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { PageLayout, Card, Button, FormGroup, Input, Modal } from '../components'
import { useToast } from '../components/Toast'
import { DashboardWidgets } from '../components/Stats'

interface Typification {
  id: number
  name: string
  prefijo1: string
  prefijo2: string
  seq_digits: number
}

interface VMTemplate {
  id: string
  name: string
  description: string
  cpu_cores: number
  memory_mb: number
  storage_gb: number
}

interface VCenterConnection {
  id: number
  name: string
  url: string
  connection_type: 'token' | 'basic'
  is_active: boolean
  default_datacenter: string | null
  default_cluster: string | null
}

interface CreateVMFormData {
  description: string
  typificationId: string
  manualValue: string
  templateId: string
  vcenterId: string
  cpu: number
  memory: number
  disk: number
  quantity: number
}

function DashboardPage() {
  const navigate = useNavigate()
  const { success: showSuccess, error: showError, warning: showWarning } = useToast()
  const [typifications, setTypifications] = useState<Typification[]>([])
  const [vmTemplates, setVmTemplates] = useState<VMTemplate[]>([])
  const [vcenters, setVcenters] = useState<VCenterConnection[]>([])
  const [namePreview, setNamePreview] = useState('')
  const [vmNameList, setVmNameList] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [formData, setFormData] = useState<CreateVMFormData>({
    description: '',
    typificationId: '',
    manualValue: '',
    templateId: '',
    vcenterId: '',
    cpu: 2,
    memory: 4096,
    disk: 100,
    quantity: 1
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateVMFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadingVcenters, setLoadingVcenters] = useState(true)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return
    }
    fetchTypifications()
    fetchTemplates()
    fetchVcenters()
  }, [navigate])

  const fetchTypifications = async () => {
    try {
      setLoading(true)
      const data: Typification[] = await api.get('/typing/templates')
      setTypifications(data)
    } catch (err) {
      showError('Failed to load', 'Unable to fetch typifications')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const data: VMTemplate[] = await api.get('/vm-classes')
      setVmTemplates(data)
    } catch (err) {
      showError('Failed to load', 'Unable to fetch VM templates')
    } finally {
      setLoadingTemplates(false)
    }
  }

  const fetchVcenters = async () => {
    try {
      const data: VCenterConnection[] = await api.get('/api/vcenters')
      setVcenters(data)
      if (data.length > 0 && !formData.vcenterId) {
        setFormData(prev => ({ ...prev, vcenterId: data[0].id.toString() }))
      }
    } catch (err) {
      showError('Failed to load', 'Unable to fetch vCenter connections')
    } finally {
      setLoadingVcenters(false)
    }
  }

  const handleInputChange = (field: keyof CreateVMFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    let value: string | number = e.target.value

    if (field === 'cpu' || field === 'memory' || field === 'disk') {
      value = parseInt(value, 10) || 0
    }

    setFormData(prev => ({ ...prev, [field]: value }))
    setFieldErrors(prev => ({ ...prev, [field]: undefined }))
    setPreviewError(null)

    if (field === 'typificationId' || field === 'manualValue') {
      updateNamePreview()
    }
  }

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    setFormData(prev => ({ ...prev, quantity: Math.min(Math.max(value || 1, 1), 50) }))
    setFieldErrors(prev => ({ ...prev, quantity: undefined }))
  }

  const updateNamePreview = async () => {
    if (formData.typificationId && formData.manualValue) {
      if (!/^[a-zA-Z0-9]+$/.test(formData.manualValue)) {
        setPreviewError('Only letters and numbers allowed')
        setNamePreview('')
        return
      }

      try {
        const response: { full_name: string } = await api.post(
          `/typing/generate-name/${formData.typificationId}`,
          { manual_value: formData.manualValue }
        )
        setNamePreview(response.full_name)
        setPreviewError(null)
      } catch (err: any) {
        const errorDetail = err.response?.data?.detail || err.message || 'Unknown error'
        setPreviewError(errorDetail)
        setNamePreview('')
      }
    } else {
      setNamePreview('')
      setPreviewError(null)
    }
  }

  const generateVMNameList = async () => {
    setGeneratingPreview(true)
    setPreviewError(null)
    const names: string[] = []

    try {
      for (let i = 0; i < formData.quantity; i++) {
        const response: { full_name: string } = await api.post(
          `/typing/generate-name/${formData.typificationId}`,
          { manual_value: formData.manualValue }
        )
        names.push(response.full_name)
      }
      setVmNameList(names)
      if (names.length > 0) {
        setShowConfirmModal(true)
      }
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || err.message || 'Unknown error'
      setPreviewError(errorDetail)
      showError('Preview failed', errorDetail)
    } finally {
      setGeneratingPreview(false)
    }
  }

  const handleOpenConfirmation = async () => {
    setPreviewError(null)
    await generateVMNameList()
  }

  const handleCloseConfirmation = () => {
    setShowConfirmModal(false)
    setVmNameList([])
  }

  const handleConfirmSubmit = async () => {
    setShowConfirmModal(false)
    setIsSubmitting(true)

    try {
      const results: string[] = []
      const errors: string[] = []

      for (let i = 0; i < formData.quantity; i++) {
        try {
          const payload: any = {
            template_id: parseInt(formData.templateId),
            manual_value: formData.manualValue,
            vcenter_connection_id: parseInt(formData.vcenterId),
          }

          const selectedVcenter = vcenters.find(v => v.id.toString() === formData.vcenterId)
          if (selectedVcenter?.default_datacenter) {
            payload.vcenter_datacenter = selectedVcenter.default_datacenter
          }
          if (selectedVcenter?.default_cluster) {
            payload.vcenter_cluster = selectedVcenter.default_cluster
          }
          if (formData.templateId) {
            payload.specs = {
              cpu: formData.cpu,
              ram: formData.memory,
              storage: formData.disk
            }
          }

          await api.post('/provision/provision', payload)
          results.push(vmNameList[i] || `VM-${i + 1}`)
        } catch (err: any) {
          errors.push(`VM #${i + 1}: ${err.message || 'Failed'}`)
        }
      }

      if (errors.length === 0) {
        showSuccess('VMs Created!', `Successfully created ${formData.quantity} VM(s)`)
      } else if (results.length === 0) {
        showError('Creation failed', `All ${formData.quantity} VMs failed: ${errors.join(', ')}`)
      } else {
        showWarning('Partial success', `Created ${results.length} of ${formData.quantity}. ${errors.length} failed.`)
      }

      setFormData({
        description: '',
        typificationId: '',
        manualValue: '',
        templateId: '',
        vcenterId: vcenters.length > 0 ? vcenters[0].id.toString() : '',
        cpu: 2,
        memory: 4096,
        disk: 100,
        quantity: 1
      })
      setNamePreview('')
      setVmNameList([])
      setPreviewError(null)
    } catch (err) {
      showError('Failed', 'An unexpected error occurred while creating VMs')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handleGoTypifications = () => {
    navigate('/typifications')
  }

  const handleGoVMClasses = () => {
    navigate('/vm-classes')
  }

  const selectedTypification = typifications.find(t => t.id.toString() === formData.typificationId)
  const selectedTemplate = vmTemplates.find(t => t.id === formData.templateId)

  return (
    <PageLayout
      headerProps={{
        onLogout: handleLogout,
        title: 'vCenter Provisioner - Dashboard'
      }}
    >
      <div className="mb-6">
        <DashboardWidgets />
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={handleCloseConfirmation}
        title="Confirm VM Creation"
        size="large"
      >
        {previewError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600" role="alert">{previewError}</p>
          </div>
        )}

        {!previewError && (
          <>
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">VM Class Specs</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div><strong>Class:</strong> {selectedTemplate?.name}</div>
                <div><strong>Specs:</strong> {selectedTemplate?.cpu_cores}CPU, {selectedTemplate?.memory_mb}MB, {selectedTemplate?.storage_gb}GB</div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-3">VM Names to be created</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {vmNameList.map((name, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm"
                  >
                    {index + 1}. {name}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={handleCloseConfirmation}
            disabled={generatingPreview}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmSubmit}
            disabled={generatingPreview || vmNameList.length === 0}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : `Confirm & Create ${formData.quantity} VM(s)`}
          </Button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header
            title="Create New VM"
            subtitle="Configure and provision new virtual machines"
            action={
              <div className="flex space-x-2">
                <Button variant="secondary" size="small" onClick={handleGoTypifications}>
                  Typifications
                </Button>
                <Button variant="secondary" size="small" onClick={handleGoVMClasses}>
                  VM Classes
                </Button>
              </div>
            }
          />

          <form onSubmit={(e) => { e.preventDefault(); handleOpenConfirmation(); }}>
            <FormGroup label="Number of VMs to Create">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="vm-quantity" className="sr-only">Number of VMs</label>
                  <span className="text-lg font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {formData.quantity}
                  </span>
                </div>
                <input
                  id="vm-quantity"
                  type="range"
                  min="1"
                  max="50"
                  value={formData.quantity}
                  onChange={handleQuantityChange}
                  disabled={loading || isSubmitting}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                </div>
              </div>
            </FormGroup>

            <FormGroup label="Typification" required error={fieldErrors.typificationId}>
              <select
                id="vm-typification"
                value={formData.typificationId}
                onChange={handleInputChange('typificationId')}
                disabled={loading || loadingTemplates}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a typification</option>
                {typifications.map(typ => (
                  <option key={typ.id} value={typ.id}>
                    {typ.name} ({typ.prefijo1}-{typ.prefijo2}-{'{MANUAL}'}-{typ.seq_digits} digits)
                  </option>
                ))}
              </select>
            </FormGroup>

            {formData.typificationId && (
              <FormGroup label="Manual Value" required error={fieldErrors.manualValue}>
                <Input
                  id="vm-manual"
                  type="text"
                  value={formData.manualValue}
                  onChange={handleInputChange('manualValue')}
                  placeholder="Enter manual value (letters and numbers only)"
                  disabled={loading || isSubmitting}
                  autoComplete="off"
                  aria-describedby="pattern-hint"
                />
                <p id="pattern-hint" className="mt-1 text-xs text-gray-500">
                  Pattern: <code className="bg-gray-100 px-1 rounded">{selectedTypification?.prefijo1}-{selectedTypification?.prefijo2}-{'{MANUAL}'}-{''.padStart(selectedTypification?.seq_digits || 1, '0')}</code>
                </p>
              </FormGroup>
            )}

            <FormGroup label="VM Class" required error={fieldErrors.templateId}>
              <select
                id="vm-template"
                value={formData.templateId}
                onChange={handleInputChange('templateId')}
                disabled={loadingTemplates}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a VM Class</option>
                {vmTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.cpu_cores}CPU, {template.memory_mb}MB, {template.storage_gb}GB)
                  </option>
                ))}
              </select>
            </FormGroup>

            <FormGroup label="vCenter Connection" required>
              <select
                id="vcenter-connection"
                value={formData.vcenterId}
                onChange={handleInputChange('vcenterId')}
                disabled={loadingVcenters}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {loadingVcenters ? (
                  <option value="">Loading vCenters...</option>
                ) : vcenters.length === 0 ? (
                  <option value="">No vCenters configured</option>
                ) : (
                  vcenters.map(vcenter => (
                    <option key={vcenter.id} value={vcenter.id}>
                      {vcenter.name} ({vcenter.url}) {vcenter.is_active ? '✓' : '✗'}
                    </option>
                  ))
                )}
              </select>
              {vcenters.length === 0 && !loadingVcenters && (
                <p className="mt-1 text-xs text-amber-600">
                  No vCenter connections configured.{' '}
                  <a href="/vcenters" className="underline">Add a vCenter connection</a>
                </p>
              )}
            </FormGroup>

            {formData.templateId && selectedTemplate && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Selected Template Details</h4>
                <div className="grid grid-cols-4 gap-4 text-sm text-gray-600">
                  <div><strong>Name:</strong> {selectedTemplate.name}</div>
                <div><strong>Specs:</strong> {selectedTemplate.cpu_cores}CPU, {selectedTemplate.memory_mb}MB, {selectedTemplate.storage_gb}GB</div>
                </div>
              </div>
            )}

            {previewError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600" role="alert">{previewError}</p>
              </div>
            )}

            {namePreview && !previewError && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <label className="block text-sm font-medium text-indigo-900 mb-2">VM Name Preview</label>
                <div className="font-mono text-lg text-indigo-700">{namePreview}</div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleOpenConfirmation}
                disabled={loading || isSubmitting || !formData.typificationId || !formData.manualValue || !formData.templateId}
                loading={generatingPreview}
              >
                Preview Name
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || isSubmitting || vmNameList.length === 0 || !formData.typificationId || !formData.templateId}
                loading={loading}
              >
                {loading ? 'Please wait...' : 'Create VM(s)'}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <Card.Header title="VM Name Preview" />

          {loadingTemplates ? (
            <div className="space-y-4" role="status" aria-label="Loading templates">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : !formData.typificationId || !formData.templateId ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select options to preview</h3>
              <p className="text-gray-500">Choose a typification and template to preview VM names</p>
            </div>
          ) : !formData.manualValue ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Enter manual value</h3>
              <p className="text-gray-500">Type a manual value to see VM name preview</p>
            </div>
          ) : previewError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600" role="alert">{previewError}</p>
            </div>
          ) : vmNameList.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Preview not generated</h3>
              <p className="text-gray-500 mb-4">Click "Preview Name" to see VM names</p>
              <Button
                variant="primary"
                onClick={handleOpenConfirmation}
                disabled={!formData.typificationId || !formData.manualValue || !formData.templateId}
              >
                Preview Name
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">VM Class Specs</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div><strong>Class:</strong> {selectedTemplate?.name}</div>
                  <div><strong>Specs:</strong> {selectedTemplate?.cpu_cores}CPU, {selectedTemplate?.memory_mb}MB, {selectedTemplate?.storage_gb}GB</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">VM Names to be created</h4>
                <div className="space-y-2">
                  {vmNameList.map((name, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-gray-700"
                    >
                      {index + 1}. {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  )
}

export default DashboardPage
