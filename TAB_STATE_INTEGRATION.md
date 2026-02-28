# Tab State & Title Integration Guide

## Overview

This guide explains how to integrate fully isolated tab state and dynamic title management into the Biostatistics page. Each tab maintains completely independent state for AI chat, files, chart configuration, and table data, with automatic title generation based on user queries.

## Architecture

### Stores

| Store | Purpose |
|-------|---------|
| `tabStore.ts` | Manages tab lifecycle (add, close, switch, rename) |
| `tabContentStore.ts` | Manages isolated state per tab (chat, files, chart, table) |

### Utilities

| Utility | Purpose |
|---------|---------|
| `titleGeneration.ts` | Generates meaningful titles from queries and analysis types |

## Quick Start

### 1. Initialize Stores on Mount

```tsx
import { useEffect } from 'react';
import { useTabStore, initializeTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

export default function Biostatistics() {
  useEffect(() => {
    // Initialize tab store
    initializeTabStore();
    
    // Initialize content for first tab
    const { tabs } = useTabStore.getState();
    if (tabs.length > 0) {
      const firstTabId = tabs[0].id;
      // Content will be auto-created on first access
    }
  }, []);

  return (
    // ... page layout
  );
}
```

### 2. Use Tab Content in Components

```tsx
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

function AIChat() {
  const activeTabId = useTabStore((state) => state.activeTabId);
  const { getTabChatMessages, addChatMessage } = useTabContentStore();
  
  const messages = getTabChatMessages(activeTabId!);
  
  const handleSendMessage = (content: string) => {
    const message = {
      id: nanoid(),
      role: 'user' as const,
      content,
      timestamp: new Date(),
    };
    addChatMessage(activeTabId!, message);
  };

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <input onSubmit={handleSendMessage} />
    </div>
  );
}
```

### 3. Auto-Generate Titles from Queries

```tsx
import { generateTitleFromQuery } from '@/utils/titleGeneration';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

function handleUserQuery(query: string) {
  const activeTabId = useTabStore.getState().activeTabId;
  const { setTabLastQuery } = useTabContentStore.getState();
  
  // Track query for title generation
  setTabLastQuery(activeTabId!, query);
  
  // Auto-generate title on first query
  const { getTabContent } = useTabContentStore.getState();
  const content = getTabContent(activeTabId!);
  
  if (content.chatMessages.length === 0) {
    // First message in tab - generate title
    const newTitle = generateTitleFromQuery(query);
    useTabStore.getState().renameTab(activeTabId!, newTitle);
  }
  
  // Send query to AI...
}
```

## Tab Content Store API

### State Structure

```typescript
interface TabContentState {
  chatMessages: ChatMessage[];      // AI chat history
  files: FileMetadata[];            // Uploaded files
  chartConfig: ChartConfig;         // Chart settings
  chartData: any;                   // Chart data points
  tableData: TableRow[];            // Table rows
  tableColumns?: string[];          // Table column names
  analysisResults?: any;            // Analysis results
  selectedMeasurements?: string[];  // Selected measurements
  lastQuery?: string;               // Last user query
}
```

### Getter Methods

```typescript
// Get all content for a tab
getTabContent(tabId: string): TabContentState

// Get specific fields
getTabChatMessages(tabId: string): ChatMessage[]
getTabFiles(tabId: string): FileMetadata[]
getTabChartConfig(tabId: string): ChartConfig
getTabChartData(tabId: string): any
getTabTableData(tabId: string): TableRow[]
getTabAnalysisResults(tabId: string): any
```

### Setter Methods

```typescript
// Set entire field
setTabChatMessages(tabId: string, messages: ChatMessage[]): void
setTabFiles(tabId: string, files: FileMetadata[]): void
setTabChartConfig(tabId: string, config: Partial<ChartConfig>): void
setTabChartData(tabId: string, data: any): void
setTabTableData(tabId: string, data: TableRow[], columns?: string[]): void
setTabAnalysisResults(tabId: string, results: any): void
setTabSelectedMeasurements(tabId: string, measurements: string[]): void
setTabLastQuery(tabId: string, query: string): void

// Add single item
addChatMessage(tabId: string, message: ChatMessage): void
addFile(tabId: string, file: FileMetadata): void

// Remove item
removeFile(tabId: string, fileId: string): void

// Bulk operations
updateTabContent(tabId: string, update: Partial<TabContentState>): void
resetTabContent(tabId: string): void
removeTabContent(tabId: string): void
clearAllTabContent(): void
```

## Title Generation

### Automatic Title Generation

Titles are automatically generated from user queries using keyword detection:

```typescript
import { generateTitleFromQuery } from '@/utils/titleGeneration';

// Examples
generateTitleFromQuery('create a mean for fold_change')
// → "Mean fold_change"

generateTitleFromQuery('calculate median expression_level')
// → "Median expression_level"

generateTitleFromQuery('generate a volcano plot')
// → "Volcano Plot"

generateTitleFromQuery('run a t-test on control vs treatment')
// → "T-Test"
```

### Supported Analysis Types

| Query Pattern | Generated Title |
|---------------|-----------------|
| `mean of X` | `Mean X` |
| `median for X` | `Median X` |
| `std dev of X` | `Std Dev X` |
| `variance of X` | `Variance X` |
| `t-test` | `T-Test` |
| `anova` | `ANOVA` |
| `regression` | `Regression` |
| `volcano plot` | `Volcano Plot` |
| `boxplot` | `Boxplot` |
| `scatter plot` | `Scatter Plot` |
| `correlation` | `Correlation` |

### Pharmaceutical Analysis Types

```typescript
import { generatePharmaTitle } from '@/utils/titleGeneration';

generatePharmaTitle('analyze pharmacokinetic data')
// → "PK Analysis"

generatePharmaTitle('bioequivalence study analysis')
// → "Bioequivalence"

generatePharmaTitle('safety analysis of adverse events')
// → "Safety Analysis"
```

### Custom Title Generation

```typescript
import { generateTitleFromAnalysis } from '@/utils/titleGeneration';

// With metric and statistic
generateTitleFromAnalysis('mean', 'fold_change', 'p-value')
// → "Mean fold_change (p-value)"

// With metric only
generateTitleFromAnalysis('median', 'expression_level')
// → "Median expression_level"

// Analysis type only
generateTitleFromAnalysis('tTest')
// → "T-Test"
```

## Complete Integration Example

Here's a complete example integrating tab state and title management:

```tsx
import React, { useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useTabStore, initializeTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';
import { generateTitleFromQuery } from '@/utils/titleGeneration';
import { TabBar } from '@/components/biostat/TabBar';
import { TabContent } from '@/components/biostat/TabContent';

export default function Biostatistics() {
  const { tabs } = useTabStore();
  const activeTabId = useTabStore((state) => state.activeTabId);
  const {
    getTabChatMessages,
    addChatMessage,
    setTabChartConfig,
    getTabChartConfig,
    setTabLastQuery,
  } = useTabContentStore();

  // Initialize on mount
  useEffect(() => {
    initializeTabStore();
  }, []);

  // Handle user query
  const handleUserQuery = (query: string) => {
    if (!activeTabId) return;

    // Track query
    setTabLastQuery(activeTabId, query);

    // Auto-generate title on first query
    const messages = getTabChatMessages(activeTabId);
    if (messages.length === 0) {
      const newTitle = generateTitleFromQuery(query);
      useTabStore.getState().renameTab(activeTabId, newTitle);
    }

    // Add message to chat
    const message = {
      id: nanoid(),
      role: 'user' as const,
      content: query,
      timestamp: new Date(),
    };
    addChatMessage(activeTabId, message);

    // Send to AI...
  };

  // Handle chart config change
  const handleChartConfigChange = (config: Partial<any>) => {
    if (!activeTabId) return;
    setTabChartConfig(activeTabId, config);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Tab Bar */}
      <TabBar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {tabs.map((tab) => (
          <TabContent key={tab.id} tabId={tab.id}>
            <div className="flex-1 flex gap-4">
              {/* AI Chat Panel */}
              <div className="w-1/3 border-r overflow-y-auto">
                <AIChat
                  messages={getTabChatMessages(tab.id)}
                  onSendMessage={handleUserQuery}
                />
              </div>

              {/* Chart Panel */}
              <div className="w-1/3 border-r overflow-y-auto">
                <ChartArea
                  config={getTabChartConfig(tab.id)}
                  onConfigChange={handleChartConfigChange}
                />
              </div>

              {/* Measurements Panel */}
              <div className="w-1/3 overflow-y-auto">
                <Measurements />
              </div>
            </div>
          </TabContent>
        ))}
      </div>
    </div>
  );
}
```

## State Isolation Example

Each tab maintains completely independent state:

```tsx
// Tab 1: Analysis of fold_change
// - Chat: "create a mean for fold_change"
// - Chart: Line chart, Y-zero enabled
// - Table: Mean values for each sample

// Tab 2: Analysis of expression_level
// - Chat: "calculate median expression_level"
// - Chart: Bar chart, Grid disabled
// - Table: Median values for each sample

// Switching between tabs instantly loads that tab's state
// No data mixing or interference
```

## Performance Considerations

### Memory Usage

- Each tab stores ~50KB of state
- With 20 tabs: ~1MB total
- Recommendation: Keep <20 tabs open

### Optimization Tips

1. **Lazy Load Data** — Only fetch data when tab becomes active
2. **Memoize Components** — Use `React.memo()` to prevent re-renders
3. **Cleanup on Close** — Call `removeTabContent()` when tab is closed

```tsx
// Cleanup when tab closes
useEffect(() => {
  return () => {
    if (activeTabId) {
      useTabContentStore.getState().removeTabContent(activeTabId);
    }
  };
}, [activeTabId]);
```

## Cleanup on Tab Close

When a tab is closed, clean up its state:

```tsx
// In TabBar or Biostatistics component
const handleCloseTab = (tabId: string) => {
  // Remove content before closing tab
  useTabContentStore.getState().removeTabContent(tabId);
  
  // Close tab
  useTabStore.getState().closeTab(tabId);
};
```

## State Persistence (Optional)

To persist tab state across page reloads:

```tsx
import { useEffect } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

export function usePersistTabState() {
  const { tabs, activeTabId } = useTabStore();
  const { tabContent } = useTabContentStore();

  // Save to localStorage
  useEffect(() => {
    const state = { tabs, activeTabId, tabContent };
    localStorage.setItem('biostat-tabs', JSON.stringify(state));
  }, [tabs, activeTabId, tabContent]);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('biostat-tabs');
    if (saved) {
      try {
        const { tabs, activeTabId, tabContent } = JSON.parse(saved);
        useTabStore.setState({ tabs, activeTabId });
        useTabContentStore.setState({ tabContent });
      } catch (err) {
        console.error('Failed to restore tab state:', err);
      }
    }
  }, []);
}
```

## Troubleshooting

### State not updating across tabs

**Problem:** Changing state in one tab affects another tab

**Solution:** Ensure you're using the correct `tabId` when calling store methods:

```tsx
// ✅ Correct
const activeTabId = useTabStore((state) => state.activeTabId);
useTabContentStore.getState().setTabChartConfig(activeTabId!, config);

// ❌ Wrong
useTabContentStore.getState().setTabChartConfig('hardcoded-id', config);
```

### Title not auto-generating

**Problem:** Tab title doesn't change when user sends query

**Solution:** Call `generateTitleFromQuery()` on first message:

```tsx
const messages = getTabChatMessages(activeTabId);
if (messages.length === 0) {
  // First message - generate title
  const title = generateTitleFromQuery(query);
  useTabStore.getState().renameTab(activeTabId, title);
}
```

### Memory growing with many tabs

**Problem:** App slows down with many open tabs

**Solution:** Implement cleanup and lazy loading:

```tsx
// Clean up when tab closes
const handleCloseTab = (tabId: string) => {
  useTabContentStore.getState().removeTabContent(tabId);
  useTabStore.getState().closeTab(tabId);
};

// Lazy load data only when tab becomes active
const handleTabSwitch = (tabId: string) => {
  useTabStore.getState().setActiveTab(tabId);
  // Load data for this tab
};
```

## Testing

Run tests:

```bash
# Tab content store tests
pnpm test -- tabContentStore

# Title generation tests
pnpm test -- titleGeneration
```

## API Reference

### Tab Content Store

```typescript
// Initialization
useTabContentStore.getState()

// Get methods
.getTabContent(tabId)
.getTabChatMessages(tabId)
.getTabFiles(tabId)
.getTabChartConfig(tabId)
.getTabChartData(tabId)
.getTabTableData(tabId)
.getTabAnalysisResults(tabId)

// Set methods
.setTabChatMessages(tabId, messages)
.setTabFiles(tabId, files)
.setTabChartConfig(tabId, config)
.setTabChartData(tabId, data)
.setTabTableData(tabId, data, columns)
.setTabAnalysisResults(tabId, results)
.setTabSelectedMeasurements(tabId, measurements)
.setTabLastQuery(tabId, query)

// Add methods
.addChatMessage(tabId, message)
.addFile(tabId, file)

// Remove methods
.removeFile(tabId, fileId)

// Bulk methods
.updateTabContent(tabId, update)
.resetTabContent(tabId)
.removeTabContent(tabId)
.clearAllTabContent()
```

### Title Generation

```typescript
// Generate from query
generateTitleFromQuery(query: string): string

// Generate from analysis results
generateTitleFromAnalysis(type: string, metric?: string, stat?: string): string

// Sanitize for display
sanitizeTabTitle(title: string): string

// Generate default
generateDefaultTitle(): string

// Detect follow-ups
isFollowUpQuery(query: string): boolean

// Extract columns
extractColumnNames(query: string): string[]

// Pharmaceutical titles
generatePharmaTitle(query: string): string
```

## Examples

### Example 1: Gene Expression Analysis

```
Tab 1: "Mean fold_change"
  - Query: "create a mean for fold_change"
  - Chart: Line chart showing means
  - Table: Mean values by sample

Tab 2: "Volcano Plot"
  - Query: "generate a volcano plot"
  - Chart: Volcano plot
  - Table: Significant genes
```

### Example 2: Clinical Trial

```
Tab 1: "T-Test treatment vs control"
  - Query: "run t-test on treatment vs control"
  - Chart: Boxplot with p-value
  - Table: T-test results

Tab 2: "Safety Analysis"
  - Query: "safety analysis of adverse events"
  - Chart: Bar chart of AE frequencies
  - Table: AE summary
```

### Example 3: Multi-Study Comparison

```
Tab 1: "Study A - Efficacy"
Tab 2: "Study B - Efficacy"
Tab 3: "Meta-Analysis"
  - Each tab has independent data, charts, and results
```
