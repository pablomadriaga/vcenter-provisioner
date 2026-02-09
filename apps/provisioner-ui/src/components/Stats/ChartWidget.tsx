import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { Card } from '../UI/Card'

interface ChartData {
  name?: string
  label?: string
  value: number
  [key: string]: string | number | undefined
}

interface ChartWidgetProps {
  title: string
  chartType: 'line' | 'bar' | 'pie' | 'area'
  data: ChartData[]
  dataKey?: string
  xKey?: string
  colors?: string[]
  height?: number
  showLegend?: boolean
  className?: string
}

const DEFAULT_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  title,
  chartType,
  data,
  dataKey = 'value',
  xKey = 'name',
  colors = DEFAULT_COLORS,
  height = 300,
  showLegend = true,
  className = ''
}) => {
  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        )
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey={dataKey}
                nameKey={xKey}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        )
      default:
        return null
    }
  }

  return (
    <Card className={`p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {renderChart()}
    </Card>
  )
}

export default ChartWidget
