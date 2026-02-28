/**
 * Backend Biostatistics Computation Engine
 * Computes actual statistics and returns structured JSON (not narrative text)
 */

import {
  computeSampleStdDev,
  computeMean,
  computeMedian,
  computeQuartiles,
  computeMinMax,
  computeRange,
  computeCV,
  computeDescriptiveStats,
  computeFoldChangeStats,
  computeLog2FoldChange,
  filterNumericValues,
  formatNumber,
} from "@/lib/statistics";

export interface ComputationResult {
  query: string;
  column: string | string[];
  statistic: string;
  result: {
    value: number | null;
    n: number;
    mean?: number | null;
    median?: number | null;
    stdDev?: number | null;
    min?: number | null;
    max?: number | null;
    range?: number | null;
    q1?: number | null;
    q3?: number | null;
    iqr?: number | null;
    cv?: number | null;
    ci95?: { lower: number; upper: number; margin: number } | null;
    upregulated?: number;
    downregulated?: number;
    unchanged?: number;
  };
  chartData: {
    type: "bar" | "line" | "scatter" | "histogram";
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
  };
  explanation: string;
  rawData?: number[];
}

/**
 * Parse CSV data and extract numeric column
 */
function extractNumericColumn(
  data: Record<string, any>[],
  columnName: string
): number[] {
  if (!data || data.length === 0) return [];

  const columnData = data.map((row) => row[columnName]);
  return filterNumericValues(columnData);
}

/**
 * Detect most likely numeric column if not specified
 */
function detectNumericColumn(data: Record<string, any>[]): string | null {
  if (!data || data.length === 0) return null;

  const firstRow = data[0];
  const columns = Object.keys(firstRow);

  // Priority: fold_change, treated_value, control_value, then first numeric column
  const priorities = [
    "fold_change",
    "log2_fold_change",
    "treated_value",
    "control_value",
    "value",
    "expression",
  ];

  for (const col of priorities) {
    if (columns.includes(col)) {
      const values = extractNumericColumn(data, col);
      if (values.length > 0) return col;
    }
  }

  // Find first numeric column
  for (const col of columns) {
    const values = extractNumericColumn(data, col);
    if (values.length > 0) return col;
  }

  return null;
}

/**
 * Compute standard deviation and return structured result
 */
export function computeStdDevResult(
  data: Record<string, any>[],
  query: string,
  columnName?: string
): ComputationResult {
  const column = columnName || detectNumericColumn(data);
  if (!column) {
    throw new Error("No numeric column found in data");
  }

  const values = extractNumericColumn(data, column);
  if (values.length === 0) {
    throw new Error(`No numeric values found in column "${column}"`);
  }

  const stdDev = computeSampleStdDev(values);
  const mean = computeMean(values);
  const stats = computeDescriptiveStats(values);

  // Create histogram data for visualization
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length)));
  const binSize = (max - min) / binCount;
  const bins = Array(binCount).fill(0);

  values.forEach((v) => {
    const binIndex = Math.floor((v - min) / binSize);
    if (binIndex < binCount) bins[binIndex]++;
  });

  return {
    query,
    column,
    statistic: "sample_std_dev",
    result: {
      value: stdDev,
      n: values.length,
      mean,
      median: stats.median,
      stdDev,
      min: stats.min,
      max: stats.max,
      range: stats.range,
      q1: stats.q1,
      q3: stats.q3,
      iqr: stats.iqr,
      cv: stats.cv,
      ci95: stats.ci95,
    },
    chartData: {
      type: "histogram",
      labels: Array.from({ length: binCount }, (_, i) =>
        formatNumber(min + i * binSize, 2)
      ),
      datasets: [
        {
          label: `${column} Distribution`,
          data: bins,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
        },
      ],
    },
    explanation: `Sample standard deviation for "${column}" is ${formatNumber(stdDev, 4)} (n=${values.length}). This measures the spread of values around the mean of ${formatNumber(mean, 4)}.`,
    rawData: values,
  };
}

/**
 * Compute mean and return structured result
 */
export function computeMeanResult(
  data: Record<string, any>[],
  query: string,
  columnName?: string
): ComputationResult {
  const column = columnName || detectNumericColumn(data);
  if (!column) {
    throw new Error("No numeric column found in data");
  }

  const values = extractNumericColumn(data, column);
  if (values.length === 0) {
    throw new Error(`No numeric values found in column "${column}"`);
  }

  const mean = computeMean(values);
  const stats = computeDescriptiveStats(values);

  // Create line chart showing values over index
  const labels = Array.from({ length: Math.min(50, values.length) }, (_, i) =>
    i.toString()
  );
  const chartValues = values.slice(0, 50);

  return {
    query,
    column,
    statistic: "mean",
    result: {
      value: mean,
      n: values.length,
      mean,
      median: stats.median,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      range: stats.range,
      ci95: stats.ci95,
    },
    chartData: {
      type: "scatter",
      labels,
      datasets: [
        {
          label: `${column} Values`,
          data: chartValues,
          backgroundColor: "rgba(34, 197, 94, 0.6)",
          borderColor: "rgba(34, 197, 94, 1)",
        },
        {
          label: `Mean (${formatNumber(mean, 4)})`,
          data: Array(chartValues.length).fill(mean),
          backgroundColor: "rgba(239, 68, 68, 0.3)",
          borderColor: "rgba(239, 68, 68, 1)",
        },
      ],
    },
    explanation: `Mean for "${column}" is ${formatNumber(mean, 4)} (n=${values.length}). 95% CI: [${formatNumber(stats.ci95?.lower ?? null, 4)}, ${formatNumber(stats.ci95?.upper ?? null, 4)}].`,
    rawData: values,
  };
}

/**
 * Compute median and return structured result
 */
export function computeMedianResult(
  data: Record<string, any>[],
  query: string,
  columnName?: string
): ComputationResult {
  const column = columnName || detectNumericColumn(data);
  if (!column) {
    throw new Error("No numeric column found in data");
  }

  const values = extractNumericColumn(data, column);
  if (values.length === 0) {
    throw new Error(`No numeric values found in column "${column}"`);
  }

  const median = computeMedian(values);
  const stats = computeDescriptiveStats(values);
  const quartiles = computeQuartiles(values);

  // Create box plot data
  return {
    query,
    column,
    statistic: "median",
    result: {
      value: median,
      n: values.length,
      mean: stats.mean,
      median,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      q1: quartiles?.q1,
      q3: quartiles?.q3,
      iqr: quartiles ? quartiles.q3 - quartiles.q1 : null,
    },
    chartData: {
      type: "bar",
      labels: ["Min", "Q1", "Median", "Q3", "Max"],
      datasets: [
        {
          label: `${column} Quartiles`,
          data: [
            (stats.min ?? 0) as number,
            (quartiles?.q1 ?? 0) as number,
            (median ?? 0) as number,
            (quartiles?.q3 ?? 0) as number,
            (stats.max ?? 0) as number,
          ],
          backgroundColor: "rgba(99, 102, 241, 0.6)",
          borderColor: "rgba(99, 102, 241, 1)",
        },
      ],
    },
    explanation: `Median for "${column}" is ${formatNumber(median, 4)}. IQR: [${formatNumber(quartiles?.q1 ?? null, 4)}, ${formatNumber(quartiles?.q3 ?? null, 4)}].`,
    rawData: values,
  };
}

/**
 * Compute comprehensive descriptive statistics
 */
export function computeDescriptiveResult(
  data: Record<string, any>[],
  query: string,
  columnName?: string
): ComputationResult {
  const column = columnName || detectNumericColumn(data);
  if (!column) {
    throw new Error("No numeric column found in data");
  }

  const values = extractNumericColumn(data, column);
  if (values.length === 0) {
    throw new Error(`No numeric values found in column "${column}"`);
  }

  const stats = computeDescriptiveStats(values);

  // Create comprehensive bar chart
  const labels: string[] = [
    "Mean",
    "Median",
    "Min",
    "Max",
    "Q1",
    "Q3",
  ];
  const chartValues: number[] = [
    (stats.mean ?? 0) as number,
    (stats.median ?? 0) as number,
    (stats.min ?? 0) as number,
    (stats.max ?? 0) as number,
    (stats.q1 ?? 0) as number,
    (stats.q3 ?? 0) as number,
  ];

  return {
    query,
    column,
    statistic: "descriptive_stats",
    result: {
      value: stats.mean,
      n: stats.n,
      mean: stats.mean,
      median: stats.median,
      stdDev: stats.stdDev,
      min: stats.min,
      max: stats.max,
      range: stats.range,
      q1: stats.q1,
      q3: stats.q3,
      iqr: stats.iqr,
      cv: stats.cv,
      ci95: stats.ci95,
    },
    chartData: {
      type: "bar",
      labels,
      datasets: [
        {
          label: `${column} Statistics`,
          data: chartValues,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
        },
      ],
    },
    explanation: `Descriptive statistics for "${column}": Mean=${formatNumber(stats.mean, 4)}, SD=${formatNumber(stats.stdDev, 4)}, Median=${formatNumber(stats.median, 4)}, Range=[${formatNumber(stats.min ?? null, 4)}, ${formatNumber(stats.max ?? null, 4)}].`,
    rawData: values,
  };
}

/**
 * Compute fold-change statistics
 */
export function computeFoldChangeResult(
  data: Record<string, any>[],
  query: string
): ComputationResult {
  const foldChangeData = extractNumericColumn(data, "fold_change");
  if (foldChangeData.length === 0) {
    throw new Error("No fold_change column found in data");
  }

  const stats = computeFoldChangeStats(foldChangeData);
  const total =
    stats.upregulated + stats.downregulated + stats.unchanged;

  return {
    query,
    column: "fold_change",
    statistic: "fold_change_stats",
    result: {
      value: stats.meanFoldChange,
      n: foldChangeData.length,
      mean: stats.meanFoldChange,
      median: stats.medianFoldChange,
      stdDev: stats.stdDevFoldChange,
      upregulated: stats.upregulated,
      downregulated: stats.downregulated,
      unchanged: stats.unchanged,
    },
    chartData: {
      type: "bar",
      labels: ["Upregulated", "Unchanged", "Downregulated"],
      datasets: [
        {
          label: "Gene Count",
          data: [stats.upregulated, stats.unchanged, stats.downregulated],
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(59, 130, 246, 1)",
        },
      ],
    },
    explanation: `Fold-change analysis: Mean=${formatNumber(stats.meanFoldChange ?? null, 4)}, SD=${formatNumber(stats.stdDevFoldChange ?? null, 4)}. Upregulated: ${stats.upregulated} (${((stats.upregulated / total) * 100).toFixed(1)}%), Downregulated: ${stats.downregulated} (${((stats.downregulated / total) * 100).toFixed(1)}%).`,
    rawData: foldChangeData,
  };
}

/**
 * Main computation dispatcher
 * Routes queries to appropriate computation function
 */
export function computeBiostatistics(
  data: Record<string, any>[],
  query: string,
  columnName?: string
): ComputationResult {
  const lowerQuery = query.toLowerCase();

  // Fold change
  if (
    lowerQuery.includes("fold") ||
    lowerQuery.includes("fc") ||
    lowerQuery.includes("expression")
  ) {
    return computeFoldChangeResult(data, query);
  }

  // Standard deviation
  if (
    lowerQuery.includes("standard deviation") ||
    lowerQuery.includes("std dev") ||
    lowerQuery.includes("stddev") ||
    lowerQuery.includes("variance")
  ) {
    return computeStdDevResult(data, query, columnName);
  }

  // Mean
  if (
    lowerQuery.includes("mean") ||
    lowerQuery.includes("average") ||
    lowerQuery.includes("avg")
  ) {
    return computeMeanResult(data, query, columnName);
  }

  // Median
  if (lowerQuery.includes("median")) {
    return computeMedianResult(data, query, columnName);
  }

  // Comprehensive stats
  if (
    lowerQuery.includes("descriptive") ||
    lowerQuery.includes("summary") ||
    lowerQuery.includes("statistics") ||
    lowerQuery.includes("all stats")
  ) {
    return computeDescriptiveResult(data, query, columnName);
  }

  // Default to descriptive stats
  return computeDescriptiveResult(data, query, columnName);
}
