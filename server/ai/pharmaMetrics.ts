/**
 * Pharma Metrics Module
 * Comprehensive calculations for pharmaceutical biostatistics
 * Includes: PK/PD, BA/BE, efficacy ratios, safety metrics, regulatory compliance
 */

/**
 * Pharmacokinetic (PK) Parameters
 */
export interface PKParameters {
  cmax: number; // Maximum concentration
  tmax: number; // Time to maximum concentration
  auc: number; // Area under the curve
  t_half: number; // Half-life
  cl: number; // Clearance
  vd: number; // Volume of distribution
}

/**
 * Pharmacodynamic (PD) Parameters
 */
export interface PDParameters {
  emax: number; // Maximum effect
  ec50: number; // Concentration producing 50% of Emax
  slope: number; // Hill coefficient
  baseline: number; // Baseline effect
}

/**
 * Bioavailability/Bioequivalence (BA/BE) Parameters
 */
export interface BABEParameters {
  test_auc: number;
  reference_auc: number;
  test_cmax: number;
  reference_cmax: number;
  be_ratio_auc: number; // Test/Reference ratio
  be_ratio_cmax: number;
  ci_lower_auc: number; // 90% CI lower bound
  ci_upper_auc: number; // 90% CI upper bound
  ci_lower_cmax: number;
  ci_upper_cmax: number;
  meets_fda_criteria: boolean; // 80-125% range
}

/**
 * Efficacy Metrics
 */
export interface EfficacyMetrics {
  responder_rate: number; // Percentage of responders
  response_magnitude: number; // Average response
  effect_size: number; // Cohen's d or similar
  nnt: number; // Number needed to treat
  nnth: number; // Number needed to harm
  relative_risk: number;
  odds_ratio: number;
  absolute_risk_reduction: number;
}

/**
 * Safety Metrics
 */
export interface SafetyMetrics {
  adverse_event_rate: number;
  serious_ae_rate: number;
  discontinuation_rate: number;
  mortality_rate: number;
  safety_index: number; // Therapeutic index or similar
}

/**
 * Regulatory Compliance Result
 */
export interface RegulatoryComplianceResult {
  meets_fda_ba_be: boolean;
  meets_ema_ba_be: boolean;
  meets_efficacy_threshold: boolean;
  meets_safety_threshold: boolean;
  recommendations: string[];
  risk_assessment: string;
}

/**
 * Calculate Bioavailability (F) = (AUC_test / AUC_ref) * 100
 */
export function calculateBioavailability(
  testAUC: number,
  referenceAUC: number
): number {
  if (referenceAUC === 0) return 0;
  return (testAUC / referenceAUC) * 100;
}

/**
 * Calculate Bioequivalence Ratio (Test/Reference)
 * FDA criteria: 80-125% (90% CI)
 */
export function calculateBioequivalenceRatio(
  testValue: number,
  referenceValue: number
): number {
  if (referenceValue === 0) return 0;
  return (testValue / referenceValue) * 100;
}

/**
 * Check FDA Bioequivalence Criteria
 * Requires 90% CI to be within 80-125%
 */
export function checkFDABECriteria(
  ciLower: number,
  ciUpper: number
): boolean {
  return ciLower >= 80 && ciUpper <= 125;
}

/**
 * Calculate Effect Size (Cohen's d)
 * d = (mean1 - mean2) / pooled_std_dev
 */
export function calculateCohenD(
  mean1: number,
  mean2: number,
  std1: number,
  std2: number,
  n1: number,
  n2: number
): number {
  const pooledStdDev = Math.sqrt(
    ((n1 - 1) * std1 ** 2 + (n2 - 1) * std2 ** 2) / (n1 + n2 - 2)
  );
  if (pooledStdDev === 0) return 0;
  return (mean1 - mean2) / pooledStdDev;
}

/**
 * Calculate Number Needed to Treat (NNT)
 * NNT = 1 / (event_rate_treatment - event_rate_control)
 */
export function calculateNNT(
  treatmentRate: number,
  controlRate: number
): number {
  const arr = treatmentRate - controlRate;
  if (arr === 0) return Infinity;
  return 1 / Math.abs(arr);
}

/**
 * Calculate Odds Ratio
 * OR = (a*d) / (b*c)
 */
export function calculateOddsRatio(
  a: number, // events in treatment
  b: number, // non-events in treatment
  c: number, // events in control
  d: number // non-events in control
): number {
  if (b === 0 || c === 0) return 0;
  return (a * d) / (b * c);
}

/**
 * Calculate Relative Risk
 * RR = (a/(a+b)) / (c/(c+d))
 */
export function calculateRelativeRisk(
  a: number, // events in treatment
  b: number, // non-events in treatment
  c: number, // events in control
  d: number // non-events in control
): number {
  const treatmentRate = a / (a + b);
  const controlRate = c / (c + d);
  if (controlRate === 0) return 0;
  return treatmentRate / controlRate;
}

/**
 * Calculate Absolute Risk Reduction (ARR)
 * ARR = event_rate_control - event_rate_treatment
 */
export function calculateARR(
  treatmentRate: number,
  controlRate: number
): number {
  return controlRate - treatmentRate;
}

/**
 * Calculate 90% Confidence Interval for log-transformed ratio
 * Used for BA/BE assessment
 */
export function calculate90CI(
  ratio: number,
  cv: number, // Coefficient of variation
  n: number // Sample size
): { lower: number; upper: number } {
  // Simplified calculation - in practice, use more sophisticated methods
  const se = Math.sqrt(Math.log(1 + cv ** 2) / n);
  const logRatio = Math.log(ratio);
  const zScore = 1.645; // 90% CI

  const lowerLog = logRatio - zScore * se;
  const upperLog = logRatio + zScore * se;

  return {
    lower: Math.exp(lowerLog) * 100,
    upper: Math.exp(upperLog) * 100,
  };
}

/**
 * Assess Regulatory Compliance
 */
export function assessRegulatoryCompliance(
  babeResult: BABEParameters,
  efficacyMetrics: EfficacyMetrics,
  safetyMetrics: SafetyMetrics
): RegulatoryComplianceResult {
  const recommendations: string[] = [];
  const risks: string[] = [];

  // BA/BE Assessment
  const fdaBE = babeResult.meets_fda_criteria;
  if (!fdaBE) {
    recommendations.push(
      "Bioequivalence criteria not met. Consider additional studies or formulation optimization."
    );
    risks.push("Bioequivalence failure");
  }

  // Efficacy Assessment
  const efficacyOK = efficacyMetrics.effect_size >= 0.2;
  if (!efficacyOK) {
    recommendations.push(
      "Effect size below clinical significance threshold. Review study design and sample size."
    );
    risks.push("Insufficient efficacy");
  }

  // Safety Assessment
  const safetyOK =
    safetyMetrics.serious_ae_rate < 0.05 &&
    safetyMetrics.discontinuation_rate < 0.1;
  if (!safetyOK) {
    recommendations.push(
      "Safety concerns detected. Conduct additional safety monitoring."
    );
    risks.push("Safety signals");
  }

  return {
    meets_fda_ba_be: fdaBE,
    meets_ema_ba_be: fdaBE, // Simplified - EMA has similar criteria
    meets_efficacy_threshold: efficacyOK,
    meets_safety_threshold: safetyOK,
    recommendations,
    risk_assessment: risks.length > 0 ? risks.join("; ") : "No major risks identified",
  };
}

/**
 * Generate Pharma Insights from Analysis
 */
export function generatePharmaInsights(
  analysisType: string,
  metrics: any
): string[] {
  const insights: string[] = [];

  if (analysisType === "ba_be") {
    const babeMetrics = metrics as BABEParameters;
    if (babeMetrics.meets_fda_criteria) {
      insights.push(
        `✓ Bioequivalence demonstrated: AUC ratio ${babeMetrics.be_ratio_auc.toFixed(1)}% (90% CI: ${babeMetrics.ci_lower_auc.toFixed(1)}-${babeMetrics.ci_upper_auc.toFixed(1)}%) meets FDA criteria (80-125%).`
      );
    } else {
      insights.push(
        `✗ Bioequivalence not demonstrated: AUC ratio ${babeMetrics.be_ratio_auc.toFixed(1)}% falls outside FDA acceptance range.`
      );
    }
  } else if (analysisType === "efficacy") {
    const efficacy = metrics as EfficacyMetrics;
    insights.push(
      `Responder rate: ${(efficacy.responder_rate * 100).toFixed(1)}% with effect size (Cohen's d) = ${efficacy.effect_size.toFixed(2)}.`
    );
    insights.push(
      `Number needed to treat (NNT): ${efficacy.nnt.toFixed(1)} patients must be treated to achieve one additional positive outcome.`
    );
    if (efficacy.relative_risk > 1) {
      insights.push(
        `Relative risk: ${efficacy.relative_risk.toFixed(2)}x higher in treatment group.`
      );
    }
  } else if (analysisType === "safety") {
    const safety = metrics as SafetyMetrics;
    insights.push(
      `Adverse event rate: ${(safety.adverse_event_rate * 100).toFixed(1)}% with ${(safety.serious_ae_rate * 100).toFixed(1)}% serious events.`
    );
    if (safety.discontinuation_rate > 0.1) {
      insights.push(
        `⚠ High discontinuation rate (${(safety.discontinuation_rate * 100).toFixed(1)}%) suggests tolerability concerns.`
      );
    }
  }

  return insights;
}

/**
 * Format metrics for report display
 */
export function formatMetricsForReport(
  metrics: Record<string, any>
): Array<{ label: string; value: string }> {
  return Object.entries(metrics).map(([key, value]) => ({
    label: key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    value:
      typeof value === "number"
        ? value.toFixed(3)
        : typeof value === "boolean"
          ? value
            ? "Yes"
            : "No"
          : String(value),
  }));
}
