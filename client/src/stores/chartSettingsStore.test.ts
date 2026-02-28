import { describe, it, expect, beforeEach } from 'vitest';
import { useChartSettings } from './chartSettingsStore';

describe('chartSettingsStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useChartSettings.setState({
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
    });
  });

  it('should initialize with default settings', () => {
    const state = useChartSettings.getState();
    expect(state.chartType).toBe('line');
    expect(state.showGrid).toBe(true);
    expect(state.yZero).toBe(true);
    expect(state.colorScheme).toBe('default');
  });

  it('should change chart type', () => {
    const { setChartType } = useChartSettings.getState();
    setChartType('bar');
    expect(useChartSettings.getState().chartType).toBe('bar');
  });

  it('should toggle grid visibility', () => {
    const { toggleGrid } = useChartSettings.getState();
    const initialState = useChartSettings.getState().showGrid;
    toggleGrid();
    expect(useChartSettings.getState().showGrid).toBe(!initialState);
  });

  it('should toggle Y-zero setting', () => {
    const { toggleYZero } = useChartSettings.getState();
    const initialState = useChartSettings.getState().yZero;
    toggleYZero();
    expect(useChartSettings.getState().yZero).toBe(!initialState);
  });

  it('should change color scheme to publication', () => {
    const { setColorScheme } = useChartSettings.getState();
    setColorScheme('publication');
    const state = useChartSettings.getState();
    expect(state.colorScheme).toBe('publication');
    expect(state.customColors?.primary).toBe('#000000');
    expect(state.customColors?.secondary).toBe('#404040');
  });

  it('should change color scheme to dark', () => {
    const { setColorScheme } = useChartSettings.getState();
    setColorScheme('dark');
    const state = useChartSettings.getState();
    expect(state.colorScheme).toBe('dark');
    expect(state.customColors?.primary).toBe('#60a5fa');
    expect(state.customColors?.background).toBe('#1f2937');
  });

  it('should change color scheme to minimal', () => {
    const { setColorScheme } = useChartSettings.getState();
    setColorScheme('minimal');
    const state = useChartSettings.getState();
    expect(state.colorScheme).toBe('minimal');
    expect(state.customColors?.primary).toBe('#1f2937');
  });

  it('should change color scheme to vibrant', () => {
    const { setColorScheme } = useChartSettings.getState();
    setColorScheme('vibrant');
    const state = useChartSettings.getState();
    expect(state.colorScheme).toBe('vibrant');
    expect(state.customColors?.primary).toBe('#ef4444');
  });

  it('should set custom color', () => {
    const { setCustomColor } = useChartSettings.getState();
    setCustomColor('primary', '#ff0000');
    expect(useChartSettings.getState().customColors?.primary).toBe('#ff0000');
  });

  it('should reset to default settings', () => {
    const { setChartType, toggleGrid, toggleYZero, setColorScheme, resetSettings } = useChartSettings.getState();
    
    // Change some settings
    setChartType('bar');
    toggleGrid();
    toggleYZero();
    setColorScheme('dark');
    
    // Reset
    resetSettings();
    
    const state = useChartSettings.getState();
    expect(state.chartType).toBe('line');
    expect(state.showGrid).toBe(true);
    expect(state.yZero).toBe(true);
    expect(state.colorScheme).toBe('default');
  });

  it('should support all chart types', () => {
    const { setChartType } = useChartSettings.getState();
    const chartTypes = ['line', 'bar', 'area', 'scatter'] as const;
    
    chartTypes.forEach((type) => {
      setChartType(type);
      expect(useChartSettings.getState().chartType).toBe(type);
    });
  });
});
