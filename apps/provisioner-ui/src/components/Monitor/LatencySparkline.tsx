import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ProbeResult } from '../../hooks/useMonitoringHistory';

interface LatencySparklineProps {
  data: ProbeResult[];
  serviceName: string;
  height?: number;
}

export const LatencySparkline: React.FC<LatencySparklineProps> = ({
  data,
  serviceName,
  height = 200,
}) => {
  const chartData = useMemo(() => {
    const filtered = data
      .filter((d) => d.target === serviceName)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-100);

    return filtered.map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      latency: d.latency_ms > 0 ? d.latency_ms : 0,
      status: d.status,
    }));
  }, [data, serviceName]);

  const stats = useMemo(() => {
    const latencies = chartData.filter((d) => d.latency > 0).map((d) => d.latency);
    if (latencies.length === 0) {
      return { min: 0, avg: 0, max: 0 };
    }
    return {
      min: Math.min(...latencies),
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      max: Math.max(...latencies),
    };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm" style={{ color: data.status === 'up' ? '#10b981' : '#ef4444' }}>
            {data.status === 'up' ? 'Up' : 'Down'}: {data.latency}ms
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Latency Trend</h3>
          <p className="text-sm text-gray-500">{serviceName}</p>
        </div>

        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-gray-500">Min</p>
            <p className="font-medium text-green-600">{stats.min}ms</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Avg</p>
            <p className="font-medium text-indigo-600">{stats.avg}ms</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500">Max</p>
            <p className="font-medium text-red-600">{stats.max}ms</p>
          </div>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              domain={[0, 'dataMax + 20']}
              tickFormatter={(value) => `${value}ms`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="latency"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#latencyGradient)"
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.status !== 'up') {
                  return (
                    <circle
                      key={props.key}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#ef4444"
                    />
                  );
                }
                return null;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[200px] text-gray-400">
          No data available
        </div>
      )}
    </div>
  );
};

export default LatencySparkline;
