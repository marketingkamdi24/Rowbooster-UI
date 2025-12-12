import React from 'react';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  height?: number;
  defaultColor?: string;
  showValues?: boolean;
  showLabels?: boolean;
  horizontal?: boolean;
  highlightIndex?: number;
}

export function BarChart({
  data,
  height = 200,
  defaultColor = '#4191FF',
  showValues = true,
  showLabels = true,
  horizontal = false,
  highlightIndex
}: BarChartProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barGap = 4;

  if (horizontal) {
    return (
      <div className="w-full space-y-2">
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const isHighlighted = highlightIndex === index;
          const barColor = item.color || defaultColor;
          
          return (
            <div key={index} className="flex items-center gap-3">
              {showLabels && (
                <div className="w-16 text-xs text-gray-400 text-right truncate">
                  {item.label}
                </div>
              )}
              <div className="flex-1 h-6 bg-gray-800/50 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-500 flex items-center justify-end pr-2"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: isHighlighted ? '#FF5050' : barColor,
                    boxShadow: `0 0 10px ${isHighlighted ? 'rgba(255, 80, 80, 0.5)' : `${barColor}40`}`,
                  }}
                >
                  {showValues && (
                    <span className="text-xs font-bold text-white">
                      {item.value.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <div className="h-full flex items-end justify-between gap-1 px-2">
        {data.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const isHighlighted = highlightIndex === index;
          const barColor = item.color || defaultColor;
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="relative w-full flex-1 flex items-end justify-center">
                {showValues && (
                  <span
                    className="absolute -top-6 text-xs font-bold"
                    style={{ color: barColor }}
                  >
                    {item.value >= 1000 
                      ? `${(item.value / 1000).toFixed(1)}k`
                      : item.value.toLocaleString()}
                  </span>
                )}
                <div
                  className="w-full max-w-[40px] rounded-t transition-all duration-500"
                  style={{
                    height: `${Math.max(percentage, 2)}%`,
                    backgroundColor: isHighlighted ? '#FF5050' : barColor,
                    boxShadow: `0 0 15px ${isHighlighted ? 'rgba(255, 80, 80, 0.5)' : `${barColor}40`}`,
                  }}
                />
              </div>
              {showLabels && (
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface StackedBarData {
  label: string;
  segments: {
    label: string;
    value: number;
    color: string;
  }[];
}

interface StackedBarChartProps {
  data: StackedBarData[];
  height?: number;
  showLabels?: boolean;
}

export function StackedBarChart({
  data,
  height = 200,
  showLabels = true
}: StackedBarChartProps) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(
    ...data.map(d => d.segments.reduce((sum, s) => sum + s.value, 0)),
    1
  );

  return (
    <div className="w-full" style={{ height }}>
      <div className="h-full flex items-end justify-between gap-1 px-2">
        {data.map((bar, barIndex) => {
          const total = bar.segments.reduce((sum, s) => sum + s.value, 0);
          const percentage = (total / maxTotal) * 100;
          
          return (
            <div key={barIndex} className="flex-1 flex flex-col items-center gap-2">
              <div
                className="relative w-full max-w-[40px] flex flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${Math.max(percentage, 2)}%` }}
              >
                {bar.segments.map((segment, segIndex) => {
                  const segmentPercent = total > 0 ? (segment.value / total) * 100 : 0;
                  return (
                    <div
                      key={segIndex}
                      className="w-full transition-all duration-500"
                      style={{
                        height: `${segmentPercent}%`,
                        backgroundColor: segment.color,
                        minHeight: segment.value > 0 ? '4px' : '0',
                      }}
                      title={`${segment.label}: ${segment.value}`}
                    />
                  );
                })}
              </div>
              {showLabels && (
                <span className="text-[10px] text-gray-500 whitespace-nowrap">
                  {bar.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Progress bar variation
interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({
  value,
  max = 100,
  label,
  color = '#4191FF',
  showPercentage = true,
  size = 'md'
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const heightClass = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-6' : 'h-4';

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-gray-400">{label}</span>}
          {showPercentage && (
            <span className="text-sm font-bold" style={{ color }}>
              {percentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-800/50 rounded overflow-hidden ${heightClass}`}>
        <div
          className={`h-full rounded transition-all duration-500`}
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`,
          }}
        />
      </div>
    </div>
  );
}