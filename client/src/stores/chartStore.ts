import { create } from 'zustand';

export interface ChartConfig {
  type: 'line' | 'bar' | 'scatter' | 'area' | 'histogram';
  data: {
    labels: (string | number)[];
    datasets: Array<{
      label: string;
      data: (number | null)[];
      type?: 'line' | 'bar' | 'scatter';
      borderDash?: number[];
      fill?: boolean;
      borderColor?: string;
      backgroundColor?: string;
    }>;
  };
}

export interface TableData {
  headers: string[];
  rows: (string | number | null)[][];
  summary?: Record<string, string | number>;
}

interface ChartStore {
  chartConfig: ChartConfig | null;
  tableData: TableData | null;
  setChartData: (config: ChartConfig | null, table: TableData | null) => void;
  clearChart: () => void;
}

export const useChartStore = create<ChartStore>((set) => ({
  chartConfig: null,
  tableData: null,
  setChartData: (config, table) => {
    console.log('[chartStore] Setting chart data:', { config, table });
    set({ chartConfig: config, tableData: table });
  },
  clearChart: () => {
    console.log('[chartStore] Clearing chart data');
    set({ chartConfig: null, tableData: null });
  },
}));
