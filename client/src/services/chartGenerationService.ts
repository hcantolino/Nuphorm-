import { DataRow, ChartVariable } from '@/stores/biostatStore';

export interface ChartGenerationRequest {
  measurements: string[];
  dataFiles: string[];
  prompt: string;
  selectedData?: DataRow[];
}

export interface GeneratedChart {
  data: DataRow[];
  variables: ChartVariable[];
  title: string;
  chartType: 'line' | 'scatter' | 'bar' | 'area';
  statistics: Record<string, number>;
}

// Sample data generator for demonstration
export function generateSampleChartData(measurements: string[], dataSize: number = 20): DataRow[] {
  const data: DataRow[] = [];
  
  // Generate sample data points
  for (let i = 0; i < dataSize; i++) {
    const row: DataRow = { name: `Point ${i + 1}` };
    
    // Generate values for each measurement
    measurements.forEach((measurement) => {
      if (measurement.includes('mean') || measurement.includes('Mean')) {
        row[measurement] = Math.round((Math.random() * 100 + 50) * 10) / 10;
      } else if (measurement.includes('median') || measurement.includes('Median')) {
        row[measurement] = Math.round((Math.random() * 90 + 40) * 10) / 10;
      } else if (measurement.includes('std') || measurement.includes('Standard')) {
        row[measurement] = Math.round((Math.random() * 20 + 5) * 10) / 10;
      } else {
        row[measurement] = Math.round(Math.random() * 100 * 10) / 10;
      }
    });
    
    data.push(row);
  }
  
  return data;
}

// Calculate statistics from data
export function calculateStatistics(data: DataRow[], columnName: string): Record<string, number> {
  const values = data
    .map((row) => row[columnName])
    .filter((val) => typeof val === 'number') as number[];

  if (values.length === 0) return {};

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const median = values.length % 2 === 0
    ? (sorted[values.length / 2 - 1] + sorted[values.length / 2]) / 2
    : sorted[Math.floor(values.length / 2)];

  return {
    count: values.length,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: Math.min(...values),
    max: Math.max(...values),
    stdDev: Math.round(stdDev * 100) / 100,
    variance: Math.round(variance * 100) / 100,
  };
}

// Main chart generation function
export async function generateChart(request: ChartGenerationRequest): Promise<GeneratedChart> {
  const { measurements, prompt } = request;

  // Extract measurement names from the prompt
  const extractedMeasurements = measurements.length > 0
    ? measurements
    : ['Mean', 'Median', 'Standard Deviation'];

  // Generate sample data based on measurements
  const generatedData = generateSampleChartData(extractedMeasurements, 20);

  // Determine chart type based on prompt
  let chartType: 'line' | 'scatter' | 'bar' | 'area' = 'line';
  if (prompt.toLowerCase().includes('scatter')) {
    chartType = 'scatter';
  } else if (prompt.toLowerCase().includes('bar')) {
    chartType = 'bar';
  } else if (prompt.toLowerCase().includes('area')) {
    chartType = 'area';
  }

  // Create chart variables with colors
  const colors = ['#0693e3', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  const variables: ChartVariable[] = extractedMeasurements.map((name, index) => ({
    name,
    type: 'numeric',
    color: colors[index % colors.length],
  }));

  // Calculate statistics
  const statistics: Record<string, number> = {};
  extractedMeasurements.forEach((measurement) => {
    const stats = calculateStatistics(generatedData, measurement);
    Object.entries(stats).forEach(([key, value]) => {
      statistics[`${measurement}_${key}`] = value;
    });
  });

  // Generate title from prompt
  const title = prompt.includes('for')
    ? prompt.split('for')[1].trim().split(' ').slice(0, 3).join(' ')
    : 'Generated Analysis';

  return {
    data: generatedData,
    variables,
    title: `${title} Analysis`,
    chartType,
    statistics,
  };
}
