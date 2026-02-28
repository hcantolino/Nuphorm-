# Chart Configuration Tab Integration Guide

This guide explains how to integrate the `useTabChart` hook into your components to enable per-tab chart configuration persistence.

## Overview

Each tab now maintains its own independent chart configuration including:
- **Chart Type**: line, bar, scatter, area, composed
- **Grid Settings**: show/hide grid lines
- **Y-Axis Settings**: include zero or auto-scale
- **Color Scheme**: default, pastel, vibrant, or custom
- **Custom Colors**: individual colors for lines, bars, grid, background, axis text
- **Presets**: saved chart configurations
- **Variables**: selected data variables to display
- **Title**: custom chart title

When users switch tabs, the chart automatically restores its previous configuration.

## Basic Usage

### 1. Import the Hook

```tsx
import { useTabChart } from '@/hooks/useTabChart';
```

### 2. Use in Your Component

```tsx
function ChartArea() {
  const {
    chartConfig,
    setChartType,
    setShowGrid,
    setYZero,
    setColorScheme,
    setCustomColors,
    setPreset,
    setVariables,
    setChartTitle,
    updateChartConfig,
    resetChartConfig,
  } = useTabChart();

  return (
    <div>
      {/* Display current config */}
      <p>Chart Type: {chartConfig.chartType}</p>
      <p>Show Grid: {chartConfig.showGrid ? 'Yes' : 'No'}</p>
      
      {/* Update individual settings */}
      <button onClick={() => setChartType('bar')}>
        Switch to Bar Chart
      </button>
      
      <button onClick={() => setShowGrid(!chartConfig.showGrid)}>
        Toggle Grid
      </button>
    </div>
  );
}
```

## API Reference

### `useTabChart()` Hook

Returns an object with the following properties and methods:

#### Properties

- **`chartConfig: TabChartConfig`** - Current chart configuration for active tab
  - `chartType`: 'line' | 'bar' | 'scatter' | 'area' | 'composed'
  - `showGrid`: boolean
  - `yZero`: boolean
  - `colorScheme`: 'default' | 'pastel' | 'vibrant' | 'custom'
  - `customColors`: { line?, bar?, grid?, background?, axisText? }
  - `preset`: string
  - `variables`: string[]
  - `title`: string

#### Methods

- **`setChartType(type)`** - Change chart type
  ```tsx
  setChartType('bar');
  ```

- **`setShowGrid(show)`** - Toggle grid visibility
  ```tsx
  setShowGrid(false);
  ```

- **`setYZero(include)`** - Toggle Y-axis zero inclusion
  ```tsx
  setYZero(false);
  ```

- **`setColorScheme(scheme)`** - Set color scheme
  ```tsx
  setColorScheme('vibrant');
  ```

- **`setCustomColors(colors)`** - Set custom colors
  ```tsx
  setCustomColors({
    line: '#FF0000',
    grid: '#CCCCCC',
    background: '#FFFFFF',
    axisText: '#000000',
  });
  ```

- **`setPreset(name)`** - Apply a preset configuration
  ```tsx
  setPreset('pharma-standard');
  ```

- **`setVariables(vars)`** - Set variables to display
  ```tsx
  setVariables(['fold_change', 'p_value', 'expression_level']);
  ```

- **`setChartTitle(title)`** - Set chart title
  ```tsx
  setChartTitle('Gene Expression Analysis');
  ```

- **`updateChartConfig(partial)`** - Update multiple settings at once
  ```tsx
  updateChartConfig({
    chartType: 'scatter',
    showGrid: false,
    colorScheme: 'pastel',
  });
  ```

- **`resetChartConfig()`** - Reset to default configuration
  ```tsx
  resetChartConfig();
  ```

## Integration Examples

### Example 1: Chart Type Selector

```tsx
function ChartTypeSelector() {
  const { chartConfig, setChartType } = useTabChart();

  return (
    <select 
      value={chartConfig.chartType}
      onChange={(e) => setChartType(e.target.value as any)}
    >
      <option value="line">Line</option>
      <option value="bar">Bar</option>
      <option value="scatter">Scatter</option>
      <option value="area">Area</option>
      <option value="composed">Composed</option>
    </select>
  );
}
```

### Example 2: Grid and Y-Axis Controls

```tsx
function ChartControls() {
  const { chartConfig, setShowGrid, setYZero } = useTabChart();

  return (
    <div className="flex gap-4">
      <label>
        <input
          type="checkbox"
          checked={chartConfig.showGrid}
          onChange={(e) => setShowGrid(e.target.checked)}
        />
        Show Grid
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={chartConfig.yZero}
          onChange={(e) => setYZero(e.target.checked)}
        />
        Include Y-Zero
      </label>
    </div>
  );
}
```

### Example 3: Color Customization

```tsx
function ColorCustomizer() {
  const { chartConfig, setCustomColors } = useTabChart();

  const handleColorChange = (element: string, color: string) => {
    setCustomColors({
      ...chartConfig.customColors,
      [element]: color,
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <label>
        Line Color:
        <input
          type="color"
          value={chartConfig.customColors?.line || '#0000FF'}
          onChange={(e) => handleColorChange('line', e.target.value)}
        />
      </label>
      
      <label>
        Grid Color:
        <input
          type="color"
          value={chartConfig.customColors?.grid || '#CCCCCC'}
          onChange={(e) => handleColorChange('grid', e.target.value)}
        />
      </label>
      
      <label>
        Background Color:
        <input
          type="color"
          value={chartConfig.customColors?.background || '#FFFFFF'}
          onChange={(e) => handleColorChange('background', e.target.value)}
        />
      </label>
      
      <label>
        Axis Text Color:
        <input
          type="color"
          value={chartConfig.customColors?.axisText || '#000000'}
          onChange={(e) => handleColorChange('axisText', e.target.value)}
        />
      </label>
    </div>
  );
}
```

### Example 4: Preset Manager

```tsx
function PresetManager() {
  const { chartConfig, setPreset, updateChartConfig } = useTabChart();

  const presets = {
    'pharma-standard': {
      chartType: 'line' as const,
      showGrid: true,
      yZero: true,
      colorScheme: 'default' as const,
    },
    'pharma-advanced': {
      chartType: 'composed' as const,
      showGrid: true,
      yZero: false,
      colorScheme: 'vibrant' as const,
    },
    'publication-ready': {
      chartType: 'bar' as const,
      showGrid: false,
      yZero: false,
      colorScheme: 'pastel' as const,
    },
  };

  return (
    <div className="flex gap-2">
      {Object.entries(presets).map(([name, config]) => (
        <button
          key={name}
          onClick={() => updateChartConfig(config)}
          className={chartConfig.preset === name ? 'active' : ''}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
```

### Example 5: Full Integration in ChartArea

```tsx
import { useTabChart } from '@/hooks/useTabChart';
import { PremiumChartRenderer } from '@/components/biostat/PremiumChartRenderer';

function ChartArea() {
  const { chartConfig, setChartType, setShowGrid, setYZero, resetChartConfig } = useTabChart();
  const { data } = useChartData(); // Your data fetching hook

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-4 p-4 bg-white rounded-lg shadow">
        <select 
          value={chartConfig.chartType}
          onChange={(e) => setChartType(e.target.value as any)}
        >
          <option value="line">Line</option>
          <option value="bar">Bar</option>
          <option value="scatter">Scatter</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={chartConfig.showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          Grid
        </label>

        <label>
          <input
            type="checkbox"
            checked={chartConfig.yZero}
            onChange={(e) => setYZero(e.target.checked)}
          />
          Y-Zero
        </label>

        <button onClick={resetChartConfig}>Reset</button>
      </div>

      {/* Chart */}
      <PremiumChartRenderer
        data={data}
        chartType={chartConfig.chartType}
        showGrid={chartConfig.showGrid}
        yZero={chartConfig.yZero}
        colors={chartConfig.customColors}
        title={chartConfig.title}
      />
    </div>
  );
}
```

## How It Works

1. **Tab Activation**: When a user switches to a tab, `useTabStore` updates `activeTabId`
2. **Config Retrieval**: `useTabChart()` reads the active tab's configuration from `useTabContentStore`
3. **Updates**: When settings change, they're saved to the tab's state in `tabContentStore`
4. **Persistence**: Tab configurations are automatically saved to localStorage via `tabPersistence` utilities
5. **Restoration**: On page reload, tab states are restored from localStorage

## State Structure

Chart configuration is stored in `tabContentStore` under each tab:

```typescript
tabContent: {
  'tab-1': {
    chatMessages: [...],
    files: [...],
    chartConfig: {
      chartType: 'line',
      showGrid: true,
      yZero: true,
      colorScheme: 'default',
      customColors: { line: '#0000FF', grid: '#CCCCCC' },
      preset: 'pharma-standard',
      variables: ['fold_change', 'p_value'],
      title: 'Gene Expression',
    },
    tableData: [...],
    settings: {...},
  },
  'tab-2': {
    // Completely independent configuration
    chartConfig: { ... },
    ...
  },
}
```

## Best Practices

1. **Use the hook at component level** - Import and use `useTabChart()` in components that need chart config
2. **Update on user interaction** - Call setter methods when users interact with controls
3. **Batch updates** - Use `updateChartConfig()` for multiple changes at once
4. **Preserve other settings** - The hook automatically preserves unchanged settings when updating
5. **Reset when needed** - Use `resetChartConfig()` to return to defaults
6. **Test tab switching** - Verify that switching tabs correctly restores chart configuration

## Testing

```tsx
import { useTabChart } from '@/hooks/useTabChart';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

// Test that chart config persists per tab
test('chart config persists when switching tabs', () => {
  const { chartConfig, setChartType } = useTabChart();
  
  // Change chart type in tab 1
  setChartType('bar');
  
  // Switch to tab 2
  useTabStore.setState({ activeTabId: 'tab-2' });
  
  // Verify tab 2 has default config
  expect(useTabChart().chartConfig.chartType).toBe('line');
  
  // Switch back to tab 1
  useTabStore.setState({ activeTabId: 'tab-1' });
  
  // Verify tab 1 still has 'bar'
  expect(useTabChart().chartConfig.chartType).toBe('bar');
});
```

## Troubleshooting

**Q: Chart config not persisting when switching tabs?**
A: Ensure `useTabChart()` is called inside a component that re-renders when `activeTabId` changes. The hook depends on the active tab ID from `useTabStore`.

**Q: Changes not appearing in the chart?**
A: Make sure the chart component is reading from `chartConfig` and re-rendering when it changes. Use the config values directly in your chart rendering logic.

**Q: localStorage not saving?**
A: Check that `tabPersistence` utilities are properly subscribed to store changes. Verify browser localStorage is enabled.

**Q: Custom colors not applying?**
A: Ensure your chart renderer is using the `customColors` from `chartConfig`. Pass them to your chart library's color configuration.
