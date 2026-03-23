/**
 * computeErrorBars.ts — Server-side error bar computation from raw uploaded data.
 *
 * Removes the dependency on the AI returning error_y values. The application
 * computes SD, SEM, and 95% CI directly from the raw data using proper
 * statistical formulas (Bessel's correction, t-distribution).
 */

// ── T-critical value lookup (alpha/2 = 0.025, two-tailed 95% CI) ─────────
const T_TABLE: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
  16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  25: 2.060, 30: 2.042, 40: 2.021, 50: 2.009, 60: 2.000,
  80: 1.990, 100: 1.984, 120: 1.980,
};

function tCritical025(df: number): number {
  if (df <= 0) return 1.96;
  if (T_TABLE[df]) return T_TABLE[df];
  const keys = Object.keys(T_TABLE).map(Number).sort((a, b) => a - b);
  if (df > keys[keys.length - 1]) return 1.96;
  const upper = keys.find(k => k >= df) ?? keys[keys.length - 1];
  const lower = [...keys].reverse().find(k => k <= df) ?? keys[0];
  if (lower === upper) return T_TABLE[lower];
  const frac = (df - lower) / (upper - lower);
  return T_TABLE[lower] + frac * (T_TABLE[upper] - T_TABLE[lower]);
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ErrorType = 'sd' | 'se' | 'ci95';

export interface ErrorBarResult {
  groups: string[];
  columns: string[];
  means: number[][];
  errors: {
    sd: number[][];
    se: number[][];
    ci95: number[][];
  };
  n: number[][];
}

export interface ErrorBarInput {
  rawData: Record<string, unknown>[];
  valueColumns: string[];
  groupColumn: string;
  errorType?: ErrorType;
}

// ── Core computation ──────────────────────────────────────────────────────

export function computeErrorBars(input: ErrorBarInput): ErrorBarResult {
  const { rawData, valueColumns, groupColumn, errorType = 'sd' } = input;

  // Extract unique groups in order of appearance
  const groupSet = new Set<string>();
  for (const row of rawData) {
    const g = String(row[groupColumn] ?? '').trim();
    if (g) groupSet.add(g);
  }
  const groups = Array.from(groupSet);

  // For each group × column, collect numeric values
  const means: number[][] = [];
  const sdArr: number[][] = [];
  const seArr: number[][] = [];
  const ci95Arr: number[][] = [];
  const nArr: number[][] = [];

  for (const group of groups) {
    const groupRows = rawData.filter(
      row => String(row[groupColumn] ?? '').trim() === group
    );

    const rowMeans: number[] = [];
    const rowSd: number[] = [];
    const rowSe: number[] = [];
    const rowCi95: number[] = [];
    const rowN: number[] = [];

    for (const col of valueColumns) {
      const values = groupRows
        .map(row => {
          const v = row[col];
          if (typeof v === 'number' && !isNaN(v)) return v;
          if (typeof v === 'string') {
            const n = Number(v);
            if (!isNaN(n)) return n;
          }
          return null;
        })
        .filter((v): v is number => v !== null);

      const n = values.length;
      rowN.push(n);

      if (n === 0) {
        rowMeans.push(0);
        rowSd.push(0);
        rowSe.push(0);
        rowCi95.push(0);
        continue;
      }

      const mean = values.reduce((a, b) => a + b, 0) / n;
      rowMeans.push(parseFloat(mean.toFixed(4)));

      if (n < 2) {
        rowSd.push(0);
        rowSe.push(0);
        rowCi95.push(0);
        continue;
      }

      // Bessel's correction (ddof=1)
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
      const sd = Math.sqrt(variance);
      const se = sd / Math.sqrt(n);
      const tCrit = tCritical025(n - 1);
      const ci95 = tCrit * se;

      rowSd.push(parseFloat(sd.toFixed(4)));
      rowSe.push(parseFloat(se.toFixed(4)));
      rowCi95.push(parseFloat(ci95.toFixed(4)));
    }

    means.push(rowMeans);
    sdArr.push(rowSd);
    seArr.push(rowSe);
    ci95Arr.push(rowCi95);
    nArr.push(rowN);
  }

  return {
    groups,
    columns: valueColumns,
    means,
    errors: {
      sd: sdArr,
      se: seArr,
      ci95: ci95Arr,
    },
    n: nArr,
  };
}

/**
 * Simplified helper: compute error bars for a flat group → values mapping.
 * Used when the chart already has labels and we just need error values per label.
 */
export function computeErrorArrayForLabels(
  rawData: Record<string, unknown>[],
  allColumns: string[],
  xLabels: string[],
  seriesLabel: string,
  errorType: ErrorType = 'sd',
): number[] | null {
  if (!rawData || rawData.length === 0 || xLabels.length === 0) return null;

  // Find value column matching series label
  const valueCol = allColumns.find(c => {
    const cl = c.toLowerCase().replace(/[_\s]/g, '');
    const sl = seriesLabel.toLowerCase().replace(/[_\s]/g, '');
    return cl === sl;
  });

  // Find group column whose unique values match xLabels
  let groupCol: string | null = null;
  for (const col of allColumns) {
    const uniq = Array.from(new Set(
      rawData.map(r => String(r[col] ?? '').trim())
    )).filter(Boolean);
    const labelLower = xLabels.map(l => String(l).trim().toLowerCase());
    const matchCount = uniq.filter(v => labelLower.includes(v.toLowerCase())).length;
    if (matchCount >= Math.min(xLabels.length, uniq.length) * 0.7 && matchCount >= 2) {
      groupCol = col;
      break;
    }
  }

  if (!groupCol) {
    // Fallback: first categorical column
    for (const col of allColumns) {
      const vals = rawData.map(r => r[col]);
      const numericRatio = vals.filter(v =>
        typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)))
      ).length / vals.length;
      if (numericRatio < 0.5) {
        const uniq = Array.from(new Set(vals.map(v => String(v ?? ''))));
        if (uniq.length >= 2 && uniq.length <= 50) {
          groupCol = col;
          break;
        }
      }
    }
  }

  if (!groupCol) return null;

  const effectiveValueCol = valueCol ?? allColumns.find(c => {
    if (c === groupCol) return false;
    const numCount = rawData.filter(r =>
      typeof r[c] === 'number' || (typeof r[c] === 'string' && !isNaN(Number(r[c])))
    ).length;
    return numCount > rawData.length * 0.5;
  });

  if (!effectiveValueCol) return null;

  // Group raw data
  const groups: Record<string, number[]> = {};
  for (const row of rawData) {
    const key = String(row[groupCol] ?? '').trim();
    const val = Number(row[effectiveValueCol]);
    if (key && !isNaN(val)) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(val);
    }
  }

  if (Object.keys(groups).length === 0) return null;

  // Build error array matching xLabels order
  const errorArray = xLabels.map(label => {
    const labelKey = String(label).trim();
    const values = groups[labelKey]
      ?? Object.entries(groups).find(([k]) => k.toLowerCase() === labelKey.toLowerCase())?.[1]
      ?? [];

    if (values.length < 2) return 0;

    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const sd = Math.sqrt(variance);
    const se = sd / Math.sqrt(n);

    switch (errorType) {
      case 'se': return parseFloat(se.toFixed(4));
      case 'ci95': return parseFloat((tCritical025(n - 1) * se).toFixed(4));
      case 'sd':
      default: return parseFloat(sd.toFixed(4));
    }
  });

  if (errorArray.every(v => v === 0)) return null;
  return errorArray;
}
