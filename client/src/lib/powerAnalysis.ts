/**
 * Power and Sample Size Analysis Module
 * Equivalent to R's pwr package
 */

export interface PowerResult {
  testType: string;
  n: number;
  power: number;
  alpha: number;
  effectSize: number;
  alternative: "two.sided" | "one.sided";
  note: string;
}

export interface SampleSizeResult {
  testType: string;
  n: number;
  power: number;
  alpha: number;
  effectSize: number;
  note: string;
}

/**
 * Power calculation for t-test
 */
export function powerTTest(
  n: number,
  d: number,
  alpha: number = 0.05,
  alternative: "two.sided" | "one.sided" = "two.sided"
): PowerResult {
  const twoSided = alternative === "two.sided" ? 1 : 0.5;
  const zAlpha = normalInverse(1 - (alpha * twoSided) / 2);
  const zBeta = Math.sqrt(n / 2) * Math.abs(d) - zAlpha;
  const power = normalCDF(zBeta);

  return {
    testType: "t-test",
    n,
    power: Math.max(0, Math.min(1, power)),
    alpha,
    effectSize: d,
    alternative,
    note: `For ${alternative} t-test with effect size d=${d.toFixed(3)}`,
  };
}

/**
 * Sample size for t-test
 */
export function sampleSizeTTest(
  power: number,
  d: number,
  alpha: number = 0.05,
  alternative: "two.sided" | "one.sided" = "two.sided"
): SampleSizeResult {
  const twoSided = alternative === "two.sided" ? 1 : 0.5;
  const zAlpha = normalInverse(1 - (alpha * twoSided) / 2);
  const zBeta = normalInverse(power);
  const n = Math.ceil((2 * Math.pow(zAlpha + zBeta, 2)) / Math.pow(d, 2));

  return {
    testType: "t-test",
    n,
    power,
    alpha,
    effectSize: d,
    note: `${alternative} t-test: need ${n} per group for power=${power.toFixed(3)}`,
  };
}

/**
 * Power calculation for ANOVA
 */
export function powerANOVA(
  n: number,
  k: number,
  f: number,
  alpha: number = 0.05
): PowerResult {
  const df1 = k - 1;
  const df2 = k * (n - 1);
  const lambda = Math.sqrt(n * k) * f;

  const fCrit = fInverse(1 - alpha, df1, df2);
  const power = 1 - nonCentralFCDF(fCrit, df1, df2, lambda);

  return {
    testType: "ANOVA",
    n,
    power: Math.max(0, Math.min(1, power)),
    alpha,
    effectSize: f,
    alternative: "two.sided",
    note: `One-way ANOVA with ${k} groups, effect size f=${f.toFixed(3)}`,
  };
}

/**
 * Sample size for ANOVA
 */
export function sampleSizeANOVA(
  power: number,
  k: number,
  f: number,
  alpha: number = 0.05
): SampleSizeResult {
  let n = 2;
  let currentPower = 0;

  // Binary search for sample size
  while (currentPower < power && n < 10000) {
    const result = powerANOVA(n, k, f, alpha);
    currentPower = result.power;
    if (currentPower < power) n += 1;
  }

  return {
    testType: "ANOVA",
    n,
    power,
    alpha,
    effectSize: f,
    note: `One-way ANOVA: need ${n} per group for power=${power.toFixed(3)}`,
  };
}

/**
 * Power calculation for correlation
 */
export function powerCorrelation(
  n: number,
  r: number,
  alpha: number = 0.05,
  alternative: "two.sided" | "one.sided" = "two.sided"
): PowerResult {
  const twoSided = alternative === "two.sided" ? 1 : 0.5;
  const zAlpha = normalInverse(1 - (alpha * twoSided) / 2);
  const zr = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const z = Math.abs(zr) / se - zAlpha;
  const power = normalCDF(z);

  return {
    testType: "Correlation",
    n,
    power: Math.max(0, Math.min(1, power)),
    alpha,
    effectSize: r,
    alternative,
    note: `Correlation test with r=${r.toFixed(3)}`,
  };
}

/**
 * Sample size for correlation
 */
export function sampleSizeCorrelation(
  power: number,
  r: number,
  alpha: number = 0.05,
  alternative: "two.sided" | "one.sided" = "two.sided"
): SampleSizeResult {
  const twoSided = alternative === "two.sided" ? 1 : 0.5;
  const zAlpha = normalInverse(1 - (alpha * twoSided) / 2);
  const zBeta = normalInverse(power);
  const zr = 0.5 * Math.log((1 + r) / (1 - r));
  const n = Math.ceil(Math.pow((zAlpha + zBeta) / zr, 2) + 3);

  return {
    testType: "Correlation",
    n,
    power,
    alpha,
    effectSize: r,
    note: `Correlation: need ${n} samples for power=${power.toFixed(3)}`,
  };
}

/**
 * Power calculation for proportions
 */
export function powerProportions(
  n: number,
  p1: number,
  p2: number,
  alpha: number = 0.05,
  alternative: "two.sided" | "one.sided" = "two.sided"
): PowerResult {
  const twoSided = alternative === "two.sided" ? 1 : 0.5;
  const zAlpha = normalInverse(1 - (alpha * twoSided) / 2);

  const p = (p1 + p2) / 2;
  const se0 = Math.sqrt(2 * p * (1 - p) / n);
  const se1 = Math.sqrt(p1 * (1 - p1) / n + p2 * (1 - p2) / n);

  const z = (Math.abs(p1 - p2) - zAlpha * se0) / se1;
  const power = normalCDF(z);

  return {
    testType: "Proportions",
    n,
    power: Math.max(0, Math.min(1, power)),
    alpha,
    effectSize: Math.abs(p1 - p2),
    alternative,
    note: `Proportion test: p1=${p1.toFixed(3)}, p2=${p2.toFixed(3)}`,
  };
}

/**
 * Sample size for proportions
 */
export function sampleSizeProportions(
  power: number,
  p1: number,
  p2: number,
  alpha: number = 0.05,
  alternative: "two.sided" | "one.sided" = "two.sided"
): SampleSizeResult {
  const twoSided = alternative === "two.sided" ? 1 : 0.5;
  const zAlpha = normalInverse(1 - (alpha * twoSided) / 2);
  const zBeta = normalInverse(power);

  const p = (p1 + p2) / 2;
  const se0 = Math.sqrt(2 * p * (1 - p));
  const se1 = Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));

  const n = Math.ceil(
    Math.pow((zAlpha * se0 + zBeta * se1) / (p1 - p2), 2)
  );

  return {
    testType: "Proportions",
    n,
    power,
    alpha,
    effectSize: Math.abs(p1 - p2),
    note: `Proportions: need ${n} per group for power=${power.toFixed(3)}`,
  };
}

/**
 * Effect size conversions
 */
export function effectSizeConversions(
  value: number,
  fromType: "cohens_d" | "r" | "odds_ratio",
  toType: "cohens_d" | "r" | "odds_ratio"
): number {
  let d = 0;

  // Convert to Cohen's d first
  if (fromType === "cohens_d") {
    d = value;
  } else if (fromType === "r") {
    d = (2 * value) / Math.sqrt(1 - value * value);
  } else if (fromType === "odds_ratio") {
    d = Math.log(value) * Math.sqrt(3) / Math.PI;
  }

  // Convert from Cohen's d to target
  if (toType === "cohens_d") {
    return d;
  } else if (toType === "r") {
    return d / Math.sqrt(d * d + 4);
  } else if (toType === "odds_ratio") {
    return Math.exp((d * Math.PI) / Math.sqrt(3));
  }

  return 0;
}

/**
 * Generate power curve
 */
export function powerCurve(
  testType: "t-test" | "ANOVA" | "correlation",
  effectSize: number,
  alpha: number = 0.05,
  nMin: number = 10,
  nMax: number = 200,
  step: number = 10
): Array<{ n: number; power: number }> {
  const curve = [];

  for (let n = nMin; n <= nMax; n += step) {
    let result: PowerResult;

    if (testType === "t-test") {
      result = powerTTest(n, effectSize, alpha);
    } else if (testType === "ANOVA") {
      result = powerANOVA(n, 3, effectSize, alpha);
    } else {
      result = powerCorrelation(n, effectSize, alpha);
    }

    curve.push({ n, power: result.power });
  }

  return curve;
}

/**
 * Interpret effect size
 */
export function interpretEffectSize(
  d: number,
  testType: string = "t-test"
): string {
  const absD = Math.abs(d);

  if (testType === "t-test" || testType === "correlation") {
    if (absD < 0.2) return "negligible";
    if (absD < 0.5) return "small";
    if (absD < 0.8) return "medium";
    return "large";
  } else if (testType === "ANOVA") {
    if (absD < 0.1) return "small";
    if (absD < 0.25) return "medium";
    return "large";
  }

  return "unknown";
}

// ============ Helper Functions ============

function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function normalInverse(p: number): number {
  // Approximation of inverse normal CDF
  if (p < 0.5) {
    return -normalInverse(1 - p);
  }

  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  return (
    t -
    ((c2 * t + c1) * t + c0) /
      (((d3 * t + d2) * t + d1) * t + 1)
  );
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

function fInverse(p: number, df1: number, df2: number): number {
  // Simplified F-inverse
  let f = 1;
  for (let i = 0; i < 100; i++) {
    const cdf = nonCentralFCDF(f, df1, df2, 0);
    if (cdf > p) break;
    f += 0.01;
  }
  return f;
}

function nonCentralFCDF(
  f: number,
  df1: number,
  df2: number,
  lambda: number
): number {
  // Simplified non-central F CDF
  if (lambda === 0) {
    return centralFCDF(f, df1, df2);
  }

  // Approximate using chi-square
  const x = (df1 * f) / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

function centralFCDF(f: number, df1: number, df2: number): number {
  const x = (df1 * f) / (df1 * f + df2);
  return incompleteBeta(x, df1 / 2, df2 / 2);
}

function incompleteBeta(x: number, a: number, b: number): number {
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
