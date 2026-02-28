/**
 * Data Exploration Engine
 * R-like summary() output with comprehensive statistics
 */

import { computeDescriptiveStats } from "@/lib/statistics";

export interface ColumnSummary {
  name: string;
  type: "numeric" | "categorical" | "date" | "boolean" | "text";
  nonNullCount: number;
  nullCount: number;
  nullPercent: number;
  uniqueValues: number;
  // Numeric stats
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  q1?: number;
  q3?: number;
  stdDev?: number;
  skewness?: number;
  kurtosis?: number;
  // Categorical stats
  topCategories?: Array<{ value: string; count: number; percent: number }>;
  // Date stats
  minDate?: string;
  maxDate?: string;
  dateRange?: string;
}

export interface DataSummary {
  totalRows: number;
  totalColumns: number;
  columns: ColumnSummary[];
  memoryUsage: string;
  completeness: number;
  issues: string[];
}

/**
 * Generate comprehensive data summary (R-like summary())
 */
export function generateDataSummary(data: Record<string, any>[]): DataSummary {
  if (data.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      columns: [],
      memoryUsage: "0 KB",
      completeness: 0,
      issues: ["No data to summarize"],
    };
  }

  const columns = Object.keys(data[0]);
  const summary: DataSummary = {
    totalRows: data.length,
    totalColumns: columns.length,
    columns: [],
    memoryUsage: estimateMemoryUsage(data),
    completeness: 0,
    issues: [],
  };

  let totalNonNull = 0;

  columns.forEach((col) => {
    const values = data.map((row) => row[col]);
    const nonNullValues = values.filter((v) => v !== null && v !== "");
    const nullCount = values.length - nonNullValues.length;

    totalNonNull += nonNullValues.length;

    const columnSummary: ColumnSummary = {
      name: col,
      type: detectType(values),
      nonNullCount: nonNullValues.length,
      nullCount,
      nullPercent: (nullCount / values.length) * 100,
      uniqueValues: new Set(nonNullValues).size,
    };

    if (columnSummary.type === "numeric") {
      const numericValues = nonNullValues
        .map((v: any) => Number(v))
        .filter((v: number) => !isNaN(v));

      if (numericValues.length > 0) {
        const stats = computeDescriptiveStats(numericValues);
        columnSummary.min = stats.min ?? undefined;
        columnSummary.max = stats.max ?? undefined;
        columnSummary.mean = stats.mean ?? undefined;
        columnSummary.median = stats.median ?? undefined;
        columnSummary.q1 = stats.q1 ?? undefined;
        columnSummary.q3 = stats.q3 ?? undefined;
        columnSummary.stdDev = stats.stdDev ?? undefined;
        columnSummary.skewness = calculateSkewness(numericValues);
        columnSummary.kurtosis = calculateKurtosis(numericValues);
      }
    } else if (columnSummary.type === "categorical") {
      const freqTable = getFrequencyTable(nonNullValues as string[]);
      columnSummary.topCategories = freqTable
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((item) => ({
          ...item,
          percent: (item.count / nonNullValues.length) * 100,
        }));
    } else if (columnSummary.type === "date") {
      const dates = nonNullValues.filter((v) => isValidDate(v as string));
      if (dates.length > 0) {
        const sortedDates = (dates as string[]).sort();
        columnSummary.minDate = sortedDates[0];
        columnSummary.maxDate = sortedDates[sortedDates.length - 1];
        columnSummary.dateRange = `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;
      }
    }

    summary.columns.push(columnSummary);
  });

  summary.completeness =
    (totalNonNull / (data.length * columns.length)) * 100;

  // Identify issues
  if (summary.completeness < 80) {
    summary.issues.push(
      `Low data completeness (${summary.completeness.toFixed(1)}%)`
    );
  }

  summary.columns.forEach((col) => {
    if (col.nullPercent > 20) {
      summary.issues.push(
        `Column "${col.name}" has ${col.nullPercent.toFixed(1)}% missing values`
      );
    }
    if (col.type === "numeric" && col.skewness !== undefined && Math.abs(col.skewness) > 2) {
      summary.issues.push(
        `Column "${col.name}" is highly skewed (skewness: ${col.skewness.toFixed(2)})`
      );
    }
  });

  return summary;
}

/**
 * Generate frequency table for categorical variable
 */
export function getFrequencyTable(
  values: string[]
): Array<{ value: string; count: number }> {
  const freq = new Map<string, number>();
  values.forEach((v) => {
    freq.set(v, (freq.get(v) || 0) + 1);
  });

  return Array.from(freq.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate correlation matrix
 */
export function calculateCorrelationMatrix(
  data: Record<string, any>[],
  numericColumns: string[]
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};

  numericColumns.forEach((col1) => {
    matrix[col1] = {};
    const values1 = data
      .map((row) => Number(row[col1]))
      .filter((v) => !isNaN(v));

    numericColumns.forEach((col2) => {
      const values2 = data
        .map((row) => Number(row[col2]))
        .filter((v) => !isNaN(v));

      if (col1 === col2) {
        matrix[col1][col2] = 1;
      } else {
        matrix[col1][col2] = calculatePearsonCorrelation(values1, values2);
      }
    });
  });

  return matrix;
}

/**
 * Detect multicollinearity (VIF)
 */
export function detectMulticollinearity(
  data: Record<string, any>[],
  numericColumns: string[]
): Record<string, number> {
  const vif: Record<string, number> = {};
  const corr = calculateCorrelationMatrix(data, numericColumns);

  numericColumns.forEach((col) => {
    const correlations = numericColumns
      .filter((c) => c !== col)
      .map((c) => Math.abs(corr[col][c]));

    const avgCorr =
      correlations.length > 0
        ? correlations.reduce((a, b) => a + b, 0) / correlations.length
        : 0;

    vif[col] = avgCorr > 0.9 ? 10 : avgCorr > 0.7 ? 5 : 1;
  });

  return vif;
}

/**
 * Helper: Detect column type
 */
function detectType(
  values: any[]
): "numeric" | "categorical" | "date" | "boolean" | "text" {
  const nonEmpty = values.filter((v) => v !== null && v !== "");
  if (nonEmpty.length === 0) return "text";

  if (nonEmpty.every((v) => v === "true" || v === "false" || v === true || v === false)) {
    return "boolean";
  }

  const numericCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
  if (numericCount / nonEmpty.length > 0.8) return "numeric";

  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{1,2}-\w{3}-\d{4}/,
  ];
  const dateCount = nonEmpty.filter((v) =>
    dateFormats.some((fmt) => fmt.test(String(v)))
  ).length;
  if (dateCount / nonEmpty.length > 0.8) return "date";

  const uniqueCount = new Set(nonEmpty).size;
  if (uniqueCount / nonEmpty.length < 0.1 && uniqueCount < 50) {
    return "categorical";
  }

  return "text";
}

/**
 * Helper: Estimate memory usage
 */
function estimateMemoryUsage(data: Record<string, any>[]): string {
  const json = JSON.stringify(data);
  const bytes = new Blob([json]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Helper: Check if valid date
 */
function isValidDate(dateString: string): boolean {
  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}/,
    /^\d{2}\/\d{2}\/\d{4}/,
    /^\d{1,2}-\w{3}-\d{4}/,
  ];
  return dateFormats.some((fmt) => fmt.test(dateString));
}

/**
 * Helper: Calculate Pearson correlation
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

/**
 * Helper: Calculate skewness
 */
function calculateSkewness(values: number[]): number {
  if (values.length < 3) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const skewness =
    values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) /
    values.length;

  return skewness;
}

/**
 * Helper: Calculate kurtosis
 */
function calculateKurtosis(values: number[]): number {
  if (values.length < 4) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const kurtosis =
    values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) /
    values.length - 3;

  return kurtosis;
}

/**
 * Generate human-readable summary text
 */
export function generateSummaryText(summary: DataSummary): string {
  let text = `## Data Summary\n\n`;
  text += `**Dimensions**: ${summary.totalRows} rows × ${summary.totalColumns} columns\n`;
  text += `**Memory**: ${summary.memoryUsage}\n`;
  text += `**Completeness**: ${summary.completeness.toFixed(1)}%\n\n`;

  text += `### Column Summary\n\n`;
  summary.columns.forEach((col) => {
    text += `**${col.name}** (${col.type})\n`;
    text += `- Non-null: ${col.nonNullCount}/${summary.totalRows} (${(100 - col.nullPercent).toFixed(1)}%)\n`;
    text += `- Unique values: ${col.uniqueValues}\n`;

    if (col.type === "numeric") {
      text += `- Range: [${col.min?.toFixed(2)}, ${col.max?.toFixed(2)}]\n`;
      text += `- Mean: ${col.mean?.toFixed(2)}, Median: ${col.median?.toFixed(2)}, SD: ${col.stdDev?.toFixed(2)}\n`;
    } else if (col.type === "categorical" && col.topCategories) {
      text += `- Top categories: ${col.topCategories.slice(0, 3).map((c) => `${c.value} (${c.percent.toFixed(1)}%)`).join(", ")}\n`;
    }
    text += "\n";
  });

  if (summary.issues.length > 0) {
    text += `### Data Quality Issues\n\n`;
    summary.issues.forEach((issue) => {
      text += `- ⚠️ ${issue}\n`;
    });
  }

  return text;
}
