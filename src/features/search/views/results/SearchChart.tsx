import type { ChartData } from '../../api/services/search-service';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { PieChart } from './charts/PieChart';
import type { ChartMetrics } from './charts/types';

export function cleanAndParseFloat(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getChartMetrics(
  data: Record<string, string | number>[],
  valueKey: string,
  labelKey: string,
): ChartMetrics {
  const width = 500;
  const height = 200;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const values = data.map((d) => cleanAndParseFloat(d[valueKey]));
  const labels = data.map((d) => {
    const v = d[labelKey];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  });
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  return {
    width,
    height,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    chartWidth: width - paddingLeft - paddingRight,
    chartHeight: height - paddingTop - paddingBottom,
    maxVal,
    minVal,
    values,
    labels,
  };
}

export function SearchChart({ chart }: { chart: ChartData }) {
  const { type, data } = chart;
  if (!data || data.length === 0) return null;

  const sample = data[0];
  const keys = Object.keys(sample);
  let valueKey = '';
  let labelKey = '';

  for (const key of keys) {
    const val = sample[key];
    const parsed = cleanAndParseFloat(val);
    if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parsed) && parsed !== 0)) {
      valueKey = key;
    } else {
      labelKey = key;
    }
  }

  if (!valueKey) valueKey = keys[1] || keys[0];
  if (!labelKey) labelKey = keys[0];

  const metrics = getChartMetrics(data, valueKey, labelKey);

  if (type === 'bar') {
    return <BarChart data={data} valueKey={valueKey} metrics={metrics} />;
  }
  if (type === 'line') {
    return <LineChart data={data} valueKey={valueKey} metrics={metrics} />;
  }
  return <PieChart data={data} valueKey={valueKey} metrics={metrics} />;
}
