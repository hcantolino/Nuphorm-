import { ChevronDown, TrendingUp, Grid3x3, Eye, Settings } from 'lucide-react';
import { useState } from 'react';

interface ChartSettingsBarProps {
  chartType: 'line' | 'scatter' | 'bar' | 'area';
  onChartTypeChange: (type: 'line' | 'scatter' | 'bar' | 'area') => void;
  gridVisible: boolean;
  onGridToggle: (visible: boolean) => void;
  yAxisStartAtZero: boolean;
  onYAxisToggle: (startAtZero: boolean) => void;
  lineColor: string;
  onLineColorChange: (color: string) => void;
  barColor: string;
  onBarColorChange: (color: string) => void;
  gridColor: string;
  onGridColorChange: (color: string) => void;
  chartBackground: string;
  onChartBackgroundChange: (color: string) => void;
  axisTextColor: string;
  onAxisTextColorChange: (color: string) => void;
  onOpenGlobalSettings: () => void;
}

export default function ChartSettingsBar({
  chartType,
  onChartTypeChange,
  gridVisible,
  onGridToggle,
  yAxisStartAtZero,
  onYAxisToggle,
  lineColor,
  onLineColorChange,
  barColor,
  onBarColorChange,
  gridColor,
  onGridColorChange,
  chartBackground,
  onChartBackgroundChange,
  axisTextColor,
  onAxisTextColorChange,
  onOpenGlobalSettings,
}: ChartSettingsBarProps) {
  const [showChartTypeMenu, setShowChartTypeMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  const chartTypes = ['line', 'scatter', 'bar', 'area'];

  const handleColorChange = (colorType: string, color: string) => {
    switch (colorType) {
      case 'line':
        onLineColorChange(color);
        break;
      case 'bar':
        onBarColorChange(color);
        break;
      case 'grid':
        onGridColorChange(color);
        break;
      case 'background':
        onChartBackgroundChange(color);
        break;
      case 'axis':
        onAxisTextColorChange(color);
        break;
    }
  };

  return (
    <div className="px-6 py-2 border-b border-gray-200 bg-white flex items-center gap-3 flex-wrap">
      {/* Chart Type Selector */}
      <div className="relative">
        <button
          onClick={() => setShowChartTypeMenu(!showChartTypeMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors"
          title="Change chart type"
        >
          <TrendingUp className="w-4 h-4" />
          {chartType ? chartType.charAt(0).toUpperCase() + chartType.slice(1) : 'Chart Type'}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showChartTypeMenu && (
          <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            {chartTypes.map((type) => (
              <button
                key={type}
                onClick={() => {
                  onChartTypeChange(type as 'line' | 'scatter' | 'bar' | 'area');
                  setShowChartTypeMenu(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  chartType === type
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid Toggle */}
      <button
        onClick={() => onGridToggle(!gridVisible)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
          gridVisible
            ? 'text-blue-600 bg-blue-50 rounded'
            : 'text-gray-700 hover:text-gray-900'
        }`}
        title="Toggle grid"
      >
        <Grid3x3 className="w-4 h-4" />
        Grid
      </button>

      {/* Y-Zero Toggle */}
      <button
        onClick={() => onYAxisToggle(!yAxisStartAtZero)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
          yAxisStartAtZero
            ? 'text-blue-600 bg-blue-50 rounded'
            : 'text-gray-700 hover:text-gray-900'
        }`}
        title="Y-axis starts at zero"
      >
        <Eye className="w-4 h-4" />
        Y-Zero
      </button>

      {/* Color Picker Button */}
      <div className="relative">
        <button
          onClick={() => setShowColorMenu(!showColorMenu)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors border border-gray-300 rounded"
          title="Customize colors"
        >
          <div className="flex gap-1">
            <div
              className="w-3 h-3 rounded-full border border-gray-400"
              style={{ backgroundColor: lineColor }}
            />
            <div
              className="w-3 h-3 rounded-full border border-gray-400"
              style={{ backgroundColor: gridColor }}
            />
            <div
              className="w-3 h-3 rounded-full border border-gray-400"
              style={{ backgroundColor: chartBackground }}
            />
          </div>
          Colors
          <ChevronDown className="w-3 h-3" />
        </button>

        {showColorMenu && (
          <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4">
            <div className="space-y-3">
              {/* Line Color */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Line Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={lineColor}
                    onChange={(e) => handleColorChange('line', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={lineColor}
                    onChange={(e) => handleColorChange('line', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="#0693e3"
                  />
                </div>
              </div>

              {/* Bar Color */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Bar Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={barColor}
                    onChange={(e) => handleColorChange('bar', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={barColor}
                    onChange={(e) => handleColorChange('bar', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="#0693e3"
                  />
                </div>
              </div>

              {/* Grid Color */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Grid Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={gridColor}
                    onChange={(e) => handleColorChange('grid', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={gridColor}
                    onChange={(e) => handleColorChange('grid', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="#e5e7eb"
                  />
                </div>
              </div>

              {/* Chart Background */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Chart Background
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={chartBackground}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={chartBackground}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="#ffffff"
                  />
                </div>
              </div>

              {/* Axis Text Color */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Axis Text Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={axisTextColor}
                    onChange={(e) => handleColorChange('axis', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={axisTextColor}
                    onChange={(e) => handleColorChange('axis', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    placeholder="#374151"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Presets Button */}
      <button
        onClick={onOpenGlobalSettings}
        className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors"
        title="Open presets"
      >
        <Settings className="w-4 h-4" />
        Presets
      </button>
    </div>
  );
}
