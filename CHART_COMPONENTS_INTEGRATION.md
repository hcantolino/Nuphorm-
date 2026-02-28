# Complete Chart Components Integration Guide

This guide shows how to integrate the color picker, preset manager, and updated toolbar into your ChartArea component for complete chart configuration management.

## Components Overview

1. **ChartColorPicker** - Customize individual chart element colors
2. **ChartPresetManager** - Save, load, and manage chart presets
3. **UnifiedChartToolbar** (updated) - Wire to useTabChart hook for chart type, grid, Y-zero controls

## Step 1: Update UnifiedChartToolbar

The toolbar should import and use the `useTabChart` hook:

```tsx
import { useTabChart } from '@/hooks/useTabChart';
import { Button } from '@/components/ui/button';

export function UnifiedChartToolbar() {
  const { chartConfig, setChartType, setShowGrid, setYZero, resetChartConfig } = useTabChart();

  return (
    <div className="flex gap-2 p-4 bg-white rounded-lg shadow">
      {/* Chart Type Selector */}
      <select
        value={chartConfig.chartType}
        onChange={(e) => setChartType(e.target.value as any)}
        className="px-3 py-2 border rounded"
      >
        <option value="line">Line</option>
        <option value="bar">Bar</option>
        <option value="scatter">Scatter</option>
        <option value="area">Area</option>
        <option value="composed">Composed</option>
      </select>

      {/* Grid Toggle */}
      <Button
        variant={chartConfig.showGrid ? 'default' : 'outline'}
        onClick={() => setShowGrid(!chartConfig.showGrid)}
        className="flex items-center gap-2"
      >
        <Grid3X3 className="w-4 h-4" />
        Grid
      </Button>

      {/* Y-Zero Toggle */}
      <Button
        variant={chartConfig.yZero ? 'default' : 'outline'}
        onClick={() => setYZero(!chartConfig.yZero)}
        className="flex items-center gap-2"
      >
        <ZeroIcon className="w-4 h-4" />
        Y-Zero
      </Button>

      {/* Reset Button */}
      <Button
        variant="outline"
        onClick={resetChartConfig}
        className="flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Reset
      </Button>
    </div>
  );
}
```

## Step 2: Integrate into ChartArea

Update your ChartArea component to include all three components:

```tsx
import { ChartColorPicker } from '@/components/biostat/ChartColorPicker';
import { ChartPresetManager } from '@/components/biostat/ChartPresetManager';
import { UnifiedChartToolbar } from '@/components/biostat/UnifiedChartToolbar';
import { useTabChart } from '@/hooks/useTabChart';

export function ChartArea() {
  const { chartConfig } = useTabChart();
  const { data } = useChartData();

  return (
    <div className="space-y-4 p-4">
      {/* Main Toolbar */}
      <UnifiedChartToolbar />

      {/* Chart Display */}
      <div className="bg-white rounded-lg shadow p-4">
        <PremiumChartRenderer
          data={data}
          chartType={chartConfig.chartType}
          showGrid={chartConfig.showGrid}
          yZero={chartConfig.yZero}
          colors={chartConfig.customColors}
          title={chartConfig.title}
        />
      </div>

      {/* Settings Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Color Picker */}
        <ChartColorPicker />

        {/* Preset Manager */}
        <ChartPresetManager />
      </div>
    </div>
  );
}
```

## Step 3: Complete Example with All Features

Here's a complete, production-ready example:

```tsx
import React, { useState } from 'react';
import { useTabChart } from '@/hooks/useTabChart';
import { ChartColorPicker } from '@/components/biostat/ChartColorPicker';
import { ChartPresetManager } from '@/components/biostat/ChartPresetManager';
import { PremiumChartRenderer } from '@/components/biostat/PremiumChartRenderer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Grid3X3,
  RotateCcw,
  Download,
  Settings,
} from 'lucide-react';

interface ChartAreaProps {
  data: any[];
  title?: string;
}

export const ChartArea: React.FC<ChartAreaProps> = ({ data, title = 'Chart' }) => {
  const {
    chartConfig,
    setChartType,
    setShowGrid,
    setYZero,
    resetChartConfig,
  } = useTabChart();

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      {/* Main Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Chart Type */}
          <select
            value={chartConfig.chartType}
            onChange={(e) => setChartType(e.target.value as any)}
            className="px-3 py-2 border rounded bg-white"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
            <option value="scatter">Scatter</option>
            <option value="area">Area</option>
            <option value="composed">Composed</option>
          </select>

          {/* Grid Toggle */}
          <Button
            variant={chartConfig.showGrid ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowGrid(!chartConfig.showGrid)}
            className="flex items-center gap-2"
          >
            <Grid3X3 className="w-4 h-4" />
            Grid
          </Button>

          {/* Y-Zero Toggle */}
          <Button
            variant={chartConfig.yZero ? 'default' : 'outline'}
            size="sm"
            onClick={() => setYZero(!chartConfig.yZero)}
          >
            Y-Zero
          </Button>

          {/* Reset */}
          <Button
            variant="outline"
            size="sm"
            onClick={resetChartConfig}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>

          {/* Advanced Settings Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="ml-auto flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>
      </Card>

      {/* Chart Display */}
      <Card className="p-6 bg-white">
        <PremiumChartRenderer
          data={data}
          chartType={chartConfig.chartType}
          showGrid={chartConfig.showGrid}
          yZero={chartConfig.yZero}
          colors={chartConfig.customColors}
          title={chartConfig.title || title}
        />
      </Card>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartColorPicker />
          <ChartPresetManager />
        </div>
      )}
    </div>
  );
};

export default ChartArea;
```

## Step 4: Wire into Biostatistics Page

Update your Biostatistics page to use the integrated ChartArea:

```tsx
import { ChartArea } from '@/components/biostat/ChartArea';
import { TabBarDraggable } from '@/components/biostat/TabBarDraggable';
import { TabContent } from '@/components/biostat/TabContent';
import { useTabStore } from '@/stores/tabStore';

export function Biostatistics() {
  const { activeTabId } = useTabStore();

  return (
    <div className="space-y-4">
      {/* Tab Bar */}
      <TabBarDraggable />

      {/* Tab Content */}
      {activeTabId && (
        <TabContent tabId={activeTabId}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* AI Chat */}
            <div className="lg:col-span-1">
              <AIBiostatisticsChatTabIntegrated />
            </div>

            {/* Chart and Settings */}
            <div className="lg:col-span-2">
              <ChartArea data={chartData} />
            </div>
          </div>
        </TabContent>
      )}
    </div>
  );
}
```

## Features Breakdown

### ChartColorPicker Features

- Individual color inputs for: line, bar, grid, background, axis text
- Color preview swatches
- Hex value display and editing
- Quick preset buttons: Default, Pharma, Vibrant, Pastel
- Reset to defaults button
- All changes saved to active tab state

### ChartPresetManager Features

- Built-in presets: Pharma Standard, Pharma Advanced, Publication Ready
- Save current configuration as custom preset
- Load any preset with one click
- Delete custom presets
- Export presets to JSON file
- Import presets from JSON file
- All presets stored in localStorage
- Visual indicators for active preset

### UnifiedChartToolbar Features

- Chart type selector (line, bar, scatter, area, composed)
- Grid toggle button
- Y-Zero toggle button
- Reset to defaults button
- All connected to useTabChart hook
- Per-tab state persistence

## Data Flow

```
User Action (e.g., select chart type)
    ↓
Component calls setChartType()
    ↓
useTabChart hook updates tab content store
    ↓
Tab state updated in useTabContentStore
    ↓
Component re-renders with new config
    ↓
Chart displays with new settings
    ↓
localStorage auto-saves via tabPersistence
```

## Testing the Integration

### Test 1: Basic Toolbar Usage

1. Open Biostatistics page
2. Create a new tab ("New Analysis" button)
3. Select "Bar" chart type
4. Toggle Grid on/off
5. Toggle Y-Zero on/off
6. Switch to another tab
7. Verify toolbar shows different settings
8. Switch back to first tab
9. Verify original settings are restored

### Test 2: Color Customization

1. Click "Show Advanced" in toolbar
2. Expand "Chart Colors" section
3. Change line color to red
4. Change grid color to blue
5. Switch tabs
6. Verify colors are different
7. Switch back
8. Verify colors are restored

### Test 3: Preset Management

1. Configure a chart (e.g., scatter, no grid, vibrant colors)
2. Click "Show Advanced"
3. Expand "Chart Presets"
4. Click "Save Current as Preset"
5. Enter name "My Analysis"
6. Click "Save Preset"
7. Switch tabs and configure differently
8. Load "My Analysis" preset
9. Verify all settings restored

### Test 4: Persistence

1. Configure chart settings
2. Refresh page
3. Verify all settings are restored
4. Verify custom presets are available

## Troubleshooting

**Q: Chart settings not updating when I change toolbar?**
A: Ensure UnifiedChartToolbar is importing and using `useTabChart()` hook correctly. Check browser console for errors.

**Q: Color picker not showing?**
A: Click "Show Advanced" button in toolbar to expand the settings panels.

**Q: Presets not saving?**
A: Check browser localStorage is enabled. Look for "nuphorm-chart-presets" in localStorage.

**Q: Settings lost on page refresh?**
A: Ensure `tabPersistence` utilities are properly subscribed in Biostatistics page. Check browser console for errors.

## Performance Considerations

- Color picker uses React.memo to prevent unnecessary re-renders
- Preset manager debounces localStorage writes
- Tab state updates are batched
- Chart re-renders only when config actually changes

## Future Enhancements

1. **Color Palettes** - Add predefined color palettes (viridis, plasma, etc.)
2. **Gradient Support** - Allow gradient colors for chart elements
3. **Animation Settings** - Add animation duration and easing options
4. **Export Presets** - Export presets as shareable URLs
5. **Preset Sharing** - Share presets with team members
6. **Undo/Redo** - Add undo/redo for chart configuration changes
