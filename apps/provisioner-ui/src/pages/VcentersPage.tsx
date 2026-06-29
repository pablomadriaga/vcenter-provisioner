import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  name: string
  url: string
  connection_type: 'token' | 'basic'
  credential: string
  default_datacenter: string
  default_cluster: string
}

function VcentersPage() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const [vcenters, setVcenters] = useState<VCenterConnection[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingVcenter, setEditingVcenter] = useState<VCenterConnection | null>(null)
  const [loading, setLoading] = useState(false)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<VCenterFormData>({
    name: '',
    url: '',
    connection_type: 'token',
    credential: '',
    default_datacenter: '',
    default_cluster: ''
  })

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
      const data: VCenterConnection[] = await api.get('/api/vcenters')
      setVcenters(data)
    } catch (err) {
      showError('Failed to load', 'Unable to fetch vCenter connections.')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof VCenterFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      connection_type: 'token',
      credential: '',
      default_datacenter: '',
      default_cluster: ''
    })
    setEditingVcenter(null)
  }

  const handleEdit = (vcenter: VCenterConnection) => {
    setEditingVcenter(vcenter)
    setFormData({
      name: vcenter.name,
      url: vcenter.url,
      connection_type: vcenter.connection_type,
      credential: '',
      default_datacenter: vcenter.default_datacenter || '',
      default_cluster: vcenter.default_cluster || ''
    })
  }

  const handleCloseModal = () => {
    resetForm()
    setShowCreateForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!verifyAuth()) {
      return
    }

    if (!formData.name || !formData.url) {
      showError('Validation error', 'Name and URL are required.')
      return
    }

    try {
      if (editingVcenter) {
        const updateData: any = {
          name: formData.name,
          url: formData.url,
          connection_type: formData.connection_type,
          default_datacenter: formData.default_datacenter || null,
          default_cluster: formData.default_cluster || null
        }
        if (formData.credential) {
          updateData.credential = formData.credential
        }

        await api.put(`/api/vcenters/${editingVcenter.id}`, updateData)
        success('Updated', 'vCenter connection updated successfully.')
        handleCloseModal()
      } else {
        if (!formData.credential) {
          showError('Validation error', 'Credential is required for new connections.')
          return
        }
        await api.post('/api/vcenters', {
          name: formData.name,
          url: formData.url,
          connection_type: formData.connection_type,
          credential: formData.credential,
          default_datacenter: formData.default_datacenter || null,
          default_cluster: formData.default_cluster || null
        })
        success('Success', 'vCenter connection created successfully.')
        handleCloseModal()
      }
      fetchVcenters()
    } catch (err) {
      showError('Failed', editingVcenter ? 'Unable to update vCenter connection.' : 'Unable to create vCenter connection.')
    }
  }

  const handleTest = async (id: number) => {
    if (!verifyAuth()) {
      return
    }

    setTestingId(id)
    try {
      const result = await api.post<{ success: boolean; message: string }>(`/api/vcenters/${id}/test`, {})
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
      await api.delete(`/api/vcenters/${id}`)
      success('Deleted', 'vCenter connection deleted.')
      fetchVcenters()
    } catch (err) {
      showError('Failed to delete', 'Unable to delete vCenter connection.')
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
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                    {vcenter.connection_type}
                  </span>
                  {vcenter.default_datacenter && (
                    <span className="text-xs px-2 py-1 bg-blue-50 rounded text-blue-600">
                      {vcenter.default_datacenter}
                    </span>
                  )}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleTest(vcenter.id)}
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="Name" required>
            <Input
              type="text"
              value={formData.name}
              onChange={handleInputChange('name')}
              placeholder="Production vCenter"
            />
          </FormGroup>

          <FormGroup label="URL" required>
            <Input
              type="url"
              value={formData.url}
              onChange={handleInputChange('url')}
              placeholder="https://vcenter.example.com"
            />
          </FormGroup>

          <FormGroup label="Connection Type">
            <select
              value={formData.connection_type}
              onChange={handleInputChange('connection_type')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="token">API Token</option>
              <option value="basic">Basic Auth</option>
            </select>
          </FormGroup>

          <FormGroup label={editingVcenter ? 'New Credential (leave empty to keep current)' : 'Credential'} required={!editingVcenter}>
            <Input
              type="password"
              value={formData.credential}
              onChange={handleInputChange('credential')}
              placeholder={editingVcenter ? 'Enter new credential only if changing' : 'API token or password'}
            />
          </FormGroup>

          <FormGroup label="Default Datacenter">
            <Input
              type="text"
              value={formData.default_datacenter}
              onChange={handleInputChange('default_datacenter')}
              placeholder="DC1"
            />
          </FormGroup>

          <FormGroup label="Default Cluster">
            <Input
              type="text"
              value={formData.default_cluster}
              onChange={handleInputChange('default_cluster')}
              placeholder="Cluster-1"
            />
          </FormGroup>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingVcenter ? 'Update Connection' : 'Create Connection'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}

export default VcentersPage
