/**
 * useTabChart Hook
 * Manages chart configuration state for the active tab
 * Provides methods to read/write chart settings that persist per tab
 */

import { useCallback } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { useTabContentStore, ChartConfig } from '@/stores/tabContentStore';

const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'line',
  showGrid: true,
  yZero: false,
  colorScheme: 'default',
  customColors: {},
  selectedMetrics: [],
};

/**
 * Hook to manage chart configuration for the active tab
 * Returns current config and methods to update it
 */
export const useTabChart = () => {
  const { activeTabId } = useTabStore();
  const { getTabContent, updateTabContent } = useTabContentStore();

  if (!activeTabId) {
    return {
      chartConfig: DEFAULT_CHART_CONFIG,
      setChartType: () => {},
      setShowGrid: () => {},
      setYZero: () => {},
      setColorScheme: () => {},
      setCustomColors: () => {},
      setSelectedMetrics: () => {},
      setAxisLabels: () => {},
      updateChartConfig: () => {},
      resetChartConfig: () => {},
    };
  }

  const tabContent = getTabContent(activeTabId);
  const chartConfig = tabContent?.chartConfig || DEFAULT_CHART_CONFIG;

  /**
   * Update chart type
   */
  const setChartType = useCallback(
    (type: ChartConfig['type']) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          type,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Toggle grid visibility
   */
  const setShowGrid = useCallback(
    (showGrid: boolean) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          showGrid,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Toggle Y-axis zero
   */
  const setYZero = useCallback(
    (yZero: boolean) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          yZero,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Set color scheme
   */
  const setColorScheme = useCallback(
    (colorScheme: ChartConfig['colorScheme']) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          colorScheme,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Set custom colors
   */
  const setCustomColors = useCallback(
    (customColors: ChartConfig['customColors']) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          customColors,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Set selected metrics to display
   */
  const setSelectedMetrics = useCallback(
    (selectedMetrics: string[]) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          selectedMetrics,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Set axis labels
   */
  const setAxisLabels = useCallback(
    (xAxisLabel?: string, yAxisLabel?: string) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          xAxisLabel,
          yAxisLabel,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Update entire chart config at once
   */
  const updateChartConfig = useCallback(
    (newConfig: Partial<ChartConfig>) => {
      updateTabContent(activeTabId, {
        chartConfig: {
          ...chartConfig,
          ...newConfig,
        },
      });
    },
    [activeTabId, chartConfig, updateTabContent]
  );

  /**
   * Reset chart config to defaults
   */
  const resetChartConfig = useCallback(() => {
    updateTabContent(activeTabId, {
      chartConfig: DEFAULT_CHART_CONFIG,
    });
  }, [activeTabId, updateTabContent]);

  return {
    chartConfig,
    setChartType,
    setShowGrid,
    setYZero,
    setColorScheme,
    setCustomColors,
    setSelectedMetrics,
    setAxisLabels,
    updateChartConfig,
    resetChartConfig,
  };
};

export default useTabChart;
