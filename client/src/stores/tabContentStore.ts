import { create } from 'zustand';

/**
 * Chart configuration for a tab
 */
export interface ChartConfig {
  type: 'line' | 'bar' | 'area' | 'scatter';
  showGrid: boolean;
  yZero: boolean;
  colorScheme: 'default' | 'pastel' | 'vibrant' | 'monochrome';
  customColors?: Record<string, string>;
  selectedMetrics?: string[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

/**
 * Default chart configuration
 */
const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'line',
  showGrid: true,
  yZero: false,
  colorScheme: 'default',
  customColors: {},
  selectedMetrics: [],
};

/**
 * File metadata for uploaded files
 */
export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
  data?: any; // Raw file data or parsed data
}

/**
 * AI chat message
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | number; // Accept both Date objects and millisecond timestamps
  metadata?: {
    query?: string; // Original user query
    analysisType?: string; // Type of analysis performed
    usedSources?: string[]; // Filenames of sources active when query was sent
    [key: string]: any; // Allow additional metadata (llmUnavailable, chatSuggestions, etc.)
  };
}

/**
 * Table row data
 */
export interface TableRow {
  [key: string]: any;
}

/**
 * Tab content state - fully isolated per tab
 */
export interface TabContentState {
  chatMessages: ChatMessage[];
  files: FileMetadata[];
  chartConfig: ChartConfig;
  chartData: any; // Raw chart data
  tableData: TableRow[];
  tableColumns?: string[];
  analysisResults?: any; // Store analysis results
  selectedMeasurements?: string[];
  lastQuery?: string; // Track last query for title generation
}

/**
 * Default tab content state
 */
const DEFAULT_TAB_CONTENT: TabContentState = {
  chatMessages: [],
  files: [],
  chartConfig: DEFAULT_CHART_CONFIG,
  chartData: null,
  tableData: [],
  tableColumns: [],
  analysisResults: null,
  selectedMeasurements: [],
  lastQuery: undefined,
};

/**
 * Tab content store state
 */
interface TabContentStoreState {
  // Map of tab ID to its content state
  tabContent: Record<string, TabContentState>;

  // Getters
  getTabContent: (tabId: string) => TabContentState;
  getTabChatMessages: (tabId: string) => ChatMessage[];
  getTabFiles: (tabId: string) => FileMetadata[];
  getTabChartConfig: (tabId: string) => ChartConfig;
  getTabChartData: (tabId: string) => any;
  getTabTableData: (tabId: string) => TableRow[];
  getTabAnalysisResults: (tabId: string) => any;

  // Setters for individual fields
  setTabChatMessages: (tabId: string, messages: ChatMessage[]) => void;
  addChatMessage: (tabId: string, message: ChatMessage) => void;
  setTabFiles: (tabId: string, files: FileMetadata[]) => void;
  addFile: (tabId: string, file: FileMetadata) => void;
  removeFile: (tabId: string, fileId: string) => void;
  setTabChartConfig: (tabId: string, config: Partial<ChartConfig>) => void;
  setTabChartData: (tabId: string, data: any) => void;
  setTabTableData: (tabId: string, data: TableRow[], columns?: string[]) => void;
  setTabAnalysisResults: (tabId: string, results: any) => void;
  setTabSelectedMeasurements: (tabId: string, measurements: string[]) => void;
  setTabLastQuery: (tabId: string, query: string) => void;

  // Bulk operations
  updateTabContent: (tabId: string, update: Partial<TabContentState>) => void;
  resetTabContent: (tabId: string) => void;
  removeTabContent: (tabId: string) => void;
  clearAllTabContent: () => void;
}

/**
 * Zustand store for tab content state
 * Each tab has completely isolated state for:
 * - AI chat messages and history
 * - Uploaded files
 * - Chart configuration and data
 * - Table data
 * - Analysis results
 */
export const useTabContentStore = create<TabContentStoreState>((set, get) => ({
  tabContent: {},

  /**
   * Get all content for a tab, or default if not exists
   */
  getTabContent: (tabId: string) => {
    const content = get().tabContent[tabId];
    return content || { ...DEFAULT_TAB_CONTENT };
  },

  /**
   * Get chat messages for a tab
   */
  getTabChatMessages: (tabId: string) => {
    return get().getTabContent(tabId).chatMessages;
  },

  /**
   * Get files for a tab
   */
  getTabFiles: (tabId: string) => {
    return get().getTabContent(tabId).files;
  },

  /**
   * Get chart config for a tab
   */
  getTabChartConfig: (tabId: string) => {
    return get().getTabContent(tabId).chartConfig;
  },

  /**
   * Get chart data for a tab
   */
  getTabChartData: (tabId: string) => {
    return get().getTabContent(tabId).chartData;
  },

  /**
   * Get table data for a tab
   */
  getTabTableData: (tabId: string) => {
    return get().getTabContent(tabId).tableData;
  },

  /**
   * Get analysis results for a tab
   */
  getTabAnalysisResults: (tabId: string) => {
    return get().getTabContent(tabId).analysisResults;
  },

  /**
   * Set chat messages for a tab
   */
  setTabChatMessages: (tabId: string, messages: ChatMessage[]) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          chatMessages: messages,
        },
      },
    }));
  },

  /**
   * Add a single chat message to a tab
   */
  addChatMessage: (tabId: string, message: ChatMessage) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          chatMessages: [...get().getTabContent(tabId).chatMessages, message],
        },
      },
    }));
  },

  /**
   * Set files for a tab
   */
  setTabFiles: (tabId: string, files: FileMetadata[]) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          files,
        },
      },
    }));
  },

  /**
   * Add a file to a tab
   */
  addFile: (tabId: string, file: FileMetadata) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          files: [...get().getTabContent(tabId).files, file],
        },
      },
    }));
  },

  /**
   * Remove a file from a tab
   */
  removeFile: (tabId: string, fileId: string) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          files: get()
            .getTabContent(tabId)
            .files.filter((f) => f.id !== fileId),
        },
      },
    }));
  },

  /**
   * Update chart config for a tab
   */
  setTabChartConfig: (tabId: string, config: Partial<ChartConfig>) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          chartConfig: {
            ...get().getTabContent(tabId).chartConfig,
            ...config,
          },
        },
      },
    }));
  },

  /**
   * Set chart data for a tab
   */
  setTabChartData: (tabId: string, data: any) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          chartData: data,
        },
      },
    }));
  },

  /**
   * Set table data for a tab
   */
  setTabTableData: (tabId: string, data: TableRow[], columns?: string[]) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          tableData: data,
          tableColumns: columns,
        },
      },
    }));
  },

  /**
   * Set analysis results for a tab
   */
  setTabAnalysisResults: (tabId: string, results: any) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          analysisResults: results,
        },
      },
    }));
  },

  /**
   * Set selected measurements for a tab
   */
  setTabSelectedMeasurements: (tabId: string, measurements: string[]) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          selectedMeasurements: measurements,
        },
      },
    }));
  },

  /**
   * Set last query for title generation
   */
  setTabLastQuery: (tabId: string, query: string) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          lastQuery: query,
        },
      },
    }));
  },

  /**
   * Bulk update tab content
   */
  updateTabContent: (tabId: string, update: Partial<TabContentState>) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: {
          ...get().getTabContent(tabId),
          ...update,
        },
      },
    }));
  },

  /**
   * Reset tab content to default state
   */
  resetTabContent: (tabId: string) => {
    set((state) => ({
      tabContent: {
        ...state.tabContent,
        [tabId]: { ...DEFAULT_TAB_CONTENT },
      },
    }));
  },

  /**
   * Remove tab content (cleanup when tab is closed)
   */
  removeTabContent: (tabId: string) => {
    set((state) => {
      const { [tabId]: _, ...rest } = state.tabContent;
      return { tabContent: rest };
    });
  },

  /**
   * Clear all tab content
   */
  clearAllTabContent: () => {
    set({ tabContent: {} });
  },
}));
