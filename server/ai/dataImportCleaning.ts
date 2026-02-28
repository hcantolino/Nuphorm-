/**
 * Data Import & Cleaning Module
 * Handles CSV/XLSX/JSON parsing, type detection, and data quality checks
 */

import Papa from "papaparse";

export interface DataQualityReport {
  totalRows: number;
  totalColumns: number;
  columns: ColumnInfo[];
  missingValues: Record<string, number>;
  duplicateRows: number;
  outliers: Record<string, number[]>;
  dataTypes: Record<string, string>;
  warnings: string[];
}

export interface ColumnInfo {
  name: string;
  type: "numeric" | "categorical" | "date" | "boolean" | "text";
  nonNullCount: number;
  uniqueValues: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stdDev?: number;
  categories?: string[];
}

/**
 * Parse CSV data
 */
export async function parseCSV(csvText: string): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        if (results.data && Array.isArray(results.data)) {
          resolve(results.data as Record<string, any>[]);
        } else {
          reject(new Error("Failed to parse CSV"));
        }
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
}

/**
 * Detect data type of a column
 */
function detectColumnType(
  values: any[]
): "numeric" | "categorical" | "date" | "boolean" | "text" {
  if (values.length === 0) return "text";

  // Filter out nulls and empty strings
  const nonEmpty = values.filter((v) => v !== null && v !== "");
  if (nonEmpty.length === 0) return "text";

  // Check for boolean
  if (nonEmpty.every((v) => v === "true" || v === "false" || v === true || v === false)) {
    return "boolean";
  }

  // Check for numeric
  const numericCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
  if (numericCount / nonEmpty.length > 0.8) {
    return "numeric";
  }

  // Check for date
  const dateFormats = [
    /^\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
    /^\d{1,2}-\w{3}-\d{4}/, // DD-MMM-YYYY
  ];
  const dateCount = nonEmpty.filter((v) =>
    dateFormats.some((fmt) => fmt.test(String(v)))
  ).length;
  if (dateCount / nonEmpty.length > 0.8) {
    return "date";
  }

  // Check for categorical (limited unique values)
  const uniqueCount = new Set(nonEmpty).size;
  if (uniqueCount / nonEmpty.length < 0.1 && uniqueCount < 50) {
    return "categorical";
  }

  return "text";
}

/**
 * Generate data quality report
 */
export function generateDataQualityReport(
  data: Record<string, any>[]
): DataQualityReport {
  if (data.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      columns: [],
      missingValues: {},
      duplicateRows: 0,
      outliers: {},
      dataTypes: {},
      warnings: ["No data to analyze"],
    };
  }

  const columns = Object.keys(data[0]);
  const report: DataQualityReport = {
    totalRows: data.length,
    totalColumns: columns.length,
    columns: [],
    missingValues: {},
    duplicateRows: 0,
    outliers: {},
    dataTypes: {},
    warnings: [],
  };

  // Analyze each column
  columns.forEach((col) => {
    const values = data.map((row) => row[col]);
    const nonNullValues = values.filter((v) => v !== null && v !== "");
    const type = detectColumnType(values);

    report.dataTypes[col] = type;
    report.missingValues[col] = values.length - nonNullValues.length;

    const columnInfo: ColumnInfo = {
      name: col,
      type,
      nonNullCount: nonNullValues.length,
      uniqueValues: new Set(nonNullValues).size,
    };

    if (type === "numeric") {
      const numericValues = nonNullValues
        .map((v: any) => Number(v))
        .filter((v: number) => !isNaN(v));

      if (numericValues.length > 0) {
        numericValues.sort((a: number, b: number) => a - b);
        columnInfo.min = numericValues[0];
        columnInfo.max = numericValues[numericValues.length - 1];
        columnInfo.mean =
          numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length;
        columnInfo.median =
          numericValues.length % 2 === 0
            ? (numericValues[numericValues.length / 2 - 1] +
                numericValues[numericValues.length / 2]) /
              2
            : numericValues[Math.floor(numericValues.length / 2)];

        // Calculate standard deviation
        const variance =
          numericValues.reduce(
            (sum: number, val: number) => sum + Math.pow(val - columnInfo.mean!, 2),
            0
          ) / numericValues.length;
        columnInfo.stdDev = Math.sqrt(variance);

        // Detect outliers (IQR method)
        const q1 = numericValues[Math.floor(numericValues.length * 0.25)];
        const q3 = numericValues[Math.floor(numericValues.length * 0.75)];
        const iqr = q3 - q1;
        const outlierThreshold = 1.5 * iqr;
        const outliers = numericValues.filter(
          (v: number) => v < q1 - outlierThreshold || v > q3 + outlierThreshold
        );
        if (outliers.length > 0) {
          report.outliers[col] = outliers;
          report.warnings.push(
            `Column "${col}" has ${outliers.length} potential outliers`
          );
        }
      }
    } else if (type === "categorical") {
      const categories = Array.from(new Set(nonNullValues)).slice(0, 20);
      columnInfo.categories = categories as string[];
    }

    report.columns.push(columnInfo);
  });

  // Check for duplicate rows
  const rowSignatures = new Set<string>();
  let duplicates = 0;
  data.forEach((row) => {
    const signature = JSON.stringify(row);
    if (rowSignatures.has(signature)) {
      duplicates++;
    }
    rowSignatures.add(signature);
  });
  report.duplicateRows = duplicates;

  if (duplicates > 0) {
    report.warnings.push(`Found ${duplicates} duplicate rows`);
  }

  // Check for missing values
  const totalMissing = Object.values(report.missingValues).reduce(
    (a, b) => a + b,
    0
  );
  if (totalMissing > 0) {
    const missingPercent = (
      (totalMissing / (data.length * columns.length)) *
      100
    ).toFixed(1);
    report.warnings.push(
      `${missingPercent}% of data is missing (${totalMissing} cells)`
    );
  }

  return report;
}

/**
 * Handle missing values with specified strategy
 */
export function imputeMissingValues(
  data: Record<string, any>[],
  strategy: "mean" | "median" | "forward_fill" | "drop" = "mean"
): Record<string, any>[] {
  if (data.length === 0) return data;

  const columns = Object.keys(data[0]);
  const result = JSON.parse(JSON.stringify(data)); // Deep copy

  if (strategy === "drop") {
    return result.filter((row: Record<string, any>) =>
      columns.every((col) => row[col] !== null && row[col] !== "")
    );
  }

  columns.forEach((col) => {
    const values = result.map((row: Record<string, any>) => row[col]);
    const type = detectColumnType(values);

    if (type === "numeric") {
      const numericValues = values
        .filter((v: any) => v !== null && v !== "" && !isNaN(Number(v)))
        .map((v: any) => Number(v));

      if (numericValues.length === 0) return;

      let fillValue: number;

      if (strategy === "mean") {
        fillValue =
          numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length;
      } else if (strategy === "median") {
        numericValues.sort((a: number, b: number) => a - b);
        fillValue =
          numericValues.length % 2 === 0
            ? (numericValues[numericValues.length / 2 - 1] +
                numericValues[numericValues.length / 2]) /
              2
            : numericValues[Math.floor(numericValues.length / 2)];
      } else if (strategy === "forward_fill") {
        let lastValue: number | null = null;
        result.forEach((row: Record<string, any>) => {
          if (row[col] === null || row[col] === "") {
            row[col] = lastValue;
          } else {
            lastValue = Number(row[col]);
          }
        });
        return;
      } else {
        return;
      }

      result.forEach((row: Record<string, any>) => {
        if (row[col] === null || row[col] === "") {
          row[col] = fillValue;
        }
      });
    }
  });

  return result;
}

/**
 * Normalize/standardize numeric columns
 */
export function normalizeColumns(
  data: Record<string, any>[],
  columns: string[],
  method: "z_score" | "min_max" = "z_score"
): Record<string, any>[] {
  if (data.length === 0) return data;

  const result = JSON.parse(JSON.stringify(data));

  columns.forEach((col: string) => {
    const values = result
      .map((row: Record<string, any>) => row[col])
      .filter((v: any) => !isNaN(Number(v)))
      .map((v: any) => Number(v));

    if (values.length === 0) return;

    if (method === "z_score") {
      const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const variance =
        values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) return;

      result.forEach((row: Record<string, any>) => {
        if (!isNaN(Number(row[col]))) {
          row[col] = (Number(row[col]) - mean) / stdDev;
        }
      });
    } else if (method === "min_max") {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;

      if (range === 0) return;

      result.forEach((row: Record<string, any>) => {
        if (!isNaN(Number(row[col]))) {
          row[col] = (Number(row[col]) - min) / range;
        }
      });
    }
  });

  return result;
}

/**
 * Filter data by conditions
 */
export function filterData(
  data: Record<string, any>[],
  conditions: Array<{ column: string; operator: string; value: any }>
): Record<string, any>[] {
  return data.filter((row) => {
    return conditions.every(({ column, operator, value }) => {
      const rowValue = row[column];

      switch (operator) {
        case "==":
          return rowValue == value;
        case "!=":
          return rowValue != value;
        case ">":
          return Number(rowValue) > Number(value);
        case "<":
          return Number(rowValue) < Number(value);
        case ">=":
          return Number(rowValue) >= Number(value);
        case "<=":
          return Number(rowValue) <= Number(value);
        case "in":
          return Array.isArray(value) && value.includes(rowValue);
        case "contains":
          return String(rowValue).includes(String(value));
        default:
          return true;
      }
    });
  });
}
