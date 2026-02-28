import { create } from 'zustand';

export interface DataRow {
  [key: string]: string | number | null;
}

export interface ChartVariable {
  name: string;
  type: 'numeric' | 'date' | 'string';
  color: string;
}

export type ChartType = 'line' | 'scatter' | 'bar' | 'area';

export interface ChartPanel {
  id: string;
  title: string;
  chartType: ChartType;
  selectedVariables: ChartVariable[];
  data: DataRow[];
  reportContent?: string;
  createdAt: Date;
}

interface BiostatState {
  // Data
  data: DataRow[];
  columns: string[];
  datasetName: string;
  
  // Chart configuration
  chartTitle: string;
  chartType: ChartType;
  selectedVariables: ChartVariable[];
  xAxisVariable: string | null;
  yAxisStartAtZero: boolean;
  gridVisible: boolean;
  // Color customization
  lineColor: string;
  barColor: string;
  gridColor: string;
  chartBackground: string;
  axisTextColor: string;
  legendPosition: 'top' | 'right' | 'bottom';
  
  // Time range
  timeRangeStart: Date | null;
  timeRangeEnd: Date | null;
  
  // Multi-view panels
  chartPanels: ChartPanel[];
  activePanel: string | null;
  
  // UI
  sidebarOpen: boolean;
  showDataTable: boolean;
  activeViewType: 'chart' | 'report' | null;
  showGlobalSettings: boolean;
  selectedFiles: Array<{ id: string; name: string; fileName: string; format: string }>;
  showFileSelectionModal: boolean;
  
  // Actions
  setData: (data: DataRow[], columns: string[], name: string) => void;
  setChartTitle: (title: string) => void;
  setChartType: (type: ChartType) => void;
  addVariable: (variable: ChartVariable) => void;
  removeVariable: (name: string) => void;
  setXAxisVariable: (name: string | null) => void;
  setYAxisStartAtZero: (value: boolean) => void;
  setGridVisible: (value: boolean) => void;
  setLineColor: (color: string) => void;
  setBarColor: (color: string) => void;
  setGridColor: (color: string) => void;
  setChartBackground: (color: string) => void;
  setAxisTextColor: (color: string) => void;
  setLegendPosition: (position: 'top' | 'right' | 'bottom') => void;

  setTimeRange: (start: Date | null, end: Date | null) => void;
  toggleSidebar: () => void;
  toggleDataTable: () => void;
  toggleGlobalSettings: () => void;
  setSelectedFiles: (files: Array<{ id: string; name: string; fileName: string; format: string }>) => void;
  toggleFileSelectionModal: () => void;
  resetChart: () => void;
  setChartData: (data: DataRow[], variables: ChartVariable[]) => void;
  loadGlobalSettings: () => void;
  
  // Multi-view panel actions
  addChartPanel: (panel: ChartPanel) => void;
  removeChartPanel: (id: string) => void;
  setActivePanel: (id: string | null) => void;
  updateChartPanel: (id: string, updates: Partial<ChartPanel>) => void;
  setActiveViewType: (type: 'chart' | 'report' | null) => void;
}

const COLORS = [
  '#0693e3',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

let colorIndex = 0;
export const getNextColor = (): string => {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
};

export const resetColorIndex = (): void => {
  colorIndex = 0;
};

// Generate sample data for testing
const generateSampleData = (): DataRow[] => {
  const data: DataRow[] = [];
  const categories = ['Control', 'Treatment A', 'Treatment B'];
  
  for (let i = 0; i < 50; i++) {
    data.push({
      Date: new Date(Date.now() - (50 - i) * 86400000).toISOString().split('T')[0],
      'Mean Value': 50 + Math.random() * 30,
      'Median Value': 55 + Math.random() * 25,
      'Std Dev': 5 + Math.random() * 10,
      'Sample Size': 100 + Math.floor(Math.random() * 50),
      Category: categories[Math.floor(Math.random() * categories.length)],
      'P-Value': (Math.random() * 0.05).toFixed(4),
      'Confidence Interval': `[${(40 + Math.random() * 20).toFixed(2)}, ${(60 + Math.random() * 20).toFixed(2)}]`,
    });
  }
  
  return data;
};

export const useBiostatStore = create<BiostatState>((set) => ({
  // Initial state with sample data
  data: generateSampleData(),
  columns: ['Date', 'Mean Value', 'Median Value', 'Std Dev', 'Sample Size', 'Category', 'P-Value', 'Confidence Interval'],
  datasetName: 'Sample Clinical Trial Data',
  chartTitle: 'Clinical Trial Analysis',
  chartType: 'line',
  selectedVariables: [],
  xAxisVariable: 'Date',
  yAxisStartAtZero: false,
  timeRangeStart: null,
  timeRangeEnd: null,
  sidebarOpen: true,
  showDataTable: true,
  chartPanels: [],
  activePanel: null,
  activeViewType: 'chart',
  gridVisible: true,
  lineColor: '#0693e3',
  barColor: '#0693e3',
  gridColor: '#e5e7eb',
  chartBackground: '#ffffff',
  axisTextColor: '#374151',
  legendPosition: 'right',
  showGlobalSettings: false,
  selectedFiles: [],
  showFileSelectionModal: false,

  // Actions
  setData: (data, columns, name) =>
    set({
      data,
      columns,
      datasetName: name,
      selectedVariables: [],
      xAxisVariable: null,
    }),

  setChartData: (data: DataRow[], variables: ChartVariable[]) =>
    set({
      data,
      selectedVariables: variables,
    }),

  setChartTitle: (title) => set({ chartTitle: title }),

  setChartType: (type) => set({ chartType: type }),

  addVariable: (variable) =>
    set((state: BiostatState) => {
      // Check if variable already exists
      if (state.selectedVariables.some((v) => v.name === variable.name)) {
        return state;
      }
      return {
        selectedVariables: [...state.selectedVariables, variable],
      };
    }),

  removeVariable: (name) =>
    set((state: BiostatState) => ({
      selectedVariables: state.selectedVariables.filter((v) => v.name !== name),
    })),

  setXAxisVariable: (name) => set({ xAxisVariable: name }),

  setYAxisStartAtZero: (value) => set({ yAxisStartAtZero: value }),

  setGridVisible: (value) => set({ gridVisible: value }),

  setLineColor: (color) => set({ lineColor: color }),

  setBarColor: (color) => set({ barColor: color }),

  setGridColor: (color) => set({ gridColor: color }),

  setChartBackground: (color) => set({ chartBackground: color }),

  setAxisTextColor: (color) => set({ axisTextColor: color }),

  setLegendPosition: (position) => set({ legendPosition: position }),

  setTimeRange: (start, end) =>
    set({
      timeRangeStart: start,
      timeRangeEnd: end,
    }),

  toggleSidebar: () =>
    set((state) => ({
      sidebarOpen: !state.sidebarOpen,
    })),

  toggleDataTable: () =>
    set((state) => ({
      showDataTable: !state.showDataTable,
    })),

  toggleGlobalSettings: () =>
    set((state) => ({
      showGlobalSettings: !state.showGlobalSettings,
    })),

  setSelectedFiles: (files) => set({ selectedFiles: files }),

  toggleFileSelectionModal: () =>
    set((state) => ({
      showFileSelectionModal: !state.showFileSelectionModal,
    })),

  resetChart: () =>
    set({
      data: generateSampleData(),
      columns: ['Date', 'Mean Value', 'Median Value', 'Std Dev', 'Sample Size', 'Category', 'P-Value', 'Confidence Interval'],
      chartTitle: 'Clinical Trial Analysis',
      selectedVariables: [],
      xAxisVariable: 'Date',
      yAxisStartAtZero: false,
      chartType: 'line',
    }),

  loadGlobalSettings: () => {
    const saved = localStorage.getItem('biostat-global-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      set(settings);
    }
  },

  addChartPanel: (panel) =>
    set((state) => ({
      chartPanels: [...state.chartPanels, panel],
      activePanel: panel.id,
    })),

  removeChartPanel: (id) =>
    set((state) => ({
      chartPanels: state.chartPanels.filter((p) => p.id !== id),
      activePanel: state.activePanel === id ? state.chartPanels[0]?.id || null : state.activePanel,
    })),

  setActivePanel: (id) => set({ activePanel: id }),

  updateChartPanel: (id, updates) =>
    set((state) => ({
      chartPanels: state.chartPanels.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  setActiveViewType: (type) => set({ activeViewType: type }),
}));
