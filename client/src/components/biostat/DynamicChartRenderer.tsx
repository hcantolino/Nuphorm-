import React from 'react';
import {
  LineChart,
  BarChart,
  AreaChart,
  ScatterChart,
  Line,
  Bar,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useChartSettings } from '@/stores/chartSettingsStore';
import {
  getColorForScheme,
  getFillForScheme,
  getGridColorForScheme,
  getBackgroundColorForScheme,
} from '@/utils/chartColorSchemes';
import type { ChartType } from '@/stores/chartSettingsStore';

interface DynamicChartRendererProps {
  data: any[];
  width?: number;
  height?: number;
  xAxisKey?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

/**
 * DynamicChartRenderer
 * Renders charts dynamically based on chart type from settings store
 * Automatically applies color schemes and customizations
 */
export const DynamicChartRenderer: React.FC<DynamicChartRendererProps> = ({
  data,
  width = 700,
  height = 400,
  xAxisKey = 'name',
  yAxisLabel = '',
  xAxisLabel = '',
}) => {
  const { chartType, showGrid, yZero, colorScheme, customColors } = useChartSettings();

  // Get colors from scheme or custom colors
  const gridColor = customColors?.grid || getGridColorForScheme(colorScheme);
  const backgroundColor = customColors?.background || getBackgroundColorForScheme(colorScheme);

  // Determine which chart component to render
  const getChartComponent = (): React.ComponentType<any> => {
    switch (chartType) {
      case 'bar':
        return BarChart;
      case 'area':
        return AreaChart;
      case 'scatter':
        return ScatterChart;
      case 'line':
      default:
        return LineChart;
    }
  };

  const ChartComponent = getChartComponent();

  // Render series components based on chart type
  const renderSeries = () => {
    if (!data || data.length === 0) {
      return null;
    }

    // Get all numeric keys from the first data point (excluding xAxisKey)
    const firstDataPoint = data[0];
    const numericKeys = Object.keys(firstDataPoint).filter(
      (key) => key !== xAxisKey && typeof firstDataPoint[key] === 'number'
    );

    return numericKeys.map((key, index) => {
      const strokeColor = getColorForScheme(key, colorScheme, index);
      const fillColor = getFillForScheme(key, colorScheme, index);

      switch (chartType) {
        case 'bar':
          return (
            <Bar
              key={key}
              dataKey={key}
              fill={fillColor}
              stroke={strokeColor}
              name={key}
            />
          );
        case 'area':
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              fill={fillColor}
              stroke={strokeColor}
              name={key}
            />
          );
        case 'scatter':
          return (
            <Scatter
              key={key}
              dataKey={key}
              fill={strokeColor}
              name={key}
            />
          );
        case 'line':
        default:
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={strokeColor}
              name={key}
              dot={false}
              isAnimationActive={false}
            />
          );
      }
    });
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent
        data={data}
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
        style={{ backgroundColor }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
        <XAxis
          dataKey={xAxisKey}
          label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottomRight', offset: -5 } : undefined}
        />
        <YAxis
          domain={yZero ? [0, 'auto'] : ['dataMin', 'dataMax']}
          label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
        />
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} />
        {renderSeries()}
      </ChartComponent>
    </ResponsiveContainer>
  );
};

export default DynamicChartRenderer;
