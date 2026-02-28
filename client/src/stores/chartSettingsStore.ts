import { create } from 'zustand';

export type ChartType = 'line' | 'bar' | 'area' | 'scatter';
export type ColorScheme = 'default' | 'publication' | 'dark' | 'minimal' | 'vibrant';

export interface ChartSettings {
  chartType: ChartType;
  showGrid: boolean;
  yZero: boolean;
  colorScheme: ColorScheme;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    grid?: string;
    background?: string;
  };
}

export interface ChartSettingsStore extends ChartSettings {
  setChartType: (type: ChartType) => void;
  toggleGrid: () => void;
  toggleYZero: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setCustomColor: (key: keyof ChartSettings['customColors'], color: string) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: ChartSettings = {
  chartType: 'line',
  showGrid: true,
  yZero: true,
  colorScheme: 'default',
  customColors: {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    grid: '#e5e7eb',
    background: '#ffffff',
  },
};

export const useChartSettings = create<ChartSettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,

  setChartType: (chartType: ChartType) => set({ chartType }),

  toggleGrid: () =>
    set((state) => ({
      showGrid: !state.showGrid,
    })),

  toggleYZero: () =>
    set((state) => ({
      yZero: !state.yZero,
    })),

  setColorScheme: (colorScheme: ColorScheme) => {
    const colorSchemes: Record<ColorScheme, ChartSettings['customColors']> = {
      default: {
        primary: '#3b82f6',
        secondary: '#10b981',
        accent: '#f59e0b',
        grid: '#e5e7eb',
        background: '#ffffff',
      },
      publication: {
        primary: '#000000',
        secondary: '#404040',
        accent: '#808080',
        grid: '#cccccc',
        background: '#ffffff',
      },
      dark: {
        primary: '#60a5fa',
        secondary: '#34d399',
        accent: '#fbbf24',
        grid: '#374151',
        background: '#1f2937',
      },
      minimal: {
        primary: '#1f2937',
        secondary: '#6b7280',
        accent: '#d1d5db',
        grid: '#f3f4f6',
        background: '#ffffff',
      },
      vibrant: {
        primary: '#ef4444',
        secondary: '#8b5cf6',
        accent: '#06b6d4',
        grid: '#fecaca',
        background: '#fef3c7',
      },
    };

    set({
      colorScheme,
      customColors: colorSchemes[colorScheme],
    });
  },

  setCustomColor: (key: keyof ChartSettings['customColors'], color: string) =>
    set((state) => ({
      customColors: {
        ...state.customColors,
        [key]: color,
      },
    })),

  resetSettings: () => set(DEFAULT_SETTINGS),
}));
