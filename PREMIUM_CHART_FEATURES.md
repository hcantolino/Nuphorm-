# Premium Chart Features Guide

## Overview

The `PremiumChartRenderer` component enhances NuPhorm's biostatistics charts with professional-grade features:

- **Custom Tooltips** — Formatted values showing metric name, value, and unit
- **Interactive Legend** — Click legend items to toggle series visibility
- **Zoom/Pan** — Brush component for interactive zooming and panning
- **Full Responsiveness** — Charts adapt to window resize and mobile screens

## Features

### 1. Custom Tooltips

Tooltips display formatted information when hovering over chart data points:

```
┌─────────────────────┐
│ Row 42              │
│ value: 1.234        │
│ sales: 45.678       │
└─────────────────────┘
```

**Styling:**
- White background with dark border (dark mode compatible)
- Rounded corners with shadow
- Shows metric name and formatted value (3 decimal places)
- Color-coded by series

### 2. Interactive Legend

Click legend items to toggle series visibility:

```
Legend (click to toggle):
● value  ● sales  ● revenue
```

**Features:**
- Click any legend item to hide/show that series
- "Show all" button appears when series are hidden
- Counter shows "Showing X of Y series"
- Cursor changes to pointer when legend toggle is enabled

### 3. Zoom/Pan (Brush)

The Brush component at the bottom of the chart enables:

- **Drag to zoom** — Select a range to zoom into
- **Pan** — Scroll through zoomed data
- **Reset** — Click outside brush to reset zoom

**Example:**
```
Chart Area
[Line chart with data]

Brush Area (bottom)
[Miniature chart showing full data range]
[Draggable selection box]
```

### 4. Responsive Design

Charts automatically resize when:
- Window is resized
- Sidebar collapses/expands
- Device orientation changes (mobile)
- Container dimensions change

## Usage

### Basic Usage

```tsx
import { PremiumChartRenderer } from '@/components/biostat/PremiumChartRenderer';

const data = [
  { name: 'Jan', value: 100, sales: 50 },
  { name: 'Feb', value: 120, sales: 60 },
  { name: 'Mar', value: 110, sales: 55 },
];

export function MyChart() {
  return (
    <PremiumChartRenderer
      data={data}
      xAxisKey="name"
      yAxisLabel="Amount"
      xAxisLabel="Month"
    />
  );
}
```

### With All Features Enabled

```tsx
<PremiumChartRenderer
  data={data}
  xAxisKey="name"
  yAxisLabel="Amount"
  xAxisLabel="Month"
  showBrush={true}              // Enable zoom/pan
  enableLegendToggle={true}     // Enable legend toggle
  width={800}
  height={500}
/>
```

### Disabling Specific Features

```tsx
// Disable zoom/pan
<PremiumChartRenderer
  data={data}
  xAxisKey="name"
  showBrush={false}
/>

// Disable legend toggle
<PremiumChartRenderer
  data={data}
  xAxisKey="name"
  enableLegendToggle={false}
/>
```

## Integration with ChartArea

To integrate PremiumChartRenderer into the existing ChartArea component:

```tsx
import { PremiumChartRenderer } from './PremiumChartRenderer';

export default function ChartArea() {
  // ... existing code ...

  return (
    <div className="flex-1 bg-white overflow-y-auto flex flex-col">
      <UnifiedChartToolbar {...toolbarProps} />
      
      {/* Chart Container */}
      <div className="flex-1 min-h-0 p-4">
        <PremiumChartRenderer
          data={chartConfig?.data || filteredData}
          xAxisKey={selectedVariables[0]?.name || 'name'}
          yAxisLabel={yAxisLabel}
          xAxisLabel={xAxisLabel}
          showBrush={true}
          enableLegendToggle={true}
        />
      </div>

      {/* Table Display */}
      <TableDataDisplay data={tableData} />
    </div>
  );
}
```

## Chart Settings Integration

PremiumChartRenderer respects all chart settings from `useChartSettings()`:

| Setting | Effect |
|---------|--------|
| `chartType` | Renders Line/Bar/Area/Scatter |
| `showGrid` | Shows/hides grid lines |
| `yZero` | Forces Y-axis to start at 0 |
| `colorScheme` | Applies color scheme (default, publication, dark, minimal, vibrant) |
| `customColors` | Applies custom grid, background colors |

## Styling & Customization

### Tooltip Styling

Edit the `CustomTooltip` component in `PremiumChartRenderer.tsx`:

```tsx
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
        {/* Customize here */}
      </div>
    );
  }
  return null;
};
```

### Legend Styling

Modify the `<Legend>` component props:

```tsx
<Legend
  verticalAlign="bottom"  // or "top", "middle"
  height={36}
  onClick={handleLegendClick}
  wrapperStyle={{
    cursor: enableLegendToggle ? 'pointer' : 'default',
    paddingTop: '10px',
  }}
/>
```

### Brush Styling

Customize the Brush appearance:

```tsx
<Brush
  dataKey={xAxisKey}
  height={30}
  stroke={gridColor}
  fill="#f0f0f0"  // Background color
  travellerWidth={8}  // Handle width
/>
```

## Performance Considerations

1. **Large Datasets** — For 1000+ data points, consider:
   - Enabling Brush for data sampling
   - Using ScatterChart instead of LineChart
   - Implementing data aggregation

2. **Multiple Series** — For 10+ series:
   - Use legend toggle to reduce visual clutter
   - Consider stacked charts
   - Use color schemes with good contrast

3. **Responsive Rendering** — Charts automatically optimize for:
   - Mobile screens (reduced brush height)
   - Narrow containers (adjusted margins)
   - Touch devices (larger legend click targets)

## Accessibility

- **Keyboard Navigation** — Legend items are keyboard accessible
- **Color Contrast** — All color schemes meet WCAG AA standards
- **Screen Readers** — Tooltips provide text alternatives
- **Focus Indicators** — Clear focus rings on interactive elements

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Testing

Run tests:

```bash
pnpm test -- PremiumChartRenderer
```

24 tests cover:
- Chart type rendering (line, bar, area, scatter)
- Grid toggle
- Y-zero setting
- Color schemes
- Brush enable/disable
- Legend toggle
- Responsive container
- Empty data handling
- Custom axis labels

## Troubleshooting

### Chart not displaying
- Ensure `data` prop is not empty
- Check that `xAxisKey` matches a property in data objects
- Verify chart container has defined height

### Legend toggle not working
- Ensure `enableLegendToggle={true}`
- Check browser console for errors
- Verify `useChartSettings()` hook is properly mocked in tests

### Brush not appearing
- Ensure `showBrush={true}`
- Check that chart height is sufficient (minimum 100px)
- Verify data has multiple points

### Tooltip not showing
- Hover over chart data points
- Check that `<Tooltip />` component is rendered
- Verify custom tooltip function returns JSX

## Examples

### Example 1: Gene Expression Analysis

```tsx
<PremiumChartRenderer
  data={geneExpressionData}
  xAxisKey="gene"
  yAxisLabel="Log2 Fold Change"
  xAxisLabel="Gene Name"
  showBrush={true}
  enableLegendToggle={true}
/>
```

### Example 2: Clinical Trial Results

```tsx
<PremiumChartRenderer
  data={clinicalTrialData}
  xAxisKey="week"
  yAxisLabel="Patient Count"
  xAxisLabel="Study Week"
  showBrush={true}
  enableLegendToggle={false}  // Fixed legend
/>
```

### Example 3: Pharmacokinetics

```tsx
<PremiumChartRenderer
  data={pkData}
  xAxisKey="time"
  yAxisLabel="Concentration (ng/mL)"
  xAxisLabel="Time (hours)"
  showBrush={true}
  enableLegendToggle={true}
/>
```

## API Reference

### Props

```typescript
interface PremiumChartRendererProps {
  data: any[];                    // Chart data
  width?: number;                 // Width (default: 700)
  height?: number;                // Height (default: 400)
  xAxisKey?: string;              // X-axis data key (default: 'name')
  yAxisLabel?: string;            // Y-axis label
  xAxisLabel?: string;            // X-axis label
  showBrush?: boolean;            // Enable zoom/pan (default: true)
  enableLegendToggle?: boolean;   // Enable legend toggle (default: true)
}
```

### Exported Components

- `PremiumChartRenderer` — Main component
- `CustomTooltip` — Tooltip formatter (internal)

### Hooks Used

- `useChartSettings()` — Reads chart type, grid, yZero, colorScheme, customColors

## Future Enhancements

- [ ] Annotation tools (text labels, arrows)
- [ ] Crosshair cursor
- [ ] Data point selection
- [ ] Export with annotations
- [ ] Comparison mode (overlay multiple analyses)
- [ ] Custom tooltip templates
- [ ] Animation controls
- [ ] Print-optimized styling
