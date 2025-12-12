import React from 'react';

interface DonutChartProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export function DonutChart({
  data,
  size = 160,
  strokeWidth = 20,
  centerLabel,
  centerValue
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  let cumulativePercent = 0;
  
  const segments = data.map((item, index) => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -(cumulativePercent / 100) * circumference;
    
    cumulativePercent += percent;
    
    return (
      <circle
        key={index}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={item.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="transition-all duration-500"
        style={{
          filter: `drop-shadow(0 0 4px ${item.color}40)`,
        }}
      />
    );
  });

  return (
    <div className="donut-chart relative inline-block" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(65, 145, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {segments}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="donut-chart-center absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          {centerValue && (
            <div className="text-xl font-bold text-white">{centerValue}</div>
          )}
          {centerLabel && (
            <div className="text-xs text-gray-400">{centerLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface DonutLegendProps {
  data: {
    label: string;
    value: number;
    color: string;
  }[];
  showPercentage?: boolean;
}

export function DonutLegend({ data, showPercentage = true }: DonutLegendProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="space-y-2">
      {data.map((item, index) => {
        const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
        return (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-300">{item.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">{item.value.toLocaleString()}</span>
              {showPercentage && (
                <span className="text-gray-500 text-xs">({percent}%)</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}