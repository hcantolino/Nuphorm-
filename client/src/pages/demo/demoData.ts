/**
 * Seeded PRNG + realistic clinical trial data generation for the demo page.
 * No external deps beyond mathjs for the Box-Muller normal distribution.
 */

// ── Seeded PRNG ──────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(12345);

/** Box-Muller normal variate using our seeded PRNG */
function normalRandom(mean: number, sd: number): number {
  let u1 = rand();
  let u2 = rand();
  while (u1 === 0) u1 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── DESCRIPTIVE: 150-patient dataset ─────────────────────────────────
export interface PatientRow {
  id: number;
  age: number;
  weight: number;
  bmi: number;
  sbp: number;
  hr: number;
  group: "Treatment" | "Placebo";
}

export const PATIENT_DATA: PatientRow[] = (() => {
  const rows: PatientRow[] = [];
  for (let i = 0; i < 150; i++) {
    const group = i < 75 ? "Treatment" as const : "Placebo" as const;
    rows.push({
      id: i + 1,
      age: Math.round(clamp(normalRandom(54.3, 12.1), 22, 81)),
      weight: +clamp(normalRandom(78.2, 15.4), 45, 118.5).toFixed(1),
      bmi: +clamp(normalRandom(26.1, 4.2), 17.8, 39.4).toFixed(1),
      sbp: Math.round(clamp(normalRandom(132.7, 16.9), 98, 178)),
      hr: Math.round(clamp(normalRandom(72.4, 11.3), 48, 102)),
      group,
    });
  }
  return rows;
})();

export const DESCRIPTIVE_VARS = ["age", "weight", "bmi", "sbp", "hr"] as const;
export const VAR_LABELS: Record<string, string> = {
  age: "Age (years)",
  weight: "Weight (kg)",
  bmi: "BMI (kg/m²)",
  sbp: "SBP (mmHg)",
  hr: "Heart Rate (bpm)",
};

export function computeStats(values: number[]) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  return {
    n,
    mean: +mean.toFixed(1),
    sd: +sd.toFixed(1),
    min: sorted[0],
    max: sorted[n - 1],
    q1: sorted[Math.floor(n * 0.25)],
    median: sorted[Math.floor(n * 0.5)],
    q3: sorted[Math.floor(n * 0.75)],
  };
}

// ── SURVIVAL: KM curve data ─────────────────────────────────────────
export interface KMPoint {
  time: number;
  survival: number;
  ciLower: number;
  ciUpper: number;
  nRisk: number;
  censored: boolean;
}

function generateKMCurve(
  medianSurvival: number,
  n0: number,
  seed: number,
): KMPoint[] {
  const r = mulberry32(seed);
  const points: KMPoint[] = [];
  let nRisk = n0;
  let surv = 1.0;
  const lambda = Math.log(2) / medianSurvival;

  for (let t = 0; t <= 24; t += 1) {
    const hazard = lambda * (1 + 0.15 * (r() - 0.5));
    const events = t === 0 ? 0 : Math.round(nRisk * (1 - Math.exp(-hazard)));
    const censored = t > 0 && r() > 0.7;
    const censorN = censored ? Math.max(1, Math.round(r() * 2)) : 0;

    if (t > 0) surv *= (nRisk - events) / nRisk;
    surv = Math.max(0, surv);

    const se = surv * Math.sqrt((1 - surv) / Math.max(1, nRisk));
    points.push({
      time: t,
      survival: +surv.toFixed(4),
      ciLower: +Math.max(0, surv - 1.96 * se).toFixed(4),
      ciUpper: +Math.min(1, surv + 1.96 * se).toFixed(4),
      nRisk,
      censored: censored && t > 0,
    });

    nRisk = Math.max(0, nRisk - events - censorN);
  }
  return points;
}

export const KM_TREATMENT = generateKMCurve(18.2, 75, 111);
export const KM_PLACEBO = generateKMCurve(12.7, 75, 222);

// ── EFFICACY: multi-endpoint data ───────────────────────────────────
export interface EfficacyEndpoint {
  name: string;
  treatment: number;
  treatmentCI: [number, number];
  placebo: number;
  placeboCI: [number, number];
  pValue: string;
  or: number;
  orCI: [number, number];
}

export const EFFICACY_ENDPOINTS: EfficacyEndpoint[] = [
  {
    name: "Overall Response",
    treatment: 68.0, treatmentCI: [56.2, 78.3],
    placebo: 42.7, placeboCI: [31.3, 54.6],
    pValue: "< 0.001", or: 2.86, orCI: [1.48, 5.52],
  },
  {
    name: "Complete Response",
    treatment: 32.0, treatmentCI: [21.7, 43.8],
    placebo: 14.7, placeboCI: [7.6, 24.7],
    pValue: "0.013", or: 2.73, orCI: [1.21, 6.16],
  },
  {
    name: "Duration of Response",
    treatment: 8.4, treatmentCI: [6.9, 10.2],
    placebo: 5.1, placeboCI: [3.8, 6.7],
    pValue: "0.002", or: 1.91, orCI: [1.12, 3.25],
  },
  {
    name: "Time to Response",
    treatment: 2.1, treatmentCI: [1.6, 2.8],
    placebo: 3.4, placeboCI: [2.5, 4.6],
    pValue: "0.018", or: 0.62, orCI: [0.35, 1.08],
  },
];

// ── SAFETY: adverse events ──────────────────────────────────────────
export interface AdverseEvent {
  name: string;
  treatmentMild: number;
  treatmentModerate: number;
  treatmentSevere: number;
  placeboMild: number;
  placeboModerate: number;
  placeboSevere: number;
}

export const ADVERSE_EVENTS: AdverseEvent[] = [
  { name: "Nausea",            treatmentMild: 18, treatmentModerate: 8,  treatmentSevere: 2, placeboMild: 10, placeboModerate: 3, placeboSevere: 1 },
  { name: "Fatigue",           treatmentMild: 15, treatmentModerate: 10, treatmentSevere: 3, placeboMild: 12, placeboModerate: 5, placeboSevere: 1 },
  { name: "Headache",          treatmentMild: 14, treatmentModerate: 6,  treatmentSevere: 1, placeboMild: 11, placeboModerate: 4, placeboSevere: 1 },
  { name: "Diarrhea",          treatmentMild: 12, treatmentModerate: 7,  treatmentSevere: 2, placeboMild: 6,  placeboModerate: 2, placeboSevere: 0 },
  { name: "Neutropenia",       treatmentMild: 5,  treatmentModerate: 8,  treatmentSevere: 6, placeboMild: 2,  placeboModerate: 1, placeboSevere: 0 },
  { name: "Anemia",            treatmentMild: 8,  treatmentModerate: 6,  treatmentSevere: 3, placeboMild: 4,  placeboModerate: 2, placeboSevere: 1 },
  { name: "Rash",              treatmentMild: 10, treatmentModerate: 4,  treatmentSevere: 1, placeboMild: 5,  placeboModerate: 1, placeboSevere: 0 },
  { name: "Arthralgia",        treatmentMild: 9,  treatmentModerate: 5,  treatmentSevere: 1, placeboMild: 7,  placeboModerate: 3, placeboSevere: 0 },
  { name: "Elevated ALT",      treatmentMild: 6,  treatmentModerate: 4,  treatmentSevere: 2, placeboMild: 3,  placeboModerate: 1, placeboSevere: 0 },
  { name: "Peripheral Neuropathy", treatmentMild: 7, treatmentModerate: 5, treatmentSevere: 2, placeboMild: 2, placeboModerate: 1, placeboSevere: 0 },
  { name: "Vomiting",          treatmentMild: 8,  treatmentModerate: 4,  treatmentSevere: 1, placeboMild: 4,  placeboModerate: 2, placeboSevere: 0 },
  { name: "Decreased Appetite",treatmentMild: 11, treatmentModerate: 3,  treatmentSevere: 0, placeboMild: 6,  placeboModerate: 2, placeboSevere: 0 },
];

// ── PK/PD: concentration-time data ─────────────────────────────────
export interface PKTimePoint {
  time: number;
  mean: number;
  patients: number[];
}

export interface PKDoseGroup {
  dose: string;
  color: string;
  cmax: number;
  tmax: number;
  auc: number;
  halfLife: number;
  points: PKTimePoint[];
}

function generatePKCurve(
  dose: number,
  ka: number,
  ke: number,
  vd: number,
  seed: number,
  nPatients: number,
): PKTimePoint[] {
  const r = mulberry32(seed);
  const times = [0, 0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 36, 48];
  return times.map((t) => {
    const meanConc = t === 0 ? 0 : (dose * ka / (vd * (ka - ke))) * (Math.exp(-ke * t) - Math.exp(-ka * t));
    const patients: number[] = [];
    for (let i = 0; i < nPatients; i++) {
      const noise = 1 + 0.25 * (r() - 0.5) * 2;
      patients.push(+Math.max(0, meanConc * noise).toFixed(2));
    }
    return { time: t, mean: +Math.max(0, meanConc).toFixed(2), patients };
  });
}

export const PK_DOSE_GROUPS: PKDoseGroup[] = [
  { dose: "10 mg",  color: "#3b82f6", cmax: 42.3,  tmax: 1.5, auc: 312,  halfLife: 5.2, points: generatePKCurve(10,  1.5, 0.133, 0.15, 301, 8) },
  { dose: "25 mg",  color: "#8b5cf6", cmax: 105.8, tmax: 1.5, auc: 780,  halfLife: 5.4, points: generatePKCurve(25,  1.5, 0.128, 0.15, 302, 8) },
  { dose: "50 mg",  color: "#f59e0b", cmax: 211.5, tmax: 2.0, auc: 1560, halfLife: 5.3, points: generatePKCurve(50,  1.5, 0.131, 0.15, 303, 8) },
  { dose: "100 mg", color: "#ef4444", cmax: 423.1, tmax: 2.0, auc: 3120, halfLife: 5.5, points: generatePKCurve(100, 1.5, 0.126, 0.15, 304, 8) },
];

// ── SAMPLE SIZE: power calculation ──────────────────────────────────
/**
 * Two-sample z-test sample-size formula:
 *   n = ((z_α + z_β)² × 2σ²) / δ²
 * We parametrise via effect-size d = δ/σ so n = 2(z_α + z_β)² / d²
 */
export function zFromP(p: number): number {
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  const t = Math.sqrt(-2 * Math.log(p));
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) /
    (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
}

export function calcSampleSize(
  effectSize: number,
  alpha: number,
  power: number,
  allocRatio: number,
  dropoutRate: number,
): { perGroup: number; total: number } {
  const za = zFromP(alpha / 2); // two-sided
  const zb = zFromP(1 - power);
  const r = allocRatio;
  const n1 = Math.ceil(((za + zb) ** 2 * (1 + 1 / r)) / (effectSize ** 2));
  const n2 = Math.ceil(n1 * r);
  const adjustedN1 = Math.ceil(n1 / (1 - dropoutRate));
  const adjustedN2 = Math.ceil(n2 / (1 - dropoutRate));
  return { perGroup: adjustedN1, total: adjustedN1 + adjustedN2 };
}

export function powerCurveData(
  effectSize: number,
  alpha: number,
  power: number,
  allocRatio: number,
  dropoutRate: number,
): { n: number; pwr: number }[] {
  const za = zFromP(alpha / 2);
  const r = allocRatio;
  const pts: { n: number; pwr: number }[] = [];
  for (let n = 5; n <= 500; n += 5) {
    const se = Math.sqrt((1 + 1 / r) / n);
    const zBeta = effectSize / se - za;
    // Φ(zBeta) approximation
    const pwr = 1 / (1 + Math.exp(-1.7 * zBeta - 0.73 * zBeta * zBeta * zBeta * 0.001));
    pts.push({ n, pwr: Math.min(1, Math.max(0, pwr)) });
  }
  void power; void dropoutRate; // used only for the target point
  return pts;
}
