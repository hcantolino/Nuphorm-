import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toggle } from '@/components/ui/toggle';
import { useChartSettings, type ChartType, type ColorScheme } from '@/stores/chartSettingsStore';
import {
  Grid3x3,
  Eye,
  Palette,
  Settings2,
  RotateCcw,
  Plus,
  Save,
  Zap,
  Download,
} from 'lucide-react';

interface UnifiedChartToolbarProps {
  onNewChart?: () => void;
  onSaveFile?: () => void;
  onGenerateReport?: () => void;
  onDownload?: () => void;
  isSavingFile?: boolean;
  isGeneratingReport?: boolean;
  isExporting?: boolean;
}

export function UnifiedChartToolbar({
  onNewChart,
  onSaveFile,
  onGenerateReport,
  onDownload,
  isSavingFile = false,
  isGeneratingReport = false,
  isExporting = false,
}: UnifiedChartToolbarProps) {
  const {
    chartType,
    showGrid,
    yZero,
    colorScheme,
    setChartType,
    toggleGrid,
    toggleYZero,
    setColorScheme,
    resetSettings,
  } = useChartSettings();

  const chartTypes: ChartType[] = ['line', 'bar', 'area', 'scatter'];
  const colorSchemes: ColorScheme[] = ['default', 'publication', 'dark', 'minimal', 'vibrant'];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      {/* Top Row: Action Buttons */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
        <Button
          variant="outline"
          size="sm"
          onClick={onNewChart}
          className="gap-2"
          title="Create a new analysis"
        >
          <Plus className="h-4 w-4" />
          New Analysis
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onSaveFile}
          disabled={isSavingFile}
          className="gap-2"
          title="Save chart as technical file"
        >
          <Save className="h-4 w-4" />
          {isSavingFile ? 'Saving...' : 'Save Technical File'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateReport}
          disabled={isGeneratingReport}
          className="gap-2"
          title="Generate analysis report"
        >
          <Zap className="h-4 w-4" />
          {isGeneratingReport ? 'Generating...' : 'Generate Report'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          disabled={isExporting}
          className="gap-2"
          title="Download chart"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Downloading...' : 'Download'}
        </Button>
      </div>

      {/* Bottom Row: Chart Editing Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Chart Type Dropdown */}
        <Select value={chartType} onValueChange={(value) => setChartType(value as ChartType)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Chart type" />
          </SelectTrigger>
          <SelectContent>
            {chartTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Grid Toggle */}
        <Toggle
          pressed={showGrid}
          onPressedChange={toggleGrid}
          aria-label="Toggle grid"
          title="Show/Hide Grid"
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Grid3x3 className="h-4 w-4" />
          <span className="ml-2 text-sm">Grid</span>
        </Toggle>

        {/* Y-Zero Toggle */}
        <Toggle
          pressed={yZero}
          onPressedChange={toggleYZero}
          aria-label="Toggle Y-Zero"
          title="Start Y-axis at zero"
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Eye className="h-4 w-4" />
          <span className="ml-2 text-sm">Y-Zero</span>
        </Toggle>

        {/* Color Scheme Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Palette className="h-4 w-4" />
              Colors
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {colorSchemes.map((scheme) => (
              <DropdownMenuItem
                key={scheme}
                onClick={() => setColorScheme(scheme)}
                className={colorScheme === scheme ? 'bg-accent' : ''}
              >
                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Presets Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Presets
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setColorScheme('publication')}>
              Publication
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setColorScheme('dark')}>
              Dark Mode
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setColorScheme('minimal')}>
              Minimal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setColorScheme('vibrant')}>
              Vibrant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSettings}
          title="Reset to default settings"
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );
}
