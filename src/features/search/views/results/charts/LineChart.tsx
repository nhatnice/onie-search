import type { ChartMetrics } from './types';

interface LineChartProps {
  data: Record<string, string | number>[];
  valueKey: string;
  metrics: ChartMetrics;
}

interface Point {
  x: number;
  y: number;
  val: number;
  label: string;
}

function GridLines({
  paddingLeft,
  paddingRight,
  width,
  paddingTop,
  chartHeight,
  minVal,
  maxVal,
}: {
  paddingLeft: number;
  paddingRight: number;
  width: number;
  paddingTop: number;
  chartHeight: number;
  minVal: number;
  maxVal: number;
}) {
  return (
    <>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = paddingTop + chartHeight * (1 - ratio);
        const val = Math.round(minVal + (maxVal - minVal) * ratio);
        return (
          <g key={`grid-${ratio}`}>
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
    </>
  );
}

function PointMarkers({
  points,
  paddingTop,
  chartHeight,
}: {
  points: Point[];
  paddingTop: number;
  chartHeight: number;
}) {
  return (
    <>
      {points.map((p, i) => (
        <g key={`pt-${p.label || i}`}>
          <circle cx={p.x} cy={p.y} r="5" fill="#0066cc" stroke="#ffffff" strokeWidth="2" />
          <text
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#1d1d1f"
          >
            {p.val.toLocaleString()}
          </text>
          <text
            x={p.x}
            y={paddingTop + chartHeight + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#86868b"
          >
            {p.label}
          </text>
        </g>
      ))}
    </>
  );
}

export function LineChart({ data, valueKey, metrics }: LineChartProps) {
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
  const points: Point[] = data.map((d, i) => {
    const val = Number(d[valueKey] || 0);
    const ratio = (val - minVal) / (maxVal - minVal);
    const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - chartHeight * ratio;
    return { x, y, val, label: labels[i] };
  });

  const pathD = points.reduce(
    (acc, p, i) => acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`),
    '',
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
    >
      <GridLines
        paddingLeft={paddingLeft}
        paddingRight={paddingRight}
        width={width}
        paddingTop={paddingTop}
        chartHeight={chartHeight}
        minVal={minVal}
        maxVal={maxVal}
      />
      <path
        d={pathD}
        fill="none"
        stroke="#0066cc"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <PointMarkers points={points} paddingTop={paddingTop} chartHeight={chartHeight} />
    </svg>
  );
}
