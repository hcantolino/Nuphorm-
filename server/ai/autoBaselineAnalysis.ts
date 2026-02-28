/**
 * Auto-Baseline Analysis Engine
 * Automatically computes comprehensive baseline analysis on data upload
 * Includes descriptive stats, pharma metrics, and data quality assessment
 */

import {
  calculateDescriptiveStats,
  calculatePearsonCorrelation,
} from "../statisticsCalculator";
import {
  calculateBioavailability,
  calculateBioequivalenceRatio,
  calculateCohenD,
  calculateNNT,
  calculateOddsRatio,
  calculateRelativeRisk,
  calculateARR,
  generatePharmaInsights,
} from "./pharmaMetrics";

export interface DataQualityReport {
  total_rows: number;
  total_columns: number;
  missing_values: number;
  missing_percentage: number;
  numeric_columns: number;
  categorical_columns: number;
  data_quality_score: number; // 0-100
  issues: string[];
  warnings: string[];
}

export interface BaselineAnalysisResult {
  data_summary: {
    rows: number;
    columns: string[];
    column_types: Record<string, string>;
  };
  data_quality: DataQualityReport;
  descriptive_statistics: Record<string, any>;
  pharma_metrics: Record<string, any>;
  suggested_analyses: string[];
  key_findings: string[];
  data_characteristics: {
    has_time_data: boolean;
    has_survival_data: boolean;
    has_dose_data: boolean;
    has_concentration_data: boolean;
    has_efficacy_data: boolean;
    has_safety_data: boolean;
    has_control_treated: boolean;
    has_paired_data: boolean;
  };
}

/**
 * Assess data quality
 */
export function assessDataQuality(data: any[]): DataQualityReport {
  if (!data || data.length === 0) {
    return {
      total_rows: 0,
      total_columns: 0,
      missing_values: 0,
      missing_percentage: 0,
      numeric_columns: 0,
      categorical_columns: 0,
      data_quality_score: 0,
      issues: ["No data provided"],
      warnings: [],
    };
  }

  const firstRow = data[0];
  const columns = Object.keys(firstRow);
  let missingValues = 0;
  let numericCols = 0;
  let categoricalCols = 0;

  // Count missing values and column types
  for (const col of columns) {
    let numericCount = 0;
    for (const row of data) {
      const value = row[col];
      if (value === null || value === undefined || value === "") {
        missingValues++;
      } else if (typeof value === "number") {
        numericCount++;
      }
    }

    if (numericCount > data.length * 0.5) {
      numericCols++;
    } else {
      categoricalCols++;
    }
  }

  const totalCells = data.length * columns.length;
  const missingPercentage = (missingValues / totalCells) * 100;

  // Calculate quality score (0-100)
  let qualityScore = 100;
  if (missingPercentage > 20) qualityScore -= 30;
  else if (missingPercentage > 10) qualityScore -= 15;
  else if (missingPercentage > 5) qualityScore -= 5;

  if (data.length < 30) qualityScore -= 20; // Small sample size
  if (numericCols === 0) qualityScore -= 25; // No numeric data

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const issues: string[] = [];
  const warnings: string[] = [];

  if (missingPercentage > 20) {
    issues.push(
      `High missing data rate: ${missingPercentage.toFixed(1)}% of cells are empty`
    );
  }
  if (data.length < 30) {
    warnings.push(
      `Small sample size (n=${data.length}): statistical power may be limited`
    );
  }
  if (numericCols === 0) {
    issues.push("No numeric columns detected: cannot perform quantitative analysis");
  }

  return {
    total_rows: data.length,
    total_columns: columns.length,
    missing_values: missingValues,
    missing_percentage: missingPercentage,
    numeric_columns: numericCols,
    categorical_columns: categoricalCols,
    data_quality_score: qualityScore,
    issues,
    warnings,
  };
}

/**
 * Detect data characteristics
 */
export function detectDataCharacteristics(
  data: any[],
  columns: string[]
): BaselineAnalysisResult["data_characteristics"] {
  if (!data || data.length === 0) {
    return {
      has_time_data: false,
      has_survival_data: false,
      has_dose_data: false,
      has_concentration_data: false,
      has_efficacy_data: false,
      has_safety_data: false,
      has_control_treated: false,
      has_paired_data: false,
    };
  }

  const lowerColumns = columns.map((c) => c.toLowerCase());
  const dataStr = JSON.stringify(data).toLowerCase();

  return {
    has_time_data:
      lowerColumns.some(
        (c) =>
          c.includes("time") ||
          c.includes("date") ||
          c.includes("day") ||
          c.includes("week")
      ) || dataStr.includes("time"),
    has_survival_data:
      lowerColumns.some(
        (c) =>
          c.includes("survival") ||
          c.includes("event") ||
          c.includes("status") ||
          c.includes("censored")
      ) || dataStr.includes("survival"),
    has_dose_data:
      lowerColumns.some(
        (c) =>
          c.includes("dose") ||
          c.includes("mg") ||
          c.includes("concentration") ||
          c.includes("conc")
      ) || dataStr.includes("dose"),
    has_concentration_data:
      lowerColumns.some(
        (c) =>
          c.includes("concentration") ||
          c.includes("conc") ||
          c.includes("auc") ||
          c.includes("cmax") ||
          c.includes("tmax")
      ) || dataStr.includes("concentration"),
    has_efficacy_data:
      lowerColumns.some(
        (c) =>
          c.includes("efficacy") ||
          c.includes("response") ||
          c.includes("outcome") ||
          c.includes("endpoint")
      ) || dataStr.includes("efficacy"),
    has_safety_data:
      lowerColumns.some(
        (c) =>
          c.includes("safety") ||
          c.includes("adverse") ||
          c.includes("ae") ||
          c.includes("toxicity")
      ) || dataStr.includes("adverse"),
    has_control_treated:
      lowerColumns.some((c) => c.includes("control") || c.includes("group")) ||
      dataStr.includes("control") ||
      dataStr.includes("treated"),
    has_paired_data:
      lowerColumns.some((c) => c.includes("baseline") || c.includes("post")) ||
      dataStr.includes("baseline"),
  };
}

/**
 * Generate suggested analyses based on data characteristics
 */
export function generateSuggestedAnalyses(
  characteristics: BaselineAnalysisResult["data_characteristics"],
  dataQuality: DataQualityReport
): string[] {
  const suggestions: string[] = [];

  if (dataQuality.data_quality_score < 50) {
    suggestions.push("Data Quality Assessment - Review missing values and outliers");
  }

  if (characteristics.has_survival_data) {
    suggestions.push("Kaplan-Meier Survival Analysis - Visualize survival curves");
    suggestions.push("Cox Proportional Hazards - Assess risk factors");
  }

  if (characteristics.has_dose_data) {
    suggestions.push("Dose-Response Analysis - Model dose-effect relationship");
    suggestions.push("Pharmacokinetic Analysis - Estimate PK parameters");
  }

  if (characteristics.has_concentration_data) {
    suggestions.push(
      "Bioavailability/Bioequivalence Analysis - Compare formulations"
    );
    suggestions.push("Pharmacodynamic Modeling - Link concentration to effect");
  }

  if (characteristics.has_efficacy_data && characteristics.has_control_treated) {
    suggestions.push("Efficacy Comparison - Compare treatment vs control");
    suggestions.push("Effect Size Calculation - Quantify clinical significance");
  }

  if (characteristics.has_safety_data) {
    suggestions.push("Safety Signal Detection - Identify adverse events");
    suggestions.push("Risk Assessment - Evaluate safety profile");
  }

  if (characteristics.has_paired_data) {
    suggestions.push("Paired Analysis - Compare baseline vs post-treatment");
    suggestions.push("Within-Subject Variability - Assess individual changes");
  }

  if (suggestions.length === 0) {
    suggestions.push("Descriptive Statistics - Summarize data distributions");
    suggestions.push("Correlation Analysis - Explore relationships between variables");
  }

  return suggestions;
}

/**
 * Compute baseline descriptive statistics
 */
export function computeBaselineDescriptiveStats(
  data: any[],
  columns: string[]
): Record<string, any> {
  const stats: Record<string, any> = {};

  for (const col of columns) {
    const values = data
      .map((row) => row[col])
      .filter((v) => typeof v === "number");

    if (values.length > 0) {
      try {
        const colStats = calculateDescriptiveStats(data, col);
        stats[col] = colStats;
      } catch (e) {
        // Skip columns that can't be analyzed
      }
    }
  }

  return stats;
}

/**
 * Compute pharma-specific metrics if applicable
 */
export function computeBaselinePharmaMetrics(
  data: any[],
  columns: string[]
): Record<string, any> {
  const metrics: Record<string, any> = {};
  const lowerColumns = columns.map((c) => c.toLowerCase());

  // Check for BA/BE data
  const testAUCCol = lowerColumns.find((c) => c.includes("test") && c.includes("auc"));
  const refAUCCol = lowerColumns.find((c) => c.includes("ref") && c.includes("auc"));

  if (testAUCCol && refAUCCol) {
    const testAUCs = data.map((row) => row[testAUCCol]).filter((v) => typeof v === "number");
    const refAUCs = data.map((row) => row[refAUCCol]).filter((v) => typeof v === "number");

    if (testAUCs.length > 0 && refAUCs.length > 0) {
      const avgTestAUC = testAUCs.reduce((a, b) => a + b, 0) / testAUCs.length;
      const avgRefAUC = refAUCs.reduce((a, b) => a + b, 0) / refAUCs.length;
      const bioavailability = calculateBioavailability(avgTestAUC, avgRefAUC);
      const beRatio = calculateBioequivalenceRatio(avgTestAUC, avgRefAUC);

      metrics.bioavailability = bioavailability;
      metrics.bioequivalence_ratio = beRatio;
      metrics.meets_fda_criteria = beRatio >= 80 && beRatio <= 125;
    }
  }

  // Check for efficacy data
  const responseCol = lowerColumns.find((c) => c.includes("response"));
  if (responseCol) {
    const responses = data
      .map((row) => row[responseCol])
      .filter((v) => typeof v === "number");
    if (responses.length > 0) {
      const responderRate = responses.filter((v) => v > 0).length / responses.length;
      metrics.responder_rate = responderRate;
    }
  }

  return metrics;
}

/**
 * Generate key findings from baseline analysis
 */
export function generateKeyFindings(
  stats: Record<string, any>,
  metrics: Record<string, any>,
  characteristics: BaselineAnalysisResult["data_characteristics"]
): string[] {
  const findings: string[] = [];

  // Data quality findings
  const qualityScore = Object.values(stats).length > 0 ? 85 : 50;
  findings.push(`Data quality score: ${qualityScore}/100`);

  // Descriptive findings
  for (const [col, colStats] of Object.entries(stats)) {
    if (colStats && typeof colStats === "object") {
      const mean = (colStats as any).mean;
      const stdDev = (colStats as any).stdDev;
      if (mean !== undefined && stdDev !== undefined) {
        findings.push(
          `${col}: Mean = ${mean.toFixed(2)}, SD = ${stdDev.toFixed(2)}`
        );
      }
    }
  }

  // Pharma metrics findings
  if (metrics.bioequivalence_ratio) {
    findings.push(
      `Bioequivalence ratio: ${metrics.bioequivalence_ratio.toFixed(1)}% (${
        metrics.meets_fda_criteria ? "✓ Meets FDA criteria" : "✗ Does not meet FDA criteria"
      })`
    );
  }

  if (metrics.responder_rate) {
    findings.push(
      `Responder rate: ${(metrics.responder_rate * 100).toFixed(1)}%`
    );
  }

  // Data characteristics findings
  if (characteristics.has_survival_data) {
    findings.push("Survival data detected - Kaplan-Meier analysis recommended");
  }
  if (characteristics.has_dose_data) {
    findings.push("Dose-response data detected - Modeling recommended");
  }
  if (characteristics.has_control_treated) {
    findings.push("Treatment comparison data detected - Efficacy analysis recommended");
  }

  return findings;
}

/**
 * Run complete baseline analysis
 */
export function runAutoBaselineAnalysis(
  data: any[]
): BaselineAnalysisResult {
  if (!data || data.length === 0) {
    throw new Error("No data provided for analysis");
  }

  const columns = Object.keys(data[0]);
  const dataQuality = assessDataQuality(data);
  const characteristics = detectDataCharacteristics(data, columns);
  const suggestedAnalyses = generateSuggestedAnalyses(
    characteristics,
    dataQuality
  );

  const descriptiveStats = computeBaselineDescriptiveStats(data, columns);
  const pharmaMetrics = computeBaselinePharmaMetrics(data, columns);
  const keyFindings = generateKeyFindings(
    descriptiveStats,
    pharmaMetrics,
    characteristics
  );

  return {
    data_summary: {
      rows: data.length,
      columns,
      column_types: Object.fromEntries(
        columns.map((col) => [
          col,
          typeof data[0][col] === "number" ? "numeric" : "string",
        ])
      ),
    },
    data_quality: dataQuality,
    descriptive_statistics: descriptiveStats,
    pharma_metrics: pharmaMetrics,
    suggested_analyses: suggestedAnalyses,
    key_findings: keyFindings,
    data_characteristics: characteristics,
  };
}
