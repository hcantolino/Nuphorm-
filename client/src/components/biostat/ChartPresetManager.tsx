/**
 * ChartPresetManager Component
 * Allows users to save, load, and manage chart configuration presets
 * Presets are stored in localStorage for persistence
 */

import React, { useState, useEffect } from 'react';
import { useTabChart } from '@/hooks/useTabChart';
import { ChartConfig } from '@/stores/tabContentStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Save, Trash2, Download, Upload, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChartPreset {
  id: string;
  name: string;
  description: string;
  config: Partial<ChartConfig>;
  createdAt: number;
  isBuiltIn: boolean;
}

const BUILT_IN_PRESETS: ChartPreset[] = [
  {
    id: 'pharma-standard',
    name: 'Pharma Standard',
    description: 'Standard pharmaceutical analysis preset',
    config: {
      type: 'line',
      showGrid: true,
      yZero: true,
      colorScheme: 'default',
      customColors: {
        line: '#0066cc',
        grid: '#cccccc',
        background: '#ffffff',
        axisText: '#333333',
      },
    },
    createdAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: 'pharma-advanced',
    name: 'Pharma Advanced',
    description: 'Advanced multi-variable analysis',
    config: {
      type: 'scatter',
      showGrid: true,
      yZero: false,
      colorScheme: 'vibrant',
    },
    createdAt: Date.now(),
    isBuiltIn: true,
  },
  {
    id: 'publication-ready',
    name: 'Publication Ready',
    description: 'Optimized for publication and reports',
    config: {
      type: 'bar',
      showGrid: false,
      yZero: false,
      colorScheme: 'pastel',
      customColors: {
        line: '#000000',
        bar: '#333333',
        grid: '#ffffff',
        background: '#ffffff',
        axisText: '#000000',
      },
    },
    createdAt: Date.now(),
    isBuiltIn: true,
  },
];

const STORAGE_KEY = 'nuphorm-chart-presets';

export const ChartPresetManager: React.FC = () => {
  const { chartConfig, updateChartConfig } = useTabChart();
  const [presets, setPresets] = useState<ChartPreset[]>(BUILT_IN_PRESETS);
  const [isExpanded, setIsExpanded] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Load presets from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const customPresets = JSON.parse(saved) as ChartPreset[];
        setPresets([...BUILT_IN_PRESETS, ...customPresets]);
      } catch (error) {
        console.error('Failed to load presets:', error);
      }
    }
  }, []);

  // Save custom presets to localStorage
  const saveCustomPresets = (updatedPresets: ChartPreset[]) => {
    const customPresets = updatedPresets.filter(p => !p.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
  };

  // Save current config as a new preset
  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    const newPreset: ChartPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName,
      description: newPresetDescription,
      config: chartConfig,
      createdAt: Date.now(),
      isBuiltIn: false,
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    saveCustomPresets(updated);

    setNewPresetName('');
    setNewPresetDescription('');
    setShowSaveForm(false);
    toast.success(`Preset "${newPresetName}" saved successfully`);
  };

  // Load a preset
  const handleLoadPreset = (preset: ChartPreset) => {
    updateChartConfig(preset.config);
    toast.success(`Loaded preset "${preset.name}"`);
  };

  // Delete a custom preset
  const handleDeletePreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset?.isBuiltIn) {
      toast.error('Cannot delete built-in presets');
      return;
    }

    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    saveCustomPresets(updated);
    toast.success('Preset deleted');
  };

  // Export presets as JSON
  const handleExportPresets = () => {
    const customPresets = presets.filter(p => !p.isBuiltIn);
    const dataStr = JSON.stringify(customPresets, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chart-presets-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Presets exported');
  };

  // Import presets from JSON
  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as ChartPreset[];
        const updated = [...presets, ...imported];
        setPresets(updated);
        saveCustomPresets(updated);
        toast.success(`Imported ${imported.length} preset(s)`);
      } catch (error) {
        console.error('Failed to import presets:', error);
        toast.error('Failed to import presets');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Chart Presets
            </CardTitle>
            <CardDescription>
              Save and load chart configurations
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide' : 'Show'}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Save New Preset Form */}
          {showSaveForm ? (
            <div className="space-y-3 p-3 bg-muted rounded-lg">
              <Input
                placeholder="Preset name"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSavePreset}
                  className="flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Preset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSaveForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={() => setShowSaveForm(true)}
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Current Config as Preset
            </Button>
          )}

          {/* Presets List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No presets available
              </p>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {preset.name}
                      {preset.isBuiltIn && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Built-in)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {preset.description}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLoadPreset(preset)}
                      className="h-8 w-8 p-0"
                      title="Load preset"
                    >
                      ↻
                    </Button>
                    {!preset.isBuiltIn && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePreset(preset.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        title="Delete preset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Import/Export Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPresets}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <label className="flex-1">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </span>
              </Button>
              <input
                type="file"
                accept=".json"
                onChange={handleImportPresets}
                className="hidden"
              />
            </label>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ChartPresetManager;
