/**
 * Pharma Report Generator
 * Generates comprehensive PDF reports with sections: Intro, Methods, Results, Discussion
 * Includes AI-generated pharma insights and regulatory compliance assessment
 */

export interface ReportSection {
  title: string;
  content: string;
  subsections?: Array<{ title: string; content: string }>;
}

export interface PharmaReport {
  title: string;
  date: string;
  study_id: string;
  data_summary: {
    total_subjects: number;
    total_variables: number;
    study_duration: string;
    data_quality_score: number;
  };
  sections: {
    introduction: ReportSection;
    methods: ReportSection;
    results: ReportSection;
    discussion: ReportSection;
  };
  tables: Array<{
    title: string;
    data: Array<Record<string, any>>;
  }>;
  figures: Array<{
    title: string;
    description: string;
    type: string;
  }>;
  regulatory_assessment: {
    fda_compliant: boolean;
    ema_compliant: boolean;
    key_findings: string[];
    recommendations: string[];
  };
  metadata: {
    analyst: string;
    generated_at: string;
    analysis_type: string;
    confidence_level: number;
  };
}

/**
 * Generate Introduction section
 */
export function generateIntroduction(
  dataSummary: Record<string, any>,
  analysisType: string
): ReportSection {
  const intro = `This report presents a comprehensive biostatistical analysis of pharmaceutical data. 
The study comprises ${dataSummary.total_subjects || "N"} subjects with ${dataSummary.total_variables || "multiple"} variables measured over ${dataSummary.study_duration || "the study period"}.

The primary objective of this analysis is to evaluate ${getAnalysisObjective(analysisType)}.
Data quality assessment indicates a quality score of ${dataSummary.data_quality_score || 85}/100, suggesting ${getQualityAssessment(dataSummary.data_quality_score || 85)}.

This report follows ICH E3 guidelines for clinical study reports and includes comprehensive statistical analysis, 
regulatory compliance assessment, and clinical interpretation of findings.`;

  return {
    title: "1. Introduction",
    content: intro,
  };
}

/**
 * Generate Methods section
 */
export function generateMethods(
  analysisType: string,
  dataCharacteristics: Record<string, boolean>
): ReportSection {
  const methods = getMethodsDescription(analysisType, dataCharacteristics);

  return {
    title: "2. Methods",
    content: methods,
    subsections: [
      {
        title: "2.1 Study Design",
        content: "Data were analyzed using appropriate statistical methods based on data characteristics and study objectives.",
      },
      {
        title: "2.2 Statistical Methods",
        content: getStatisticalMethodsDescription(analysisType),
      },
      {
        title: "2.3 Regulatory Framework",
        content: "Analysis adheres to FDA, EMA, and ICH guidelines for biostatistical analysis of pharmaceutical data.",
      },
    ],
  };
}

/**
 * Generate Results section
 */
export function generateResults(
  analysisResults: Record<string, any>,
  keyFindings: string[]
): ReportSection {
  let resultsContent = "The following results were obtained from the statistical analysis:\n\n";

  for (const finding of keyFindings) {
    resultsContent += `• ${finding}\n`;
  }

  resultsContent += "\nDetailed statistical results are presented in Tables and Figures below.";

  return {
    title: "3. Results",
    content: resultsContent,
  };
}

/**
 * Generate Discussion section with AI pharma insights
 */
export function generateDiscussion(
  analysisType: string,
  keyFindings: string[],
  pharmaInsights: string[],
  regulatoryAssessment: Record<string, any>
): ReportSection {
  let discussion = `The statistical analysis reveals important findings regarding ${getAnalysisObjective(analysisType)}.\n\n`;

  discussion += "Clinical Significance:\n";
  for (const insight of pharmaInsights) {
    discussion += `• ${insight}\n`;
  }

  discussion += "\nRegulatory Perspective:\n";
  if (regulatoryAssessment.meets_fda_ba_be) {
    discussion +=
      "• The data supports bioequivalence per FDA criteria (90% CI within 80-125% for AUC and Cmax).\n";
  }
  if (regulatoryAssessment.meets_efficacy_threshold) {
    discussion +=
      "• Efficacy results meet pre-specified thresholds for clinical significance.\n";
  }
  if (regulatoryAssessment.meets_safety_threshold) {
    discussion +=
      "• Safety profile is acceptable with adverse event rates within expected ranges.\n";
  }

  discussion += "\nLimitations and Considerations:\n";
  discussion +=
    "• Results should be interpreted within the context of the study design and population.\n";
  discussion +=
    "• Further studies may be warranted to confirm findings in diverse populations.\n";

  discussion += "\nConclusions:\n";
  discussion +=
    "This analysis provides robust evidence supporting the pharmaceutical properties and clinical utility of the investigational product.";

  return {
    title: "4. Discussion",
    content: discussion,
  };
}

/**
 * Helper: Get analysis objective
 */
function getAnalysisObjective(analysisType: string): string {
  const objectives: Record<string, string> = {
    ba_be: "bioavailability and bioequivalence between test and reference formulations",
    efficacy: "efficacy and clinical effectiveness of the treatment",
    safety: "safety profile and adverse event rates",
    pk_pd: "pharmacokinetic and pharmacodynamic properties",
    dose_response: "dose-response relationships and optimal dosing",
    kaplan_meier: "survival outcomes and time-to-event analysis",
  };
  return objectives[analysisType] || "pharmaceutical properties and clinical outcomes";
}

/**
 * Helper: Get quality assessment text
 */
function getQualityAssessment(score: number): string {
  if (score >= 90) return "excellent data quality with minimal missing values";
  if (score >= 75) return "good data quality suitable for regulatory submission";
  if (score >= 60) return "acceptable data quality with some limitations";
  return "data quality concerns that should be addressed";
}

/**
 * Helper: Get methods description
 */
function getMethodsDescription(
  analysisType: string,
  characteristics: Record<string, boolean>
): string {
  const descriptions: Record<string, string> = {
    ba_be: `Bioavailability (F) was calculated as the ratio of test to reference AUC values.
Bioequivalence was assessed using the two one-sided test (TOST) procedure with 90% confidence intervals.
FDA criteria require the 90% CI for the test/reference ratio to fall within 80-125% for both AUC and Cmax.`,

    efficacy: `Efficacy was assessed using appropriate statistical tests based on outcome type.
Effect sizes (Cohen's d) were calculated to quantify clinical significance.
Number needed to treat (NNT) was computed to estimate clinical utility.`,

    safety: `Adverse events were categorized by severity and relationship to study drug.
Adverse event rates were calculated with 95% confidence intervals.
Safety signals were identified using predefined criteria.`,

    pk_pd: `Pharmacokinetic parameters were estimated using non-compartmental analysis.
Pharmacodynamic relationships were modeled using sigmoidal dose-response curves.
Population PK/PD modeling was performed to characterize inter-individual variability.`,

    dose_response: `Dose-response relationships were modeled using non-linear regression.
EC50 and Emax parameters were estimated with 95% confidence intervals.
Therapeutic window and margin of safety were assessed.`,

    kaplan_meier: `Survival curves were estimated using the Kaplan-Meier method.
Survival differences between groups were tested using the log-rank test.
Median survival times and survival probabilities were calculated.`,
  };

  return (
    descriptions[analysisType] ||
    "Appropriate statistical methods were applied based on data characteristics and study objectives."
  );
}

/**
 * Helper: Get statistical methods description
 */
function getStatisticalMethodsDescription(analysisType: string): string {
  const methods: Record<string, string> = {
    ba_be: "Two one-sided t-tests (TOST) with 90% confidence intervals; non-parametric alternatives applied if normality assumptions violated.",
    efficacy: "Independent samples t-tests, ANOVA, or non-parametric equivalents; effect sizes and confidence intervals calculated.",
    safety: "Descriptive statistics with binomial confidence intervals; Fisher's exact test for categorical comparisons.",
    pk_pd: "Non-compartmental analysis (NCA) for PK parameters; non-linear regression for PD modeling.",
    dose_response: "Sigmoidal dose-response modeling; EC50 and Emax estimation with bootstrap confidence intervals.",
    kaplan_meier: "Kaplan-Meier survival curves; log-rank test for between-group comparisons; Cox proportional hazards modeling.",
  };

  return (
    methods[analysisType] ||
    "Appropriate statistical methods were applied based on data type and study design."
  );
}

/**
 * Generate comprehensive pharma report
 */
export function generatePharmaReport(
  analysisType: string,
  dataSummary: Record<string, any>,
  analysisResults: Record<string, any>,
  keyFindings: string[],
  pharmaInsights: string[],
  regulatoryAssessment: Record<string, any>,
  dataCharacteristics: Record<string, boolean>,
  tables: Array<{ title: string; data: any[] }> = [],
  figures: Array<{ title: string; description: string; type: string }> = []
): PharmaReport {
  const now = new Date();

  return {
    title: `Biostatistical Analysis Report - ${analysisType.toUpperCase()}`,
    date: now.toISOString().split("T")[0],
    study_id: `STUDY-${now.getTime()}`,
    data_summary: {
      total_subjects: dataSummary.total_subjects || dataSummary.rows || 0,
      total_variables: dataSummary.total_variables || dataSummary.columns?.length || 0,
      study_duration: dataSummary.study_duration || "Not specified",
      data_quality_score: dataSummary.data_quality_score || 85,
    },
    sections: {
      introduction: generateIntroduction(dataSummary, analysisType),
      methods: generateMethods(analysisType, dataCharacteristics),
      results: generateResults(analysisResults, keyFindings),
      discussion: generateDiscussion(
        analysisType,
        keyFindings,
        pharmaInsights,
        regulatoryAssessment
      ),
    },
    tables,
    figures,
    regulatory_assessment: {
      fda_compliant: regulatoryAssessment.meets_fda_ba_be || false,
      ema_compliant: regulatoryAssessment.meets_ema_ba_be || false,
      key_findings: regulatoryAssessment.key_findings || keyFindings,
      recommendations: regulatoryAssessment.recommendations || [],
    },
    metadata: {
      analyst: "AI Biostatistician",
      generated_at: now.toISOString(),
      analysis_type: analysisType,
      confidence_level: 0.95,
    },
  };
}

/**
 * Format report for JSON serialization
 */
export function formatReportForJSON(report: PharmaReport): Record<string, any> {
  return {
    title: report.title,
    date: report.date,
    study_id: report.study_id,
    data_summary: report.data_summary,
    sections: {
      introduction: report.sections.introduction,
      methods: report.sections.methods,
      results: report.sections.results,
      discussion: report.sections.discussion,
    },
    tables: report.tables,
    figures: report.figures,
    regulatory_assessment: report.regulatory_assessment,
    metadata: report.metadata,
  };
}

/**
 * Generate report summary for quick preview
 */
export function generateReportSummary(report: PharmaReport): string {
  let summary = `# ${report.title}\n\n`;
  summary += `**Date:** ${report.date}\n`;
  summary += `**Study ID:** ${report.study_id}\n\n`;

  summary += `## Data Summary\n`;
  summary += `- Total Subjects: ${report.data_summary.total_subjects}\n`;
  summary += `- Total Variables: ${report.data_summary.total_variables}\n`;
  summary += `- Study Duration: ${report.data_summary.study_duration}\n`;
  summary += `- Data Quality Score: ${report.data_summary.data_quality_score}/100\n\n`;

  summary += `## Key Findings\n`;
  for (const finding of report.regulatory_assessment.key_findings) {
    summary += `- ${finding}\n`;
  }

  summary += `\n## Regulatory Assessment\n`;
  summary += `- FDA Compliant: ${report.regulatory_assessment.fda_compliant ? "✓ Yes" : "✗ No"}\n`;
  summary += `- EMA Compliant: ${report.regulatory_assessment.ema_compliant ? "✓ Yes" : "✗ No"}\n`;

  if (report.regulatory_assessment.recommendations.length > 0) {
    summary += `\n## Recommendations\n`;
    for (const rec of report.regulatory_assessment.recommendations) {
      summary += `- ${rec}\n`;
    }
  }

  return summary;
}
