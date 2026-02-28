import { X } from 'lucide-react';
import { useState } from 'react';

interface GlobalSettings {
  defaultChartType: string;
  defaultGridVisible: boolean;
  defaultYAxisZero: boolean;
  defaultLegendPosition: 'top' | 'right' | 'bottom';
  defaultLineColor: string;
  defaultBarColor: string;
  defaultGridColor: string;
  defaultChartBackground: string;
  defaultAxisTextColor: string;
}

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: GlobalSettings) => void;
}

const COLOR_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    lineColor: '#0693e3',
    barColor: '#0693e3',
    gridColor: '#e5e7eb',
    chartBackground: '#ffffff',
    axisTextColor: '#374151',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    lineColor: '#006994',
    barColor: '#00A8D8',
    gridColor: '#B8E6F5',
    chartBackground: '#F0F8FF',
    axisTextColor: '#003D5C',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    lineColor: '#FF6B35',
    barColor: '#F7931E',
    gridColor: '#FFE5CC',
    chartBackground: '#FFF5E6',
    axisTextColor: '#8B4513',
  },
  {
    id: 'forest',
    name: 'Forest',
    lineColor: '#2D6A4F',
    barColor: '#40916C',
    gridColor: '#D8F3DC',
    chartBackground: '#F1FAEE',
    axisTextColor: '#1B4332',
  },
  {
    id: 'grape',
    name: 'Grape',
    lineColor: '#7209B7',
    barColor: '#B5179E',
    gridColor: '#E0AAFF',
    chartBackground: '#F8F0FF',
    axisTextColor: '#5A189A',
  },
];

export default function GlobalSettingsModal({
  isOpen,
  onClose,
  onSave,
}: GlobalSettingsModalProps) {
  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const saved = localStorage.getItem('globalChartSettings');
    return saved
      ? JSON.parse(saved)
      : {
          defaultChartType: 'line',
          defaultGridVisible: true,
          defaultYAxisZero: false,
          defaultLegendPosition: 'right',
          defaultLineColor: '#0693e3',
          defaultBarColor: '#0693e3',
          defaultGridColor: '#e5e7eb',
          defaultChartBackground: '#ffffff',
          defaultAxisTextColor: '#374151',
        };
  });

  const handleSave = () => {
    localStorage.setItem('globalChartSettings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setSettings({
      ...settings,
      defaultLineColor: preset.lineColor,
      defaultBarColor: preset.barColor,
      defaultGridColor: preset.gridColor,
      defaultChartBackground: preset.chartBackground,
      defaultAxisTextColor: preset.axisTextColor,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Global Chart Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Default Chart Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Default Chart Type
            </label>
            <select
              value={settings.defaultChartType}
              onChange={(e) =>
                setSettings({ ...settings, defaultChartType: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['line', 'scatter', 'bar', 'area'].map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Color Presets */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Color Presets
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="p-3 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                  title={`Apply ${preset.name} preset`}
                >
                  <div className="space-y-1 mb-2">
                    <div
                      className="w-full h-6 rounded"
                      style={{ backgroundColor: preset.chartBackground, border: `1px solid ${preset.gridColor}` }}
                    />
                    <div className="flex gap-1">
                      <div
                        className="flex-1 h-3 rounded"
                        style={{ backgroundColor: preset.lineColor }}
                      />
                      <div
                        className="flex-1 h-3 rounded"
                        style={{ backgroundColor: preset.barColor }}
                      />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-700 text-center">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Custom Colors
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Line Color */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Line Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.defaultLineColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultLineColor: e.target.value })
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.defaultLineColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultLineColor: e.target.value })
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Bar Color */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Bar Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.defaultBarColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultBarColor: e.target.value })
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.defaultBarColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultBarColor: e.target.value })
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Grid Color */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Grid Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.defaultGridColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultGridColor: e.target.value })
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.defaultGridColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultGridColor: e.target.value })
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Chart Background */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Chart Background
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.defaultChartBackground}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultChartBackground: e.target.value })
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.defaultChartBackground}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultChartBackground: e.target.value })
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>

              {/* Axis Text Color */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">
                  Axis Text Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.defaultAxisTextColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultAxisTextColor: e.target.value })
                    }
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.defaultAxisTextColor}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultAxisTextColor: e.target.value })
                    }
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grid and Y-Axis Options */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.defaultGridVisible}
                onChange={(e) =>
                  setSettings({ ...settings, defaultGridVisible: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Show Grid by Default</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.defaultYAxisZero}
                onChange={(e) =>
                  setSettings({ ...settings, defaultYAxisZero: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Y-Axis Starts at Zero</span>
            </label>
          </div>

          {/* Legend Position */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Default Legend Position
            </label>
            <div className="flex gap-4">
              {(['top', 'right', 'bottom'] as const).map((position) => (
                <label key={position} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="legendPosition"
                    value={position}
                    checked={settings.defaultLegendPosition === position}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultLegendPosition: e.target.value as 'top' | 'right' | 'bottom',
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">
                    {position.charAt(0).toUpperCase() + position.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
