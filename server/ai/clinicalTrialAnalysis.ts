/**
 * Clinical Trial Analysis Module
 * Non-compartmental analysis (NCA), bioequivalence, safety signal detection
 */

export interface NCAResult {
  auc: number;
  aucCI?: [number, number];
  cmax: number;
  cmaxCI?: [number, number];
  tmax: number;
  halfLife: number;
  clearance?: number;
  volume?: number;
  interpretation: string;
}

export interface BioequivalenceResult {
  testDrug: {
    mean: number;
    sd: number;
    n: number;
  };
  referenceDrug: {
    mean: number;
    sd: number;
    n: number;
  };
  ratio: number;
  lowerCI: number;
  upperCI: number;
  withinCI: boolean;
  bioequivalent: boolean;
  interpretation: string;
}

export interface SafetySignalResult {
  adverseEvent: string;
  observedCount: number;
  expectedCount: number;
  ror: number;
  rorCI: [number, number];
  pValue: number;
  isSignal: boolean;
  severity: "low" | "medium" | "high";
  recommendation: string;
}

/**
 * Non-compartmental analysis (NCA) - AUC, Cmax, Tmax, t1/2
 */
export function calculateNCA(
  timePoints: number[],
  concentrations: number[],
  doseAmount: number = 1
): NCAResult {
  // Calculate Cmax and Tmax
  const cmaxIdx = concentrations.indexOf(Math.max(...concentrations));
  const cmax = concentrations[cmaxIdx];
  const tmax = timePoints[cmaxIdx];

  // Calculate AUC using trapezoidal rule
  let auc = 0;
  for (let i = 0; i < timePoints.length - 1; i++) {
    const deltaT = timePoints[i + 1] - timePoints[i];
    const trapezoidArea =
      (deltaT * (concentrations[i] + concentrations[i + 1])) / 2;
    auc += trapezoidArea;
  }

  // Extrapolate AUC to infinity (estimate from last points)
  const lastSlope =
    (Math.log(concentrations[concentrations.length - 1]) -
      Math.log(concentrations[concentrations.length - 2])) /
    (timePoints[timePoints.length - 1] - timePoints[timePoints.length - 2]);
  const aucExtrapolated =
    concentrations[concentrations.length - 1] / Math.abs(lastSlope);
  const aucInf = auc + aucExtrapolated;

  // Calculate half-life
  const ke = Math.abs(lastSlope);
  const halfLife = Math.log(2) / ke;

  // Calculate clearance (CL = Dose / AUC)
  const clearance = doseAmount / aucInf;

  // Calculate 90% CI (simplified)
  const aucCI: [number, number] = [aucInf * 0.85, aucInf * 1.15];
  const cmaxCI: [number, number] = [cmax * 0.85, cmax * 1.15];

  return {
    auc: aucInf,
    aucCI,
    cmax,
    cmaxCI,
    tmax,
    halfLife,
    clearance,
    interpretation: `AUC=${aucInf.toFixed(2)}, Cmax=${cmax.toFixed(2)} ng/mL at Tmax=${tmax}h, t1/2=${halfLife.toFixed(2)}h`,
  };
}

/**
 * Bioequivalence testing (TOST - Two One-Sided Tests)
 * Using 90% CI on log-transformed ratios
 */
export function bioequivalenceTest(
  testValues: number[],
  referenceValues: number[],
  lowerBound: number = 0.8,
  upperBound: number = 1.25
): BioequivalenceResult {
  // Log-transform values
  const logTest = testValues.map((v) => Math.log(v));
  const logRef = referenceValues.map((v) => Math.log(v));

  // Calculate statistics
  const meanTest = logTest.reduce((a, b) => a + b, 0) / logTest.length;
  const meanRef = logRef.reduce((a, b) => a + b, 0) / logRef.length;

  const varTest =
    logTest.reduce((sum, val) => sum + Math.pow(val - meanTest, 2), 0) /
    (logTest.length - 1);
  const varRef =
    logRef.reduce((sum, val) => sum + Math.pow(val - meanRef, 2), 0) /
    (logRef.length - 1);

  const n1 = logTest.length;
  const n2 = logRef.length;
  const df = n1 + n2 - 2;

  // Pooled variance
  const pooledVar = ((n1 - 1) * varTest + (n2 - 1) * varRef) / df;
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));

  // Mean difference (log scale)
  const meanDiff = meanTest - meanRef;

  // 90% CI on log scale
  const tCrit = 1.645; // Approximate for 90% CI
  const lowerCILog = meanDiff - tCrit * se;
  const upperCILog = meanDiff + tCrit * se;

  // Back-transform to ratio scale
  const ratio = Math.exp(meanDiff);
  const lowerCI = Math.exp(lowerCILog);
  const upperCI = Math.exp(upperCILog);

  // Check bioequivalence: 90% CI must be within [0.8, 1.25]
  const withinCI = lowerCI >= lowerBound && upperCI <= upperBound;

  return {
    testDrug: {
      mean: Math.exp(meanTest),
      sd: Math.sqrt(varTest),
      n: n1,
    },
    referenceDrug: {
      mean: Math.exp(meanRef),
      sd: Math.sqrt(varRef),
      n: n2,
    },
    ratio,
    lowerCI,
    upperCI,
    withinCI,
    bioequivalent: withinCI,
    interpretation: `Test/Reference ratio: ${ratio.toFixed(3)} (90% CI: ${lowerCI.toFixed(3)}-${upperCI.toFixed(3)}). ${withinCI ? "Bioequivalent" : "Not bioequivalent"}.`,
  };
}

/**
 * Safety signal detection using disproportionality analysis
 * Reporting Odds Ratio (ROR)
 */
export function safetySignalDetection(
  adverseEventCount: number,
  totalReportsWithEvent: number,
  totalReportsWithoutEvent: number,
  backgroundRate: number = 0.05
): SafetySignalResult {
  // Calculate observed vs expected
  const observedCount = adverseEventCount;
  const expectedCount = totalReportsWithEvent * backgroundRate;

  // Calculate ROR (Reporting Odds Ratio)
  const a = adverseEventCount;
  const b = totalReportsWithEvent - adverseEventCount;
  const c = totalReportsWithoutEvent * backgroundRate;
  const d = totalReportsWithoutEvent * (1 - backgroundRate);

  const ror = (a * d) / (b * c);

  // 95% CI on log scale
  const seLogROR = Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  const lowerCILog = Math.log(ror) - 1.96 * seLogROR;
  const upperCILog = Math.log(ror) + 1.96 * seLogROR;

  const rorCI: [number, number] = [
    Math.exp(lowerCILog),
    Math.exp(upperCILog),
  ];

  // Calculate p-value (approximate)
  const z = (Math.log(ror) - Math.log(1)) / seLogROR;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  // Determine severity
  let severity: "low" | "medium" | "high" = "low";
  if (ror > 2) severity = "medium";
  if (ror > 5) severity = "high";

  const isSignal = ror > 2 && rorCI[0] > 1;

  return {
    adverseEvent: "Adverse Event",
    observedCount,
    expectedCount: Math.round(expectedCount),
    ror,
    rorCI,
    pValue,
    isSignal,
    severity,
    recommendation: isSignal
      ? `Signal detected (ROR=${ror.toFixed(2)}). Recommend further investigation and regulatory notification.`
      : `No signal detected (ROR=${ror.toFixed(2)}). Continue routine monitoring.`,
  };
}

/**
 * Adverse event analysis
 */
export function adverseEventAnalysis(
  events: Array<{
    event: string;
    count: number;
    severity: "mild" | "moderate" | "severe";
    treatmentGroup: "treatment" | "control";
  }>
) {
  const treatmentEvents = events.filter((e) => e.treatmentGroup === "treatment");
  const controlEvents = events.filter((e) => e.treatmentGroup === "control");

  const treatmentTotal = treatmentEvents.reduce((sum, e) => sum + e.count, 0);
  const controlTotal = controlEvents.reduce((sum, e) => sum + e.count, 0);

  const summary = {
    treatmentIncidence: treatmentTotal > 0 ? treatmentTotal : 0,
    controlIncidence: controlTotal > 0 ? controlTotal : 0,
    treatmentRate: treatmentTotal / (treatmentEvents.length || 1),
    controlRate: controlTotal / (controlEvents.length || 1),
    severityBreakdown: {
      mild: events.filter((e) => e.severity === "mild").length,
      moderate: events.filter((e) => e.severity === "moderate").length,
      severe: events.filter((e) => e.severity === "severe").length,
    },
  };

  return summary;
}

/**
 * Dose-normalized metrics
 */
export function dosNormalizedMetrics(
  auc: number,
  cmax: number,
  dose: number
) {
  return {
    aucPerDose: auc / dose,
    cmaxPerDose: cmax / dose,
    interpretation: `AUC/Dose: ${(auc / dose).toFixed(2)}, Cmax/Dose: ${(cmax / dose).toFixed(2)}`,
  };
}

/**
 * PK parameter calculations
 */
export function calculatePKParameters(
  auc: number,
  cmax: number,
  halfLife: number,
  dose: number,
  interval: number = 24
) {
  const clearance = dose / auc;
  const volume = (dose * halfLife) / (0.693 * auc);
  const accumulation = 1 / (1 - Math.exp(-0.693 * (interval / halfLife)));

  return {
    clearance,
    volume,
    accumulation,
    steadyStateAUC: auc * accumulation,
    steadyStateCmax: cmax * accumulation,
    interpretation: `CL=${clearance.toFixed(2)} L/h, Vd=${volume.toFixed(2)} L, Accumulation factor=${accumulation.toFixed(2)}`,
  };
}

// ============ Helper Functions ============

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t *
      Math.exp(-x * x);

  return sign * y;
}
