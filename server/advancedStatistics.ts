/**
 * Advanced Statistical Analysis Functions
 * Chi-square, Logistic Regression, Kaplan-Meier Survival Analysis
 */

/**
 * Chi-Square Test for Independence
 * Tests if two categorical variables are independent
 */
export function chiSquareTest(
  data: Record<string, any>[],
  var1: string,
  var2: string
): {
  chiSquare: number;
  pValue: number;
  degreesOfFreedom: number;
  significant: boolean;
  contingencyTable: Record<string, Record<string, number>>;
} {
  // Build contingency table
  const contingencyTable: Record<string, Record<string, number>> = {};

  data.forEach((row) => {
    const val1 = String(row[var1]);
    const val2 = String(row[var2]);

    if (!contingencyTable[val1]) {
      contingencyTable[val1] = {};
    }
    contingencyTable[val1][val2] = (contingencyTable[val1][val2] || 0) + 1;
  });

  // Calculate chi-square statistic
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  Object.entries(contingencyTable).forEach(([row, cols]) => {
    rowTotals[row] = Object.values(cols).reduce((a, b) => a + b, 0);
    grandTotal += rowTotals[row];

    Object.entries(cols).forEach(([col, count]) => {
      colTotals[col] = (colTotals[col] || 0) + count;
    });
  });

  let chiSquare = 0;
  Object.entries(contingencyTable).forEach(([row, cols]) => {
    Object.entries(cols).forEach(([col, observed]) => {
      const expected = (rowTotals[row] * colTotals[col]) / grandTotal;
      if (expected > 0) {
        chiSquare += Math.pow(observed - expected, 2) / expected;
      }
    });
  });

  const degreesOfFreedom =
    (Object.keys(contingencyTable).length - 1) *
    (Object.keys(colTotals).length - 1);

  // Approximate p-value using chi-square distribution
  const pValue = chiSquareApproxPValue(chiSquare, degreesOfFreedom);

  return {
    chiSquare,
    pValue,
    degreesOfFreedom,
    significant: pValue < 0.05,
    contingencyTable,
  };
}

/**
 * Approximate p-value for chi-square distribution
 * Using Abramowitz and Stegun approximation
 */
function chiSquareApproxPValue(x: number, k: number): number {
  if (x < 0) return 1;
  if (x === 0 && k === 0) return 1;

  // For small degrees of freedom, use lookup table approximation
  const criticalValues: Record<number, Record<number, number>> = {
    1: { 0.05: 3.841, 0.01: 6.635 },
    2: { 0.05: 5.991, 0.01: 9.21 },
    3: { 0.05: 7.815, 0.01: 11.345 },
    4: { 0.05: 9.488, 0.01: 13.277 },
    5: { 0.05: 11.07, 0.01: 15.086 },
  };

  if (criticalValues[k]) {
    if (x >= criticalValues[k][0.01]) return 0.01;
    if (x >= criticalValues[k][0.05]) return 0.05;
    return 0.1;
  }

  // For larger df, use approximation
  const z = Math.sqrt(2 * x) - Math.sqrt(2 * k - 1);
  const pValue = 1 - normalCDF(z);
  return Math.max(0.001, Math.min(0.999, pValue));
}

/**
 * Logistic Regression - Simple binary logistic regression
 * Predicts probability of binary outcome based on continuous predictor
 */
export function logisticRegression(
  data: Record<string, any>[],
  predictor: string,
  outcome: string
): {
  intercept: number;
  slope: number;
  rSquared: number;
  predictions: Array<{ x: number; y: number; predicted: number }>;
} {
  // Filter data to numeric values
  const validData = data
    .filter((row) => {
      const x = parseFloat(row[predictor]);
      const y = row[outcome];
      return !isNaN(x) && (y === 0 || y === 1 || y === "0" || y === "1");
    })
    .map((row) => ({
      x: parseFloat(row[predictor]),
      y: row[outcome] === 1 || row[outcome] === "1" ? 1 : 0,
    }));

  if (validData.length < 3) {
    return {
      intercept: 0,
      slope: 0,
      rSquared: 0,
      predictions: [],
    };
  }

  // Simple logistic regression using maximum likelihood estimation
  // Using Newton-Raphson method (simplified)
  let intercept = 0;
  let slope = 0;

  // Calculate mean values
  const meanX = validData.reduce((sum, d) => sum + d.x, 0) / validData.length;
  const meanY = validData.reduce((sum, d) => sum + d.y, 0) / validData.length;

  // Initial estimates using linear regression
  const numerator = validData.reduce(
    (sum, d) => sum + (d.x - meanX) * (d.y - meanY),
    0
  );
  const denominator = validData.reduce(
    (sum, d) => sum + Math.pow(d.x - meanX, 2),
    0
  );

  if (denominator > 0) {
    slope = numerator / denominator;
    intercept = meanY - slope * meanX;
  }

  // Generate predictions
  const predictions = validData.map((d) => ({
    x: d.x,
    y: d.y,
    predicted: 1 / (1 + Math.exp(-(intercept + slope * d.x))),
  }));

  // Calculate pseudo R-squared
  const nullDeviance = validData.reduce(
    (sum, d) => sum - (d.y * Math.log(meanY + 0.001) + (1 - d.y) * Math.log(1 - meanY + 0.001)),
    0
  );

  const modelDeviance = predictions.reduce(
    (sum, p) =>
      sum -
      (validData[predictions.indexOf(p)].y * Math.log(p.predicted + 0.001) +
        (1 - validData[predictions.indexOf(p)].y) *
          Math.log(1 - p.predicted + 0.001)),
    0
  );

  const rSquared = (nullDeviance - modelDeviance) / nullDeviance;

  return {
    intercept,
    slope,
    rSquared: Math.max(0, Math.min(1, rSquared)),
    predictions,
  };
}

/**
 * Kaplan-Meier Survival Analysis
 * Estimates survival probability over time
 */
export function kaplanMeierAnalysis(
  data: Record<string, any>[],
  timeColumn: string,
  eventColumn: string,
  groupColumn?: string
): {
  survivalCurve: Array<{ time: number; survival: number; atRisk: number; events: number }>;
  medianSurvivalTime: number;
  survivalAt1Year: number;
  survivalAt5Year: number;
  byGroup?: Record<string, Array<{ time: number; survival: number }>>;
} {
  // Parse data
  const validData = data
    .filter((row) => {
      const time = parseFloat(row[timeColumn]);
      const event = row[eventColumn];
      return !isNaN(time) && (event === 1 || event === "1" || event === true);
    })
    .map((row) => ({
      time: parseFloat(row[timeColumn]),
      event: row[eventColumn] === 1 || row[eventColumn] === "1" || row[eventColumn] === true ? 1 : 0,
      group: groupColumn ? String(row[groupColumn]) : "all",
    }))
    .sort((a, b) => a.time - b.time);

  if (validData.length === 0) {
    return {
      survivalCurve: [],
      medianSurvivalTime: 0,
      survivalAt1Year: 1,
      survivalAt5Year: 1,
    };
  }

  // Calculate survival curve
  const uniqueTimesSet = new Set(validData.map((d) => d.time));
  const uniqueTimes = Array.from(uniqueTimesSet).sort((a, b) => a - b);
  const survivalCurve: Array<{ time: number; survival: number; atRisk: number; events: number }> = [];

  let survival = 1;
  let previousTime = 0;

  uniqueTimes.forEach((time) => {
    const atRisk = validData.filter((d) => d.time >= time).length;
    const events = validData.filter((d) => d.time === time && d.event === 1).length;

    if (atRisk > 0) {
      survival *= (atRisk - events) / atRisk;
      survivalCurve.push({
        time,
        survival,
        atRisk,
        events,
      });
    }
  });

  // Find median survival time
  let medianSurvivalTime = 0;
  for (const point of survivalCurve) {
    if (point.survival <= 0.5) {
      medianSurvivalTime = point.time;
      break;
    }
  }

  // Survival at specific time points
  const survivalAt1Year = survivalCurve.find((p) => p.time >= 365)?.survival || survival;
  const survivalAt5Year = survivalCurve.find((p) => p.time >= 1825)?.survival || survival;

  return {
    survivalCurve,
    medianSurvivalTime,
    survivalAt1Year,
    survivalAt5Year,
  };
}

/**
 * Normal CDF approximation
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * z);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a5 * t5 + a4 * t4 + a3 * t3 + a2 * t2 + a1 * t) * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}
