/**
 * Multiple Comparison Adjustments Module
 * Bonferroni, Holm-Bonferroni, FDR, Tukey HSD, Dunnett's, Scheffe's
 */

export interface AdjustmentResult {
  method: string;
  originalPValues: number[];
  adjustedPValues: number[];
  significantIndices: number[];
  adjustmentFactor?: number;
}

export interface PostHocResult {
  comparison: string;
  meanDiff: number;
  lowerCI: number;
  upperCI: number;
  pValue: number;
  significant: boolean;
}

/**
 * Bonferroni correction
 * Divide alpha by number of comparisons
 */
export function bonferroniCorrection(
  pValues: number[],
  alpha: number = 0.05
): AdjustmentResult {
  const m = pValues.length;
  const adjustedAlpha = alpha / m;
  const adjustedPValues = pValues.map((p) => Math.min(1, p * m));

  return {
    method: "Bonferroni",
    originalPValues: pValues,
    adjustedPValues,
    significantIndices: adjustedPValues
      .map((p, i) => (p < alpha ? i : -1))
      .filter((i) => i !== -1),
    adjustmentFactor: m,
  };
}

/**
 * Holm-Bonferroni step-down method
 * More powerful than Bonferroni
 */
export function holmBonferroni(
  pValues: number[],
  alpha: number = 0.05
): AdjustmentResult {
  const m = pValues.length;
  const sorted = pValues
    .map((p, i) => ({ pValue: p, index: i }))
    .sort((a, b) => a.pValue - b.pValue);

  const adjustedPValues = Array(m).fill(0);

  for (let i = 0; i < m; i++) {
    const adjustedP = Math.min(1, sorted[i].pValue * (m - i));
    adjustedPValues[sorted[i].index] = adjustedP;
  }

  return {
    method: "Holm-Bonferroni",
    originalPValues: pValues,
    adjustedPValues,
    significantIndices: adjustedPValues
      .map((p, i) => (p < alpha ? i : -1))
      .filter((i) => i !== -1),
  };
}

/**
 * False Discovery Rate (FDR) / Benjamini-Hochberg
 * Controls proportion of false positives among significant tests
 */
export function benjaminiHochberg(
  pValues: number[],
  alpha: number = 0.05
): AdjustmentResult {
  const m = pValues.length;
  const sorted = pValues
    .map((p, i) => ({ pValue: p, index: i, rank: 0 }))
    .sort((a, b) => a.pValue - b.pValue);

  sorted.forEach((item, i) => {
    item.rank = i + 1;
  });

  const adjustedPValues = Array(m).fill(0);

  // Find largest i where P(i) <= (i/m)*alpha
  let threshold = 0;
  for (let i = m - 1; i >= 0; i--) {
    if (sorted[i].pValue <= ((i + 1) / m) * alpha) {
      threshold = sorted[i].pValue;
      break;
    }
  }

  for (let i = 0; i < m; i++) {
    const adjustedP = Math.min(
      1,
      (sorted[i].pValue * m) / sorted[i].rank
    );
    adjustedPValues[sorted[i].index] = adjustedP;
  }

  return {
    method: "Benjamini-Hochberg (FDR)",
    originalPValues: pValues,
    adjustedPValues,
    significantIndices: adjustedPValues
      .map((p, i) => (p < alpha ? i : -1))
      .filter((i) => i !== -1),
  };
}

/**
 * Tukey HSD (Honestly Significant Difference) post-hoc test
 */
export function tukeyHSD(
  groupMeans: number[],
  groupSizes: number[],
  mse: number,
  alpha: number = 0.05
): PostHocResult[] {
  const k = groupMeans.length;
  const N = groupSizes.reduce((a, b) => a + b, 0);
  const df = N - k;

  // Tukey q-value (approximation)
  const qCrit = tukeyQValue(k, df, alpha);

  const results: PostHocResult[] = [];

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const meanDiff = groupMeans[i] - groupMeans[j];
      const se = Math.sqrt(mse * (1 / groupSizes[i] + 1 / groupSizes[j]) / 2);
      const ci = qCrit * se;

      const pValue = tukeyPValue(Math.abs(meanDiff) / se, k, df);

      results.push({
        comparison: `Group ${i + 1} vs Group ${j + 1}`,
        meanDiff,
        lowerCI: meanDiff - ci,
        upperCI: meanDiff + ci,
        pValue,
        significant: pValue < alpha,
      });
    }
  }

  return results;
}

/**
 * Dunnett's test (compare all to control)
 */
export function dunnettsTest(
  controlMean: number,
  treatmentMeans: number[],
  controlSize: number,
  treatmentSizes: number[],
  mse: number,
  alpha: number = 0.05
): PostHocResult[] {
  const k = treatmentMeans.length;
  const N = controlSize + treatmentSizes.reduce((a, b) => a + b, 0);
  const df = N - k - 1;

  // Dunnett's critical value (approximation)
  const tCrit = dunnettCritical(k, df, alpha);

  const results: PostHocResult[] = [];

  treatmentMeans.forEach((treatMean, i) => {
    const meanDiff = treatMean - controlMean;
    const se = Math.sqrt(mse * (1 / controlSize + 1 / treatmentSizes[i]));
    const ci = tCrit * se;

    const t = meanDiff / se;
    const pValue = 2 * (1 - tCDF(Math.abs(t), df));

    results.push({
      comparison: `Treatment ${i + 1} vs Control`,
      meanDiff,
      lowerCI: meanDiff - ci,
      upperCI: meanDiff + ci,
      pValue,
      significant: pValue < alpha,
    });
  });

  return results;
}

/**
 * Scheffe's test (for complex comparisons)
 */
export function scheffesTest(
  groupMeans: number[],
  groupSizes: number[],
  mse: number,
  alpha: number = 0.05
): PostHocResult[] {
  const k = groupMeans.length;
  const N = groupSizes.reduce((a, b) => a + b, 0);
  const df1 = k - 1;
  const df2 = N - k;

  // Scheffe critical value
  const fCrit = fInverse(1 - alpha, df1, df2);
  const sCrit = Math.sqrt((k - 1) * fCrit);

  const results: PostHocResult[] = [];

  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const meanDiff = groupMeans[i] - groupMeans[j];
      const se = Math.sqrt(
        mse * (1 / groupSizes[i] + 1 / groupSizes[j])
      );
      const ci = sCrit * se;

      const t = meanDiff / se;
      const pValue = 2 * (1 - tCDF(Math.abs(t), df2));

      results.push({
        comparison: `Group ${i + 1} vs Group ${j + 1}`,
        meanDiff,
        lowerCI: meanDiff - ci,
        upperCI: meanDiff + ci,
        pValue,
        significant: pValue < alpha,
      });
    }
  }

  return results;
}

/**
 * Calculate adjusted p-values for multiple methods
 */
export function compareAdjustmentMethods(
  pValues: number[],
  alpha: number = 0.05
): {
  bonferroni: AdjustmentResult;
  holm: AdjustmentResult;
  fdr: AdjustmentResult;
} {
  return {
    bonferroni: bonferroniCorrection(pValues, alpha),
    holm: holmBonferroni(pValues, alpha),
    fdr: benjaminiHochberg(pValues, alpha),
  };
}

// ============ Helper Functions ============

function tukeyQValue(k: number, df: number, alpha: number): number {
  // Simplified Tukey q-value lookup
  const qTable: Record<string, number> = {
    "3,10": 3.88,
    "3,20": 3.58,
    "3,30": 3.49,
    "4,10": 4.33,
    "4,20": 3.96,
    "4,30": 3.85,
    "5,10": 4.6,
    "5,20": 4.23,
    "5,30": 4.1,
  };

  const key = `${k},${Math.round(df / 10) * 10}`;
  return qTable[key] || 3.5;
}

function tukeyPValue(q: number, k: number, df: number): number {
  // Approximate p-value from q-statistic
  return Math.max(0, 1 - Math.exp(-0.5 * q * q));
}

function dunnettCritical(k: number, df: number, alpha: number): number {
  // Simplified Dunnett's critical value
  const tCrit = tInverse(1 - alpha / (2 * k), df);
  return tCrit * Math.sqrt(2);
}

function fInverse(p: number, df1: number, df2: number): number {
  // Simplified F-inverse
  return 2.5 + (df1 + df2) / 10;
}

function tInverse(p: number, df: number): number {
  // Simplified t-inverse
  return 1.96 + (df - 30) / 100;
}

function tCDF(t: number, df: number): number {
  // Simplified t-distribution CDF
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  // Simplified incomplete beta function
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x));
  let f = 1;
  let c = 1;

  for (let i = 0; i < 100; i++) {
    const m = i / 2;
    let numerator: number;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator =
        -((a + m) * (a + b + m) * x) /
        ((a + 2 * m) * (a + 2 * m + 1));
    }

    const d = 1 + numerator * (1 / (1 + numerator / c));
    c = 1 + numerator / c;
    f *= d * c;
  }

  return front * f / a;
}
