import { describe, it, expect } from 'vitest';
import { convertAnalysisResultsToChartData } from './chartDataConverter';

describe('convertAnalysisResultsToChartData', () => {
  it('should convert direct format (labels/datasets) correctly', () => {
    const analysisResults = {
      chart_data: {
        type: 'line',
        labels: [1, 2, 3, 4, 5],
        datasets: [
          {
            label: 'expression_level',
            data: [100, 200, 150, 300, 250],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
          }
        ]
      },
      results_table: [
        { metric: 'Mean', value: 200 },
        { metric: 'Median', value: 200 }
      ]
    };

    const result = convertAnalysisResultsToChartData(analysisResults, 'test query');

    expect(result.chartConfig).toBeDefined();
    expect(result.chartConfig?.type).toBe('line');
    expect(result.chartConfig?.data.labels).toEqual([1, 2, 3, 4, 5]);
    expect(result.chartConfig?.data.datasets[0].data).toEqual([100, 200, 150, 300, 250]);
    expect(result.tableData).toBeDefined();
    expect(result.tableData?.rows.length).toBe(2);
  });

  it('should convert points format correctly', () => {
    const analysisResults = {
      chart_data: {
        type: 'bar',
        points: [
          { x: 'Mean', y: 552.77 },
          { x: 'Median', y: 580.3 },
          { x: 'Std Dev', y: 298.24 }
        ]
      },
      results_table: [
        { metric: 'Mean', value: 552.77 }
      ]
    };

    const result = convertAnalysisResultsToChartData(analysisResults, 'std dev query');

    expect(result.chartConfig).toBeDefined();
    expect(result.chartConfig?.type).toBe('bar');
    expect(result.chartConfig?.data.labels).toEqual(['Mean', 'Median', 'Std Dev']);
    expect(result.chartConfig?.data.datasets[0].data).toEqual([552.77, 580.3, 298.24]);
  });

  it('should handle empty chart_data gracefully', () => {
    const analysisResults = {
      results_table: [
        { metric: 'Mean', value: 100 }
      ]
    };

    const result = convertAnalysisResultsToChartData(analysisResults, 'query');

    expect(result.chartConfig).toBeNull();
    expect(result.tableData).toBeDefined();
    expect(result.tableData?.rows.length).toBe(1);
  });

  it('should handle missing results_table gracefully', () => {
    const analysisResults = {
      chart_data: {
        type: 'line',
        labels: [1, 2, 3],
        datasets: [{ label: 'test', data: [10, 20, 30] }]
      }
    };

    const result = convertAnalysisResultsToChartData(analysisResults, 'query');

    expect(result.chartConfig).toBeDefined();
    expect(result.tableData).toBeNull();
  });

  it('should use default chart type when not specified', () => {
    const analysisResults = {
      chart_data: {
        labels: [1, 2],
        datasets: [{ label: 'test', data: [10, 20] }]
      }
    };

    const result = convertAnalysisResultsToChartData(analysisResults, 'query');

    expect(result.chartConfig?.type).toBe('line');
  });

  it('should handle datasets with multiple series', () => {
    const analysisResults = {
      chart_data: {
        type: 'line',
        labels: [1, 2, 3],
        datasets: [
          { label: 'Series 1', data: [10, 20, 30], borderColor: '#0693e3' },
          { label: 'Series 2', data: [5, 15, 25], borderColor: '#ef4444' }
        ]
      }
    };

    const result = convertAnalysisResultsToChartData(analysisResults, 'query');

    expect(result.chartConfig?.data.datasets.length).toBe(2);
    expect(result.chartConfig?.data.datasets[0].label).toBe('Series 1');
    expect(result.chartConfig?.data.datasets[1].label).toBe('Series 2');
  });
});
