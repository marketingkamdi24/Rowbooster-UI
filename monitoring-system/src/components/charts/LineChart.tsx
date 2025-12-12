import React from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  showDots?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  animate?: boolean;
}

export function LineChart({
  data,
  height = 200,
  lineColor = '#4191FF',
  fillColor = 'rgba(65, 145, 255, 0.1)',
  showDots = true,
  showGrid = true,
  showLabels = true,
  animate = true
}: LineChartProps) {
  if (data.length === 0) return null;

  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = 100; // Using percentages for responsiveness
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const valueRange = maxValue - minValue || 1;

  // Calculate points as percentages
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: ((maxValue - d.value) / valueRange) * chartHeight + padding.top,
    value: d.value,
    label: d.label
  }));

  // Create path
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
    .join(' ');

  // Create fill path
  const fillPath = `
    ${pathData}
    L ${points[points.length - 1].x}% ${chartHeight + padding.top}
    L 0% ${chartHeight + padding.top}
    Z
  `;

  // Grid lines
  const gridLines = showGrid ? [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    y: padding.top + chartHeight * ratio,
    value: maxValue - valueRange * ratio
  })) : [];

  return (
    <div className="w-full relative" style={{ height }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Grid lines */}
        {gridLines.map((line, i) => (
          <g key={i}>
            <line
              x1="0%"
              y1={line.y}
              x2="100%"
              y2={line.y}
              stroke="rgba(65, 145, 255, 0.1)"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {/* Fill area */}
        <path
          d={fillPath}
          fill={fillColor}
          className={animate ? 'animate-fade-in' : ''}
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0 0 4px ${lineColor}80)`,
          }}
          className={animate ? 'animate-draw-line' : ''}
        />

        {/* Dots */}
        {showDots && points.map((p, i) => (
          <g key={i} className="group">
            <circle
              cx={`${p.x}%`}
              cy={p.y}
              r="4"
              fill={lineColor}
              stroke="white"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="transition-all duration-200"
              style={{
                filter: `drop-shadow(0 0 4px ${lineColor}80)`,
              }}
            />
            {/* Hover area */}
            <circle
              cx={`${p.x}%`}
              cy={p.y}
              r="12"
              fill="transparent"
              className="cursor-pointer"
            />
          </g>
        ))}
      </svg>

      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between py-4 pr-2">
        {gridLines.map((line, i) => (
          <span key={i} className="text-xs text-gray-500">
            {line.value >= 1000 ? `${(line.value / 1000).toFixed(1)}k` : line.value.toFixed(0)}
          </span>
        ))}
      </div>

      {/* X-axis labels */}
      {showLabels && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pt-2">
          {data.map((d, i) => (
            <span key={i} className="text-xs text-gray-500 truncate max-w-[60px]">
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface MiniLineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function MiniLineChart({
  data,
  width = 100,
  height = 40,
  color = '#4191FF'
}: MiniLineChartProps) {
  if (data.length < 2) return null;

  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((value, i) => ({
    x: (i / (data.length - 1)) * width,
    y: ((maxValue - value) / range) * height
  }));

  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}60)` }}
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={color}
        style={{ filter: `drop-shadow(0 0 3px ${color}80)` }}
      />
    </svg>
  );
}