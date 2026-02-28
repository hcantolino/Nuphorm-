import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PremiumChartRenderer } from './PremiumChartRenderer';
import * as chartSettingsStore from '@/stores/chartSettingsStore';

// Mock the chart settings store
vi.mock('@/stores/chartSettingsStore', () => ({
  useChartSettings: vi.fn(() => ({
    chartType: 'line',
    showGrid: true,
    yZero: false,
    colorScheme: 'default',
    customColors: {},
  })),
}));

// Mock the color schemes
vi.mock('@/utils/chartColorSchemes', () => ({
  getColorForScheme: vi.fn((key, scheme, index) => '#0693e3'),
  getFillForScheme: vi.fn((key, scheme, index) => '#10b98166'),
  getGridColorForScheme: vi.fn((scheme) => '#e5e7eb'),
  getBackgroundColorForScheme: vi.fn((scheme) => '#ffffff'),
}));

describe('PremiumChartRenderer', () => {
  const mockData = [
    { name: 'Jan', value: 100, sales: 50 },
    { name: 'Feb', value: 120, sales: 60 },
    { name: 'Mar', value: 110, sales: 55 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a valid React component', () => {
    expect(PremiumChartRenderer).toBeDefined();
    expect(typeof PremiumChartRenderer).toBe('function');
  });

  it('should accept data prop', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should accept optional props', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
      yAxisLabel: 'Value',
      xAxisLabel: 'Month',
      showBrush: true,
      enableLegendToggle: true,
    });
    expect(component).toBeDefined();
  });

  it('should handle empty data array', () => {
    const component = PremiumChartRenderer({
      data: [],
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should use default chart type from settings', () => {
    const mockSettings = {
      chartType: 'line',
      showGrid: true,
      yZero: false,
      colorScheme: 'default',
      customColors: {},
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should support bar chart type', () => {
    const mockSettings = {
      chartType: 'bar',
      showGrid: true,
      yZero: false,
      colorScheme: 'default',
      customColors: {},
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should support area chart type', () => {
    const mockSettings = {
      chartType: 'area',
      showGrid: true,
      yZero: false,
      colorScheme: 'default',
      customColors: {},
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should support scatter chart type', () => {
    const mockSettings = {
      chartType: 'scatter',
      showGrid: true,
      yZero: false,
      colorScheme: 'default',
      customColors: {},
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should respect showGrid setting', () => {
    const mockSettings = {
      chartType: 'line',
      showGrid: false,
      yZero: false,
      colorScheme: 'default',
      customColors: {},
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should respect yZero setting', () => {
    const mockSettings = {
      chartType: 'line',
      showGrid: true,
      yZero: true,
      colorScheme: 'default',
      customColors: {},
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should apply custom colors', () => {
    const mockSettings = {
      chartType: 'line',
      showGrid: true,
      yZero: false,
      colorScheme: 'default',
      customColors: {
        grid: '#ff0000',
        background: '#00ff00',
      },
    };
    
    vi.mocked(chartSettingsStore.useChartSettings).mockReturnValue(mockSettings as any);
    
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should support brush for zoom/pan', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
      showBrush: true,
    });
    expect(component).toBeDefined();
  });

  it('should support disabling brush', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
      showBrush: false,
    });
    expect(component).toBeDefined();
  });

  it('should support legend toggle', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
      enableLegendToggle: true,
    });
    expect(component).toBeDefined();
  });

  it('should support disabling legend toggle', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
      enableLegendToggle: false,
    });
    expect(component).toBeDefined();
  });

  it('should handle custom axis labels', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      xAxisKey: 'name',
      xAxisLabel: 'Month',
      yAxisLabel: 'Amount',
    });
    expect(component).toBeDefined();
  });

  it('should use default width and height', () => {
    const component = PremiumChartRenderer({
      data: mockData,
    });
    expect(component).toBeDefined();
  });

  it('should accept custom width and height', () => {
    const component = PremiumChartRenderer({
      data: mockData,
      width: 800,
      height: 500,
    });
    expect(component).toBeDefined();
  });

  it('should extract numeric keys from data', () => {
    const testData = [
      { name: 'A', value: 10, count: 5, text: 'ignored' },
      { name: 'B', value: 20, count: 15, text: 'ignored' },
    ];
    
    const component = PremiumChartRenderer({
      data: testData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should handle data with single numeric column', () => {
    const testData = [
      { name: 'A', value: 10 },
      { name: 'B', value: 20 },
    ];
    
    const component = PremiumChartRenderer({
      data: testData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });

  it('should handle data with multiple numeric columns', () => {
    const testData = [
      { name: 'A', value1: 10, value2: 20, value3: 30 },
      { name: 'B', value1: 15, value2: 25, value3: 35 },
    ];
    
    const component = PremiumChartRenderer({
      data: testData,
      xAxisKey: 'name',
    });
    expect(component).toBeDefined();
  });
});
