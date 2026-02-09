import { useState, useEffect } from 'react'
import { api } from '../../utils/api'
import { useToast } from '../Toast'

interface RecentProvision {
  id: number
  job_id: string
  vm_name: string
  status: string
  vm_class_name: string | null
  vcenter_name: string | null
  created_at: string
}

interface DashboardStats {
  total_provisions: number
  successful: number
  failed: number
  success_rate: number
}

interface VMClassStat {
  vm_class_name: string | null
  count: number
}

interface vCenterStat {
  vcenter_name: string | null
  count: number
}

export function DashboardWidgets() {
  const { error: showError } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recent, setRecent] = useState<RecentProvision[]>([])
  const [topVmClasses, setTopVmClasses] = useState<VMClassStat[]>([])
  const [topVcenters, setTopVcenters] = useState<vCenterStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes, recentRes, vmClassRes, vCenterRes] = await Promise.all([
        api.get<DashboardStats>('/api/stats/summary?days=7'),
        api.get<RecentProvision[]>('/api/stats/recent?limit=5'),
        api.get<VMClassStat[]>('/api/stats/by-vmclass'),
        api.get<vCenterStat[]>('/api/stats/by-vcenter'),
      ])
      
      setStats(statsRes)
      setRecent(recentRes)
      setTopVmClasses(vmClassRes.slice(0, 3))
      setTopVcenters(vCenterRes.slice(0, 3))
    } catch (err) {
      showError('Failed to load', 'Unable to fetch dashboard stats')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY': return 'bg-green-100 text-green-800'
      case 'FAILED': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READY': return '✓'
      case 'FAILED': return '✗'
      default: return '⟳'
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  const successRate = stats?.success_rate || 0
  const successColor = successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Provisions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {stats?.total_provisions?.toLocaleString() || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Success Rate</p>
          <p className={`text-2xl font-bold mt-1 ${successColor}`}>
            {successRate.toFixed(1)}%
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Successful</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {stats?.successful?.toLocaleString() || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Failed</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {stats?.failed?.toLocaleString() || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Stats</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Top VM Classes</p>
              {topVmClasses.length > 0 ? (
                <div className="space-y-2">
                  {topVmClasses.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{item.vm_class_name || 'Unknown'}</span>
                      <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data available</p>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Top vCenters</p>
              {topVcenters.length > 0 ? (
                <div className="space-y-2">
                  {topVcenters.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{item.vcenter_name || 'Unknown'}</span>
                      <span className="text-sm font-medium text-gray-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data available</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Provisions</h3>
          {recent.length > 0 ? (
            <div className="space-y-2">
              {recent.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {getStatusIcon(item.status)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.vm_name}</p>
                      <p className="text-xs text-gray-500">
                        {item.vm_class_name || 'N/A'} • {item.vcenter_name || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No recent provisions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardWidgets
