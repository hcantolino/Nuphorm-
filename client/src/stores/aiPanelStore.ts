import { create } from "zustand";

// ── Customization types ────────────────────────────────────────────────────

export type ControlChartType = 'bar' | 'line' | 'area' | 'scatter' | 'pie';
export type PaletteName = 'finbox' | 'viridis' | 'pastel' | 'highContrast' | 'publication';
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right' | 'none';

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
  /** Called when a tab is closed — frees all stored results for that tab. */
  removeTab: (tabId: string) => void;

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
