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
export type MarkerShape = 'circle' | 'square' | 'triangle-up' | 'diamond' | 'triangle-down' | 'hexagon' | 'star' | 'cross' | 'pentagon' | 'bowtie';
export type LineStyle = 'solid' | 'dash' | 'dot' | 'dashdot';
export type GridStyle = 'solid' | 'dashed' | 'dotted';
export type LegendAnchor = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'outside-right' | 'outside-bottom';

export interface TableSortConfig {
  column: 'metric' | 'value';
  direction: 'asc' | 'desc';
}

/** Per-series styling overrides — one per data series */
export interface SeriesCustomization {
  name: string;
  color: string;
  lineStyle: LineStyle;
  lineWidth: number;
  markerShape: MarkerShape;
  markerSize: number;
  showErrorBars: boolean;
  errorBarColor: string;
  visible: boolean;
}

/** Annotation placed on the chart */
export interface ChartAnnotation {
  id: string;
  type: 'text' | 'asterisk' | 'arrow' | 'line' | 'bracket' | 'rect';
  x: number;
  y: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  bgColor?: string;
  borderColor?: string;
  showBorder?: boolean;
  showBg?: boolean;
  opacity?: number;
  // For arrows/lines
  x2?: number;
  y2?: number;
  arrowStyle?: string;
  lineThickness?: number;
  // For rects
  width?: number;
  height?: number;
}

/** Per-bar (per-point) customization from the click-to-edit popup */
export interface BarPointCustomization {
  color?: string;
  value?: number;
  significance?: string | null; // '*' | '**' | '***' | 'ns' | null
  hidden?: boolean;
}

/**
 * Bar customizations keyed by "traceIdx:pointIdx".
 * Layered on top of original chart_data at render time — never mutates AI output.
 */
export type BarCustomizations = Record<string, BarPointCustomization>;

/** Undo stack entry */
export interface UndoEntry {
  description: string;
  chartData: any;
  annotations: ChartAnnotation[];
  seriesOverrides: SeriesCustomization[];
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
  // Series styling (global defaults)
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
  // ── NEW: Publication-quality fields ─────────────────────────────────
  /** Subtitle / reference line (e.g. "Fig. 1A") */
  subtitle: string;
  /** Per-series styling overrides */
  seriesOverrides: SeriesCustomization[];
  /** Show minor tick marks */
  showMinorTicks: boolean;
  /** X-axis scale */
  xAxisScale: 'linear' | 'log';
  /** Background color */
  bgColor: string;
  /** Grid color */
  gridColor: string;
  /** Grid style */
  gridStyle: GridStyle;
  /** Show chart border (box around plot area) */
  showChartBorder: boolean;
  /** Chart border color */
  borderColor: string;
  /** Legend settings */
  legendAnchor: LegendAnchor;
  showLegendBorder: boolean;
  legendBgColor: string;
  legendFontSize: number;
  /** Show values on chart (above bars, next to points) */
  showValues: boolean;
  /** Value display position */
  valuePosition: 'above' | 'below' | 'inside';
  /** Value font size */
  valueFontSize: number;
  /** Chart annotations (text boxes, asterisks, arrows, etc.) */
  annotations: ChartAnnotation[];
  /** Per-bar/point customizations from the click-to-edit popup (keyed by "traceIdx:pointIdx") */
  barCustomizations: BarCustomizations;
  /** Undo stack */
  undoStack: UndoEntry[];
  /** Redo stack */
  redoStack: UndoEntry[];
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
  // Publication-quality defaults
  subtitle: '',
  seriesOverrides: [],
  showMinorTicks: false,
  xAxisScale: 'linear',
  bgColor: '#ffffff',
  gridColor: '#e8e8e8',
  gridStyle: 'solid',
  showChartBorder: true,
  borderColor: '#1a2332',
  legendAnchor: 'top-right',
  showLegendBorder: true,
  legendBgColor: '#ffffff',
  legendFontSize: 11,
  showValues: false,
  valuePosition: 'above',
  valueFontSize: 10,
  annotations: [],
  barCustomizations: {},
  undoStack: [],
  redoStack: [],
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
  /** Currently selected table type for table-edit mode ('statistics' | 'data-points' | null) */
  selectedTableType: 'statistics' | 'data-points' | null;
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

  // Graph/table selection for edit mode
  setSelectedGraph: (resultId: string | null) => void;
  setSelectedTable: (tableType: 'statistics' | 'data-points' | null) => void;
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
  selectedTableType: null,
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
      // Remove all customization entries for this tab (keys are tabId or tabId::resultId)
      const restCustom: Record<string, TabCustomizations> = {};
      for (const key of Object.keys(state.customizationsByTab)) {
        if (key !== tabId && !key.startsWith(`${tabId}::`)) {
          restCustom[key] = state.customizationsByTab[key];
        }
      }
      return {
        resultsByTab: restResults,
        activeResultIdByTab: restActive,
        customizationsByTab: restCustom,
      };
    });
  },

  setSelectedGraph: (resultId) => {
    set({ selectedGraphId: resultId, selectedTableType: null });
  },

  setSelectedTable: (tableType) => {
    set({ selectedTableType: tableType, selectedGraphId: null });
  },

  clearSelectedGraph: () => {
    set({ selectedGraphId: null, selectedTableType: null, pendingEditAction: null });
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
          ...DEFAULT_CUSTOMIZATIONS,
          ...(state.customizationsByTab[tabId] ?? {}),
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

  getTabCustomizations: (tabId) => {
    const stored = get().customizationsByTab[tabId];
    if (!stored) return { ...DEFAULT_CUSTOMIZATIONS };
    // Merge with defaults so newly added fields are always present
    // even if the stored object predates them.
    return { ...DEFAULT_CUSTOMIZATIONS, ...stored };
  },
}));
