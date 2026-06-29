import { useState, useEffect, useRef } from 'react'
import { api, ApiError } from '../../utils/api'
import { StatsCard, ChartWidget } from './index'
import { useToast } from '../Toast'
import { useAuth } from '../../contexts/AuthContext'
import { FEATURES } from '../../utils/features'
import { CustomChartsEditor } from './CustomChartsEditor'

interface StatsSummary {
  total: number
  successful: number
  failed: number
  success_rate: number
}

interface TimelinePoint {
  date: string
  success: number
  failed: number
}

interface VMClassStat {
  vm_class_name: string
  count: number
  success: number
  failed: number
}

interface vCenterStat {
  vcenter_name: string
  count: number
  success: number
  failed: number
}

interface HourlyDistribution {
  hour: number
  count: number
}

interface FailureReason {
  reason: string
  count: number
}

type TabType = 'overview' | 'vmclass' | 'vcenter' | 'custom'

export function StatsWidgets() {
  const { checkAuth, isLoading: authLoading } = useAuth()
  const { error: showError } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [vmClassStats, setVMClassStats] = useState<VMClassStat[]>([])
  const [vCenterStats, setVCenterStats] = useState<vCenterStat[]>([])
  const [hourlyDist, setHourlyDist] = useState<HourlyDistribution[]>([])
  const [failures, setFailures] = useState<FailureReason[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('7d')
  const authReady = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (!authReady.current) {
      authReady.current = true
      if (!checkAuth()) {
        setLoading(false)
        return
      }
    }
    fetchStats()
  }, [timeframe, authLoading])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [summaryRes, timelineRes, vmClassRes, vCenterRes, hourlyRes, failuresRes] = await Promise.all([
        api.get<StatsSummary>(`/stats/summary?days=${timeframe === '24h' ? 1 : timeframe.replace('d', '')}`),
        api.get<TimelinePoint[]>(`/stats/timeline?timeframe=${timeframe}`),
        api.get<VMClassStat[]>(`/stats/by-vmclass`),
        api.get<vCenterStat[]>(`/stats/by-vcenter`),
        api.get<HourlyDistribution[]>(`/stats/hourly?days=${timeframe === '24h' ? 1 : timeframe.replace('d', '')}`),
        api.get<FailureReason[]>(`/stats/failures?limit=10`),
      ])
      
      setSummary(summaryRes)
      setTimeline(timelineRes)
      setVMClassStats(vmClassRes)
      setVCenterStats(vCenterRes)
      setHourlyDist(hourlyRes)
      setFailures(failuresRes)
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        showError('Session Expired', 'Please log in again to continue.')
      } else if (err instanceof ApiError && err.isNetworkError) {
        showError('Connection Error', 'Unable to connect to server. Please check your network.')
      } else {
        showError('Failed to load', 'Unable to fetch statistics')
      }
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'vmclass', label: 'By VM Class' },
    { id: 'vcenter', label: 'By vCenter' },
    ...(FEATURES.CUSTOM_CHARTS ? [{ id: 'custom' as TabType, label: 'Custom Charts' }] : []),
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />
      case 'vmclass':
        return <VMClassTab />
      case 'vcenter':
        return <VCenterTab />
      case 'custom':
        return <CustomChartsEditor />
      default:
        return null
    }
  }

  const OverviewTab = () => {
    if (loading && !summary) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )
    }

    const successRateNum = summary?.success_rate || 0
    const successColor = successRateNum >= 90 ? 'text-green-600' : successRateNum >= 70 ? 'text-yellow-600' : 'text-red-600'

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Provisions"
            value={summary?.total?.toLocaleString() || 0}
            subtitle={`Last ${timeframe}`}
          />
          <StatsCard
            title="Successful"
            value={summary?.successful?.toLocaleString() || 0}
            subtitle="Completed provisions"
          />
          <StatsCard
            title="Failed"
            value={summary?.failed?.toLocaleString() || 0}
            subtitle="Failed provisions"
          />
          <StatsCard
            title="Success Rate"
            value={`${successRateNum.toFixed(1)}%`}
            subtitle={`Last ${timeframe}`}
            className={successColor}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget
            title="Provisions Over Time"
            chartType="area"
            data={timeline.map(t => ({
              name: t.date,
              value: t.success + t.failed
            }))}
            colors={['#6366f1']}
            height={280}
          />

          <ChartWidget
            title="Success vs Failed"
            chartType="pie"
            data={[
              { name: 'Successful', value: summary?.successful || 0 },
              { name: 'Failed', value: summary?.failed || 0 }
            ]}
            colors={['#22c55e', '#ef4444']}
            height={280}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartWidget
            title="Hourly Distribution"
            chartType="bar"
            data={Array.from({ length: 24 }, (_, i) => {
              const hour = hourlyDist.find(h => h.hour === i)
              return {
                name: `${i.toString().padStart(2, '0')}:00`,
                value: hour?.count || 0
              }
            })}
            colors={['#f59e0b']}
            height={250}
          />

          <ChartWidget
            title="Failure Reasons"
            chartType="bar"
            data={failures.map(f => ({
              name: f.reason?.substring(0, 30) || 'Unknown',
              value: f.count
            }))}
            colors={['#ef4444']}
            height={250}
          />
        </div>
      </div>
    )
  }

  const VMClassTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWidget
          title="Provisions by VM Class"
          chartType="bar"
          data={vmClassStats.map(vc => ({
            name: vc.vm_class_name,
            value: vc.count
          }))}
          colors={['#8b5cf6']}
          height={300}
        />
        <ChartWidget
          title="Success Rate by VM Class"
          chartType="bar"
          data={vmClassStats.map(vc => ({
            name: vc.vm_class_name,
            value: vc.count > 0 ? (vc.success / vc.count * 100) : 0
          }))}
          colors={['#22c55e']}
          height={300}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Class</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Successful</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vmClassStats.map((item, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.vm_class_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.count}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.success}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.failed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.count > 0 ? (item.success / item.count * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const VCenterTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWidget
          title="Provisions by vCenter"
          chartType="bar"
          data={vCenterStats.map(vc => ({
            name: vc.vcenter_name,
            value: vc.count
          }))}
          colors={['#14b8a6']}
          height={300}
        />
        <ChartWidget
          title="Success Rate by vCenter"
          chartType="bar"
          data={vCenterStats.map(vc => ({
            name: vc.vcenter_name,
            value: vc.count > 0 ? (vc.success / vc.count * 100) : 0
          }))}
          colors={['#22c55e']}
          height={300}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">vCenter</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Successful</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vCenterStats.map((item, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.vcenter_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.count}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.success}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.failed}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.count > 0 ? (item.success / item.count * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Statistics</h2>
        
        {activeTab !== 'custom' && (
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              {['24h', '7d', '30d'].map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {renderTabContent()}
      </div>
    </div>
  )
}

export default StatsWidgets
