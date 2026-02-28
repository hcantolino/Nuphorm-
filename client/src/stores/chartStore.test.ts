import { describe, it, expect, beforeEach } from 'vitest';
import { useChartStore } from './chartStore';

describe('chartStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useChartStore.getState();
    store.clearChart();
  });

  it('should initialize with null values', () => {
    const store = useChartStore.getState();
    expect(store.chartConfig).toBeNull();
    expect(store.tableData).toBeNull();
  });

  it('should set chart data correctly', () => {
    const store = useChartStore.getState();
    const mockChartConfig = {
      type: 'line' as const,
      data: {
        labels: ['A', 'B', 'C'],
        datasets: [
          {
            label: 'Series 1',
            data: [1, 2, 3],
            borderColor: '#0693e3',
          },
        ],
      },
    };
    const mockTableData = {
      headers: ['Name', 'Value'],
      rows: [
        ['A', 1],
        ['B', 2],
      ],
    };

    store.setChartData(mockChartConfig, mockTableData);

    expect(store.chartConfig).toEqual(mockChartConfig);
    expect(store.tableData).toEqual(mockTableData);
  });

  it('should clear chart data', () => {
    const store = useChartStore.getState();
    const mockChartConfig = {
      type: 'bar' as const,
      data: {
        labels: ['X', 'Y'],
        datasets: [{ label: 'Data', data: [10, 20] }],
      },
    };

    store.setChartData(mockChartConfig, null);
    expect(store.chartConfig).not.toBeNull();

    store.clearChart();
    expect(store.chartConfig).toBeNull();
    expect(store.tableData).toBeNull();
  });

  it('should handle partial data updates', () => {
    const store = useChartStore.getState();
    const mockChartConfig = {
      type: 'scatter' as const,
      data: {
        labels: [1, 2, 3],
        datasets: [{ label: 'Scatter', data: [5, 10, 15] }],
      },
    };

    // Set only chart config
    store.setChartData(mockChartConfig, null);
    expect(store.chartConfig).not.toBeNull();
    expect(store.tableData).toBeNull();

    // Update with table data
    const mockTableData = {
      headers: ['Index', 'Value'],
      rows: [
        [1, 5],
        [2, 10],
      ],
    };
    store.setChartData(mockChartConfig, mockTableData);
    expect(store.tableData).not.toBeNull();
  });
});
