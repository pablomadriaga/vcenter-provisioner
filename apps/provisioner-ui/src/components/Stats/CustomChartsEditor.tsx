import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import { ChartWidget } from './ChartWidget'
import { useToast } from '../Toast'
import { useAuth } from '../../contexts/AuthContext'

interface CustomChart {
  id: number
  user_id: number
  name: string
  chart_type: 'line' | 'bar' | 'area' | 'pie'
  metric: string
  group_by: string | null
  timeframe: string
  filters: Record<string, any> | null
  is_public: boolean
  created_at: string
}

interface ChartData {
  name?: string
  label?: string
  value: number
  [key: string]: string | number | undefined
}

const CHART_TYPES = [
  { value: 'line', label: 'Line Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'pie', label: 'Pie Chart' },
]

const METRICS = [
  { value: 'total', label: 'Total Provisions' },
  { value: 'successful', label: 'Successful' },
  { value: 'failed', label: 'Failed' },
  { value: 'success_rate', label: 'Success Rate' },
]

const GROUP_BY = [
  { value: '', label: 'None (All)' },
  { value: 'vm_class', label: 'VM Class' },
  { value: 'vcenter', label: 'vCenter' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
]

interface TimelinePoint {
  timestamp: string
  total: number
  successful: number
  failed: number
}

interface VMClassStat {
  vm_class_id: number | null
  vm_class_name: string | null
  count: number
  success_count: number
  fail_count: number
  success_rate: number
}

interface vCenterStat {
  vcenter_id: number | null
  vcenter_name: string | null
  count: number
  success_count: number
  fail_count: number
  success_rate: number
}

interface StatsSummary {
  total_provisions: number
  successful: number
  failed: number
  success_rate: number
  last_update: string | null
}

const TIMEFRAMES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

export function CustomChartsEditor() {
  const { success: showSuccess, error: showError } = useToast()
  const { user } = useAuth()
  const userId = user?.id ?? 1
  const [savedCharts, setSavedCharts] = useState<CustomChart[]>([])
  const [selectedChart, setSelectedChart] = useState<CustomChart | null>(null)
  const [previewData, setPreviewData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    chart_type: 'bar' as 'line' | 'bar' | 'area' | 'pie',
    metric: 'total',
    group_by: '',
    timeframe: '7d',
    status_filter: '',
    vm_class_filter: '',
    vcenter_filter: '',
    is_public: false,
  })

  useEffect(() => {
    fetchSavedCharts()
  }, [])

  const fetchSavedCharts = async () => {
    try {
      const charts = await api.get<CustomChart[]>(`/custom-charts?user_id=${userId}`)
      setSavedCharts(charts)
    } catch (err) {
      console.error('Failed to fetch saved charts:', err)
    }
  }

  const generatePreview = async () => {
    setIsLoading(true)
    try {
      let data: any[] = []
      
      if (formData.metric === 'total') {
        const timelineRes = await api.get<TimelinePoint[]>(`/stats/timeline?timeframe=${formData.timeframe}`)
        data = timelineRes.map((t: TimelinePoint) => ({
          name: t.timestamp.split(' ')[1] || t.timestamp,
          value: t.total
        }))
      } else if (formData.metric === 'successful') {
        const timelineRes = await api.get<TimelinePoint[]>(`/stats/timeline?timeframe=${formData.timeframe}`)
        data = timelineRes.map((t: TimelinePoint) => ({
          name: t.timestamp.split(' ')[1] || t.timestamp,
          value: t.successful
        }))
      } else if (formData.metric === 'failed') {
        const timelineRes = await api.get<TimelinePoint[]>(`/stats/timeline?timeframe=${formData.timeframe}`)
        data = timelineRes.map((t: TimelinePoint) => ({
          name: t.timestamp.split(' ')[1] || t.timestamp,
          value: t.failed
        }))
      } else if (formData.metric === 'success_rate') {
        const summaryRes = await api.get<StatsSummary>('/stats/summary')
        data = [{ name: 'Success Rate', value: summaryRes.success_rate || 0 }]
      }

      if (formData.group_by === 'vm_class') {
        const vmClassRes = await api.get<VMClassStat[]>('/stats/by-vmclass')
        data = vmClassRes.slice(0, 10).map((vc: VMClassStat) => ({
          name: vc.vm_class_name || 'Unknown',
          value: (vc as any)[formData.metric] || vc.count
        }))
      } else if (formData.group_by === 'vcenter') {
        const vCenterRes = await api.get<vCenterStat[]>('/stats/by-vcenter')
        data = vCenterRes.slice(0, 10).map((vc: vCenterStat) => ({
          name: vc.vcenter_name || 'Unknown',
          value: (vc as any)[formData.metric] || vc.count
        }))
      }

      setPreviewData(data)
    } catch (err) {
      showError('Preview failed', 'Unable to generate chart preview')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError('Name required', 'Please enter a name for this chart')
      return
    }

    setIsSaving(true)
    try {
      const filters: Record<string, any> = {}
      if (formData.status_filter) filters.status = formData.status_filter
      if (formData.vm_class_filter) filters.vm_class_id = formData.vm_class_filter
      if (formData.vcenter_filter) filters.vcenter_id = formData.vcenter_filter

      await api.post('/custom-charts', {
        user_id: userId,
        name: formData.name,
        chart_type: formData.chart_type,
        metric: formData.metric,
        group_by: formData.group_by || null,
        timeframe: formData.timeframe,
        filters: Object.keys(filters).length > 0 ? filters : null,
        is_public: formData.is_public,
      })

      showSuccess('Chart saved', 'Your custom chart has been saved')
      fetchSavedCharts()
      
      setFormData(prev => ({
        ...prev,
        name: '',
      }))
      setSelectedChart(null)
    } catch (err) {
      showError('Save failed', 'Unable to save chart')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (chartId: number) => {
    if (!confirm('Are you sure you want to delete this chart?')) return
    
    try {
      await api.delete(`/custom-charts/${chartId}`)
      showSuccess('Chart deleted', 'Custom chart has been removed')
      fetchSavedCharts()
      if (selectedChart?.id === chartId) {
        setSelectedChart(null)
        setPreviewData([])
      }
    } catch (err) {
      showError('Delete failed', 'Unable to delete chart')
    }
  }

  const loadChart = (chart: CustomChart) => {
    setSelectedChart(chart)
    setFormData({
      name: chart.name,
      chart_type: chart.chart_type,
      metric: chart.metric,
      group_by: chart.group_by || '',
      timeframe: chart.timeframe,
      status_filter: chart.filters?.status || '',
      vm_class_filter: chart.filters?.vm_class_id || '',
      vcenter_filter: chart.filters?.vcenter_id || '',
      is_public: chart.is_public,
    })
    generatePreview()
  }

  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Chart Builder</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chart Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Custom Chart"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Chart Type</label>
              <select
                value={formData.chart_type}
                onChange={(e) => setFormData(prev => ({ ...prev, chart_type: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CHART_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric</label>
              <select
                value={formData.metric}
                onChange={(e) => setFormData(prev => ({ ...prev, metric: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {METRICS.map(metric => (
                  <option key={metric.value} value={metric.value}>{metric.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={formData.group_by}
                onChange={(e) => setFormData(prev => ({ ...prev, group_by: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {GROUP_BY.map(group => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
              <select
                value={formData.timeframe}
                onChange={(e) => setFormData(prev => ({ ...prev, timeframe: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <label htmlFor="is_public" className="ml-2 text-sm text-gray-700">Share with others</label>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={generatePreview}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Preview'}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {savedCharts.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Charts</h3>
            <div className="space-y-2">
              {savedCharts.map(chart => (
                <div
                  key={chart.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedChart?.id === chart.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => loadChart(chart)}
                >
                  <div>
                    <p className="font-medium text-gray-900">{chart.name}</p>
                    <p className="text-xs text-gray-500">
                      {chart.chart_type} • {chart.metric} • {chart.timeframe}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(chart.id)
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm min-h-[400px]">
          {previewData.length > 0 ? (
            <ChartWidget
              title={selectedChart?.name || formData.name || 'Chart Preview'}
              chartType={formData.chart_type}
              data={previewData}
              colors={colors}
              height={350}
            />
          ) : (
            <div className="flex items-center justify-center h-full min-h-[350px] text-gray-400">
              <div className="text-center">
                <p className="text-lg">No preview yet</p>
                <p className="text-sm">Configure options and click Preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomChartsEditor
