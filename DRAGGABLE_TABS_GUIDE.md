# Draggable Tabs & Persistence Integration Guide

## Overview

This guide explains how to integrate draggable/reorderable tabs and localStorage persistence into the Biostatistics page. Users can now drag tabs to reorder them, and their session state is automatically saved and restored across page reloads.

## Features

| Feature | Description |
|---------|-------------|
| **Drag-to-Reorder** | Click and drag tabs to reorder them horizontally |
| **Double-Click Edit** | Double-click a tab title to edit it inline |
| **Keyboard Shortcuts** | Ctrl+T (add tab), Ctrl+W (close tab) |
| **Auto-Save** | State saved to localStorage every 1 second (debounced) |
| **Auto-Restore** | Session restored on page load |
| **Storage Stats** | Track saved state size and tab count |

## Components

### TabBarDraggable Component

Enhanced tab bar with drag-and-drop functionality using `react-beautiful-dnd`.

**Features:**
- Horizontal drag-to-reorder
- Visual feedback during dragging
- Tab title editing (double-click)
- Close button with Ctrl+W shortcut
- Add tab button with Ctrl+T shortcut
- Responsive design with truncated titles

**Usage:**

```tsx
import { TabBarDraggable } from '@/components/biostat/TabBarDraggable';

export function Biostatistics() {
  return (
    <div className="flex flex-col h-screen">
      <TabBarDraggable />
      {/* Rest of page */}
    </div>
  );
}
```

## Persistence Utilities

### Core Functions

```typescript
import {
  saveTabState,        // Save state to localStorage (debounced)
  loadTabState,        // Load state from localStorage
  restoreTabState,     // Restore state to stores
  clearTabState,       // Clear saved state
  getStorageStats,     // Get storage statistics
  exportTabState,      // Export as JSON string
  importTabState,      // Import from JSON string
} from '@/utils/tabPersistence';
```

### Setup Auto-Save

```tsx
import { useEffect } from 'react';
import { saveTabState, restoreTabState } from '@/utils/tabPersistence';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

export function Biostatistics() {
  useEffect(() => {
    // Restore on mount
    restoreTabState();

    // Subscribe to store changes for auto-save
    const unsubscribeTab = useTabStore.subscribe(
      (state) => state,
      () => saveTabState()
    );

    const unsubscribeContent = useTabContentStore.subscribe(
      (state) => state,
      () => saveTabState()
    );

    return () => {
      unsubscribeTab();
      unsubscribeContent();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Page content */}
    </div>
  );
}
```

## Complete Integration Example

Here's a complete example integrating draggable tabs with persistence:

```tsx
import React, { useEffect } from 'react';
import { TabBarDraggable } from '@/components/biostat/TabBarDraggable';
import { TabContent } from '@/components/biostat/TabContent';
import { useTabStore } from '@/stores/tabStore';
import { restoreTabState, saveTabState } from '@/utils/tabPersistence';

export default function Biostatistics() {
  const { tabs } = useTabStore();

  useEffect(() => {
    // Restore session on mount
    restoreTabState();

    // Auto-save on store changes
    const unsubscribeTab = useTabStore.subscribe(
      (state) => state,
      () => saveTabState()
    );

    const unsubscribeContent = useTabContentStore.subscribe(
      (state) => state,
      () => saveTabState()
    );

    // Cleanup subscriptions
    return () => {
      unsubscribeTab();
      unsubscribeContent();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Draggable Tab Bar */}
      <TabBarDraggable />

      {/* Tab Content */}
      <div className="flex-1 flex overflow-hidden">
        {tabs.map((tab) => (
          <TabContent key={tab.id} tabId={tab.id}>
            <div className="flex-1 flex gap-4 p-4">
              {/* AI Chat Panel */}
              <div className="w-1/3 border-r">
                <AIChat tabId={tab.id} />
              </div>

              {/* Chart Panel */}
              <div className="w-1/3 border-r">
                <ChartArea tabId={tab.id} />
              </div>

              {/* Measurements Panel */}
              <div className="w-1/3">
                <Measurements tabId={tab.id} />
              </div>
            </div>
          </TabContent>
        ))}
      </div>
    </div>
  );
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` or `Cmd+T` | Add new tab |
| `Ctrl+W` or `Cmd+W` | Close active tab |
| `Double-Click` on title | Edit tab title |
| `Enter` | Save edited title |
| `Escape` | Cancel editing |
| Drag tab | Reorder tabs |

## Storage Structure

Saved state includes:

```typescript
{
  version: "1.0",
  timestamp: 1707154800000,
  tabs: [
    { id: "tab-1", title: "Mean fold_change", createdAt: "..." },
    { id: "tab-2", title: "Volcano Plot", createdAt: "..." }
  ],
  activeTabId: "tab-1",
  tabContent: {
    "tab-1": {
      chatMessages: [...],
      files: [...],
      chartConfig: { type: "line", ... },
      chartData: [...],
      tableData: [...],
      ...
    },
    "tab-2": { ... }
  }
}
```

## API Reference

### saveTabState()

Save current tab state to localStorage (debounced to 1 second).

```typescript
import { saveTabState } from '@/utils/tabPersistence';

// Automatically called on store changes
saveTabState();
```

### loadTabState()

Load saved state from localStorage.

```typescript
import { loadTabState } from '@/utils/tabPersistence';

const saved = loadTabState();
if (saved) {
  console.log('Found saved state:', saved);
}
```

### restoreTabState()

Restore saved state to stores.

```typescript
import { restoreTabState } from '@/utils/tabPersistence';

const success = restoreTabState();
if (success) {
  console.log('State restored successfully');
}
```

### clearTabState()

Clear saved state from localStorage.

```typescript
import { clearTabState } from '@/utils/tabPersistence';

clearTabState();
```

### getStorageStats()

Get storage statistics.

```typescript
import { getStorageStats } from '@/utils/tabPersistence';

const stats = getStorageStats();
console.log(`Saved ${stats.tabCount} tabs (${stats.savedStateSize} bytes)`);
```

### exportTabState()

Export state as JSON string for backup or sharing.

```typescript
import { exportTabState } from '@/utils/tabPersistence';

const json = exportTabState();
console.log(json); // Pretty-printed JSON
```

### importTabState()

Import state from JSON string.

```typescript
import { importTabState } from '@/utils/tabPersistence';

const success = importTabState(jsonString);
if (success) {
  console.log('State imported successfully');
}
```

## Tab Store API

### reorderTabs(fromIndex, toIndex)

Reorder tabs by moving from one index to another.

```typescript
import { useTabStore } from '@/stores/tabStore';

const store = useTabStore.getState();
store.reorderTabs(0, 2); // Move first tab to third position
```

## Performance Considerations

### Memory Usage

- Each tab state: ~50KB
- With 20 tabs: ~1MB total
- localStorage limit: ~5-10MB (varies by browser)

### Optimization Tips

1. **Debounced Saves** — Auto-save is debounced to 1 second to avoid excessive writes
2. **Lazy Loading** — Only fetch data when tab becomes active
3. **Cleanup** — Remove tab content when tab is closed

```typescript
const handleCloseTab = (tabId: string) => {
  // Clean up before closing
  useTabContentStore.getState().removeTabContent(tabId);
  useTabStore.getState().closeTab(tabId);
};
```

## Troubleshooting

### State not persisting

**Problem:** Changes not saved to localStorage

**Solution:** Ensure subscriptions are set up in useEffect:

```tsx
useEffect(() => {
  const unsub = useTabStore.subscribe(
    (state) => state,
    () => saveTabState()
  );
  return () => unsub();
}, []);
```

### Dragging not working

**Problem:** Tabs can't be dragged

**Solution:** Ensure `react-beautiful-dnd` is installed:

```bash
pnpm add react-beautiful-dnd @types/react-beautiful-dnd
```

### Storage quota exceeded

**Problem:** "QuotaExceededError" when saving

**Solution:** Clear old sessions or reduce data:

```typescript
import { clearTabState, getStorageStats } from '@/utils/tabPersistence';

const stats = getStorageStats();
if (stats.savedStateSize > 5_000_000) {
  // Clear if over 5MB
  clearTabState();
}
```

### State not restoring on page load

**Problem:** Tabs don't restore after refresh

**Solution:** Call `restoreTabState()` in useEffect on mount:

```tsx
useEffect(() => {
  restoreTabState();
}, []);
```

## Testing

Run tests:

```bash
# Tab reordering tests
pnpm test -- tabStore.reorder

# Persistence tests
pnpm test -- tabPersistence
```

## Examples

### Example 1: Multi-Study Analysis

```
Tab 1: "Study A - Efficacy" (draggable)
  - Drag to reorder
  - State saved automatically
  - Restore on page load

Tab 2: "Study B - Safety"
  - Independent data
  - Separate chart config
  - Separate chat history

Tab 3: "Meta-Analysis"
  - Combined results
  - Custom title
  - Full state isolation
```

### Example 2: Session Recovery

```
User Session:
1. Opens Biostatistics page
2. Creates 3 tabs with analyses
3. Closes browser
4. Reopens page
5. All 3 tabs restored with exact state
6. Can continue working immediately
```

### Example 3: Tab Organization

```
User Workflow:
1. Create new tab: "Analysis 1"
2. Run query: "create mean for fold_change"
3. Tab auto-renamed to: "Mean fold_change"
4. Double-click to rename: "Mean fold_change (Study A)"
5. Drag to reorder tabs
6. Close old tabs with ×
7. Session saved automatically
```

## Storage Limits

| Browser | Limit |
|---------|-------|
| Chrome | ~10MB |
| Firefox | ~10MB |
| Safari | ~5MB |
| Edge | ~10MB |

**Recommendation:** Keep <20 tabs open to stay well under limits.

## Debugging

Enable debug logging:

```typescript
// In browser console
localStorage.getItem('nuphorm-tabs-state');

// Get stats
import { getStorageStats } from '@/utils/tabPersistence';
console.log(getStorageStats());

// Export state
import { exportTabState } from '@/utils/tabPersistence';
console.log(exportTabState());
```

## Migration Guide

If updating from previous version without persistence:

```typescript
// Old: No persistence
// New: Automatic persistence

// No code changes needed!
// Just integrate TabBarDraggable and call restoreTabState() on mount
```

## Best Practices

1. **Always restore on mount** — Call `restoreTabState()` in useEffect
2. **Subscribe to changes** — Set up auto-save subscriptions
3. **Clean up on close** — Call `removeTabContent()` when closing tabs
4. **Export for backup** — Periodically export state for backup
5. **Monitor storage** — Check `getStorageStats()` to avoid quota exceeded

## Future Enhancements

- [ ] Cloud sync across devices
- [ ] Tab groups/collections
- [ ] Keyboard navigation between tabs
- [ ] Tab search/filter
- [ ] Undo/redo for tab operations
- [ ] Tab history/timeline
