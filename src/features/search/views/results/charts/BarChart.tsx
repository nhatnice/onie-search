import type { ChartMetrics } from './types';

interface BarChartProps {
  data: Record<string, string | number>[];
  valueKey: string;
  metrics: ChartMetrics;
}

export function BarChart({ data, valueKey, metrics }: BarChartProps) {
  const {
    width,
    height,
    paddingLeft,
    paddingRight,
    paddingTop,
    chartWidth,
    chartHeight,
    minVal,
    maxVal,
    labels,
  } = metrics;
  const barWidth = (chartWidth / data.length) * 0.6;
  const barGap = (chartWidth / data.length) * 0.4;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = paddingTop + chartHeight * (1 - ratio);
        const val = Math.round(minVal + (maxVal - minVal) * ratio);
        return (
          <g key={`ratio-${ratio}`}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />
            <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#86868b">
              {val.toLocaleString()}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const ratio = (val - minVal) / (maxVal - minVal);
        const barHeight = chartHeight * ratio;
        const x = paddingLeft + i * (barWidth + barGap) + barGap / 2;
        const y = paddingTop + chartHeight - barHeight;
        return (
          <g key={`bar-${labels[i] || i}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill="#0066cc" rx="4" />
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#1d1d1f"
            >
              {val.toLocaleString()}
            </text>
            <text
              x={x + barWidth / 2}
              y={paddingTop + chartHeight + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#86868b"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
