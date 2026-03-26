import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { PageLayout, Card, Button, FormGroup, Input, Modal } from '../components'
import { useToast } from '../components/Toast'
import { DashboardWidgets } from '../components/Stats'
import { useAuth } from '../contexts/AuthContext'
import { ResourcePoolSelector, useStoragePolicies } from '../components/vcenter'

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

interface ProvisionRequestPayload {
  template_id: number
  manual_value: string
  vcenter_connection_id: number
  vcenter_datacenter?: string
  vcenter_cluster?: string
  vcenter_resource_pool?: string
  storage_policy?: string
  vm_class_id?: number
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
  vcenterId: string
  datacenter: string
  cluster: string
  resourcePool: string
  storagePolicy: string
  vmClassId: string
  quantity: number
}

function DashboardPage() {
  const navigate = useNavigate()
  const { checkAuth, isLoading: authLoading } = useAuth()
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
    vcenterId: '',
    datacenter: '',
    cluster: '',
    resourcePool: '',
    storagePolicy: '',
    vmClassId: '',
    quantity: 1
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateVMFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadingVcenters, setLoadingVcenters] = useState(true)
  const [generatingPreview, setGeneratingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { policies: storagePolicies, loading: loadingPolicies, fetch: fetchStoragePolicies, reset: resetStoragePolicies } = useStoragePolicies()

  const vcentersRef = useRef<VCenterConnection[]>([])

  useEffect(() => {
    vcentersRef.current = vcenters
  }, [vcenters])

  useEffect(() => {
    if (authLoading) return
    if (!checkAuth()) {
      navigate('/login')
      return
    }
    fetchTypifications()
    fetchTemplates()
    fetchVcenters()
  }, [navigate, checkAuth, authLoading])

  const handleResourcePoolChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, resourcePool: value }))
  }, [])

  const handleVcenterChange = useCallback((vcenterId: string) => {
    const selectedVcenter = vcentersRef.current.find(v => v.id.toString() === vcenterId)
    setFormData(prev => ({
      ...prev,
      vcenterId,
      datacenter: selectedVcenter?.default_datacenter || '',
      cluster: selectedVcenter?.default_cluster || '',
      resourcePool: '',
      storagePolicy: ''
    }))
    if (vcenterId) {
      fetchStoragePolicies(parseInt(vcenterId))
    } else {
      resetStoragePolicies()
    }
  }, [])

  const fetchTypifications = async () => {
    try {
      setLoading(true)
      const data: Typification[] = await api.get('/typing/templates')
      setTypifications(data)
    } catch (err) {
      showError('Error', 'No se pudieron cargar las tipificaciones')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const data: VMTemplate[] = await api.get('/vm-classes')
      setVmTemplates(data)
    } catch (err) {
      showError('Error', 'No se pudieron cargar las clases de VM')
    } finally {
      setLoadingTemplates(false)
    }
  }

  const fetchVcenters = async () => {
    try {
      const data: VCenterConnection[] = await api.get('/vcenters')
      setVcenters(data)
    } catch (err) {
      showError('Error', 'No se pudieron cargar las conexiones vCenter')
    } finally {
      setLoadingVcenters(false)
    }
  }

  const handleInputChange = (field: keyof CreateVMFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = e.target.value

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
        setPreviewError('Solo letras y números permitidos')
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
        const errorDetail = err.response?.data?.detail || err.message || 'Error desconocido'
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
      const errorDetail = err.response?.data?.detail || err.message || 'Error desconocido'
      setPreviewError(errorDetail)
      showError('Error', errorDetail)
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

    console.log('FormData completa:', JSON.stringify(formData, null, 2))
    
    if (!formData.typificationId || !formData.vcenterId) {
      setIsSubmitting(false)
      showError('Error', `Faltan datos requeridos: typificationId="${formData.typificationId}", vcenterId="${formData.vcenterId}"`)
      return
    }
    
    try {
      const results: string[] = []
      const errors: string[] = []

      for (let i = 0; i < formData.quantity; i++) {
        try {
          const templateId = parseInt(formData.typificationId)
          const vcenterId = parseInt(formData.vcenterId)
          const vmClassId = formData.vmClassId ? parseInt(formData.vmClassId) : undefined
          
          console.log(`VM ${i+1}: templateId=${templateId}, vcenterId=${vcenterId}, vmClassId=${vmClassId}`)
          
          const payload: ProvisionRequestPayload = {
            template_id: templateId,
            manual_value: formData.manualValue,
            vcenter_connection_id: vcenterId,
          }

          if (formData.datacenter) {
            payload.vcenter_datacenter = formData.datacenter
          }
          if (formData.cluster) {
            payload.vcenter_cluster = formData.cluster
          }
          if (formData.resourcePool) {
            payload.vcenter_resource_pool = formData.resourcePool
          }
          if (formData.storagePolicy) {
            payload.storage_policy = formData.storagePolicy
          }
          if (vmClassId) {
            payload.vm_class_id = vmClassId
          }

          await api.post('/provision', payload)
          results.push(vmNameList[i] || `VM-${i + 1}`)
        } catch (err: any) {
          errors.push(`VM #${i + 1}: ${err.message || 'Falló'}`)
        }
      }

      if (errors.length === 0) {
        showSuccess('¡VMs Creadas!', `Se crearon ${formData.quantity} VM(s) exitosamente`)
      } else if (results.length === 0) {
        showError('Error', `Fallaron las ${formData.quantity} VMs: ${errors.join(', ')}`)
      } else {
        showWarning('Éxito parcial', `Se crearon ${results.length} de ${formData.quantity}. ${errors.length} fallaron.`)
      }

      setFormData({
        description: '',
        typificationId: '',
        manualValue: '',
        vcenterId: '',
        datacenter: '',
        cluster: '',
        resourcePool: '',
        storagePolicy: '',
        vmClassId: '',
        quantity: 1
      })
      setNamePreview('')
      setVmNameList([])
      setPreviewError(null)
    } catch (err) {
      showError('Error', 'Ocurrió un error inesperado al crear las VMs')
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
  const selectedVMClass = vmTemplates.find(t => t.id.toString() === formData.vmClassId)
  const selectedVcenter = vcenters.find(v => v.id.toString() === formData.vcenterId)

  return (
    <PageLayout
      headerProps={{
        onLogout: handleLogout,
        title: 'vCenter Provisioner - Crear Nueva VM'
      }}
    >
      <div className="mb-6">
        <DashboardWidgets />
      </div>

      <Modal
        isOpen={showConfirmModal}
        onClose={handleCloseConfirmation}
        title="Confirmar Creación de VMs"
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
              <h4 className="font-medium text-gray-900 mb-3">Especificaciones de la Clase de VM</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                <div><strong>Clase:</strong> {selectedVMClass?.name}</div>
                <div><strong>Specs:</strong> {selectedVMClass?.cpu_cores}CPU, {selectedVMClass?.memory_mb}MB, {selectedVMClass?.storage_gb}GB</div>
                {selectedVcenter && (
                  <>
                    <div><strong>vCenter:</strong> {selectedVcenter.name}</div>
                    {formData.datacenter && <div><strong>Datacenter:</strong> {formData.datacenter}</div>}
                    {formData.cluster && <div><strong>Cluster:</strong> {formData.cluster}</div>}
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 mb-3">Nombres de VMs a crear</h4>
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
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmSubmit}
            disabled={generatingPreview || vmNameList.length === 0}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Creando...' : `Confirmar y Crear ${formData.quantity} VM(s)`}
          </Button>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Card.Header
            title="Crear Nueva VM"
            subtitle="Configurar y aprovisionar nuevas máquinas virtuales"
            action={
              <div className="flex space-x-2">
                <Button variant="secondary" size="small" onClick={handleGoTypifications}>
                  Tipificaciones
                </Button>
                <Button variant="secondary" size="small" onClick={handleGoVMClasses}>
                  Clases de VM
                </Button>
              </div>
            }
          />

          <form onSubmit={(e) => { e.preventDefault(); handleOpenConfirmation(); }}>
            <FormGroup label="Cantidad de VMs a Crear">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="vm-quantity" className="sr-only">Cantidad de VMs</label>
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

            <FormGroup label="Tipificación" required error={fieldErrors.typificationId}>
              <select
                id="vm-typification"
                value={formData.typificationId}
                onChange={handleInputChange('typificationId')}
                disabled={loading || loadingTemplates}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Seleccioná una tipificación</option>
                {typifications.map(typ => (
                  <option key={typ.id} value={typ.id}>
                    {typ.name} ({typ.prefijo1}-{typ.prefijo2}-{'{MANUAL}'}-{typ.seq_digits} dígitos)
                  </option>
                ))}
              </select>
            </FormGroup>

            {formData.typificationId && (
              <FormGroup label="Valor Manual" required error={fieldErrors.manualValue}>
                <Input
                  id="vm-manual"
                  type="text"
                  value={formData.manualValue}
                  onChange={handleInputChange('manualValue')}
                  placeholder="Ingresá valor manual (solo letras y números)"
                  disabled={loading || isSubmitting}
                  autoComplete="off"
                  aria-describedby="pattern-hint"
                />
                <p id="pattern-hint" className="mt-1 text-xs text-gray-500">
                  Patrón: <code className="bg-gray-100 px-1 rounded">{selectedTypification?.prefijo1}-{selectedTypification?.prefijo2}-{'{MANUAL}'}-{''.padStart(selectedTypification?.seq_digits || 1, '0')}</code>
                </p>
              </FormGroup>
            )}

            <FormGroup label="Conexión vCenter" required>
              <select
                id="vcenter-connection"
                value={formData.vcenterId}
                onChange={(e) => handleVcenterChange(e.target.value)}
                disabled={loadingVcenters}
                autoComplete="off"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {loadingVcenters ? (
                  <option value="">Cargando vCenters...</option>
                ) : vcenters.length === 0 ? (
                  <option value="">No hay vCenters configurados</option>
                ) : (
                  <>
                    <option value="">Selecciona un vCenter</option>
                    {vcenters.map(vcenter => (
                      <option key={vcenter.id} value={vcenter.id}>
                        {vcenter.name} ({vcenter.url}) {vcenter.is_active ? '✓' : '✗'}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {vcenters.length === 0 && !loadingVcenters && (
                <p className="mt-1 text-xs text-amber-600">
                  No hay conexiones vCenter configuradas.{' '}
                  <a href="/vcenters" className="underline">Agregar una conexión</a>
                </p>
              )}
            </FormGroup>

            {formData.vcenterId && selectedVcenter && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Configuración del vCenter</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
                  <div>
                    <strong>Centro de Datos:</strong> {formData.datacenter || 'No configurado'}
                  </div>
                  <div>
                    <strong>Cluster:</strong> {formData.cluster || 'No configurado'}
                  </div>
                </div>
                {(!formData.datacenter || !formData.cluster) && (
                  <p className="mt-2 text-xs text-amber-600">
                    ⚠️ Este vCenter no tiene datacenter o cluster configurado por defecto.{' '}
                    <a href="/vcenters" className="underline">Configurar en vCenters</a>
                  </p>
                )}
              </div>
            )}

            <ResourcePoolSelector
              clusterId={formData.cluster}
              value={formData.resourcePool}
              onChange={handleResourcePoolChange}
              disabled={!formData.cluster}
            />

            {formData.vcenterId && (
              <div className="mb-4">
                <label
                  htmlFor="storage-policy"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Storage Policy
                  {loadingPolicies && <span className="ml-2 text-xs text-gray-400">(cargando...)</span>}
                </label>
                <select
                  id="storage-policy"
                  value={formData.storagePolicy}
                  onChange={(e) => setFormData(prev => ({ ...prev, storagePolicy: e.target.value }))}
                  disabled={!formData.vcenterId || loadingPolicies}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                >
                  {loadingPolicies ? (
                    <option value="">Cargando políticas...</option>
                  ) : storagePolicies.length === 0 ? (
                    <option value="">No hay storage policies disponibles</option>
                  ) : (
                    <>
                      <option value="">Ninguna (usa defecto del vCenter)</option>
                      {storagePolicies.map((policy) => (
                        <option key={policy.name} value={policy.name}>
                          {policy.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            )}

            {formData.vcenterId && vmTemplates.length > 0 && (
              <div className="mb-4">
                <label
                  htmlFor="vm-class"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  VM Class (specs)
                  {loadingTemplates && <span className="ml-2 text-xs text-gray-400">(cargando...)</span>}
                </label>
                <select
                  id="vm-class"
                  value={formData.vmClassId}
                  onChange={(e) => setFormData(prev => ({ ...prev, vmClassId: e.target.value }))}
                  disabled={loadingTemplates}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Selecciona una VM Class</option>
                  {vmTemplates.map((vmClass) => (
                    <option key={vmClass.id} value={vmClass.id}>
                      {vmClass.name} - {vmClass.cpu_cores}CPU, {vmClass.memory_mb}MB, {vmClass.storage_gb}GB
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.vmClassId && selectedVMClass && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Detalles de la Clase Seleccionada</h4>
                <div className="grid grid-cols-4 gap-4 text-sm text-gray-600">
                  <div><strong>Nombre:</strong> {selectedVMClass.name}</div>
                <div><strong>Specs:</strong> {selectedVMClass.cpu_cores}CPU, {selectedVMClass.memory_mb}MB, {selectedVMClass.storage_gb}GB</div>
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
                <label className="block text-sm font-medium text-indigo-900 mb-2">Vista Previa del Nombre</label>
                <div className="font-mono text-lg text-indigo-700">{namePreview}</div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={handleOpenConfirmation}
                disabled={loading || isSubmitting || !formData.typificationId || !formData.manualValue || !formData.vmClassId}
                loading={generatingPreview}
              >
                Vista Previa
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || isSubmitting || vmNameList.length === 0 || !formData.typificationId || !formData.vmClassId}
                loading={loading}
              >
                {loading ? 'Por favor esperá...' : 'Crear VM(s)'}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <Card.Header title="Vista Previa del Nombre de VM" />

          {loadingTemplates ? (
            <div className="space-y-4" role="status" aria-label="Cargando templates">
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : !formData.typificationId || !formData.vmClassId ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Seleccioná opciones para previsualizar</h3>
              <p className="text-gray-500">Elegí una tipificación y template para previsualizar los nombres de VM</p>
            </div>
          ) : !formData.manualValue ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ingresá valor manual</h3>
              <p className="text-gray-500">Escribí un valor manual para ver la previsualización del nombre</p>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Vista previa no generada</h3>
              <p className="text-gray-500 mb-4">Hacé click en "Vista Previa" para ver los nombres de VM</p>
              <Button
                variant="primary"
                onClick={handleOpenConfirmation}
                disabled={!formData.typificationId || !formData.manualValue || !formData.vmClassId}
              >
                Vista Previa
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Especificaciones de la Clase de VM</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div><strong>Clase:</strong> {selectedVMClass?.name}</div>
                  <div><strong>Specs:</strong> {selectedVMClass?.cpu_cores}CPU, {selectedVMClass?.memory_mb}MB, {selectedVMClass?.storage_gb}GB</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Nombres de VMs a crear</h4>
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
