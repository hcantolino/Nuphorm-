/**
 * Data Transformation Module
 * Log, Box-Cox, recoding, normalization, and other transformations
 */

export interface TransformationResult {
  originalData: number[];
  transformedData: number[];
  transformation: string;
  lambda?: number;
  normality?: number;
  interpretation: string;
}

/**
 * Log transformation with handling of zeros and negative values
 */
export function logTransform(
  values: number[],
  base: number = Math.E,
  offset: number = 0
): TransformationResult {
  const transformed = values.map((v) => {
    if (v + offset <= 0) {
      return Math.log(0.001 + offset);
    }
    return Math.log(v + offset) / Math.log(base);
  });

  return {
    originalData: values,
    transformedData: transformed,
    transformation: `log${base === Math.E ? "" : base}(x${offset > 0 ? ` + ${offset}` : ""})`,
    interpretation: `Applied logarithmic transformation with base ${base} and offset ${offset} to reduce skewness.`,
  };
}

/**
 * Box-Cox transformation for normality
 */
export function boxCoxTransform(
  values: number[],
  lambda?: number
): TransformationResult {
  // Ensure all values are positive
  const minVal = Math.min(...values);
  const offset = minVal <= 0 ? Math.abs(minVal) + 1 : 0;
  const adjustedValues = values.map((v) => v + offset);

  // If lambda not provided, estimate it
  if (lambda === undefined) {
    lambda = estimateLambda(adjustedValues);
  }

  const transformed = adjustedValues.map((v) => {
    if (Math.abs(lambda!) < 0.0001) {
      return Math.log(v);
    }
    return (Math.pow(v, lambda!) - 1) / lambda!;
  });

  const normality = calculateNormality(transformed);

  return {
    originalData: values,
    transformedData: transformed,
    transformation: `Box-Cox(λ=${lambda.toFixed(3)})`,
    lambda,
    normality,
    interpretation: `Applied Box-Cox transformation with λ=${lambda.toFixed(3)}. Normality score: ${normality.toFixed(3)} (closer to 1 is better).`,
  };
}

/**
 * Square root transformation
 */
export function sqrtTransform(values: number[]): TransformationResult {
  const transformed = values.map((v) => (v >= 0 ? Math.sqrt(v) : 0));

  return {
    originalData: values,
    transformedData: transformed,
    transformation: "√x",
    interpretation: "Applied square root transformation to stabilize variance.",
  };
}

/**
 * Reciprocal transformation
 */
export function reciprocalTransform(values: number[]): TransformationResult {
  const transformed = values.map((v) => (v !== 0 ? 1 / v : 0));

  return {
    originalData: values,
    transformedData: transformed,
    transformation: "1/x",
    interpretation: "Applied reciprocal transformation to handle right-skewed data.",
  };
}

/**
 * Arcsine transformation (for proportions)
 */
export function arcsineTransform(values: number[]): TransformationResult {
  const transformed = values.map((v) => {
    const p = Math.max(0, Math.min(1, v));
    return Math.asin(Math.sqrt(p));
  });

  return {
    originalData: values,
    transformedData: transformed,
    transformation: "arcsin(√x)",
    interpretation: "Applied arcsine transformation for proportional data.",
  };
}

/**
 * Yeo-Johnson transformation (handles negative values)
 */
export function yeoJohnsonTransform(
  values: number[],
  lambda?: number
): TransformationResult {
  if (lambda === undefined) {
    lambda = estimateLambda(values);
  }

  const transformed = values.map((v) => {
    if (v >= 0) {
      if (Math.abs(lambda!) < 0.0001) {
        return Math.log(v + 1);
      }
      return (Math.pow(v + 1, lambda!) - 1) / lambda!;
    } else {
      if (Math.abs(lambda! - 2) < 0.0001) {
        return -Math.log(-v + 1);
      }
      return -(Math.pow(-v + 1, 2 - lambda!) - 1) / (2 - lambda!);
    }
  });

  return {
    originalData: values,
    transformedData: transformed,
    transformation: `Yeo-Johnson(λ=${lambda.toFixed(3)})`,
    lambda,
    interpretation: `Applied Yeo-Johnson transformation (handles negative values) with λ=${lambda.toFixed(3)}.`,
  };
}

/**
 * Normalize/standardize data (z-score)
 */
export function normalizeZScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return values.map(() => 0);

  return values.map((v) => (v - mean) / stdDev);
}

/**
 * Normalize/standardize data (min-max)
 */
export function normalizeMinMax(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return values.map(() => 0.5);

  return values.map((v) => (v - min) / range);
}

/**
 * Normalize using robust scaling (median and IQR)
 */
export function normalizeRobust(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  if (iqr === 0) return values.map(() => 0);

  return values.map((v) => (v - median) / iqr);
}

/**
 * Estimate optimal lambda for Box-Cox transformation
 */
function estimateLambda(values: number[]): number {
  const candidates = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
  let bestLambda = 0;
  let bestScore = -Infinity;

  candidates.forEach((lambda) => {
    const transformed = values.map((v) => {
      if (Math.abs(lambda) < 0.0001) {
        return Math.log(v);
      }
      return (Math.pow(v, lambda) - 1) / lambda;
    });

    const score = calculateNormality(transformed);
    if (score > bestScore) {
      bestScore = score;
      bestLambda = lambda;
    }
  });

  return bestLambda;
}

/**
 * Calculate normality score using Shapiro-Wilk approximation
 */
function calculateNormality(values: number[]): number {
  if (values.length < 3) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Calculate skewness
  const skewness =
    values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) /
    values.length;

  // Calculate kurtosis
  const kurtosis =
    values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) /
    values.length - 3;

  // Normality score: 1 - (|skewness| + |kurtosis|) / 10
  // Perfect normal distribution has skewness=0, kurtosis=0
  const score = Math.max(0, 1 - (Math.abs(skewness) + Math.abs(kurtosis)) / 10);

  return score;
}

/**
 * One-hot encode categorical variable
 */
export function oneHotEncode(
  data: Record<string, any>[],
  column: string
): Record<string, any>[] {
  const categories = Array.from(new Set(data.map((row) => row[column])));

  return data.map((row) => {
    const encoded: Record<string, any> = { ...row };
    categories.forEach((cat) => {
      encoded[`${column}_${cat}`] = row[column] === cat ? 1 : 0;
    });
    delete encoded[column];
    return encoded;
  });
}

/**
 * Label encode categorical variable
 */
export function labelEncode(
  data: Record<string, any>[],
  column: string
): Record<string, any>[] {
  const categories = Array.from(new Set(data.map((row) => row[column]))).sort();
  const encoding: Record<string, number> = {};
  categories.forEach((cat, idx) => {
    encoding[String(cat)] = idx;
  });

  return data.map((row) => ({
    ...row,
    [column]: encoding[String(row[column])],
  }));
}

/**
 * Discretize continuous variable into bins
 */
export function discretize(
  data: Record<string, any>[],
  column: string,
  numBins: number
): Record<string, any>[] {
  const values = data
    .map((row) => Number(row[column]))
    .filter((v) => !isNaN(v));

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / numBins;

  return data.map((row) => {
    const val = Number(row[column]);
    if (isNaN(val)) return row;

    const binIndex = Math.min(
      numBins - 1,
      Math.floor((val - min) / binWidth)
    );
    const binLabel = `Bin_${binIndex + 1}`;

    return { ...row, [`${column}_binned`]: binLabel };
  });
}

/**
 * Create interaction term between two variables
 */
export function createInteraction(
  data: Record<string, any>[],
  col1: string,
  col2: string,
  newColumnName?: string
): Record<string, any>[] {
  const colName = newColumnName || `${col1}_x_${col2}`;

  return data.map((row) => {
    const val1 = Number(row[col1]);
    const val2 = Number(row[col2]);

    if (!isNaN(val1) && !isNaN(val2)) {
      return { ...row, [colName]: val1 * val2 };
    }
    return row;
  });
}

/**
 * Create polynomial features
 */
export function createPolynomialFeatures(
  data: Record<string, any>[],
  column: string,
  degree: number
): Record<string, any>[] {
  return data.map((row) => {
    const val = Number(row[column]);
    if (isNaN(val)) return row;

    const newRow = { ...row };
    for (let d = 2; d <= degree; d++) {
      newRow[`${column}_pow${d}`] = Math.pow(val, d);
    }
    return newRow;
  });
}

/**
 * Lag transformation for time series
 */
export function createLag(
  data: Record<string, any>[],
  column: string,
  lagPeriod: number
): Record<string, any>[] {
  return data.map((row, idx) => {
    if (idx < lagPeriod) {
      return { ...row, [`${column}_lag${lagPeriod}`]: null };
    }
    return {
      ...row,
      [`${column}_lag${lagPeriod}`]: data[idx - lagPeriod][column],
    };
  });
}

/**
 * Difference transformation for time series
 */
export function createDifference(
  data: Record<string, any>[],
  column: string,
  diffPeriod: number = 1
): Record<string, any>[] {
  return data.map((row, idx) => {
    if (idx < diffPeriod) {
      return { ...row, [`${column}_diff${diffPeriod}`]: null };
    }
    const current = Number(row[column]);
    const previous = Number(data[idx - diffPeriod][column]);
    if (!isNaN(current) && !isNaN(previous)) {
      return { ...row, [`${column}_diff${diffPeriod}`]: current - previous };
    }
    return row;
  });
}
