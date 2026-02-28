/**
 * Biostatistics Data Context
 * Manages uploaded CSV data and analysis state
 */

import React, { createContext, useContext, useState, useCallback } from "react";

export interface BiostatData {
  filename: string;
  rows: Record<string, any>[];
  columns: string[];
  uploadedAt: Date;
  dataQuality: number;
  characteristics: Record<string, boolean>;
}

export interface AnalysisResult {
  id: string;
  query: string;
  intent: string;
  result: any;
  timestamp: Date;
  column?: string;
}

interface BiostatContextType {
  data: BiostatData | null;
  uploadData: (filename: string, rows: Record<string, any>[]) => void;
  clearData: () => void;
  analysisHistory: AnalysisResult[];
  addAnalysisResult: (result: AnalysisResult) => void;
  clearHistory: () => void;
  getColumnData: (columnName: string) => any[];
  getNumericColumnData: (columnName: string) => number[];
}

const BiostatContext = createContext<BiostatContextType | undefined>(undefined);

/**
 * Provider component
 */
export function BiostatDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BiostatData | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);

  const uploadData = useCallback((filename: string, rows: Record<string, any>[]) => {
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const characteristics = detectDataCharacteristics(rows, columns);
    const dataQuality = assessDataQuality(rows, columns);

    setData({
      filename,
      rows,
      columns,
      uploadedAt: new Date(),
      dataQuality,
      characteristics,
    });

    // Clear history on new upload
    setAnalysisHistory([]);
  }, []);

  const clearData = useCallback(() => {
    setData(null);
    setAnalysisHistory([]);
  }, []);

  const addAnalysisResult = useCallback((result: AnalysisResult) => {
    setAnalysisHistory((prev) => [result, ...prev]);
  }, []);

  const clearHistory = useCallback(() => {
    setAnalysisHistory([]);
  }, []);

  const getColumnData = useCallback(
    (columnName: string): any[] => {
      if (!data) return [];
      return data.rows.map((row) => row[columnName]);
    },
    [data]
  );

  const getNumericColumnData = useCallback(
    (columnName: string): number[] => {
      const columnData = getColumnData(columnName);
      return columnData
        .map((v) => Number(v))
        .filter((v) => !isNaN(v) && isFinite(v));
    },
    [getColumnData]
  );

  return (
    <BiostatContext.Provider
      value={{
        data,
        uploadData,
        clearData,
        analysisHistory,
        addAnalysisResult,
        clearHistory,
        getColumnData,
        getNumericColumnData,
      }}
    >
      {children}
    </BiostatContext.Provider>
  );
}

/**
 * Hook to use biostat context
 */
export function useBiostatData() {
  const context = useContext(BiostatContext);
  if (!context) {
    throw new Error("useBiostatData must be used within BiostatDataProvider");
  }
  return context;
}

/**
 * Detect data characteristics from uploaded data
 */
function detectDataCharacteristics(
  rows: Record<string, any>[],
  columns: string[]
): Record<string, boolean> {
  const characteristics: Record<string, boolean> = {
    hasGeneExpression: false,
    hasSurvivalData: false,
    hasDoseData: false,
    hasEfficacyData: false,
    hasSafetyData: false,
    hasPairedData: false,
    hasTimeSeriesData: false,
    hasGroupData: false,
  };

  const lowerColumns = columns.map((c) => c.toLowerCase());

  // Gene expression detection
  if (
    lowerColumns.some((c) =>
      /gene|expression|fold.?change|control|treated|baseline/.test(c)
    )
  ) {
    characteristics.hasGeneExpression = true;
  }

  // Survival data detection
  if (
    lowerColumns.some((c) =>
      /survival|time.?event|event|censored|status|time.?to/.test(c)
    )
  ) {
    characteristics.hasSurvivalData = true;
  }

  // Dose data detection
  if (lowerColumns.some((c) => /dose|concentration|exposure|auc|cmax/.test(c))) {
    characteristics.hasDoseData = true;
  }

  // Efficacy data detection
  if (
    lowerColumns.some((c) =>
      /efficacy|response|responder|improvement|outcome|effect/.test(c)
    )
  ) {
    characteristics.hasEfficacyData = true;
  }

  // Safety data detection
  if (
    lowerColumns.some((c) =>
      /adverse|safety|ae|event|toxicity|side.?effect/.test(c)
    )
  ) {
    characteristics.hasSafetyData = true;
  }

  // Paired data detection
  if (
    lowerColumns.some((c) => /baseline|pre|post|before|after/.test(c)) &&
    lowerColumns.length >= 3
  ) {
    characteristics.hasPairedData = true;
  }

  // Time series detection
  if (lowerColumns.some((c) => /time|week|day|month|hour|minute/.test(c))) {
    characteristics.hasTimeSeriesData = true;
  }

  // Group data detection
  if (
    lowerColumns.some((c) =>
      /group|treatment|control|arm|cohort|category|class/.test(c)
    )
  ) {
    characteristics.hasGroupData = true;
  }

  return characteristics;
}

/**
 * Assess overall data quality
 */
function assessDataQuality(
  rows: Record<string, any>[],
  columns: string[]
): number {
  let score = 100;

  // Check for missing values
  let missingCount = 0;
  rows.forEach((row) => {
    columns.forEach((col) => {
      const value = row[col];
      if (value === null || value === undefined || value === "") {
        missingCount++;
      }
    });
  });

  const missingPercentage = (missingCount / (rows.length * columns.length)) * 100;
  if (missingPercentage > 10) score -= 20;
  else if (missingPercentage > 5) score -= 10;

  // Check for outliers (very large or very small numbers)
  let outlierCount = 0;
  columns.forEach((col) => {
    const values = rows
      .map((r) => Number(r[col]))
      .filter((v) => !isNaN(v) && isFinite(v));

    if (values.length > 0) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std =
        Math.sqrt(
          values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
        ) || 1;

      values.forEach((v) => {
        if (Math.abs((v - mean) / std) > 5) {
          outlierCount++;
        }
      });
    }
  });

  const outlierPercentage = (outlierCount / (rows.length * columns.length)) * 100;
  if (outlierPercentage > 5) score -= 10;

  // Check for duplicate rows
  const uniqueRows = new Set(rows.map((r) => JSON.stringify(r)));
  const duplicatePercentage = ((rows.length - uniqueRows.size) / rows.length) * 100;
  if (duplicatePercentage > 10) score -= 15;

  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}
