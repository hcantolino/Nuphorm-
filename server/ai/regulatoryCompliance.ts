/**
 * Regulatory Compliance Module
 * FDA/EMA guidelines, power checks, sample size validation
 */

export interface ComplianceCheckResult {
  criterion: string;
  status: "pass" | "fail" | "warning";
  value: number | string;
  requirement: string;
  recommendation: string;
}

export interface RegulatoryReport {
  studyType: string;
  checks: ComplianceCheckResult[];
  overallCompliance: "compliant" | "non-compliant" | "conditional";
  summary: string;
  actionItems: string[];
}

/**
 * FDA Bioequivalence Criteria Check
 */
export function checkFDABioequivalence(
  lowerCI: number,
  upperCI: number,
  lowerBound: number = 0.8,
  upperBound: number = 1.25
): ComplianceCheckResult {
  const withinBounds = lowerCI >= lowerBound && upperCI <= upperBound;

  return {
    criterion: "FDA Bioequivalence (90% CI)",
    status: withinBounds ? "pass" : "fail",
    value: `${lowerCI.toFixed(3)}-${upperCI.toFixed(3)}`,
    requirement: `90% CI must be within [${lowerBound}, ${upperBound}]`,
    recommendation: withinBounds
      ? "Study meets FDA bioequivalence criteria."
      : `CI outside bounds. Increase sample size or review formulation.`,
  };
}

/**
 * EMA Bioequivalence Criteria Check
 */
export function checkEMABioequivalence(
  lowerCI: number,
  upperCI: number,
  lowerBound: number = 0.8,
  upperBound: number = 1.25,
  cvIntra: number
): ComplianceCheckResult {
  const withinBounds = lowerCI >= lowerBound && upperCI <= upperBound;

  // EMA may require tighter bounds if CV is low
  let adjustedBound = upperBound;
  if (cvIntra < 0.3) {
    adjustedBound = 1.25;
  } else if (cvIntra > 0.3) {
    adjustedBound = Math.min(1.25, Math.exp(0.76 * cvIntra));
  }

  const withinAdjusted = lowerCI >= lowerBound && upperCI <= adjustedBound;

  return {
    criterion: "EMA Bioequivalence (90% CI, CV-adjusted)",
    status: withinAdjusted ? "pass" : "fail",
    value: `${lowerCI.toFixed(3)}-${upperCI.toFixed(3)} (CV=${cvIntra.toFixed(3)})`,
    requirement: `90% CI within [${lowerBound}, ${adjustedBound.toFixed(3)}]`,
    recommendation: withinAdjusted
      ? "Study meets EMA bioequivalence criteria."
      : `CI outside EMA bounds. Review CV and consider wider confidence interval.`,
  };
}

/**
 * Power Adequacy Check
 */
export function checkPowerAdequacy(
  power: number,
  minPower: number = 0.8
): ComplianceCheckResult {
  const adequate = power >= minPower;

  return {
    criterion: "Statistical Power",
    status: adequate ? "pass" : "fail",
    value: `${(power * 100).toFixed(1)}%`,
    requirement: `Power must be ≥${(minPower * 100).toFixed(0)}%`,
    recommendation: adequate
      ? "Study has adequate power."
      : `Power below ${(minPower * 100).toFixed(0)}%. Increase sample size.`,
  };
}

/**
 * Sample Size Validation
 */
export function validateSampleSize(
  actualN: number,
  plannedN: number,
  tolerance: number = 0.1
): ComplianceCheckResult {
  const deviation = Math.abs(actualN - plannedN) / plannedN;
  const acceptable = deviation <= tolerance;

  return {
    criterion: "Sample Size Compliance",
    status: acceptable ? "pass" : "warning",
    value: `Actual: ${actualN}, Planned: ${plannedN}`,
    requirement: `Deviation must be ≤${(tolerance * 100).toFixed(0)}%`,
    recommendation: acceptable
      ? "Sample size matches protocol."
      : `Deviation of ${(deviation * 100).toFixed(1)}%. Document justification.`,
  };
}

/**
 * Inclusion/Exclusion Criteria Check
 */
export function validateInclusionExclusion(
  criteriaChecks: Record<string, boolean>
): ComplianceCheckResult {
  const allMet = Object.values(criteriaChecks).every((v) => v);
  const failedCriteria = Object.entries(criteriaChecks)
    .filter(([_, met]) => !met)
    .map(([criterion]) => criterion);

  return {
    criterion: "Inclusion/Exclusion Criteria",
    status: allMet ? "pass" : "fail",
    value: `${Object.values(criteriaChecks).filter((v) => v).length}/${Object.keys(criteriaChecks).length} met`,
    requirement: "All criteria must be met",
    recommendation: allMet
      ? "All inclusion/exclusion criteria satisfied."
      : `Failed criteria: ${failedCriteria.join(", ")}. Review eligibility.`,
  };
}

/**
 * Regulatory Guidance Notes Generator
 */
export function generateRegulatoryGuidance(studyType: string): string[] {
  const guidance: Record<string, string[]> = {
    bioequivalence: [
      "Use log-transformed data for analysis",
      "Report 90% confidence intervals",
      "Include intra-subject CV in report",
      "Document any protocol deviations",
      "Provide individual subject data",
    ],
    efficacy: [
      "Pre-specify primary efficacy endpoint",
      "Use intention-to-treat (ITT) population",
      "Report per-protocol (PP) population separately",
      "Include confidence intervals for all estimates",
      "Document multiplicity adjustments",
    ],
    safety: [
      "Report all adverse events",
      "Include severity and relationship to drug",
      "Document serious adverse events separately",
      "Provide exposure-adjusted incidence rates",
      "Include laboratory abnormalities",
    ],
    pharmacokinetics: [
      "Report AUC and Cmax with confidence intervals",
      "Include individual PK profiles",
      "Document sampling times",
      "Report any missing samples",
      "Include dose-normalized parameters",
    ],
  };

  return guidance[studyType] || guidance["efficacy"];
}

/**
 * Comprehensive Regulatory Report
 */
export function generateRegulatoryReport(
  studyType: string,
  checks: ComplianceCheckResult[]
): RegulatoryReport {
  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;

  let overallCompliance: "compliant" | "non-compliant" | "conditional" =
    "compliant";
  if (failCount > 0) {
    overallCompliance = "non-compliant";
  } else if (warningCount > 0) {
    overallCompliance = "conditional";
  }

  const failedChecks = checks
    .filter((c) => c.status === "fail")
    .map((c) => c.recommendation);

  const summary =
    overallCompliance === "compliant"
      ? `Study appears compliant with ${studyType} regulations (${passCount}/${checks.length} checks passed).`
      : overallCompliance === "conditional"
        ? `Study has conditional compliance with ${warningCount} warnings. Review recommendations.`
        : `Study is non-compliant with ${failCount} critical failures. Corrective actions required.`;

  return {
    studyType,
    checks,
    overallCompliance,
    summary,
    actionItems: failedChecks,
  };
}

/**
 * FDA Approval Readiness Checklist
 */
export function checkFDAApprovalReadiness(
  studyMetrics: Record<string, number | boolean>
): ComplianceCheckResult[] {
  const checks: ComplianceCheckResult[] = [];

  // Power check
  if (typeof studyMetrics.power === "number") {
    checks.push(checkPowerAdequacy(studyMetrics.power, 0.8));
  }

  // Sample size check
  if (
    typeof studyMetrics.actualN === "number" &&
    typeof studyMetrics.plannedN === "number"
  ) {
    checks.push(
      validateSampleSize(studyMetrics.actualN, studyMetrics.plannedN)
    );
  }

  // Bioequivalence check (if applicable)
  if (
    typeof studyMetrics.lowerCI === "number" &&
    typeof studyMetrics.upperCI === "number"
  ) {
    checks.push(
      checkFDABioequivalence(studyMetrics.lowerCI, studyMetrics.upperCI)
    );
  }

  // Safety check
  if (typeof studyMetrics.seriousAEs === "number") {
    const saeAcceptable = studyMetrics.seriousAEs < 5;
    checks.push({
      criterion: "Serious Adverse Events",
      status: saeAcceptable ? "pass" : "warning",
      value: `${studyMetrics.seriousAEs}`,
      requirement: "Minimize serious adverse events",
      recommendation: saeAcceptable
        ? "SAE profile acceptable."
        : "High SAE rate requires review.",
    });
  }

  return checks;
}

/**
 * EMA Approval Readiness Checklist
 */
export function checkEMAApprovalReadiness(
  studyMetrics: Record<string, number | boolean>,
  cvIntra: number = 0.25
): ComplianceCheckResult[] {
  const checks: ComplianceCheckResult[] = [];

  // Power check (EMA may require higher)
  if (typeof studyMetrics.power === "number") {
    checks.push(checkPowerAdequacy(studyMetrics.power, 0.9));
  }

  // EMA Bioequivalence check
  if (
    typeof studyMetrics.lowerCI === "number" &&
    typeof studyMetrics.upperCI === "number"
  ) {
    checks.push(
      checkEMABioequivalence(
        studyMetrics.lowerCI,
        studyMetrics.upperCI,
        0.8,
        1.25,
        cvIntra
      )
    );
  }

  // Population check
  if (typeof studyMetrics.healthySubjects === "boolean") {
    checks.push({
      criterion: "Study Population",
      status: studyMetrics.healthySubjects ? "pass" : "warning",
      value: studyMetrics.healthySubjects ? "Healthy subjects" : "Patient population",
      requirement: "Bioequivalence typically in healthy subjects",
      recommendation: studyMetrics.healthySubjects
        ? "Population appropriate."
        : "Patient population requires justification.",
    });
  }

  return checks;
}
