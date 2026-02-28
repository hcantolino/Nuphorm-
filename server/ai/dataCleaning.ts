/**
 * Intelligent Data Cleaning Module
 * Advanced imputation, outlier detection, and data quality operations
 */

export interface CleaningOperation {
  type: "impute" | "remove_outliers" | "remove_duplicates" | "recode" | "filter";
  column?: string;
  method?: string;
  value?: any;
  threshold?: number;
  description: string;
}

export interface CleaningResult {
  rowsAffected: number;
  originalRows: number;
  newRows: number;
  operation: CleaningOperation;
  details: string;
  data: Record<string, any>[];
}

/**
 * Impute missing values using KNN (k-nearest neighbors)
 */
export function imputeKNN(
  data: Record<string, any>[],
  column: string,
  k: number = 5
): Record<string, any>[] {
  const result = JSON.parse(JSON.stringify(data));
  const missingIndices = result
    .map((row: Record<string, any>, i: number) => (row[column] === null || row[column] === "" ? i : -1))
    .filter((i: number) => i !== -1);

  if (missingIndices.length === 0) return result;

  // Get numeric columns for distance calculation
  const numericCols = Object.keys(data[0]).filter((col) => {
    const values = data.map((row) => Number(row[col])).filter((v) => !isNaN(v));
    return values.length / data.length > 0.8;
  });

  missingIndices.forEach((idx: number) => {
    const distances = result
      .map((row: Record<string, any>, i: number): any => {
        if (i === idx || row[column] === null || row[column] === "") return { index: i, distance: Infinity };

        let distance = 0;
        numericCols.forEach((col: string) => {
          const val1 = Number(result[idx][col]);
          const val2 = Number(row[col]);
          if (!isNaN(val1) && !isNaN(val2)) {
            distance += Math.pow(val1 - val2, 2);
          }
        });

        return { index: i, distance: Math.sqrt(distance) };
      })
      .filter((d: any) => d.distance !== Infinity)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, k);

    if (distances.length > 0) {
      const neighbors = distances.map((d: any) => Number(result[d.index][column]));
      const mean = neighbors.reduce((a: number, b: number) => a + b, 0) / neighbors.length;
      result[idx][column] = mean;
    }
  });

  return result;
}

/**
 * Impute using MICE (Multiple Imputation by Chained Equations) - simplified version
 */
export function imputeMICE(
  data: Record<string, any>[],
  iterations: number = 5
): Record<string, any>[] {
  let result = JSON.parse(JSON.stringify(data));

  for (let iter = 0; iter < iterations; iter++) {
    const columns = Object.keys(result[0]);

    columns.forEach((col) => {
      const missingIndices = result
        .map((row: Record<string, any>, i: number) => (row[col] === null || row[col] === "" ? i : -1))
        .filter((i: number) => i !== -1);

      if (missingIndices.length === 0) return;

      // Simplified regression-based imputation
      const numericCols = columns.filter((c: string) => {
        const values = result.map((row: Record<string, any>) => Number(row[c])).filter((v: number) => !isNaN(v));
        return values.length / result.length > 0.5;
      });    if (numericCols.length > 0) {
        const otherCol = numericCols.find((c) => c !== col);
        if (otherCol) {
          const completeRows = result.filter(
            (row: Record<string, any>) => row[col] !== null && row[col] !== "" && row[otherCol] !== null
          );

          if (completeRows.length > 2) {
            const x = completeRows.map((row: Record<string, any>) => Number(row[otherCol!]));
            const y = completeRows.map((row: Record<string, any>) => Number(row[col]));

            const meanX = x.reduce((a: number, b: number) => a + b, 0) / x.length;
            const meanY = y.reduce((a: number, b: number) => a + b, 0) / y.length;

            const ssXY = x.reduce((sum: number, v: number, i: number) => sum + (v - meanX) * (y[i] - meanY), 0);
            const ssXX = x.reduce((sum: number, v: number) => sum + Math.pow(v - meanX, 2), 0);

            const slope = ssXY / ssXX;
            const intercept = meanY - slope * meanX;

            missingIndices.forEach((idx: number) => {
              const xVal = Number(result[idx][otherCol!]);
              if (!isNaN(xVal)) {
                result[idx][col] = intercept + slope * xVal;
              }
            });
          }
        }
      }
    });
  }

  return result;
}

/**
 * Detect and handle outliers using IQR method
 */
export function detectOutliersIQR(
  values: number[],
  multiplier: number = 1.5
): { outliers: number[]; indices: number[] } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const outliers: number[] = [];
  const indices: number[] = [];

  values.forEach((v, i) => {
    if (v < lowerBound || v > upperBound) {
      outliers.push(v);
      indices.push(i);
    }
  });

  return { outliers, indices };
}

/**
 * Detect outliers using z-score method
 */
export function detectOutliersZScore(
  values: number[],
  threshold: number = 3
): { outliers: number[]; indices: number[] } {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  const outliers: number[] = [];
  const indices: number[] = [];

  values.forEach((v, i) => {
    const zScore = Math.abs((v - mean) / stdDev);
    if (zScore > threshold) {
      outliers.push(v);
      indices.push(i);
    }
  });

  return { outliers, indices };
}

/**
 * Detect outliers using Mahalanobis distance (multivariate)
 */
export function detectOutliersMahalanobis(
  data: Record<string, any>[],
  numericColumns: string[],
  threshold: number = 3
): number[] {
  const matrix = numericColumns.map((col) =>
    data.map((row) => Number(row[col])).filter((v) => !isNaN(v))
  );

  if (matrix.some((col) => col.length < numericColumns.length)) {
    return [];
  }

  const means = matrix.map((col) => col.reduce((a, b) => a + b, 0) / col.length);

  // Simplified covariance calculation
  const n = matrix[0].length;
  const cov: number[][] = [];
  for (let i = 0; i < numericColumns.length; i++) {
    cov[i] = [];
    for (let j = 0; j < numericColumns.length; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (matrix[i][k] - means[i]) * (matrix[j][k] - means[j]);
      }
      cov[i][j] = sum / n;
    }
  }

  const outliers: number[] = [];

  data.forEach((row: Record<string, any>, idx: number) => {
    const point = numericColumns.map((col) => Number(row[col]));
    const diff = point.map((v: number, i: number) => v - means[i]);

    // Simplified Mahalanobis distance (using diagonal approximation)
    let distance = 0;
    for (let i = 0; i < diff.length; i++) {
      if (cov[i][i] > 0) {
        distance += Math.pow(diff[i], 2) / cov[i][i];
      }
    }
    distance = Math.sqrt(distance);

    if (distance > threshold) {
      outliers.push(idx);
    }
  });

  return outliers;
}

/**
 * Remove outliers from data
 */
export function removeOutliers(
  data: Record<string, any>[],
  column: string,
  method: "iqr" | "zscore" = "iqr"
): CleaningResult {
  const numericValues = data
    .map((row) => Number(row[column]))
    .filter((v) => !isNaN(v));

  const { indices } =
    method === "iqr"
      ? detectOutliersIQR(numericValues)
      : detectOutliersZScore(numericValues);

  const outlierSet = new Set(indices);
  const cleaned = data.filter((_, i) => !outlierSet.has(i));

  return {
    rowsAffected: indices.length,
    originalRows: data.length,
    newRows: cleaned.length,
    operation: {
      type: "remove_outliers",
      column,
      method,
      description: `Removed ${indices.length} outliers from "${column}" using ${method.toUpperCase()}`,
    },
    details: `Removed ${indices.length} rows with outlier values in "${column}"`,
    data: cleaned,
  };
}

/**
 * Remove duplicate rows
 */
export function removeDuplicates(
  data: Record<string, any>[],
  columns?: string[]
): CleaningResult {
  const seen = new Set<string>();
  const cleaned: Record<string, any>[] = [];
  let duplicateCount = 0;

  data.forEach((row: Record<string, any>) => {
    const key = columns
      ? columns.map((col: string) => row[col]).join("|")
      : JSON.stringify(row);

    if (!seen.has(key)) {
      seen.add(key);
      cleaned.push(row);
    } else {
      duplicateCount++;
    }
  });

  return {
    rowsAffected: duplicateCount,
    originalRows: data.length,
    newRows: cleaned.length,
    operation: {
      type: "remove_duplicates",
      description: `Removed ${duplicateCount} duplicate rows`,
    },
    details: `Removed ${duplicateCount} duplicate rows based on ${columns ? columns.join(", ") : "all columns"}`,
    data: cleaned,
  };
}

/**
 * Cap outliers instead of removing
 */
export function capOutliers(
  data: Record<string, any>[],
  column: string,
  method: "iqr" | "zscore" = "iqr"
): CleaningResult {
  const numericValues = data
    .map((row) => Number(row[column]))
    .filter((v) => !isNaN(v));

  const sorted = [...numericValues].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  let capped = 0;
  const result = data.map((row: Record<string, any>) => {
    const val = Number(row[column]);
    if (!isNaN(val)) {
      if (val < lowerBound) {
        capped++;
        return { ...row, [column]: lowerBound };
      } else if (val > upperBound) {
        capped++;
        return { ...row, [column]: upperBound };
      }
    }
    return row;
  });

  return {
    rowsAffected: capped,
    originalRows: data.length,
    newRows: data.length,
    operation: {
      type: "remove_outliers",
      column,
      method: "cap",
      description: `Capped ${capped} outlier values in "${column}"`,
    },
    details: `Capped ${capped} values to range [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
    data: result,
  };
}

/**
 * Flag outliers instead of removing
 */
export function flagOutliers(
  data: Record<string, any>[],
  column: string,
  flagColumn: string = "is_outlier"
): Record<string, any>[] {
  const numericValues = data
    .map((row) => Number(row[column]))
    .filter((v) => !isNaN(v));

  const { indices } = detectOutliersIQR(numericValues);
  const outlierSet = new Set(indices);

  return data.map((row: Record<string, any>, i: number) => ({
    ...row,
    [flagColumn]: outlierSet.has(i) ? true : false,
  }));
}

/**
 * Recode categorical variable
 */
export function recodeVariable(
  data: Record<string, any>[],
  column: string,
  mapping: Record<string, string | number>
): Record<string, any>[] {
  return data.map((row: Record<string, any>) => ({
    ...row,
    [column]: mapping[row[column]] !== undefined ? mapping[row[column]] : row[column],
  }));
}

/**
 * Create factor/categorical from numeric
 */
export function createFactor(
  data: Record<string, any>[],
  column: string,
  breaks: number[],
  labels: string[]
): Record<string, any>[] {
  return data.map((row: Record<string, any>) => {
    const val = Number(row[column]);
    let label = labels[0];

    for (let i = 0; i < breaks.length; i++) {
      if (val >= breaks[i]) {
        label = labels[i];
      }
    }

    return { ...row, [column]: label };
  });
}

/**
 * Bin numeric variable
 */
export function binVariable(
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

  return data.map((row: Record<string, any>) => {
    const val = Number(row[column]);
    if (isNaN(val)) return row;

    const bin = Math.floor((val - min) / binWidth);
    const binLabel = `[${(min + bin * binWidth).toFixed(2)}, ${(min + (bin + 1) * binWidth).toFixed(2)})`;

    return { ...row, [`${column}_binned`]: binLabel };
  });
}

/**
 * Merge two datasets
 */
export function mergeData(
  left: Record<string, any>[],
  right: Record<string, any>[],
  leftKey: string,
  rightKey: string,
  type: "inner" | "left" | "right" | "full" = "left"
): Record<string, any>[] {
  const rightMap = new Map<string, Record<string, any>>();

  right.forEach((row: Record<string, any>) => {
    rightMap.set(String(row[rightKey]), row);
  });

  const result: Record<string, any>[] = [];

  if (type === "inner" || type === "left") {
    left.forEach((leftRow: Record<string, any>) => {
      const rightRow = rightMap.get(String(leftRow[leftKey]));
      if (rightRow || type === "left") {
        result.push({ ...leftRow, ...rightRow });
      }
    });
  }

  if (type === "right" || type === "full") {
    const leftKeys = new Set(left.map((row: Record<string, any>) => String(row[leftKey])));
    right.forEach((rightRow: Record<string, any>) => {
      if (!leftKeys.has(String(rightRow[rightKey]))) {
        result.push(rightRow);
      }
    });
  }

  return result;
}
