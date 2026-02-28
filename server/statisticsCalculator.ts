/**
 * Real Statistical Calculations for Biostatistics Analysis
 * Implements descriptive stats, comparative tests, and correlation analysis
 */

/**
 * Extract numeric values from a column
 */
function extractNumericColumn(data: Array<Record<string, any>>, columnName: string): number[] {
  return data
    .map((row) => {
      const value = row[columnName];
      const num = Number(value);
      return isNaN(num) ? null : num;
    })
    .filter((v) => v !== null) as number[];
}

/**
 * Calculate descriptive statistics for a numeric column
 */
export function calculateDescriptiveStats(
  data: Array<Record<string, any>>,
  columnName: string
): {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
} {
  const values = extractNumericColumn(data, columnName);
  if (values.length === 0) throw new Error(`No numeric values found in column: ${columnName}`);

  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Median
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Quartiles
  const q1Index = Math.floor(n / 4);
  const q3Index = Math.floor((3 * n) / 4);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  // Skewness
  const skewness =
    n > 2
      ? (values.reduce((sum, val) => sum + Math.pow(val - mean, 3), 0) / n) / Math.pow(stdDev, 3)
      : 0;

  // Kurtosis
  const kurtosis =
    n > 3
      ? (values.reduce((sum, val) => sum + Math.pow(val - mean, 4), 0) / n) / Math.pow(stdDev, 4) - 3
      : 0;

  return {
    count: n,
    mean: parseFloat(mean.toFixed(4)),
    median: parseFloat(median.toFixed(4)),
    stdDev: parseFloat(stdDev.toFixed(4)),
    variance: parseFloat(variance.toFixed(4)),
    min: parseFloat(sorted[0].toFixed(4)),
    max: parseFloat(sorted[n - 1].toFixed(4)),
    q1: parseFloat(q1.toFixed(4)),
    q3: parseFloat(q3.toFixed(4)),
    iqr: parseFloat(iqr.toFixed(4)),
    skewness: parseFloat(skewness.toFixed(4)),
    kurtosis: parseFloat(kurtosis.toFixed(4)),
  };
}

/**
 * Calculate Pearson correlation between two numeric columns
 */
export function calculatePearsonCorrelation(
  data: Array<Record<string, any>>,
  col1: string,
  col2: string
): {
  correlation: number;
  pValue: number;
  n: number;
  interpretation: string;
} {
  const values1 = extractNumericColumn(data, col1);
  const values2 = extractNumericColumn(data, col2);

  if (values1.length !== values2.length) {
    throw new Error("Columns must have equal length");
  }

  const n = values1.length;
  if (n < 3) throw new Error("Need at least 3 data points for correlation");

  const mean1 = values1.reduce((a, b) => a + b, 0) / n;
  const mean2 = values2.reduce((a, b) => a + b, 0) / n;

  const cov = values1.reduce((sum, v1, i) => sum + (v1 - mean1) * (values2[i] - mean2), 0) / n;
  const std1 = Math.sqrt(values1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / n);
  const std2 = Math.sqrt(values2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / n);

  const correlation = cov / (std1 * std2);

  // Approximate p-value using t-distribution
  const rSquared = correlation * correlation;
  const t = correlation * Math.sqrt(n - 2) / Math.sqrt(Math.max(1e-10, 1 - rSquared));
  const pValue = Math.min(1, 2 * (1 - tCDF(Math.abs(t), n - 2)));

  let interpretation = "";
  const absCorr = Math.abs(correlation);
  if (absCorr > 0.7) interpretation = "Strong";
  else if (absCorr > 0.5) interpretation = "Moderate";
  else if (absCorr > 0.3) interpretation = "Weak";
  else interpretation = "Very weak";

  return {
    correlation: parseFloat(correlation.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    n,
    interpretation,
  };
}

/**
 * Perform independent samples t-test
 */
export function calculateTTest(
  data: Array<Record<string, any>>,
  valueColumn: string,
  groupColumn: string
): {
  tStatistic: number;
  pValue: number;
  mean1: number;
  mean2: number;
  group1: string;
  group2: string;
  n1: number;
  n2: number;
  significant: boolean;
} {
  const groups = new Map<string, number[]>();

  for (const row of data) {
    const value = Number(row[valueColumn]);
    const group = String(row[groupColumn]);
    if (!isNaN(value)) {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(value);
    }
  }

  const groupArray = Array.from(groups.entries());
  if (groupArray.length !== 2) {
    throw new Error("t-test requires exactly 2 groups");
  }

  const [group1Name, group1Values] = groupArray[0];
  const [group2Name, group2Values] = groupArray[1];

  const n1 = group1Values.length;
  const n2 = group2Values.length;
  const mean1 = group1Values.reduce((a, b) => a + b, 0) / n1;
  const mean2 = group2Values.reduce((a, b) => a + b, 0) / n2;

  const var1 = group1Values.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (n1 - 1);
  const var2 = group2Values.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (n2 - 1);

  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
  const tStatistic = (mean1 - mean2) / se;
  const df = n1 + n2 - 2;

  const pValue = Math.min(1, 2 * (1 - tCDF(Math.abs(tStatistic), df)));

  return {
    tStatistic: parseFloat(tStatistic.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    mean1: parseFloat(mean1.toFixed(4)),
    mean2: parseFloat(mean2.toFixed(4)),
    group1: group1Name,
    group2: group2Name,
    n1,
    n2,
    significant: pValue < 0.05,
  };
}

/**
 * Perform one-way ANOVA
 */
export function calculateANOVA(
  data: Array<Record<string, any>>,
  valueColumn: string,
  groupColumn: string
): {
  fStatistic: number;
  pValue: number;
  groups: Array<{ name: string; mean: number; n: number }>;
  significant: boolean;
} {
  const groups = new Map<string, number[]>();

  for (const row of data) {
    const value = Number(row[valueColumn]);
    const group = String(row[groupColumn]);
    if (!isNaN(value)) {
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(value);
    }
  }

  if (groups.size < 2) {
    throw new Error("ANOVA requires at least 2 groups");
  }

  const groupArray = Array.from(groups.entries());
  const allValues = Array.from(groups.values()).flat();
  const grandMean = allValues.reduce((a, b) => a + b, 0) / allValues.length;

  // Between-group sum of squares
  let ssb = 0;
  for (const [, values] of groupArray) {
    const groupMean = values.reduce((a, b) => a + b, 0) / values.length;
    ssb += values.length * Math.pow(groupMean - grandMean, 2);
  }

  // Within-group sum of squares
  let ssw = 0;
  for (const [, values] of groupArray) {
    const groupMean = values.reduce((a, b) => a + b, 0) / values.length;
    ssw += values.reduce((sum, v) => sum + Math.pow(v - groupMean, 2), 0);
  }

  const dfb = groups.size - 1;
  const dfw = allValues.length - groups.size;
  const msb = ssb / dfb;
  const msw = ssw / dfw;
  const fStatistic = msb / msw;
  const pValue = 1 - fCDF(fStatistic, dfb, dfw);

  const groupResults = groupArray.map(([name, values]) => ({
    name,
    mean: parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)),
    n: values.length,
  }));

  return {
    fStatistic: parseFloat(fStatistic.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    groups: groupResults,
    significant: pValue < 0.05,
  };
}

/**
 * Calculate distribution histogram data for charting
 */
export function calculateHistogramData(
  data: Array<Record<string, any>>,
  columnName: string,
  bins: number = 10
): Array<{ bin: string; count: number; midpoint: number }> {
  const values = extractNumericColumn(data, columnName);
  if (values.length === 0) throw new Error(`No numeric values in column: ${columnName}`);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins || 1;

  const histogram: Array<{ bin: string; count: number; midpoint: number }> = [];

  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const midpoint = (binStart + binEnd) / 2;
    // For last bin, include values <= binEnd; for others, exclude binEnd
    const count = values.filter((v) => {
      if (i === bins - 1) {
        return v >= binStart && v <= binEnd;
      } else {
        return v >= binStart && v < binEnd;
      }
    }).length;

    histogram.push({
      bin: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
      count,
      midpoint,
    });
  }

  return histogram;
}

/**
 * Calculate scatter plot data for two numeric columns
 */
export function calculateScatterData(
  data: Array<Record<string, any>>,
  xColumn: string,
  yColumn: string
): Array<{ x: number; y: number }> {
  const xValues = extractNumericColumn(data, xColumn);
  const yValues = extractNumericColumn(data, yColumn);

  if (xValues.length !== yValues.length) {
    throw new Error("Columns must have equal length");
  }

  return xValues.map((x, i) => ({
    x: parseFloat(x.toFixed(4)),
    y: parseFloat(yValues[i].toFixed(4)),
  }));
}

/**
 * Approximate t-distribution CDF
 * Using Abramowitz and Stegun approximation
 */
function tCDF(t: number, df: number): number {
  // For large df, use normal approximation
  if (df > 30) {
    return normalCDF(t);
  }

  // Approximate using beta distribution
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5) / 2;
}

/**
 * Approximate F-distribution CDF
 */
function fCDF(f: number, df1: number, df2: number): number {
  const x = (df1 * f) / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

/**
 * Standard normal CDF approximation
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Incomplete beta function approximation
 */
function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - logBeta(a, b));

  let f = 1;
  let c = 1;
  let d = 0;

  for (let i = 1; i <= 100; i++) {
    const m = i / 2;
    let numerator = 0;

    if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    }

    d = 1 + numerator * d;
    c = 1 + numerator / c;
    f *= c / d;

    if (Math.abs(numerator) < 1e-10) break;
  }

  return front * f / a;
}

/**
 * Log of beta function
 */
function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

/**
 * Log gamma function approximation (Stirling's approximation)
 */
function logGamma(z: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  z -= 1;
  let x = coef[0];
  for (let i = 1; i < coef.length; i++) {
    x += coef[i] / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Detect analysis type from user query
 */
export function detectAnalysisType(query: string, columns: string[]): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("correlation") || lowerQuery.includes("correlated")) {
    return "correlation";
  }
  if (lowerQuery.includes("t-test") || lowerQuery.includes("t test") || lowerQuery.includes("compare")) {
    return "t_test";
  }
  if (lowerQuery.includes("anova") || lowerQuery.includes("variance")) {
    return "anova";
  }
  if (
    lowerQuery.includes("mean") ||
    lowerQuery.includes("median") ||
    lowerQuery.includes("std dev") ||
    lowerQuery.includes("standard deviation") ||
    lowerQuery.includes("descriptive")
  ) {
    return "descriptive_stats";
  }
  if (lowerQuery.includes("distribution") || lowerQuery.includes("histogram")) {
    return "distribution";
  }
  if (lowerQuery.includes("scatter")) {
    return "scatter";
  }

  return "descriptive_stats"; // Default
}

/**
 * Extract column names from query
 */
export function extractColumnsFromQuery(query: string, availableColumns: string[]): string[] {
  const extracted: string[] = [];

  for (const col of availableColumns) {
    if (query.toLowerCase().includes(col.toLowerCase())) {
      extracted.push(col);
    }
  }

  return extracted.length > 0 ? extracted : availableColumns.slice(0, 2);
}
