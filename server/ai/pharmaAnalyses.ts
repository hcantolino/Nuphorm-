/**
 * Pharmaceutical-Specific Analyses
 * Bioequivalence, dose-response, PK/PD, efficacy, and safety analyses
 */

import { computeDescriptiveStats } from "@/lib/statistics";
import { independentTTest, linearRegression } from "./statisticalTests";

export interface BioequivalenceResult {
  metric: string;
  referenceGeomMean: number;
  testGeomMean: number;
  ratio: number;
  ci90Lower: number;
  ci90Upper: number;
  bioequivalent: boolean;
  lowerMargin: number;
  upperMargin: number;
  interpretation: string;
  fdaCompliant: boolean;
}

export interface DoseResponseResult {
  doseLevel: number;
  response: number;
  responseSD?: number;
  n?: number;
}

export interface DoseResponseCurve {
  model: "linear" | "exponential" | "sigmoid" | "power";
  parameters: Record<string, number>;
  rSquared: number;
  ed50?: number;
  ed50CI?: { lower: number; upper: number };
  maxResponse?: number;
  slope?: number;
  interpretation: string;
}

export interface PKPDParameters {
  auc: number;
  aucCI?: { lower: number; upper: number };
  cmax: number;
  cmaxCI?: { lower: number; upper: number };
  tmax: number;
  halfLife?: number;
  clearance?: number;
  vd?: number;
  interpretation: string;
}

/**
 * Bioequivalence assessment (90% CI TOST)
 */
export function assessBioequivalence(
  referenceAUC: number[],
  testAUC: number[],
  lowerMargin: number = 0.8,
  upperMargin: number = 1.25
): BioequivalenceResult {
  const refFiltered = referenceAUC.filter((v) => !isNaN(v));
  const testFiltered = testAUC.filter((v) => !isNaN(v));

  if (refFiltered.length < 2 || testFiltered.length < 2) {
    throw new Error("Need at least 2 observations per group");
  }

  // Geometric means (log-transform)
  const refLogMean =
    refFiltered.reduce((a, b) => a + Math.log(b), 0) / refFiltered.length;
  const testLogMean =
    testFiltered.reduce((a, b) => a + Math.log(b), 0) / testFiltered.length;

  const refGeomMean = Math.exp(refLogMean);
  const testGeomMean = Math.exp(testLogMean);
  const ratio = testGeomMean / refGeomMean;

  // Perform t-test on log-transformed data
  const refLog = refFiltered.map((v) => Math.log(v));
  const testLog = testFiltered.map((v) => Math.log(v));

  const tTestResult = independentTTest(refLog, testLog, 0.1);

  // Extract 90% CI from t-test
  const ci90Lower = Math.exp(tTestResult.confidenceInterval!.lower);
  const ci90Upper = Math.exp(tTestResult.confidenceInterval!.upper);

  // Check bioequivalence
  const bioequivalent =
    ci90Lower >= lowerMargin && ci90Upper <= upperMargin;

  return {
    metric: "AUC",
    referenceGeomMean: refGeomMean,
    testGeomMean: testGeomMean,
    ratio,
    ci90Lower,
    ci90Upper,
    bioequivalent,
    lowerMargin,
    upperMargin,
    interpretation: `Test/Reference ratio: ${ratio.toFixed(4)} (90% CI: ${ci90Lower.toFixed(4)}-${ci90Upper.toFixed(4)}). ${bioequivalent ? "Bioequivalent" : "Not bioequivalent"} per FDA criteria (${(lowerMargin * 100).toFixed(0)}-${(upperMargin * 100).toFixed(0)}%).`,
    fdaCompliant: bioequivalent,
  };
}

/**
 * Fit dose-response curve
 */
export function fitDoseResponseCurve(
  doses: number[],
  responses: number[],
  model: "linear" | "exponential" | "sigmoid" = "sigmoid"
): DoseResponseCurve {
  const doseFiltered = doses.filter((v, i) => !isNaN(v) && !isNaN(responses[i]));
  const respFiltered = responses.filter((v, i) => !isNaN(v) && !isNaN(doses[i]));

  if (doseFiltered.length < 3) {
    throw new Error("Need at least 3 dose-response pairs");
  }

  let parameters: Record<string, number> = {};
  let rSquared = 0;
  let ed50: number | undefined;
  let maxResponse: number | undefined;
  let slope: number | undefined;

  if (model === "linear") {
    const reg = linearRegression(doseFiltered, respFiltered);
    parameters = { slope: reg.slope, intercept: reg.intercept };
    rSquared = reg.rSquared;
    slope = reg.slope;
  } else if (model === "exponential") {
    // Fit: Response = a * exp(b * Dose)
    const logResp = respFiltered.map((r) => Math.log(Math.max(r, 0.001)));
    const reg = linearRegression(doseFiltered, logResp);
    parameters = { a: Math.exp(reg.intercept), b: reg.slope };
    rSquared = reg.rSquared;
    maxResponse = Math.max(...respFiltered);
  } else if (model === "sigmoid") {
    // Hill equation: Response = Emax * Dose^n / (ED50^n + Dose^n)
    // Simplified: fit using log-logistic regression
    const logDose = doseFiltered.map((d) => Math.log(Math.max(d, 0.001)));
    const logResp = respFiltered.map((r) => Math.log(Math.max(r, 0.001)));
    const reg = linearRegression(logDose, logResp);

    parameters = { emax: Math.max(...respFiltered), ed50: 1, slope: reg.slope };
    rSquared = reg.rSquared;
    ed50 = Math.exp(reg.intercept / reg.slope);
    maxResponse = Math.max(...respFiltered);
    slope = reg.slope;
  }

  return {
    model,
    parameters,
    rSquared,
    ed50,
    maxResponse,
    slope,
    interpretation: `${model.toUpperCase()} model fitted with R² = ${rSquared.toFixed(4)}. ${ed50 ? `ED50 ≈ ${ed50.toFixed(4)}.` : ""} ${maxResponse ? `Max response ≈ ${maxResponse.toFixed(4)}.` : ""}`,
  };
}

/**
 * Calculate PK/PD parameters from concentration-time data
 */
export function calculatePKPDParameters(
  timePoints: number[],
  concentrations: number[],
  doseAmount: number = 1
): PKPDParameters {
  const timeFiltered = timePoints.filter((v, i) => !isNaN(v) && !isNaN(concentrations[i]));
  const concFiltered = concentrations.filter((v, i) => !isNaN(v) && !isNaN(timePoints[i]));

  if (timeFiltered.length < 3) {
    throw new Error("Need at least 3 time points");
  }

  // Calculate AUC using trapezoidal rule
  let auc = 0;
  for (let i = 1; i < timeFiltered.length; i++) {
    const dt = timeFiltered[i] - timeFiltered[i - 1];
    const avgConc = (concFiltered[i] + concFiltered[i - 1]) / 2;
    auc += dt * avgConc;
  }

  // Find Cmax and Tmax
  const cmaxIdx = concFiltered.indexOf(Math.max(...concFiltered));
  const cmax = concFiltered[cmaxIdx];
  const tmax = timeFiltered[cmaxIdx];

  // Estimate half-life (terminal phase)
  const lastThird = Math.ceil(timeFiltered.length / 3);
  const terminalTimes = timeFiltered.slice(-lastThird);
  const terminalConcs = concFiltered.slice(-lastThird);

  let halfLife: number | undefined;
  if (terminalTimes.length >= 2) {
    const logConcs = terminalConcs.map((c) => Math.log(Math.max(c, 0.001)));
    const reg = linearRegression(terminalTimes, logConcs);
    const ke = -reg.slope; // Elimination rate constant
    halfLife = Math.log(2) / ke;
  }

  // Clearance = Dose / AUC
  const clearance = doseAmount / auc;

  // Volume of distribution = Dose / (Cmax * (1 - e^(-ke*t0)))
  let vd: number | undefined;
  if (halfLife) {
    const ke = Math.log(2) / halfLife;
    vd = doseAmount / (cmax * (1 - Math.exp(-ke * (timeFiltered[0] || 0))));
  }

  return {
    auc,
    cmax,
    tmax,
    halfLife,
    clearance,
    vd,
    interpretation: `AUC = ${auc.toFixed(4)}, Cmax = ${cmax.toFixed(4)} at Tmax = ${tmax.toFixed(2)}. ${halfLife ? `Half-life ≈ ${halfLife.toFixed(2)}.` : ""} Clearance = ${clearance.toFixed(4)}.`,
  };
}

/**
 * Efficacy analysis
 */
export function analyzeEfficacy(
  treatmentResponders: number,
  treatmentTotal: number,
  controlResponders: number,
  controlTotal: number
): {
  treatmentResponseRate: number;
  controlResponseRate: number;
  riskDifference: number;
  riskRatio: number;
  oddsRatio: number;
  nnt: number;
  interpretation: string;
} {
  const treatmentRate = treatmentResponders / treatmentTotal;
  const controlRate = controlResponders / controlTotal;

  const riskDiff = treatmentRate - controlRate;
  const riskRatio = treatmentRate / controlRate;
  const oddsRatio =
    (treatmentResponders / (treatmentTotal - treatmentResponders)) /
    (controlResponders / (controlTotal - controlResponders));

  const nnt = riskDiff !== 0 ? 1 / Math.abs(riskDiff) : Infinity;

  return {
    treatmentResponseRate: treatmentRate,
    controlResponseRate: controlRate,
    riskDifference: riskDiff,
    riskRatio,
    oddsRatio,
    nnt,
    interpretation: `Treatment response rate: ${(treatmentRate * 100).toFixed(1)}% vs Control: ${(controlRate * 100).toFixed(1)}%. Risk Ratio = ${riskRatio.toFixed(4)}, Odds Ratio = ${oddsRatio.toFixed(4)}. NNT = ${nnt.toFixed(1)} (need to treat ${Math.ceil(nnt)} patients to prevent 1 adverse outcome).`,
  };
}

/**
 * Safety signal detection
 */
export function detectSafetySignals(
  adverseEvents: Record<string, number>,
  totalPatients: number,
  baselineRate: number = 0.05
): Array<{
  event: string;
  incidence: number;
  incidenceRate: number;
  signal: boolean;
  severity: "low" | "medium" | "high";
}> {
  return Object.entries(adverseEvents)
    .map(([event, count]) => {
      const incidenceRate = count / totalPatients;
      const expectedCount = baselineRate * totalPatients;

      // Simple signal detection: if observed > 2x expected
      const signal = count > 2 * expectedCount;
      let severity: "low" | "medium" | "high" = "low";
      if (incidenceRate > 0.1) severity = "medium";
      if (incidenceRate > 0.2) severity = "high";

      return {
        event,
        incidence: count,
        incidenceRate,
        signal,
        severity,
      };
    })
    .sort((a, b) => b.incidenceRate - a.incidenceRate);
}
