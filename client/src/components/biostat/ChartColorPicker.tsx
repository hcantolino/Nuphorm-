/**
 * ChartColorPicker Component
 * Provides UI for customizing chart element colors
 * Supports: line, bar, grid, background, axis text
 */

import React, { useState } from 'react';
import { useTabChart } from '@/hooks/useTabChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, RotateCcw } from 'lucide-react';

interface ColorOption {
  key: 'line' | 'bar' | 'grid' | 'background' | 'axisText';
  label: string;
  description: string;
  defaultColor: string;
}

const COLOR_OPTIONS: ColorOption[] = [
  {
    key: 'line',
    label: 'Line Color',
    description: 'Color for line charts and data lines',
    defaultColor: '#0693e3',
  },
  {
    key: 'bar',
    label: 'Bar Color',
    description: 'Color for bar charts',
    defaultColor: '#f59e0b',
  },
  {
    key: 'grid',
    label: 'Grid Color',
    description: 'Color for grid lines',
    defaultColor: '#e5e7eb',
  },
  {
    key: 'background',
    label: 'Background Color',
    description: 'Chart background color',
    defaultColor: '#ffffff',
  },
  {
    key: 'axisText',
    label: 'Axis Text Color',
    description: 'Color for axis labels and text',
    defaultColor: '#374151',
  },
];

export const ChartColorPicker: React.FC = () => {
  const { chartConfig, setCustomColors } = useTabChart();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleColorChange = (key: ColorOption['key'], color: string) => {
    setCustomColors({
      ...chartConfig.customColors,
      [key]: color,
    });
  };

  const handleReset = () => {
    setCustomColors({});
  };

  const getColorValue = (key: ColorOption['key']): string => {
    return chartConfig.customColors?.[key] || COLOR_OPTIONS.find((opt) => opt.key === key)?.defaultColor || '#000000';
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            <div>
              <CardTitle className="text-lg">Chart Colors</CardTitle>
              <CardDescription>Customize colors for chart elements</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-auto"
          >
            {isExpanded ? '−' : '+'}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Color Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {COLOR_OPTIONS.map((option) => (
              <div key={option.key} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {option.label}
                </label>
                <p className="text-xs text-gray-500">{option.description}</p>

                <div className="flex gap-2 items-center">
                  {/* Color Preview */}
                  <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
                    style={{ backgroundColor: getColorValue(option.key) }}
                    title={getColorValue(option.key)}
                  />

                  {/* Color Input */}
                  <div className="flex-1 flex gap-2">
                    <input
                      type="color"
                      value={getColorValue(option.key)}
                      onChange={(e) => handleColorChange(option.key, e.target.value)}
                      className="w-12 h-12 cursor-pointer rounded border border-gray-300"
                      title={`Pick ${option.label.toLowerCase()}`}
                    />

                    {/* Hex Value Display */}
                    <input
                      type="text"
                      value={getColorValue(option.key)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (/^#[0-9A-F]{6}$/i.test(value)) {
                          handleColorChange(option.key, value);
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Color Presets */}
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Presets</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* Default Colors */}
              <button
                onClick={() => handleReset()}
                className="p-2 text-xs border rounded hover:bg-gray-50 transition-colors"
                title="Reset to default colors"
              >
                <div className="flex gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0693e3' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#e5e7eb' }} />
                </div>
                <span>Default</span>
              </button>

              {/* Pharma Standard */}
              <button
                onClick={() =>
                  setCustomColors({
                    line: '#0066cc',
                    bar: '#00aa44',
                    grid: '#cccccc',
                    background: '#ffffff',
                    axisText: '#333333',
                  })
                }
                className="p-2 text-xs border rounded hover:bg-gray-50 transition-colors"
                title="Pharma standard colors"
              >
                <div className="flex gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#0066cc' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00aa44' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#cccccc' }} />
                </div>
                <span>Pharma</span>
              </button>

              {/* Vibrant */}
              <button
                onClick={() =>
                  setCustomColors({
                    line: '#ff0055',
                    bar: '#00d4ff',
                    grid: '#ffaa00',
                    background: '#ffffff',
                    axisText: '#000000',
                  })
                }
                className="p-2 text-xs border rounded hover:bg-gray-50 transition-colors"
                title="Vibrant colors"
              >
                <div className="flex gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ff0055' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#00d4ff' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ffaa00' }} />
                </div>
                <span>Vibrant</span>
              </button>

              {/* Pastel */}
              <button
                onClick={() =>
                  setCustomColors({
                    line: '#a8d8ea',
                    bar: '#f7cac9',
                    grid: '#f0e6d2',
                    background: '#ffffff',
                    axisText: '#555555',
                  })
                }
                className="p-2 text-xs border rounded hover:bg-gray-50 transition-colors"
                title="Pastel colors"
              >
                <div className="flex gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#a8d8ea' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f7cac9' }} />
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f0e6d2' }} />
                </div>
                <span>Pastel</span>
              </button>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ChartColorPicker;
