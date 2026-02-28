/**
 * Unit tests for useTabChart hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTabChart, TabChartConfig } from './useTabChart';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore } from '@/stores/tabContentStore';

describe('useTabChart Hook', () => {
  beforeEach(() => {
    // Initialize tab store with a default tab
    useTabStore.setState({
      tabs: [{ id: 'tab-1', title: 'Analysis 1', createdAt: Date.now() }],
      activeTabId: 'tab-1',
    });

    // Initialize tab content store
    useTabContentStore.setState({
      tabContent: {
        'tab-1': {
          chatMessages: [],
          files: [],
          chartConfig: {
            chartType: 'line',
            showGrid: true,
            yZero: true,
            colorScheme: 'default',
            customColors: {},
            preset: 'default',
            variables: [],
            title: 'Chart',
          },
          tableData: [],
          settings: {},
        },
      },
    });
  });

  it('should return default chart config when no active tab', () => {
    useTabStore.setState({ activeTabId: null });
    const hook = useTabChart();
    expect(hook.chartConfig.chartType).toBe('line');
    expect(hook.chartConfig.showGrid).toBe(true);
    expect(hook.chartConfig.yZero).toBe(true);
  });

  it('should return current chart config for active tab', () => {
    const hook = useTabChart();
    expect(hook.chartConfig.chartType).toBe('line');
    expect(hook.chartConfig.showGrid).toBe(true);
  });

  it('should update chart type', () => {
    const hook = useTabChart();
    hook.setChartType('bar');

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.chartType).toBe('bar');
  });

  it('should toggle grid visibility', () => {
    const hook = useTabChart();
    hook.setShowGrid(false);

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.showGrid).toBe(false);
  });

  it('should toggle Y-zero', () => {
    const hook = useTabChart();
    hook.setYZero(false);

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.yZero).toBe(false);
  });

  it('should set color scheme', () => {
    const hook = useTabChart();
    hook.setColorScheme('vibrant');

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.colorScheme).toBe('vibrant');
  });

  it('should set custom colors', () => {
    const hook = useTabChart();
    const customColors = {
      line: '#FF0000',
      grid: '#00FF00',
      background: '#0000FF',
    };
    hook.setCustomColors(customColors);

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.customColors).toEqual(customColors);
  });

  it('should set preset', () => {
    const hook = useTabChart();
    hook.setPreset('pharma-standard');

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.preset).toBe('pharma-standard');
  });

  it('should set variables', () => {
    const hook = useTabChart();
    const variables = ['fold_change', 'p_value', 'expression_level'];
    hook.setVariables(variables);

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.variables).toEqual(variables);
  });

  it('should set chart title', () => {
    const hook = useTabChart();
    hook.setChartTitle('Gene Expression Analysis');

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.title).toBe('Gene Expression Analysis');
  });

  it('should update entire chart config at once', () => {
    const hook = useTabChart();
    const newConfig: Partial<TabChartConfig> = {
      chartType: 'scatter',
      showGrid: false,
      yZero: false,
      colorScheme: 'pastel',
    };
    hook.updateChartConfig(newConfig);

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.chartType).toBe('scatter');
    expect(updated.chartConfig?.showGrid).toBe(false);
    expect(updated.chartConfig?.yZero).toBe(false);
    expect(updated.chartConfig?.colorScheme).toBe('pastel');
  });

  it('should reset chart config to defaults', () => {
    const hook = useTabChart();
    // First modify the config
    hook.setChartType('bar');
    hook.setShowGrid(false);

    // Then reset
    hook.resetChartConfig();

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.chartType).toBe('line');
    expect(updated.chartConfig?.showGrid).toBe(true);
    expect(updated.chartConfig?.yZero).toBe(true);
  });

  it('should maintain separate configs for different tabs', () => {
    // Create a second tab
    useTabStore.setState({
      tabs: [
        { id: 'tab-1', title: 'Analysis 1', createdAt: Date.now() },
        { id: 'tab-2', title: 'Analysis 2', createdAt: Date.now() + 1000 },
      ],
      activeTabId: 'tab-1',
    });

    useTabContentStore.setState((state) => ({
      tabContent: {
        ...state.tabContent,
        'tab-2': {
          chatMessages: [],
          files: [],
          chartConfig: {
            chartType: 'line',
            showGrid: true,
            yZero: true,
            colorScheme: 'default',
            customColors: {},
            preset: 'default',
            variables: [],
            title: 'Chart',
          },
          tableData: [],
          settings: {},
        },
      },
    }));

    // Modify tab-1
    let hook = useTabChart();
    hook.setChartType('bar');

    // Switch to tab-2 and verify it's different
    useTabStore.setState({ activeTabId: 'tab-2' });
    hook = useTabChart();
    expect(hook.chartConfig.chartType).toBe('line');

    // Switch back to tab-1 and verify changes persisted
    useTabStore.setState({ activeTabId: 'tab-1' });
    hook = useTabChart();
    expect(hook.chartConfig.chartType).toBe('bar');
  });

  it('should handle no-op when no active tab', () => {
    useTabStore.setState({ activeTabId: null });
    const hook = useTabChart();

    // These should not throw
    expect(() => {
      hook.setChartType('bar');
      hook.setShowGrid(false);
      hook.setYZero(false);
      hook.setColorScheme('vibrant');
      hook.setCustomColors({ line: '#FF0000' });
      hook.setPreset('test');
      hook.setVariables(['test']);
      hook.setChartTitle('Test');
      hook.updateChartConfig({ chartType: 'scatter' });
      hook.resetChartConfig();
    }).not.toThrow();
  });

  it('should preserve other config properties when updating one', () => {
    const hook = useTabChart();
    const initialConfig = hook.chartConfig;

    hook.setChartType('bar');

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.showGrid).toBe(initialConfig.showGrid);
    expect(updated.chartConfig?.yZero).toBe(initialConfig.yZero);
    expect(updated.chartConfig?.colorScheme).toBe(initialConfig.colorScheme);
  });

  it('should support complex color customization', () => {
    const hook = useTabChart();
    const complexColors = {
      line: '#FF5733',
      bar: '#33FF57',
      grid: '#3357FF',
      background: '#F3FF33',
      axisText: '#FF33F3',
    };
    hook.setCustomColors(complexColors);

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.customColors).toEqual(complexColors);
  });

  it('should handle multiple rapid updates', () => {
    const hook = useTabChart();

    hook.setChartType('scatter');
    hook.setShowGrid(false);
    hook.setYZero(false);
    hook.setColorScheme('vibrant');
    hook.setPreset('pharma-advanced');
    hook.setVariables(['var1', 'var2', 'var3']);
    hook.setChartTitle('Complex Analysis');

    const updated = useTabContentStore.getState().getTabContent('tab-1');
    expect(updated.chartConfig?.chartType).toBe('scatter');
    expect(updated.chartConfig?.showGrid).toBe(false);
    expect(updated.chartConfig?.yZero).toBe(false);
    expect(updated.chartConfig?.colorScheme).toBe('vibrant');
    expect(updated.chartConfig?.preset).toBe('pharma-advanced');
    expect(updated.chartConfig?.variables).toEqual(['var1', 'var2', 'var3']);
    expect(updated.chartConfig?.title).toBe('Complex Analysis');
  });
});
