import React, { useState, useMemo } from 'react';
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
  Brush,
  ComposedChart,
} from 'recharts';
import { useChartSettings } from '@/stores/chartSettingsStore';
import {
  getColorForScheme,
  getFillForScheme,
  getGridColorForScheme,
  getBackgroundColorForScheme,
} from '@/utils/chartColorSchemes';
import type { ChartType } from '@/stores/chartSettingsStore';

interface PremiumChartRendererProps {
  data: any[];
  width?: number;
  height?: number;
  xAxisKey?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showBrush?: boolean;
  enableLegendToggle?: boolean;
}

/**
 * CustomTooltip
 * Formats tooltip content with metric name, value, and unit
 */
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
          {label}
        </p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            <span className="font-medium">{entry.name}:</span> {entry.value?.toFixed(3) || entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * PremiumChartRenderer
 * Enhanced chart component with:
 * - Custom formatted tooltips
 * - External legend with interactive toggle
 * - Zoom/pan via Brush
 * - Full responsiveness
 */
export const PremiumChartRenderer: React.FC<PremiumChartRendererProps> = ({
  data,
  width = 700,
  height = 400,
  xAxisKey = 'name',
  yAxisLabel = '',
  xAxisLabel = '',
  showBrush = true,
  enableLegendToggle = true,
}) => {
  const { chartType, showGrid, yZero, colorScheme, customColors } = useChartSettings();
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

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

  // Get all numeric keys for legend
  const numericKeys = useMemo(() => {
    if (!data || data.length === 0) return [];
    const firstDataPoint = data[0];
    return Object.keys(firstDataPoint).filter(
      (key) => key !== xAxisKey && typeof firstDataPoint[key] === 'number'
    );
  }, [data, xAxisKey]);

  // Handle legend click to toggle visibility
  const handleLegendClick = (e: any) => {
    if (!enableLegendToggle) return;
    
    const dataKey = e.dataKey;
    setHiddenSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  };

  // Render series components based on chart type
  const renderSeries = () => {
    if (!data || data.length === 0) {
      return null;
    }

    return numericKeys.map((key, index) => {
      // Skip hidden series
      if (hiddenSeries.has(key)) {
        return null;
      }

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
              isAnimationActive={false}
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
              isAnimationActive={false}
              opacity={0.8}
            />
          );
        case 'scatter':
          return (
            <Scatter
              key={key}
              dataKey={key}
              fill={strokeColor}
              name={key}
              isAnimationActive={false}
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
              strokeWidth={2}
            />
          );
      }
    });
  };

  // Calculate responsive height for brush
  const brushHeight = showBrush ? 40 : 0;
  const chartHeight = height - brushHeight - 20;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Chart Container */}
      <div className="flex-1 min-h-0" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
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
            {/* Custom Tooltip */}
            <Tooltip content={<CustomTooltip />} />
            {/* External Legend with Toggle */}
            <Legend
              verticalAlign="bottom"
              height={36}
              onClick={handleLegendClick}
              wrapperStyle={{
                cursor: enableLegendToggle ? 'pointer' : 'default',
                paddingTop: '10px',
              }}
            />
            {renderSeries()}
            {/* Brush for Zoom/Pan */}
            {showBrush && <Brush dataKey={xAxisKey} height={30} stroke={gridColor} />}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Legend Info Text */}
      {enableLegendToggle && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-4">
          {hiddenSeries.size > 0 && (
            <p>
              Showing {numericKeys.length - hiddenSeries.size} of {numericKeys.length} series
              {hiddenSeries.size > 0 && (
                <button
                  onClick={() => setHiddenSeries(new Set())}
                  className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Show all
                </button>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default PremiumChartRenderer;
