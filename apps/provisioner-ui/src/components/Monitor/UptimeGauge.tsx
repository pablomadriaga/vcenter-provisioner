import React from 'react';

interface UptimeGaugeProps {
  uptime: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  details?: {
    up: number;
    down: number;
    total: number;
  };
}

const SIZE_CONFIG = {
  sm: { width: 120, height: 80, textSize: 'text-xl', labelSize: 'text-xs' },
  md: { width: 180, height: 120, textSize: 'text-3xl', labelSize: 'text-sm' },
  lg: { width: 240, height: 160, textSize: 'text-4xl', labelSize: 'text-base' },
};

const getUptimeColor = (uptime: number): string => {
  if (uptime >= 99) return '#10b981';
  if (uptime >= 95) return '#f59e0b';
  if (uptime >= 90) return '#f97316';
  return '#ef4444';
};

export const UptimeGauge: React.FC<UptimeGaugeProps> = ({
  uptime,
  label,
  size = 'md',
  showDetails = false,
  details,
}) => {
  const config = SIZE_CONFIG[size];
  const radius = config.width / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (uptime / 100) * circumference;

  const color = getUptimeColor(uptime);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
        {details && (
          <span className="text-sm text-gray-500">
            {details.total} probes
          </span>
        )}
      </div>

      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: config.width, height: config.height }}>
          <svg
            viewBox={`0 0 ${config.width} ${config.height}`}
            className="transform -rotate-90"
          >
            <circle
              cx={config.width / 2}
              cy={config.height / 2}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
            />
            <circle
              cx={config.width / 2}
              cy={config.height / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`${config.textSize} font-bold`}
              style={{ color }}
            >
              {uptime}%
            </span>
            <span className={`${config.labelSize} text-gray-500`}>
              Uptime
            </span>
          </div>
        </div>

        {showDetails && details && (
          <div className="mt-4 w-full">
            <div className="flex justify-between text-sm">
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                <span className="text-gray-600">Up: {details.up}</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 rounded-full bg-red-500 mr-2" />
                <span className="text-gray-600">Down: {details.down}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UptimeGauge;
