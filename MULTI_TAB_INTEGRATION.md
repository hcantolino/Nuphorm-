# Multi-Tab Workspace Integration Guide

## Overview

The multi-tab workspace transforms the Biostatistics page into a browser-like interface where users can manage multiple independent analysis sessions. Each tab maintains its own:

- AI chat history and messages
- Uploaded data files
- Chart settings and customizations
- Analysis results and tables
- Measurement selections

## Architecture

### Components

| Component | Purpose |
|-----------|---------|
| `tabStore.ts` | Zustand store managing tab state, add/close/switch logic |
| `TabBar.tsx` | Chrome-style tab bar with keyboard shortcuts |
| `TabContent.tsx` | Wrapper ensuring only active tab content renders |

### Data Flow

```
User clicks tab → setActiveTab(tabId) → activeTabId updates in store
                → TabContent re-renders → Only active tab shows content
                → All other tabs hidden (state preserved)
```

## Integration Steps

### Step 1: Initialize Tab Store

In your Biostatistics page component, initialize the tab store on mount:

```tsx
import { useEffect } from 'react';
import { useTabStore, initializeTabStore } from '@/stores/tabStore';

export default function Biostatistics() {
  // Initialize tabs on first load
  useEffect(() => {
    initializeTabStore();
  }, []);

  // ... rest of component
}
```

### Step 2: Add TabBar to Page

Place the TabBar at the top of the page, above the main content:

```tsx
import { TabBar } from '@/components/biostat/TabBar';

export default function Biostatistics() {
  return (
    <div className="flex flex-col h-screen">
      {/* Tab Bar */}
      <TabBar />

      {/* Page Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* ... existing page layout ... */}
      </div>
    </div>
  );
}
```

### Step 3: Wrap Content with TabContent

Wrap your existing page content (AI chat + chart + table) with TabContent for each tab:

```tsx
import { TabContent } from '@/components/biostat/TabContent';

export default function Biostatistics() {
  const { tabs } = useTabStore();

  return (
    <div className="flex flex-col h-screen">
      <TabBar />

      <div className="flex-1 flex overflow-hidden">
        {/* Render content for each tab */}
        {tabs.map((tab) => (
          <TabContent key={tab.id} tabId={tab.id}>
            {/* Your existing page content here */}
            <div className="flex-1 flex gap-4">
              <AIBiostatisticsChat />
              <ChartArea />
              <BiostatisticsMeasurementsWithAI />
            </div>
          </TabContent>
        ))}
      </div>
    </div>
  );
}
```

## Complete Integration Example

Here's a complete example of integrating tabs into the Biostatistics page:

```tsx
import React, { useEffect } from 'react';
import { useTabStore, initializeTabStore } from '@/stores/tabStore';
import { TabBar } from '@/components/biostat/TabBar';
import { TabContent } from '@/components/biostat/TabContent';
import AIBiostatisticsChat from './AIBiostatisticsChat';
import ChartArea from './ChartArea';
import BiostatisticsMeasurementsWithAI from './BiostatisticsMeasurementsWithAI';

export default function Biostatistics() {
  const { tabs } = useTabStore();

  // Initialize tab store on mount
  useEffect(() => {
    initializeTabStore();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Tab Bar - Chrome-style tabs */}
      <TabBar />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Render content for each tab */}
        {tabs.map((tab) => (
          <TabContent key={tab.id} tabId={tab.id}>
            {/* Left Panel: AI Chat */}
            <div className="w-1/3 border-r border-slate-200 overflow-y-auto">
              <AIBiostatisticsChat />
            </div>

            {/* Center Panel: Chart */}
            <div className="w-1/3 border-r border-slate-200 overflow-y-auto">
              <ChartArea />
            </div>

            {/* Right Panel: Measurements */}
            <div className="w-1/3 overflow-y-auto">
              <BiostatisticsMeasurementsWithAI />
            </div>
          </TabContent>
        ))}
      </div>
    </div>
  );
}
```

## Tab Store API

### State

```typescript
interface TabStoreState {
  tabs: Tab[];                    // List of open tabs
  activeTabId: string | null;     // Currently active tab ID
}
```

### Actions

| Action | Description | Example |
|--------|-------------|---------|
| `addTab(title?)` | Add new tab, returns tab ID | `addTab('My Analysis')` |
| `closeTab(tabId)` | Close a tab | `closeTab('tab-123')` |
| `setActiveTab(tabId)` | Switch to a tab | `setActiveTab('tab-456')` |
| `renameTab(tabId, title)` | Rename a tab | `renameTab('tab-123', 'New Title')` |
| `getTabById(tabId)` | Get tab by ID | `getTabById('tab-123')` |
| `getActiveTab()` | Get currently active tab | `getActiveTab()` |
| `closeAllTabs()` | Close all tabs, create new one | `closeAllTabs()` |

### Usage Examples

```tsx
import { useTabStore } from '@/stores/tabStore';

function MyComponent() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useTabStore();

  // Add new tab
  const handleAddTab = () => {
    const newTabId = addTab('Analysis Session');
    console.log('Created tab:', newTabId);
  };

  // Close tab
  const handleCloseTab = (tabId) => {
    closeTab(tabId);
  };

  // Switch tab
  const handleSwitchTab = (tabId) => {
    setActiveTab(tabId);
  };

  return (
    <div>
      <button onClick={handleAddTab}>Add Tab</button>
      {tabs.map((tab) => (
        <div key={tab.id}>
          <span>{tab.title}</span>
          <button onClick={() => handleCloseTab(tab.id)}>Close</button>
          <button onClick={() => handleSwitchTab(tab.id)}>
            {activeTabId === tab.id ? 'Active' : 'Inactive'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

## TabBar Features

### Chrome-Style Tabs

- **Active Highlighting** — Active tab has white background, inactive tabs are gray
- **Tab Title** — Shows analysis name, truncated if too long
- **Close Button** — × button to close individual tabs
- **Add Button** — + button to create new tab

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` / `Cmd+T` | Add new tab |
| `Ctrl+W` / `Cmd+W` | Close active tab |
| Double-click tab | Edit tab title |

### Styling

The TabBar uses Tailwind CSS with dark mode support:

```tsx
// Active tab
bg-white dark:bg-slate-900 text-slate-900 dark:text-white

// Inactive tab
bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300

// Hover state
hover:bg-slate-300 dark:hover:bg-slate-600
```

## Tab Independence

Each tab maintains completely independent state for:

### AI Chat
- Message history
- Current input
- Analysis results

### Chart Settings
- Chart type (line, bar, area, scatter)
- Grid visibility
- Y-axis zero
- Color scheme
- Custom colors

### Data
- Selected files
- Measurements
- Chart data
- Table data

### Implementation

Tab independence is achieved through:

1. **Zustand Store Scoping** — Each store can be scoped to a tab ID
2. **TabContent Rendering** — Only active tab content renders, preserving state
3. **Key Prop** — Each TabContent has `key={tab.id}` to maintain React component state

## Performance Considerations

### Memory Usage

With N tabs open:
- Each tab stores its own state (~50KB per tab)
- Total memory: N × 50KB
- Recommendation: Keep <20 tabs open for optimal performance

### Rendering

- Only active tab content renders
- Inactive tabs are hidden (not removed from DOM)
- Switching tabs is instant (no re-fetch needed)

### Optimization Tips

1. **Lazy Load Data** — Only fetch data when tab becomes active
2. **Memoize Components** — Use `React.memo()` to prevent unnecessary re-renders
3. **Cleanup on Close** — Clear large data structures when closing tabs

## State Persistence (Optional)

To persist tab state across page reloads:

```tsx
import { useEffect } from 'react';
import { useTabStore } from '@/stores/tabStore';

export function usePersistTabs() {
  const { tabs, activeTabId } = useTabStore();

  // Save to localStorage on change
  useEffect(() => {
    const state = { tabs, activeTabId };
    localStorage.setItem('biostat-tabs', JSON.stringify(state));
  }, [tabs, activeTabId]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('biostat-tabs');
    if (saved) {
      const { tabs, activeTabId } = JSON.parse(saved);
      useTabStore.setState({ tabs, activeTabId });
    }
  }, []);
}
```

## Accessibility

The TabBar includes:

- **ARIA Labels** — Each tab has `role="tab"` and `aria-selected`
- **Keyboard Navigation** — Tab switching via keyboard
- **Focus Indicators** — Clear focus rings on interactive elements
- **Screen Reader Support** — Proper semantic HTML

## Troubleshooting

### Tabs not showing
- Ensure `initializeTabStore()` is called on mount
- Check that `TabBar` is rendered before `TabContent`
- Verify `activeTabId` is set (not null)

### Tab content not switching
- Verify `setActiveTab()` is being called
- Check that `TabContent` has correct `tabId` prop
- Ensure store subscription is working

### Keyboard shortcuts not working
- Check browser console for errors
- Verify event listeners are attached
- Test in different browsers

### Tab state not persisting
- Use localStorage persistence hook (see above)
- Consider using IndexedDB for larger state

## Examples

### Example 1: Gene Expression Analysis

```
Tab 1: "Gene Expression - Sample A"
  - Uploaded: sample_a.csv
  - Chart: Volcano plot
  - Measurements: Log2FC, p-value

Tab 2: "Gene Expression - Sample B"
  - Uploaded: sample_b.csv
  - Chart: MA plot
  - Measurements: Mean expression, variance
```

### Example 2: Clinical Trial Comparison

```
Tab 1: "Trial Arm A - Week 4"
  - Data: arm_a_week4.xlsx
  - Chart: Patient response rates

Tab 2: "Trial Arm B - Week 4"
  - Data: arm_b_week4.xlsx
  - Chart: Patient response rates

Tab 3: "Comparison: A vs B"
  - Data: combined analysis
  - Chart: Side-by-side comparison
```

### Example 3: Multi-Study Analysis

```
Tab 1: "Study 1 - Baseline"
Tab 2: "Study 1 - Week 12"
Tab 3: "Study 2 - Baseline"
Tab 4: "Study 2 - Week 12"
Tab 5: "Meta-Analysis"
```

## Future Enhancements

- [ ] Drag-to-reorder tabs
- [ ] Tab grouping/organization
- [ ] Tab history (undo/redo)
- [ ] Export tab session
- [ ] Import tab session
- [ ] Tab search/filter
- [ ] Tab pinning
- [ ] Tab context menu
- [ ] Tab preview on hover
- [ ] Collaborative tabs (multi-user)

## Testing

Run tests:

```bash
# Tab store tests
pnpm test -- tabStore

# TabBar component tests
pnpm test -- TabBar

# Integration tests
pnpm test -- Biostatistics
```

Test coverage includes:
- Tab creation/deletion
- Tab switching
- Tab renaming
- Keyboard shortcuts
- Edge cases (last tab, rapid operations)
- Accessibility features
