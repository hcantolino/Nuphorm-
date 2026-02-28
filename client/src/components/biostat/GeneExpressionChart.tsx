import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ErrorBar,
} from 'recharts';

interface ChartDataPoint {
  gene_id: string;
  log2_fold_change: number;
  error: number;
}

interface GeneExpressionChartProps {
  data: ChartDataPoint[];
  title?: string;
  height?: number;
}

/**
 * Gene Expression Chart Component
 * Displays fold-change values as bar chart with error bars for standard deviation
 */
export const GeneExpressionChart: React.FC<GeneExpressionChartProps> = ({
  data,
  title = 'Gene Expression Fold Change',
  height = 400,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No data available for visualization</p>
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = data.map((d) => ({
    name: d.gene_id,
    'Log2 Fold Change': d.log2_fold_change,
    error: d.error,
  }));

  return (
    <div className="w-full h-full bg-white rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Log2 Fold Change', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
            }}
            formatter={(value: any) => {
              if (typeof value === 'number') {
                return value.toFixed(3);
              }
              return value;
            }}
          />
          <Legend />
          <Bar
            dataKey="Log2 Fold Change"
            fill="#3b82f6"
            radius={[8, 8, 0, 0]}
          >
            <ErrorBar
              dataKey="error"
              width={4}
              stroke="#ef4444"
              strokeWidth={2}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <span className="font-semibold">Red error bars</span> represent standard
          deviation of log2 fold-change across all genes
        </p>
      </div>
    </div>
  );
};

export default GeneExpressionChart;
