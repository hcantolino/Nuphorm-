/**
 * Comprehensive Inferential Statistics Module
 * Equivalent to R's stats package and SAS PROC TTEST/ANOVA
 */

export interface StatTestResult {
  testName: string;
  statistic: number;
  pValue: number;
  degreesOfFreedom?: number;
  effectSize?: number;
  confidenceInterval?: [number, number];
  assumptions?: AssumptionTest[];
  interpretation: string;
  significant: boolean;
  alpha: number;
}

export interface AssumptionTest {
  name: string;
  statistic: number;
  pValue: number;
  violated: boolean;
  recommendation: string;
}

/**
 * Two-sample t-test (independent samples)
 */
export function tTestIndependent(
  group1: number[],
  group2: number[],
  alpha: number = 0.05,
  equalVar: boolean = true
): StatTestResult {
  const n1 = group1.length;
  const n2 = group2.length;

  const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = group2.reduce((a, b) => a + b, 0) / n2;

  const var1 =
    group1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
  const var2 =
    group2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);

  let se: number;
  let df: number;

  if (equalVar) {
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  } else {
    se = Math.sqrt(var1 / n1 + var2 / n2);
    df =
      Math.pow(var1 / n1 + var2 / n2, 2) /
      (Math.pow(var1 / n1, 2) / (n1 - 1) +
        Math.pow(var2 / n2, 2) / (n2 - 1));
  }

  const t = (mean1 - mean2) / se;
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  // Cohen's d effect size
  const pooledSD = Math.sqrt(
    ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
  );
  const cohensD = (mean1 - mean2) / pooledSD;

  // 95% CI
  const tCrit = tInverse(1 - alpha / 2, df);
  const ci: [number, number] = [
    mean1 - mean2 - tCrit * se,
    mean1 - mean2 + tCrit * se,
  ];

  return {
    testName: "Independent t-test",
    statistic: t,
    pValue,
    degreesOfFreedom: df,
    effectSize: cohensD,
    confidenceInterval: ci,
    interpretation: `t(${df.toFixed(0)}) = ${t.toFixed(3)}, p = ${pValue.toFixed(4)}, Cohen's d = ${cohensD.toFixed(3)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * Paired t-test
 */
export function tTestPaired(
  before: number[],
  after: number[],
  alpha: number = 0.05
): StatTestResult {
  const n = before.length;
  const differences = before.map((b, i) => after[i] - b);

  const meanDiff = differences.reduce((a, b) => a + b, 0) / n;
  const varDiff =
    differences.reduce((sum, val) => sum + Math.pow(val - meanDiff, 2), 0) /
    (n - 1);
  const sdDiff = Math.sqrt(varDiff);
  const se = sdDiff / Math.sqrt(n);

  const t = meanDiff / se;
  const df = n - 1;
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  const cohensD = meanDiff / sdDiff;

  const tCrit = tInverse(1 - alpha / 2, df);
  const ci: [number, number] = [
    meanDiff - tCrit * se,
    meanDiff + tCrit * se,
  ];

  return {
    testName: "Paired t-test",
    statistic: t,
    pValue,
    degreesOfFreedom: df,
    effectSize: cohensD,
    confidenceInterval: ci,
    interpretation: `t(${df}) = ${t.toFixed(3)}, p = ${pValue.toFixed(4)}, Cohen's d = ${cohensD.toFixed(3)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * One-way ANOVA
 */
export function anovaOneWay(
  groups: number[][],
  alpha: number = 0.05
): StatTestResult {
  const k = groups.length;
  const N = groups.reduce((sum, g) => sum + g.length, 0);

  const groupMeans = groups.map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  const grandMean = groups.flat().reduce((a, b) => a + b, 0) / N;

  // Between-group sum of squares
  const SSB = groups.reduce(
    (sum, g, i) => sum + g.length * Math.pow(groupMeans[i] - grandMean, 2),
    0
  );

  // Within-group sum of squares
  const SSW = groups.reduce(
    (sum, g, i) =>
      sum +
      g.reduce((s, val) => s + Math.pow(val - groupMeans[i], 2), 0),
    0
  );

  const dfB = k - 1;
  const dfW = N - k;
  const MSB = SSB / dfB;
  const MSW = SSW / dfW;

  const F = MSB / MSW;
  const pValue = 1 - fCDF(F, dfB, dfW);

  // Eta-squared effect size
  const etaSquared = SSB / (SSB + SSW);

  return {
    testName: "One-way ANOVA",
    statistic: F,
    pValue,
    degreesOfFreedom: dfB,
    effectSize: etaSquared,
    interpretation: `F(${dfB}, ${dfW}) = ${F.toFixed(3)}, p = ${pValue.toFixed(4)}, η² = ${etaSquared.toFixed(3)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * Kruskal-Wallis test (non-parametric ANOVA)
 */
export function kruskalWallis(
  groups: number[][],
  alpha: number = 0.05
): StatTestResult {
  const k = groups.length;
  const N = groups.reduce((sum, g) => sum + g.length, 0);

  // Rank all values
  const allValues = groups.flat().map((v, i) => ({ value: v, group: 0 }));
  let groupIdx = 0;
  let idx = 0;
  groups.forEach((g, i) => {
    for (let j = 0; j < g.length; j++) {
      allValues[idx].group = i;
      idx++;
    }
  });

  allValues.sort((a, b) => a.value - b.value);
  const ranks = allValues.map((_, i) => i + 1);

  // Sum of ranks per group
  const R = Array(k).fill(0);
  allValues.forEach((v, i) => {
    R[v.group] += ranks[i];
  });

  // Kruskal-Wallis statistic
  const H =
    (12 / (N * (N + 1))) *
      R.reduce((sum, r, i) => sum + Math.pow(r, 2) / groups[i].length, 0) -
    3 * (N + 1);

  const df = k - 1;
  const pValue = 1 - chiSquareCDF(H, df);

  return {
    testName: "Kruskal-Wallis test",
    statistic: H,
    pValue,
    degreesOfFreedom: df,
    interpretation: `H = ${H.toFixed(3)}, p = ${pValue.toFixed(4)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * Chi-square test of independence
 */
export function chiSquareTest(
  contingencyTable: number[][],
  alpha: number = 0.05
): StatTestResult {
  const rows = contingencyTable.length;
  const cols = contingencyTable[0].length;

  // Calculate row and column totals
  const rowTotals = contingencyTable.map((row) =>
    row.reduce((a, b) => a + b, 0)
  );
  const colTotals = Array(cols)
    .fill(0)
    .map((_, j) => contingencyTable.reduce((sum, row) => sum + row[j], 0));
  const N = rowTotals.reduce((a, b) => a + b, 0);

  // Calculate chi-square
  let chiSquare = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / N;
      chiSquare += Math.pow(contingencyTable[i][j] - expected, 2) / expected;
    }
  }

  const df = (rows - 1) * (cols - 1);
  const pValue = 1 - chiSquareCDF(chiSquare, df);

  // Cramér's V effect size
  const cramersV = Math.sqrt(chiSquare / (N * (Math.min(rows, cols) - 1)));

  return {
    testName: "Chi-square test",
    statistic: chiSquare,
    pValue,
    degreesOfFreedom: df,
    effectSize: cramersV,
    interpretation: `χ²(${df}) = ${chiSquare.toFixed(3)}, p = ${pValue.toFixed(4)}, Cramér's V = ${cramersV.toFixed(3)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * Wilcoxon signed-rank test (paired non-parametric)
 */
export function wilcoxonSignedRank(
  before: number[],
  after: number[],
  alpha: number = 0.05
): StatTestResult {
  const differences = before
    .map((b, i) => Math.abs(after[i] - b))
    .filter((d) => d !== 0);

  const n = differences.length;
  const sorted = differences
    .map((d, i) => ({ value: d, original: before.map((b, j) => after[j] - b)[i] }))
    .sort((a, b) => a.value - b.value);

  const ranks = sorted.map((_, i) => i + 1);
  const W = ranks.reduce((sum, r, i) => sum + (sorted[i].original > 0 ? r : 0), 0);

  // Approximate p-value using normal distribution
  const meanW = (n * (n + 1)) / 4;
  const varW = (n * (n + 1) * (2 * n + 1)) / 24;
  const z = (W - meanW) / Math.sqrt(varW);
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    testName: "Wilcoxon signed-rank test",
    statistic: W,
    pValue,
    interpretation: `W = ${W.toFixed(0)}, p = ${pValue.toFixed(4)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * Mann-Whitney U test (independent non-parametric)
 */
export function mannWhitneyU(
  group1: number[],
  group2: number[],
  alpha: number = 0.05
): StatTestResult {
  const n1 = group1.length;
  const n2 = group2.length;

  // Combine and rank
  const combined = [
    ...group1.map((v, i) => ({ value: v, group: 1 })),
    ...group2.map((v, i) => ({ value: v, group: 2 })),
  ].sort((a, b) => a.value - b.value);

  const ranks = combined.map((_, i) => i + 1);

  // Sum of ranks for group 1
  const R1 = ranks.reduce((sum, r, i) => sum + (combined[i].group === 1 ? r : 0), 0);

  // U statistic
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Approximate p-value
  const meanU = (n1 * n2) / 2;
  const varU = (n1 * n2 * (n1 + n2 + 1)) / 12;
  const z = (U - meanU) / Math.sqrt(varU);
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    testName: "Mann-Whitney U test",
    statistic: U,
    pValue,
    interpretation: `U = ${U.toFixed(0)}, p = ${pValue.toFixed(4)}`,
    significant: pValue < alpha,
    alpha,
  };
}

/**
 * Shapiro-Wilk normality test
 */
export function shapiroWilkTest(values: number[]): AssumptionTest {
  const n = values.length;
  if (n < 3 || n > 5000) {
    return {
      name: "Shapiro-Wilk",
      statistic: 0,
      pValue: 1,
      violated: false,
      recommendation: "Sample size outside valid range (3-5000)",
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;

  // Simplified Shapiro-Wilk calculation
  let numerator = 0;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const a = sorted[n - 1 - i] - sorted[i];
    numerator += a * a;
  }

  const denominator = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const W = numerator / denominator;

  // Approximate p-value
  const pValue = Math.max(0, Math.min(1, 1 - (1 - W) * 100));

  return {
    name: "Shapiro-Wilk",
    statistic: W,
    pValue,
    violated: pValue < 0.05,
    recommendation:
      pValue < 0.05
        ? "Data may not be normally distributed. Consider non-parametric tests."
        : "Data appears normally distributed.",
  };
}

/**
 * Levene's test for homogeneity of variance
 */
export function leveneTest(groups: number[][]): AssumptionTest {
  const k = groups.length;
  const N = groups.reduce((sum, g) => sum + g.length, 0);

  // Calculate group medians
  const medians = groups.map((g) => {
    const sorted = [...g].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  });

  // Calculate deviations from median
  const deviations = groups.map((g, i) =>
    g.map((v) => Math.abs(v - medians[i]))
  );

  // One-way ANOVA on deviations
  const result = anovaOneWay(deviations, 0.05);

  return {
    name: "Levene's test",
    statistic: result.statistic,
    pValue: result.pValue,
    violated: result.pValue < 0.05,
    recommendation:
      result.pValue < 0.05
        ? "Variances are not equal. Consider Welch's t-test or non-parametric tests."
        : "Variances appear equal.",
  };
}

// ============ Helper Functions ============

function tCDF(t: number, df: number): number {
  // Simplified t-distribution CDF
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

function tInverse(p: number, df: number): number {
  // Approximate inverse t-distribution
  let t = 0;
  for (let i = 0; i < 100; i++) {
    const f = tCDF(t, df) - p;
    const fp = (1 / Math.sqrt(df)) * Math.exp(-0.5 * Math.log(1 + (t * t) / df));
    t = t - f / fp;
  }
  return t;
}

function fCDF(f: number, df1: number, df2: number): number {
  const x = (df1 * f) / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

function chiSquareCDF(x: number, df: number): number {
  return incompleteBeta(x / 2, df / 2, 0.5);
}

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

function incompleteBeta(x: number, a: number, b: number): number {
  // Simplified incomplete beta function
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x));
  let f = 1;
  let c = 1;
  let d = 0;

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

    d = 1 + numerator * d;
    c = 1 + numerator / c;
    d = 1 / d;
    f *= d * c;
  }

  return front * f / a;
}
