import { create } from "zustand";

// ── Customization types ────────────────────────────────────────────────────

export type ControlChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie';
export type PaletteName = 'finbox' | 'viridis' | 'pastel' | 'highContrast' | 'publication';
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';
export type ErrorBarType = 'std' | 'se' | 'ci95';
export type TrendlineType = 'none' | 'linear' | 'polynomial' | 'exponential';
export type TrendlineDashPattern = 'solid' | 'dashed' | 'dotted';
export type DataLabelFormat = 'decimal' | 'percentage' | 'integer';
export type ChartTheme = 'light' | 'dark';

export interface TableSortConfig {
  column: 'metric' | 'value';
  direction: 'asc' | 'desc';
}

export interface TabCustomizations {
  chartType: ControlChartType;
  palette: PaletteName;
  /** Per-series color overrides (index → hex string). Empty = use palette. */
  customColors: string[];
  xLabel: string;
  yLabel: string;
  legendPosition: LegendPosition;
  showGrid: boolean;
  showDataLabels: boolean;
  tableSort: TableSortConfig | null;
  tableFilter: string;
  zebraStriping: boolean;
  // Y-axis bounds & scale
  yAxisMin: number | null;
  yAxisMax: number | null;
  yAxisLog: boolean;
  yAxisReverse: boolean;
  // X-axis bounds (numeric / scatter)
  xAxisMin: number | null;
  xAxisMax: number | null;
  // Series styling
  strokeWidth: number;
  fillOpacity: number;
  markerSize: number;
  barGap: number;
  barBorderRadius: number;
  // Chart elements
  showErrorBars: boolean;
  errorBarType: ErrorBarType;
  trendlineType: TrendlineType;
  showTrendlineEquation: boolean;
  showTrendlineR2: boolean;
  showDropLines: boolean;
  // Trendline styling
  trendlineThickness: number;
  trendlineDashPattern: TrendlineDashPattern;
  trendlineGlow: boolean;
  trendlineOpacity: number;
  showConfidenceBands: boolean;
  // Data label formatting
  dataLabelFormat: DataLabelFormat;
  dataLabelDecimals: number;
  // Axis rotation & step
  xAxisRotation: number;
  xAxisStepSize: number | null;
  yAxisStepSize: number | null;
  // Chart title (editable from panel)
  chartTitle: string;
  // Theme
  chartTheme: ChartTheme;
  // Accessibility
  altText: string;
}

export const DEFAULT_CUSTOMIZATIONS: TabCustomizations = {
  chartType: 'bar',
  palette: 'finbox',
  customColors: [],
  xLabel: '',
  yLabel: '',
  legendPosition: 'bottom',
  showGrid: true,
  showDataLabels: false,
  tableSort: null,
  tableFilter: '',
  zebraStriping: false,
  yAxisMin: null,
  yAxisMax: null,
  yAxisLog: false,
  yAxisReverse: false,
  xAxisMin: null,
  xAxisMax: null,
  strokeWidth: 2,
  fillOpacity: 0.3,
  markerSize: 4,
  barGap: 4,
  barBorderRadius: 3,
  showErrorBars: false,
  errorBarType: 'std',
  trendlineType: 'none',
  showTrendlineEquation: false,
  showTrendlineR2: false,
  showDropLines: false,
  trendlineThickness: 2,
  trendlineDashPattern: 'dashed',
  trendlineGlow: false,
  trendlineOpacity: 1,
  showConfidenceBands: false,
  dataLabelFormat: 'decimal',
  dataLabelDecimals: 2,
  xAxisRotation: 0,
  xAxisStepSize: null,
  yAxisStepSize: null,
  chartTitle: '',
  chartTheme: 'light',
  altText: '',
};

export interface PanelResult {
  id: string;
  timestamp: number;
  query: string;
  analysis: string;
  analysisResults: any; // results_table, chart_data, analysis_type, …
  chartConfig?: any;
  tableData?: any;
  // editedTable mirrors results_table but allows user overrides via inline editing
  editedTable?: Array<{ metric: string; value: any }>;
  // AI-generated publication-style title for this analysis (max 8 words)
  graphTitle?: string;
}

interface AIPanelState {
  // Per-tab results — keyed by tabId
  resultsByTab: Record<string, PanelResult[]>;
  activeResultIdByTab: Record<string, string | null>;
  /** Per-tab visualization customizations */
  customizationsByTab: Record<string, TabCustomizations>;
  /** Currently selected (highlighted) graph result ID for graph-edit mode */
  selectedGraphId: string | null;
  /** Pending edit action text from quick-action buttons — auto-sent by chat */
  pendingEditAction: string | null;
  /** Pending content to pre-fill in chat input — set by "Add to Chat" buttons */
  pendingChatContent: string | null;

  // Actions — all scoped to a tabId
  setPanelResult: (
    tabId: string,
    result: Omit<PanelResult, "id" | "timestamp">
  ) => void;
  setActiveResult: (tabId: string, id: string) => void;
  editTableCell: (
    tabId: string,
    resultId: string,
    rowIndex: number,
    field: "metric" | "value",
    newValue: string
  ) => void;
  clearResults: (tabId: string) => void;
  /** Update an existing result in-place (for graph edits). */
  updatePanelResult: (tabId: string, resultId: string, patch: Partial<Pick<PanelResult, 'analysisResults' | 'chartConfig' | 'graphTitle' | 'analysis'>>) => void;
  /** Called when a tab is closed — frees all stored results for that tab. */
  removeTab: (tabId: string) => void;

  // Graph selection for edit mode
  setSelectedGraph: (resultId: string | null) => void;
  clearSelectedGraph: () => void;
  /** Queue a graph edit action — auto-selects the graph and sets the edit text */
  queueGraphEdit: (resultId: string, actionText: string) => void;
  consumePendingEdit: () => string | null;
  /** Queue content to pre-fill in the chat input (Add to Chat feature) */
  addToChat: (content: string) => void;
  consumePendingChat: () => string | null;

  // Customization actions
  setCustomization: <K extends keyof TabCustomizations>(
    tabId: string,
    key: K,
    value: TabCustomizations[K]
  ) => void;
  resetCustomizations: (tabId: string) => void;

  // Selectors
  getTabResults: (tabId: string) => PanelResult[];
  getTabActiveResultId: (tabId: string) => string | null;
  getTabCustomizations: (tabId: string) => TabCustomizations;
}

export const useAIPanelStore = create<AIPanelState>((set, get) => ({
  resultsByTab: {},
  activeResultIdByTab: {},
  customizationsByTab: {},
  selectedGraphId: null,
  pendingEditAction: null,
  pendingChatContent: null,

  setPanelResult: (tabId, result) => {
    const id = `result-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newResult: PanelResult = { ...result, id, timestamp: Date.now() };
    set((state) => ({
      resultsByTab: {
        ...state.resultsByTab,
        [tabId]: [...(state.resultsByTab[tabId] ?? []), newResult],
      },
      activeResultIdByTab: {
        ...state.activeResultIdByTab,
        [tabId]: id,
      },
    }));
  },

  setActiveResult: (tabId, id) => {
    set((state) => ({
      activeResultIdByTab: {
        ...state.activeResultIdByTab,
        [tabId]: id,
      },
    }));
  },

  editTableCell: (tabId, resultId, rowIndex, field, newValue) => {
    set((state) => ({
      resultsByTab: {
        ...state.resultsByTab,
        [tabId]: (state.resultsByTab[tabId] ?? []).map((r) => {
          if (r.id !== resultId) return r;
          const base =
            r.editedTable ?? [...(r.analysisResults?.results_table ?? [])];
          const updated = base.map((row: any, idx: number) =>
            idx !== rowIndex
              ? row
              : {
                  ...row,
                  [field]:
                    field === "value"
                      ? isNaN(Number(newValue))
                        ? newValue
                        : Number(newValue)
                      : newValue,
                }
          );
          return { ...r, editedTable: updated };
        }),
      },
    }));
  },

  clearResults: (tabId) => {
    set((state) => ({
      resultsByTab: { ...state.resultsByTab, [tabId]: [] },
      activeResultIdByTab: { ...state.activeResultIdByTab, [tabId]: null },
    }));
  },

  updatePanelResult: (tabId, resultId, patch) => {
    set((state) => ({
      resultsByTab: {
        ...state.resultsByTab,
        [tabId]: (state.resultsByTab[tabId] ?? []).map((r) => {
          if (r.id !== resultId) return r;
          // Deep-merge analysisResults so partial AI edit responses don't
          // wipe fields like analysis_type, results_table, or chart_data.
          const mergedAnalysis = patch.analysisResults
            ? {
                ...(r.analysisResults ?? {}),
                ...patch.analysisResults,
                // Deep-merge chart_data: keep original datasets/labels/type
                // and overlay the AI's modifications on top.
                chart_data: patch.analysisResults.chart_data
                  ? {
                      ...(r.analysisResults?.chart_data ?? {}),
                      ...patch.analysisResults.chart_data,
                    }
                  : r.analysisResults?.chart_data,
              }
            : r.analysisResults;
          return {
            ...r,
            ...patch,
            analysisResults: mergedAnalysis,
            timestamp: Date.now(),
          };
        }),
      },
    }));
  },

  removeTab: (tabId) => {
    set((state) => {
      const { [tabId]: _r, ...restResults } = state.resultsByTab;
      const { [tabId]: _a, ...restActive } = state.activeResultIdByTab;
      const { [tabId]: _c, ...restCustom } = state.customizationsByTab;
      return {
        resultsByTab: restResults,
        activeResultIdByTab: restActive,
        customizationsByTab: restCustom,
      };
    });
  },

  setSelectedGraph: (resultId) => {
    set({ selectedGraphId: resultId });
  },

  clearSelectedGraph: () => {
    set({ selectedGraphId: null, pendingEditAction: null });
  },

  queueGraphEdit: (resultId, actionText) => {
    set({ selectedGraphId: resultId, pendingEditAction: actionText });
  },

  consumePendingEdit: () => {
    const action = get().pendingEditAction;
    if (action) set({ pendingEditAction: null });
    return action;
  },

  addToChat: (content) => {
    set({ pendingChatContent: content });
  },

  consumePendingChat: () => {
    const content = get().pendingChatContent;
    if (content) set({ pendingChatContent: null });
    return content;
  },

  setCustomization: (tabId, key, value) => {
    set((state) => ({
      customizationsByTab: {
        ...state.customizationsByTab,
        [tabId]: {
          ...(state.customizationsByTab[tabId] ?? DEFAULT_CUSTOMIZATIONS),
          [key]: value,
        },
      },
    }));
  },

  resetCustomizations: (tabId) => {
    set((state) => ({
      customizationsByTab: {
        ...state.customizationsByTab,
        [tabId]: { ...DEFAULT_CUSTOMIZATIONS },
      },
    }));
  },

  getTabResults: (tabId) => get().resultsByTab[tabId] ?? [],

  getTabActiveResultId: (tabId) =>
    get().activeResultIdByTab[tabId] ?? null,

  getTabCustomizations: (tabId) =>
    get().customizationsByTab[tabId] ?? { ...DEFAULT_CUSTOMIZATIONS },
}));
