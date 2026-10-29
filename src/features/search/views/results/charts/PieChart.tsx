import type { ChartMetrics } from './types';

interface PieChartProps {
  data: Record<string, string | number>[];
  valueKey: string;
  metrics: ChartMetrics;
}

export function PieChart({ data, valueKey, metrics }: PieChartProps) {
  const { width, height, values, labels } = metrics;
  const total = values.reduce((sum, val) => sum + val, 0);
  let startAngle = 0;
  const radius = 55;
  const cx = width / 2;
  const cy = height / 2 - 10;
  const colors = ['#0066cc', '#34c759', '#ff9500', '#ff3b30', '#af52de'];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
    >
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const percentage = (val / (total || 1)) * 100;
        const angle = (val / (total || 1)) * 360;

        const x1 = cx + radius * Math.cos(((startAngle - 90) * Math.PI) / 180);
        const y1 = cy + radius * Math.sin(((startAngle - 90) * Math.PI) / 180);
        startAngle += angle;
        const x2 = cx + radius * Math.cos(((startAngle - 90) * Math.PI) / 180);
        const y2 = cy + radius * Math.sin(((startAngle - 90) * Math.PI) / 180);

        const largeArc = angle > 180 ? 1 : 0;
        const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        const labelAngle = startAngle - angle / 2 - 90;
        const lx = cx + (radius + 24) * Math.cos((labelAngle * Math.PI) / 180);
        const ly = cy + (radius + 12) * Math.sin((labelAngle * Math.PI) / 180);

        return (
          <g key={`slice-${labels[i] || i}`}>
            <path d={pathData} fill={colors[i % colors.length]} stroke="#ffffff" strokeWidth="2" />
            <text x={lx} y={ly} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1d1d1f">
              {labels[i]} ({Math.round(percentage)}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}
