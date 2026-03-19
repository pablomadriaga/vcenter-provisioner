import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { api } from '../utils/api'
import { PageLayout, Card, Button, FormGroup, Input, Modal } from '../components'
import { useToast } from '../components/Toast'

interface VCenterConnection {
  id: number
  name: string
  url: string
  connection_type: 'token' | 'basic'
  is_active: boolean
  default_datacenter: string | null
  default_cluster: string | null
  created_by: number | null
  created_at: string
  updated_at: string
}

interface VCenterFormData {
  allowInsecure: boolean
  name: string
  url: string
  credential: string
  default_datacenter: string
  default_cluster: string
  connectionTested: boolean
  connectionSuccess: boolean
}

interface TestConnectionResponse {
  success: boolean
  message: string
}

interface DiscoverResponse {
  datacenters?: any[]
  clusters?: any[]
}

function VcentersPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [vcenters, setVcenters] = useState<VCenterConnection[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingVcenter, setEditingVcenter] = useState<VCenterConnection | null>(null)
  const [loading, setLoading] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [allowInsecure, setAllowInsecure] = useState(false)
  const [datacenters, setDatacenters] = useState<{ id: string; name: string }[]>([])
  const [clusters, setClusters] = useState<{ id: string; name: string }[]>([])
  const [loadingDatacenters, setLoadingDatacenters] = useState(false)
  const [loadingClusters, setLoadingClusters] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<VCenterFormData>({
defaultValues: {
        name: '',
        url: '',
        credential: '',
        default_datacenter: '',
        default_cluster: '',
        connectionTested: false,
        connectionSuccess: false,
        allowInsecure: false
      }
  })

  // Observar valores de campos relevantes
  const urlValue = watch('url')
  const credentialValue = watch('credential')
  const connectionSuccess = watch('connectionSuccess')
  const datacenterValue = watch('default_datacenter')

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return
    }
    fetchVcenters()
  }, [navigate])

  const verifyAuth = () => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) {
      navigate('/login')
      return false
    }
    return true
  }

  const fetchVcenters = async () => {
    try {
      setLoading(true)
      const data: VCenterConnection[] = await api.get('/vcenters')
      setVcenters(data)
    } catch (err) {
      showError('Failed to load', 'Unable to fetch vCenter connections.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    reset({
      name: '',
      url: '',
      credential: '',
      default_datacenter: '',
      default_cluster: '',
      connectionTested: false,
      connectionSuccess: false
    })
    setEditingVcenter(null)
    setDatacenters([])
    setClusters([])
  }

  const handleEdit = async (vcenter: VCenterConnection) => {
    setEditingVcenter(vcenter)
    reset({
      name: vcenter.name,
      url: vcenter.url,
      credential: '',
      default_datacenter: vcenter.default_datacenter || '',
      default_cluster: vcenter.default_cluster || '',
      connectionTested: true,
      connectionSuccess: false  // Necesitamos reconectar para obtener recursos
    })
    
    // Limpiar listas previas
    setDatacenters([])
    setClusters([])
    
    // Si tenemos credenciales anteriores, intentar reconectar
    // (Esto requeriría pedir al usuario que ingrese las credenciales nuevamente)
    // Por ahora, dejamos que el usuario reconecte manualmente
  }

  const handleCloseModal = () => {
    resetForm()
    setShowCreateForm(false)
  }

  const loadAvailableDatacenters = async (url: string, credential: string) => {
    setLoadingDatacenters(true)
    try {
      const response = await api.post<DiscoverResponse>('/vcenters/discover/datacenters', {
        url,
        credential,
        allowInsecure
      })
      // API vCenter returns: { datacenters: [{ datacenter: string, name: string }] }
      // We need to extract the names for display and IDs for saving
      const datacentersList = response.datacenters || []
      setDatacenters(datacentersList.map((dc: any) => ({
        id: dc.datacenter || dc.id || dc.name,
        name: dc.name || dc.datacenter || dc
      })))
    } catch (error) {
      showError('Error', 'No se pudieron cargar los datacenters')
      setDatacenters([])
    } finally {
      setLoadingDatacenters(false)
    }
  }

  const loadClustersForDatacenter = async (datacenter: string) => {
    if (!urlValue || !credentialValue) return
    
    setLoadingClusters(true)
    try {
      const response = await api.post<DiscoverResponse>('/vcenters/discover/clusters', {
        url: urlValue,
        credential: credentialValue,
        datacenter,
        allowInsecure
      })
      // API vCenter returns: { clusters: [{ cluster: string, name: string }] }
      const clustersList = response.clusters || []
      setClusters(clustersList.map((c: any) => ({
        id: c.cluster || c.id || c.name,
        name: c.name || c.cluster || c
      })))
    } catch (error) {
      showError('Error', 'No se pudieron cargar los clusters')
      setClusters([])
    } finally {
      setLoadingClusters(false)
    }
  }

  // Efecto para cargar clusters cuando cambia el datacenter
  useEffect(() => {
    if (datacenterValue && connectionSuccess) {
      loadClustersForDatacenter(datacenterValue)
    }
  }, [datacenterValue, connectionSuccess])

  const handleTestConnection = async () => {
    const isValid = await trigger(['url', 'credential'])
    if (!isValid) return

    setTestingId(-1) // Usamos -1 para indicar prueba en creación/edición
    try {
      const result = await api.post<TestConnectionResponse>('/vcenters/test-temp', {
        url: urlValue,
        credential: credentialValue,
        allowInsecure
      })

      if (result.success) {
        setValue('connectionSuccess', true)
        setValue('connectionTested', true)
        await loadAvailableDatacenters(urlValue, credentialValue)
        success('Conexión exitosa', 'Ahora puede seleccionar datacenter y cluster')
      } else {
        setValue('connectionSuccess', false)
        setValue('connectionTested', true)
        showError('Conexión fallida', result.message)
      }
    } catch (error) {
      showError('Error', 'No se pudo probar la conexión')
    } finally {
      setTestingId(null)
    }
  }

  const handleTest = async (id: number, allowInsecureParam: boolean = false) => {
    if (!verifyAuth()) {
      return
    }

    setTestingId(id)
    try {
      const result = await api.post<TestConnectionResponse>(`/vcenters/${id}/test`, { allowInsecure: allowInsecureParam })
      if (result.success) {
        success('Connection OK', `Response: ${result.message}`)
      } else {
        showError('Test failed', result.message)
      }
    } catch (err) {
      showError('Test error', 'Unable to test connection.')
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!verifyAuth()) {
      return
    }

    if (!window.confirm('Are you sure you want to delete this vCenter connection?')) {
      return
    }

    try {
      await api.delete(`/vcenters/${id}`)
      success('Deleted', 'vCenter connection deleted.')
      fetchVcenters()
    } catch (err) {
      showError('Failed to delete', 'Unable to delete vCenter connection.')
    }
  }

  const onSubmit = async (data: VCenterFormData) => {
    if (!verifyAuth()) return

    // Validar que la conexión fue exitosa
    if (!data.connectionSuccess) {
      showError('Error', 'Debe probar la conexión antes de guardar')
      return
    }

    try {
      if (editingVcenter) {
        const updateData: any = {
          name: data.name,
          url: data.url,
          default_datacenter: data.default_datacenter || null,
          default_cluster: data.default_cluster || null
        }
        if (data.credential) {
          updateData.credential = data.credential
        }

        await api.put(`/vcenters/${editingVcenter.id}`, updateData)
        success('Updated', 'vCenter connection updated successfully.')
        handleCloseModal()
      } else {
        await api.post('/vcenters', {
          name: data.name,
          url: data.url,
          credential: data.credential,
          default_datacenter: data.default_datacenter || null,
          default_cluster: data.default_cluster || null,
          allowInsecure: allowInsecure
        })
        success('Success', 'vCenter connection created successfully.')
        handleCloseModal()
      }
      fetchVcenters()
    } catch (err) {
      showError('Failed', editingVcenter ? 'Unable to update vCenter connection.' : 'Unable to create vCenter connection.')
    }
  }

  return (
    <PageLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">vCenter Connections</h1>
          <p className="text-gray-500 mt-1">Manage your vCenter server connections</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          + Add vCenter
        </Button>
      </div>

      {loading && vcenters.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">Loading vCenter connections...</p>
        </Card>
      ) : vcenters.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500 mb-4">No vCenter connections configured.</p>
          <Button onClick={() => setShowCreateForm(true)}>
            Add Your First vCenter
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {vcenters.map((vcenter) => (
            <Card key={vcenter.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 rounded-full ${vcenter.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <h3 className="font-semibold text-gray-900">{vcenter.name}</h3>
                    <p className="text-sm text-gray-500">{vcenter.url}</p>
                  </div>
                </div>
                 <div className="flex items-center space-x-4">
                   <span className="text-xs px-2 py-1 bg-green-100 rounded text-green-700">
                     basic auth
                   </span>
                   {vcenter.default_datacenter && (
                     <span className="text-xs px-2 py-1 bg-blue-50 rounded text-blue-600">
                       {vcenter.default_datacenter}
                     </span>
                   )}
                   {/* Insecure connection checkbox */}
                   <div className="flex items-center space-x-2">
                     <Input
                       type="checkbox"
                       checked={allowInsecure}
                       onChange={(e) => setAllowInsecure(e.target.checked)}
                     />
                     <span className="text-xs text-red-600">Insecure</span>
                   </div>
                   <Button
                     variant="secondary"
                     size="small"
                     onClick={() => handleTest(vcenter.id, allowInsecure)}
                     disabled={testingId === vcenter.id}
                   >
                     {testingId === vcenter.id ? 'Testing...' : 'Test'}
                   </Button>
                   <Button
                     variant="secondary"
                     size="small"
                     onClick={() => handleEdit(vcenter)}
                   >
                     Edit
                   </Button>
                   <Button
                     variant="danger"
                     size="small"
                     onClick={() => handleDelete(vcenter.id)}
                   >
                     Delete
                   </Button>
                 </div>
               </div>
             </Card>
           ))}
         </div>
       )}

       <Modal
         isOpen={showCreateForm || editingVcenter !== null}
         onClose={handleCloseModal}
         title={editingVcenter ? 'Edit vCenter Connection' : 'Add vCenter Connection'}
       >
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
           <Controller
             name="name"
             control={control}
             rules={{ required: 'Name is required' }}
             render={({ field }) => (
               <FormGroup label="Name" required error={errors.name?.message}>
                 <Input
                   type="text"
                   {...field}
                   placeholder="Production vCenter"
                 />
               </FormGroup>
             )}
           />

           <Controller
             name="url"
             control={control}
             rules={{ required: 'URL is required' }}
             render={({ field }) => (
               <FormGroup label="URL" required error={errors.url?.message}>
                 <Input
                   type="url"
                   {...field}
                   placeholder="https://vcenter.example.com"
                 />
               </FormGroup>
             )}
           />

           <Controller
             name="credential"
             control={control}
             rules={{
               required: !editingVcenter ? 'Credential is required' : undefined,
               validate: {
                 format: (value) => {
                   if (value && !value.includes(':')) {
                     return 'Credential must be in format: username:password'
                   }
                   return true
                 }
               }
             }}
             render={({ field }) => (
               <FormGroup
                 label={editingVcenter ? 'New Credential (leave empty to keep current)' : 'Credential'}
                 required={!editingVcenter}
                 error={errors.credential?.message}
               >
                 <Input
                   type="password"
                   {...field}
                   placeholder={editingVcenter ? 'Enter new credential only if changing' : 'user@domain.example.com:password'}
                 />
                 <p className="text-xs text-gray-500 mt-1">
                   Format: username:password (vCenter local user or AD user)
                 </p>
               </FormGroup>
             )}
           />

            {/* Checkbox Insecure */}
            <div className="flex items-center space-x-2 mb-4">
              <Input
                type="checkbox"
                checked={allowInsecure}
                onChange={(e) => setAllowInsecure(e.target.checked)}
              />
              <span className="text-xs text-red-600">Insecure (no validar certificado)</span>
            </div>
            {/* Botón de prueba de conexión */}
            <div className="border-t pt-4 mt-4">
              <Button
                type="button"
                onClick={handleTestConnection}
                disabled={!urlValue || !credentialValue || testingId === -1}
                className="w-full"
              >
                {testingId === -1 ? 'Probando...' : 'Probar Conexión'}
              </Button>
            </div>

           {/* Campos de datacenter/cluster solo si conexión exitosa */}
           {connectionSuccess && (
             <div className="border-t pt-4 mt-4">
               <h4 className="font-medium mb-3">Configuración de Recursos</h4>
               
               <Controller
                 name="default_datacenter"
                 control={control}
                 rules={{ required: 'Debe seleccionar un datacenter' }}
                 render={({ field }) => (
                   <FormGroup label="Default Datacenter" required error={errors.default_datacenter?.message}>
                     <select
                       {...field}
                       className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                       disabled={loadingDatacenters || datacenters.length === 0}
                     >
                       <option value="">Seleccionar Datacenter...</option>
                       {datacenters.map(dc => (
                         <option key={dc.id} value={dc.id}>{dc.name}</option>
                       ))}
                     </select>
                     {loadingDatacenters && <p className="text-xs text-gray-500 mt-1">Cargando datacenters...</p>}
                   </FormGroup>
                 )}
               />

               <Controller
                 name="default_cluster"
                 control={control}
                 rules={{ required: 'Debe seleccionar un cluster' }}
                 render={({ field }) => (
                   <FormGroup label="Default Cluster" required error={errors.default_cluster?.message}>
                     <select
                       {...field}
                       className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                       disabled={!datacenterValue || loadingClusters || clusters.length === 0}
                     >
                       <option value="">Seleccionar Cluster...</option>
                       {clusters.map(cluster => (
                         <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
                       ))}
                     </select>
                     {loadingClusters && <p className="text-xs text-gray-500 mt-1">Cargando clusters...</p>}
                   </FormGroup>
                 )}
               />
             </div>
           )}

           <div className="flex justify-end space-x-3 pt-4">
             <Button
               type="button"
               variant="secondary"
               onClick={handleCloseModal}
             >
               Cancel
             </Button>
             <Button type="submit" disabled={isSubmitting}>
               {isSubmitting ? 'Guardando...' : (editingVcenter ? 'Update Connection' : 'Create Connection')}
             </Button>
           </div>
         </form>
       </Modal>
     </PageLayout>
   )
 }

 export default VcentersPage