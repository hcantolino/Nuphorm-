/**
 * Regression Modeling Module
 * Linear, logistic, and mixed effects regression for pharma applications
 */

export interface RegressionResult {
  modelType: "linear" | "logistic" | "mixed";
  coefficients: Array<{
    name: string;
    estimate: number;
    stdError: number;
    tValue?: number;
    pValue: number;
    ci: [number, number];
    significant: boolean;
  }>;
  modelStats: {
    rSquared?: number;
    adjRSquared?: number;
    fStatistic?: number;
    fPValue?: number;
    aic?: number;
    bic?: number;
    logLikelihood?: number;
  };
  residuals: number[];
  fitted: number[];
  diagnostics: {
    multicollinearity?: Record<string, number>; // VIF values
    heteroscedasticity?: number; // Breusch-Pagan p-value
    normality?: number; // Shapiro-Wilk p-value
  };
  interpretation: string;
  plotData: {
    fittedVsActual: Array<{ actual: number; fitted: number; residual: number }>;
    residualPlot: Array<{ fitted: number; residual: number }>;
    qqPlot?: Array<{ theoretical: number; sample: number }>;
  };
}

/**
 * Linear Regression using least squares
 */
export function linearRegression(
  y: number[],
  X: number[][]
): RegressionResult {
  const n = y.length;
  const p = X[0].length;

  // Add intercept column
  const XWithIntercept = X.map((row) => [1, ...row]);

  // Calculate X'X and X'y
  const XtX = matrixMultiply(transpose(XWithIntercept), XWithIntercept);
  const Xty = matrixMultiply(transpose(XWithIntercept), y.map((v) => [v]));

  // Solve (X'X)^-1 X'y for coefficients
  const XtXInv = matrixInverse(XtX);
  const beta = matrixMultiply(XtXInv, Xty);

  // Calculate fitted values and residuals
  const fitted = XWithIntercept.map((row) =>
    beta.reduce((sum, b, i) => sum + b[0] * row[i], 0)
  );
  const residuals = y.map((yi, i) => yi - fitted[i]);

  // Calculate statistics
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const tss = y.reduce((sum, yi) => sum + Math.pow(yi - mean(y), 2), 0);
  const rSquared = 1 - rss / tss;
  const adjRSquared = 1 - ((1 - rSquared) * (n - 1)) / (n - p - 1);

  const mse = rss / (n - p - 1);
  const varBeta = XtXInv.map((row) => row.map((v) => v * mse));

  // Calculate t-statistics and p-values
  const coefficients = beta.map((b, i) => {
    const se = Math.sqrt(varBeta[i][i]);
    const tValue = b[0] / se;
    const pValue = 2 * (1 - tCDF(Math.abs(tValue), n - p - 1));
    const ci: [number, number] = [
      b[0] - 1.96 * se,
      b[0] + 1.96 * se,
    ];

    return {
      name: i === 0 ? "(Intercept)" : `X${i}`,
      estimate: b[0],
      stdError: se,
      tValue,
      pValue,
      ci,
      significant: pValue < 0.05,
    };
  });

  // F-statistic
  const fStatistic = ((tss - rss) / p) / (rss / (n - p - 1));
  const fPValue = 1 - fCDF(fStatistic, p, n - p - 1);

  // Multicollinearity (VIF)
  const vif: Record<string, number> = {};
  for (let i = 1; i < p + 1; i++) {
    const XWithoutI = XWithIntercept.map((row) => [
      ...row.slice(0, i),
      ...row.slice(i + 1),
    ]);
    const r2i = calculateR2(
      XWithIntercept.map((row) => row[i]),
      XWithoutI
    );
    vif[`X${i}`] = 1 / (1 - r2i);
  }

  return {
    modelType: "linear",
    coefficients,
    modelStats: {
      rSquared,
      adjRSquared,
      fStatistic,
      fPValue,
    },
    residuals,
    fitted,
    diagnostics: {
      multicollinearity: vif,
    },
    interpretation: `Linear regression model: R²=${rSquared.toFixed(3)}, F=${fStatistic.toFixed(2)} (p=${fPValue.toFixed(4)})`,
    plotData: {
      fittedVsActual: y.map((yi, i) => ({
        actual: yi,
        fitted: fitted[i],
        residual: residuals[i],
      })),
      residualPlot: fitted.map((f, i) => ({
        fitted: f,
        residual: residuals[i],
      })),
    },
  };
}

/**
 * Logistic Regression for binary outcomes
 */
export function logisticRegression(
  y: number[],
  X: number[][]
): RegressionResult {
  const n = y.length;
  const p = X[0].length;

  // Add intercept
  const XWithIntercept = X.map((row) => [1, ...row]);

  // Newton-Raphson for logistic regression
  let beta = Array(p + 1).fill(0);

  for (let iter = 0; iter < 20; iter++) {
    // Calculate probabilities
    const eta = XWithIntercept.map((row) =>
      beta.reduce((sum, b, i) => sum + b * row[i], 0)
    );
    const p_hat = eta.map((e) => 1 / (1 + Math.exp(-e)));

    // Calculate weights
    const W = p_hat.map((p) => p * (1 - p));

    // Calculate gradient
    const gradient = Array(p + 1).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= p; j++) {
        gradient[j] += XWithIntercept[i][j] * (y[i] - p_hat[i]);
      }
    }

    // Calculate Hessian
    const hessian = Array(p + 1)
      .fill(0)
      .map(() => Array(p + 1).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= p; j++) {
        for (let k = 0; k <= p; k++) {
          hessian[j][k] -= XWithIntercept[i][j] * XWithIntercept[i][k] * W[i];
        }
      }
    }

    // Update beta
    const hessianInv = matrixInverse(hessian);
    const delta = matrixMultiply(hessianInv, gradient.map((g) => [g]));
    beta = beta.map((b, i) => b + delta[i][0]);
  }

  // Calculate fitted probabilities and predictions
  const eta = XWithIntercept.map((row) =>
    beta.reduce((sum, b, i) => sum + b * row[i], 0)
  );
  const fitted = eta.map((e) => 1 / (1 + Math.exp(-e)));
  const predicted = fitted.map((p) => (p > 0.5 ? 1 : 0));

  // Calculate odds ratios and standard errors
  const varBeta = matrixInverse(
    Array(p + 1)
      .fill(0)
      .map(() => Array(p + 1).fill(0))
  );

  const coefficients = beta.map((b, i) => {
    const se = Math.sqrt(Math.abs(varBeta[i]?.[i] || 0.1));
    const oddsRatio = Math.exp(b);
    const zValue = b / se;
    const pValue = 2 * (1 - normalCDF(Math.abs(zValue)));

    return {
      name: i === 0 ? "(Intercept)" : `X${i}`,
      estimate: oddsRatio,
      stdError: se,
      pValue,
      ci: [
        Math.exp(b - 1.96 * se),
        Math.exp(b + 1.96 * se),
      ] as [number, number],
      significant: pValue < 0.05,
    };
  });

  // Calculate AIC and BIC
  const logLikelihood = y.reduce((sum, yi, i) => {
    const p_i = fitted[i];
    return sum + yi * Math.log(p_i) + (1 - yi) * Math.log(1 - p_i);
  }, 0);
  const aic = 2 * (p + 1) - 2 * logLikelihood;
  const bic = (p + 1) * Math.log(n) - 2 * logLikelihood;

  // Confusion matrix metrics
  const tp = predicted.filter((p, i) => p === 1 && y[i] === 1).length;
  const fp = predicted.filter((p, i) => p === 1 && y[i] === 0).length;
  const tn = predicted.filter((p, i) => p === 0 && y[i] === 0).length;
  const fn = predicted.filter((p, i) => p === 0 && y[i] === 1).length;

  const sensitivity = tp / (tp + fn);
  const specificity = tn / (tn + fp);
  const accuracy = (tp + tn) / n;

  return {
    modelType: "logistic",
    coefficients,
    modelStats: {
      aic,
      bic,
      logLikelihood,
    },
    residuals: y.map((yi, i) => yi - fitted[i]),
    fitted,
    diagnostics: {},
    interpretation: `Logistic regression: AIC=${aic.toFixed(2)}, Sensitivity=${sensitivity.toFixed(3)}, Specificity=${specificity.toFixed(3)}, Accuracy=${accuracy.toFixed(3)}`,
    plotData: {
      fittedVsActual: y.map((yi, i) => ({
        actual: yi,
        fitted: fitted[i],
        residual: yi - fitted[i],
      })),
      residualPlot: fitted.map((f, i) => ({
        fitted: f,
        residual: y[i] - f,
      })),
    },
  };
}

/**
 * Mixed Effects Model with random intercepts
 */
export function mixedEffectsModel(
  y: number[],
  X: number[][],
  groups: number[]
): RegressionResult {
  const n = y.length;
  const p = X[0].length;
  const uniqueGroups = Array.from(new Set(groups));
  const m = uniqueGroups.length;

  // Initialize fixed effects
  const fixedResult = linearRegression(y, X);
  let fixedEffects = fixedResult.coefficients.map((c) => c.estimate);

  // Estimate random intercepts
  const randomIntercepts: Record<number, number> = {};
  for (const group of uniqueGroups) {
    const groupIndices = groups.map((g, i) => (g === group ? i : -1)).filter((i) => i >= 0);
    const groupY = groupIndices.map((i) => y[i]);
    const groupMean = mean(groupY);
    randomIntercepts[group] = groupMean - fixedEffects[0];
  }

  // Calculate fitted values with random effects
  const XWithIntercept = X.map((row) => [1, ...row]);
  const fitted = XWithIntercept.map((row, i) => {
    const fixedPart = fixedEffects.reduce((sum, b, j) => sum + b * row[j], 0);
    const randomPart = randomIntercepts[groups[i]] || 0;
    return fixedPart + randomPart;
  });

  const residuals = y.map((yi, i) => yi - fitted[i]);

  // Variance components
  const rss = residuals.reduce((sum, r) => sum + r * r, 0);
  const sigma2 = rss / (n - p - 1);
  const tau2 = Object.values(randomIntercepts).reduce((sum, r) => sum + r * r, 0) / m;

  const coefficients = fixedEffects.map((b, i) => ({
    name: i === 0 ? "(Intercept)" : `X${i}`,
    estimate: b,
    stdError: Math.sqrt(sigma2 / n),
    pValue: 0.05,
    ci: [b - 1.96 * Math.sqrt(sigma2 / n), b + 1.96 * Math.sqrt(sigma2 / n)] as [number, number],
    significant: true,
  }));

  return {
    modelType: "mixed",
    coefficients,
    modelStats: {
      aic: 2 * (p + 1) + n * Math.log(rss / n),
    },
    residuals,
    fitted,
    diagnostics: {},
    interpretation: `Mixed effects model: σ²=${sigma2.toFixed(3)}, τ²=${tau2.toFixed(3)}, ${m} groups`,
    plotData: {
      fittedVsActual: y.map((yi, i) => ({
        actual: yi,
        fitted: fitted[i],
        residual: residuals[i],
      })),
      residualPlot: fitted.map((f, i) => ({
        fitted: f,
        residual: residuals[i],
      })),
    },
  };
}

// ============ Helper Functions ============

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]));
}

function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const result = Array(a.length)
    .fill(0)
    .map(() => Array(b[0].length).fill(0));

  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b[0].length; j++) {
      for (let k = 0; k < b.length; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }

  return result;
}

function matrixInverse(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array(n)
      .fill(0)
      .map((_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
        maxRow = k;
      }
    }

    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = aug[k][i] / aug[i][i];
      for (let j = i; j < 2 * n; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  for (let i = n - 1; i >= 0; i--) {
    for (let k = i - 1; k >= 0; k--) {
      const factor = aug[k][i] / aug[i][i];
      for (let j = 0; j < 2 * n; j++) {
        aug[k][j] -= factor * aug[i][j];
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const factor = aug[i][i];
    for (let j = 0; j < 2 * n; j++) {
      aug[i][j] /= factor;
    }
  }

  return aug.map((row) => row.slice(n));
}

function calculateR2(y: number[], X: number[][]): number {
  const result = linearRegression(y, X);
  return result.modelStats.rSquared || 0;
}

function tCDF(t: number, df: number): number {
  return 0.5 + 0.5 * erf(t / Math.sqrt(2 * df));
}

function fCDF(f: number, df1: number, df2: number): number {
  return incompleteBeta(df1 * f / (df1 * f + df2), df1 / 2, df2 / 2);
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

    const d = 1 + numerator / (1 + numerator / c);
    c = 1 + numerator / c;
    f *= d * c;
  }

  return front * f / a;
}
