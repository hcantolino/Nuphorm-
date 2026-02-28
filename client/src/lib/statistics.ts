/**
 * Core Statistical Computation Utilities
 * Pure vanilla JS functions for pharma biostatistics calculations
 */

/**
 * Compute sample standard deviation
 * Uses n-1 denominator (Bessel's correction) for sample std dev
 */
export function computeSampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute population standard deviation
 * Uses n denominator (not sample)
 */
export function computePopulationStdDev(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute mean (average)
 */
export function computeMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compute median
 */
export function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute quartiles (Q1, Q2/median, Q3)
 */
export function computeQuartiles(values: number[]): {
  q1: number;
  q2: number;
  q3: number;
} | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const q2 = computeMedian(sorted);
  if (q2 === null) return null;

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));

  const q1 = computeMedian(lowerHalf);
  const q3 = computeMedian(upperHalf);

  if (q1 === null || q3 === null) return null;

  return { q1, q2, q3 };
}

/**
 * Compute min and max
 */
export function computeMinMax(values: number[]): {
  min: number;
  max: number;
} | null {
  if (values.length === 0) return null;
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Compute range (max - min)
 */
export function computeRange(values: number[]): number | null {
  const minMax = computeMinMax(values);
  if (!minMax) return null;
  return minMax.max - minMax.min;
}

/**
 * Compute coefficient of variation (CV)
 * CV = (std dev / mean) * 100
 */
export function computeCV(values: number[]): number | null {
  const mean = computeMean(values);
  const stdDev = computeSampleStdDev(values);
  if (mean === null || stdDev === null || mean === 0) return null;
  return (stdDev / Math.abs(mean)) * 100;
}

/**
 * Compute skewness (measure of asymmetry)
 */
export function computeSkewness(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = computeMean(values);
  const stdDev = computeSampleStdDev(values);
  if (mean === null || stdDev === null || stdDev === 0) return null;

  const n = values.length;
  const cubedDeviations = values.reduce((sum, val) => {
    return sum + Math.pow((val - mean) / stdDev, 3);
  }, 0);

  return (n / ((n - 1) * (n - 2))) * cubedDeviations;
}

/**
 * Compute kurtosis (measure of tail weight)
 */
export function computeKurtosis(values: number[]): number | null {
  if (values.length < 4) return null;
  const mean = computeMean(values);
  const stdDev = computeSampleStdDev(values);
  if (mean === null || stdDev === null || stdDev === 0) return null;

  const n = values.length;
  const fourthMoment = values.reduce((sum, val) => {
    return sum + Math.pow((val - mean) / stdDev, 4);
  }, 0);

  return (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * fourthMoment - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
}

/**
 * Compute standard error of the mean (SEM)
 */
export function computeSEM(values: number[]): number | null {
  const stdDev = computeSampleStdDev(values);
  if (stdDev === null || values.length === 0) return null;
  return stdDev / Math.sqrt(values.length);
}

/**
 * Compute 95% confidence interval for mean
 * Using t-distribution (for small samples)
 */
export function compute95CI(values: number[]): {
  lower: number;
  upper: number;
  margin: number;
} | null {
  if (values.length < 2) return null;
  const mean = computeMean(values);
  const sem = computeSEM(values);
  if (mean === null || sem === null) return null;

  // Approximate t-value for 95% CI (varies with sample size)
  // For large samples (n > 30), t ≈ 1.96; for smaller samples, use higher values
  const tValue = values.length > 30 ? 1.96 : values.length > 20 ? 2.086 : values.length > 10 ? 2.228 : 2.571;

  const margin = tValue * sem;
  return {
    lower: mean - margin,
    upper: mean + margin,
    margin,
  };
}

/**
 * Filter numeric values from array
 * Removes NaN, null, undefined, and non-numeric values
 */
export function filterNumericValues(values: any[]): number[] {
  return values.filter((v) => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  });
}

/**
 * Extract column from array of objects
 */
export function extractColumn(data: Record<string, any>[], columnName: string): any[] {
  return data.map((row) => row[columnName]);
}

/**
 * Compute comprehensive descriptive statistics
 */
export function computeDescriptiveStats(values: number[]): {
  n: number;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  sem: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  q1: number | null;
  q3: number | null;
  iqr: number | null;
  cv: number | null;
  skewness: number | null;
  kurtosis: number | null;
  ci95: { lower: number; upper: number; margin: number } | null;
} {
  const quartiles = computeQuartiles(values);
  const minMax = computeMinMax(values);
  const ci = compute95CI(values);

  return {
    n: values.length,
    mean: computeMean(values),
    median: computeMedian(values),
    stdDev: computeSampleStdDev(values),
    sem: computeSEM(values),
    min: minMax?.min ?? null,
    max: minMax?.max ?? null,
    range: computeRange(values),
    q1: quartiles?.q1 ?? null,
    q3: quartiles?.q3 ?? null,
    iqr: quartiles ? quartiles.q3 - quartiles.q1 : null,
    cv: computeCV(values),
    skewness: computeSkewness(values),
    kurtosis: computeKurtosis(values),
    ci95: ci,
  };
}

/**
 * Compute fold-change statistics (for gene expression data)
 */
export function computeFoldChangeStats(foldChanges: number[]): {
  meanFoldChange: number | null;
  stdDevFoldChange: number | null;
  medianFoldChange: number | null;
  upregulated: number;
  downregulated: number;
  unchanged: number;
} {
  const filtered = filterNumericValues(foldChanges);
  if (filtered.length === 0) {
    return {
      meanFoldChange: null,
      stdDevFoldChange: null,
      medianFoldChange: null,
      upregulated: 0,
      downregulated: 0,
      unchanged: 0,
    };
  }

  const upregulated = filtered.filter((v) => v > 1.5).length;
  const downregulated = filtered.filter((v) => v < 0.67).length;
  const unchanged = filtered.length - upregulated - downregulated;

  return {
    meanFoldChange: computeMean(filtered),
    stdDevFoldChange: computeSampleStdDev(filtered),
    medianFoldChange: computeMedian(filtered),
    upregulated,
    downregulated,
    unchanged,
  };
}

/**
 * Compute log2 fold-change from control and treated values
 */
export function computeLog2FoldChange(treated: number, control: number): number | null {
  if (control === 0 || treated <= 0) return null;
  return Math.log2(treated / control);
}

/**
 * Compute fold-change (simple ratio)
 */
export function computeFoldChange(treated: number, control: number): number | null {
  if (control === 0) return null;
  return treated / control;
}

/**
 * Compute t-test statistic (independent samples)
 */
export function computeTTest(
  group1: number[],
  group2: number[]
): {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number | null;
} | null {
  if (group1.length < 2 || group2.length < 2) return null;

  const mean1 = computeMean(group1);
  const mean2 = computeMean(group2);
  const std1 = computeSampleStdDev(group1);
  const std2 = computeSampleStdDev(group2);

  if (mean1 === null || mean2 === null || std1 === null || std2 === null) return null;

  const n1 = group1.length;
  const n2 = group2.length;

  // Pooled standard error
  const se = Math.sqrt((std1 * std1) / n1 + (std2 * std2) / n2);
  if (se === 0) return null;

  const tStatistic = (mean1 - mean2) / se;
  const degreesOfFreedom = n1 + n2 - 2;

  // Approximate p-value (two-tailed)
  // This is a simplified approximation; for exact p-values use statistical library
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  return {
    tStatistic,
    degreesOfFreedom,
    pValue,
  };
}

/**
 * Approximate normal CDF (cumulative distribution function)
 * Used for p-value estimation
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));

  return 0.5 * (1.0 + sign * y);
}

/**
 * Compute effect size (Cohen's d)
 */
export function computeCohenD(group1: number[], group2: number[]): number | null {
  if (group1.length < 2 || group2.length < 2) return null;

  const mean1 = computeMean(group1);
  const mean2 = computeMean(group2);
  const std1 = computeSampleStdDev(group1);
  const std2 = computeSampleStdDev(group2);

  if (mean1 === null || mean2 === null || std1 === null || std2 === null) return null;

  const n1 = group1.length;
  const n2 = group2.length;

  // Pooled standard deviation
  const pooledStd = Math.sqrt(((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / (n1 + n2 - 2));

  if (pooledStd === 0) return null;

  return (mean1 - mean2) / pooledStd;
}

/**
 * Format number to specified decimal places
 */
export function formatNumber(value: number | null, decimals: number = 2): string {
  if (value === null) return "N/A";
  return value.toFixed(decimals);
}
