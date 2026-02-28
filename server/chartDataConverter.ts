/**
 * Convert analysisResults to Zustand store format (chartConfig and tableData)
 */
export function convertAnalysisResultsToChartData(analysisResults: any, userQuery: string) {
  let chartConfig = null;
  let tableData = null;

  if (analysisResults.chart_data) {
    const chartData = analysisResults.chart_data;
    
    // Handle two possible formats:
    // 1. Direct format: { type, labels, datasets }
    // 2. Points format: { type, points: [{x, y}, ...] }
    
    if (chartData.labels && chartData.datasets) {
      // Direct format - use as-is
      chartConfig = {
        type: chartData.type || 'line',
        data: {
          labels: chartData.labels || [],
          datasets: chartData.datasets || []
        }
      };
    } else if (chartData.points && Array.isArray(chartData.points)) {
      // Points format - convert to labels/datasets
      chartConfig = {
        type: chartData.type || 'bar',
        data: {
          labels: chartData.points.map((p: any) => p.x || p.label) || [],
          datasets: [
            {
              label: userQuery,
              data: chartData.points.map((p: any) => p.y || p.value) || [],
              borderColor: '#0693e3',
              backgroundColor: '#0693e3',
            }
          ]
        }
      };
    }
  }

  if (analysisResults.results_table) {
    tableData = {
      headers: analysisResults.results_table.length > 0 ? Object.keys(analysisResults.results_table[0]) : [],
      rows: analysisResults.results_table.map((row: any) => Object.values(row))
    };
  }

  return { chartConfig, tableData };
}
