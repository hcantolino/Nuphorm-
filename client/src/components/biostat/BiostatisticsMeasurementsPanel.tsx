import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Calculator,
  Code2,
  Wand2,
  ShieldCheck,
  BarChart2,
  Sparkles,
  Download,
  FlaskConical,
  TrendingUp,
  HeartPulse,
  Pill,
  Scale,
  Sigma,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMeasurementTriggerStore } from '@/stores/measurementTriggerStore';
import { useCurrentDatasetStore } from '@/stores/currentDatasetStore';
import { useTabStore } from '@/stores/tabStore';
import { AIBiostatisticsChatTabIntegrated } from './AIBiostatisticsChatTabIntegrated';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface Measurement {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface BiostatisticsMeasurementsPanelProps {
  onSelectMeasurement?: (measurementId: string) => void;
  onRemoveMeasurement?: (measurementId: string) => void;
}

// ── Category definitions ───────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'clean',        label: 'Clean',        icon: Wand2        },
  { id: 'descriptive',  label: 'Descriptive',  icon: Sigma        },
  { id: 'efficacy',     label: 'Efficacy',     icon: TrendingUp   },
  { id: 'survival',     label: 'Survival',     icon: HeartPulse   },
  { id: 'safety',       label: 'Safety',       icon: ShieldCheck  },
  { id: 'pkpd',         label: 'PK/PD',        icon: Pill         },
  { id: 'bioequiv',     label: 'Bioequiv.',    icon: Scale        },
  { id: 'inferential',  label: 'Inferential',  icon: FlaskConical },
  { id: 'samplesize',   label: 'Sample Size',  icon: Calculator   },
  { id: 'script',       label: 'Script',       icon: Code2        },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

// ── Measurements data ──────────────────────────────────────────────────────

const MEASUREMENTS: Measurement[] = [
  // Descriptive
  { id: 'mean',         name: 'Mean',                      category: 'descriptive',  description: 'Average value of continuous variables' },
  { id: 'median',       name: 'Median',                    category: 'descriptive',  description: 'Middle value of continuous variables' },
  { id: 'mode',         name: 'Mode',                      category: 'descriptive',  description: 'Most frequently occurring value' },
  { id: 'std_dev',      name: 'Std. Deviation',            category: 'descriptive',  description: 'Measure of data spread' },
  { id: 'variance',     name: 'Variance',                  category: 'descriptive',  description: 'Squared standard deviation' },
  { id: 'range',        name: 'Range',                     category: 'descriptive',  description: 'Difference between max and min values' },
  { id: 'iqr',          name: 'IQR',                       category: 'descriptive',  description: 'Range of middle 50% of data' },
  { id: 'min_max',      name: 'Min / Max',                 category: 'descriptive',  description: 'Minimum and maximum values' },
  { id: 'freq',         name: 'Frequencies & %',           category: 'descriptive',  description: 'Count and proportion of categorical variables' },
  { id: 'patient_disp', name: 'Patient Disposition',       category: 'descriptive',  description: 'Enrollment, randomization, completion rates' },
  { id: 'exposure',     name: 'Exposure Summaries',        category: 'descriptive',  description: 'Treatment duration and dose compliance' },
  // Efficacy
  { id: 't_test',       name: 'T-tests',                   category: 'efficacy',     description: 'Compare means between two groups' },
  { id: 'wilcoxon',     name: 'Wilcoxon / Mann-Whitney',   category: 'efficacy',     description: 'Non-parametric test for continuous data' },
  { id: 'chi_square',   name: 'Chi-Square',                category: 'efficacy',     description: 'Test for categorical associations' },
  { id: 'fisher_exact', name: "Fisher's Exact",            category: 'efficacy',     description: 'Exact test for categorical data' },
  { id: 'ancova',       name: 'ANCOVA',                    category: 'efficacy',     description: 'Covariance with adjusted means' },
  { id: 'anova',        name: 'ANOVA',                     category: 'efficacy',     description: 'Compare means across multiple groups' },
  { id: 'logistic_reg', name: 'Logistic Regression',       category: 'efficacy',     description: 'Odds ratios for binary outcomes' },
  { id: 'mmrm',         name: 'MMRM',                      category: 'efficacy',     description: 'Mixed Models for Repeated Measures' },
  { id: 'non_inf',      name: 'Non-Inferiority',           category: 'efficacy',     description: 'Test margins and confidence intervals' },
  { id: 'ci',           name: 'Confidence Intervals',      category: 'efficacy',     description: 'Range of plausible parameter values' },
  { id: 'p_value',      name: 'P-values',                  category: 'efficacy',     description: 'Statistical significance testing' },
  // Survival
  { id: 'km',           name: 'Kaplan-Meier',              category: 'survival',     description: 'Survival curves and median survival times' },
  { id: 'log_rank',     name: 'Log-Rank Test',             category: 'survival',     description: 'Compare survival distributions' },
  { id: 'cox',          name: 'Cox Regression',            category: 'survival',     description: 'Hazard ratios adjusted for covariates' },
  { id: 'pfs',          name: 'PFS',                       category: 'survival',     description: 'Progression-Free Survival' },
  { id: 'os',           name: 'Overall Survival',          category: 'survival',     description: 'Time to death from any cause' },
  { id: 'ttp',          name: 'Time to Progression',       category: 'survival',     description: 'Time until disease progression' },
  // Safety
  { id: 'ae_incidence', name: 'AE Incidence Tables',       category: 'safety',       description: 'AE counts by System Organ Class' },
  { id: 'sae',          name: 'SAEs',                      category: 'safety',       description: 'Serious adverse events and deaths' },
  { id: 'shift_tables', name: 'Shift Tables',              category: 'safety',       description: 'Lab values and vital signs changes' },
  { id: 'lab_summaries',name: 'Lab Summaries',             category: 'safety',       description: 'Means, changes from baseline, outliers' },
  { id: 'vital_signs',  name: 'Vital Signs',               category: 'safety',       description: 'Blood pressure, heart rate, temperature' },
  { id: 'ecg',          name: 'ECG Summaries',             category: 'safety',       description: 'Electrocardiogram findings' },
  // PK/PD
  { id: 'auc',          name: 'AUC',                       category: 'pkpd',         description: 'Area Under Curve — total drug exposure' },
  { id: 'cmax',         name: 'Cmax',                      category: 'pkpd',         description: 'Maximum drug concentration' },
  { id: 'tmax',         name: 'Tmax',                      category: 'pkpd',         description: 'Time to peak concentration' },
  { id: 't_half',       name: 'Half-life (t½)',            category: 'pkpd',         description: 'Time for concentration to halve' },
  { id: 'clearance',    name: 'Clearance',                 category: 'pkpd',         description: 'Rate of drug elimination' },
  { id: 'vd',           name: 'Volume of Distribution',   category: 'pkpd',         description: 'Theoretical distribution volume' },
  { id: 'pop_pk',       name: 'Population PK',            category: 'pkpd',         description: 'Non-linear mixed effects models' },
  { id: 'exp_resp',     name: 'Exposure-Response',        category: 'pkpd',         description: 'PK-efficacy/safety correlations' },
  { id: 'conc_time',    name: 'Conc-Time Profiles',       category: 'pkpd',         description: 'Drug concentration over time' },
  // Bioequivalence
  { id: 'be_ci',        name: '90% CI',                    category: 'bioequiv',     description: 'Geometric mean ratios for AUC/Cmax' },
  { id: 'avg_be',       name: 'Average BE',                category: 'bioequiv',     description: 'ANOVA on log-transformed data' },
  { id: 'ind_be',       name: 'Individual BE',             category: 'bioequiv',     description: 'Subject-by-formulation interactions' },
  { id: 'pop_be',       name: 'Population BE',             category: 'bioequiv',     description: 'Variability between formulations' },
  { id: 'biosim',       name: 'Biosimilarity',             category: 'bioequiv',     description: 'PK/PD similarity assessment' },
];

const BIOSTAT_API = '/api/v1';

// ── Clean Data actions ─────────────────────────────────────────────────────

const CLEAN_ACTIONS = [
  { id: 'clean',      label: 'Clean Dataset',        icon: Wand2,       command: (fn: string) => `Scan my dataset ${fn} for data quality issues — missing values, outliers, duplicates, and format inconsistencies — and ask me how to handle each issue before applying any changes.` },
  { id: 'cdisc',      label: 'Standardize to CDISC', icon: ShieldCheck, command: (fn: string) => `Standardize ${fn} to CDISC SDTM format. Map variables to domains and flag compliance gaps.` },
  { id: 'ae_summary', label: 'Run AE Summary',       icon: BarChart2,   command: (fn: string) => `Generate an Adverse Events incidence summary for ${fn}. Group by System Organ Class and preferred term.` },
  { id: 'km_plot',    label: 'Generate KM Plot',     icon: Sparkles,    command: (fn: string) => `Generate a Kaplan-Meier survival plot for ${fn}. Auto-detect the time and event columns.` },
  { id: 'export',     label: 'Export Cleaned',       icon: Download,    command: null as null },
] as const;

// ── Special panels ─────────────────────────────────────────────────────────

const INFERENTIAL_TESTS = [
  { value: 'independent_t',       label: 'Independent Samples t-Test' },
  { value: 'paired_t',            label: 'Paired Samples t-Test' },
  { value: 'one_sample_t',        label: 'One-Sample t-Test' },
  { value: 'one_way_anova',       label: 'One-Way ANOVA' },
  { value: 'wilcoxon',            label: 'Wilcoxon Signed-Rank' },
  { value: 'mann_whitney',        label: 'Mann-Whitney U' },
  { value: 'kruskal_wallis',      label: 'Kruskal-Wallis H' },
  { value: 'linear_regression',   label: 'Linear Regression' },
  { value: 'logistic_regression', label: 'Logistic Regression' },
  { value: 'mixed_effects',       label: 'Mixed-Effects (LMM)' },
];
const ONE_GROUP = new Set(['one_sample_t', 'wilcoxon', 'one_way_anova', 'kruskal_wallis']);

function InferentialPanel() {
  const [testType, setTestType] = useState('independent_t');
  const [alpha, setAlpha] = useState('0.05');
  const [alt, setAlt] = useState('two-sided');
  const [g1, setG1] = useState('');
  const [g2, setG2] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true); setError(''); setResult(null);
    try {
      const vals1 = g1.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      const vals2 = g2.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      const res = await fetch(`${BIOSTAT_API}/stats/inferential`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: testType, group1: vals1, group2: vals2, alpha: parseFloat(alpha), alternative: alt }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.detail ?? `HTTP ${res.status}`); }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setRunning(false); }
  };

  const fmt = (v: unknown) =>
    typeof v === 'number' ? v.toFixed(4) : typeof v === 'boolean' ? (v ? 'Yes ✓' : 'No') : String(v ?? '—');

  return (
    <div className="p-3 space-y-3">
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Statistical Test</label>
        <select value={testType} onChange={(e) => setTestType(e.target.value)} className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
          {INFERENTIAL_TESTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">
          {ONE_GROUP.has(testType) ? 'Values' : 'Group 1'}<span className="font-normal opacity-60 ml-1">(comma-separated)</span>
        </label>
        <textarea value={g1} onChange={(e) => setG1(e.target.value)} rows={2} placeholder="e.g. 12.3, 14.5, 11.2"
          className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
      </div>
      {!ONE_GROUP.has(testType) && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Group 2</label>
          <textarea value={g2} onChange={(e) => setG2(e.target.value)} rows={2} placeholder="e.g. 15.1, 17.3, 14.9"
            className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">α level</label>
          <select value={alpha} onChange={(e) => setAlpha(e.target.value)} className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none">
            <option value="0.01">0.01</option><option value="0.05">0.05</option><option value="0.10">0.10</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Alternative</label>
          <select value={alt} onChange={(e) => setAlt(e.target.value)} className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none">
            <option value="two-sided">Two-sided</option><option value="less">Less</option><option value="greater">Greater</option>
          </select>
        </div>
      </div>
      <button onClick={run} disabled={running || !g1.trim()}
        // BEFORE: bg-indigo-600 hover:bg-indigo-700
      // AFTER:  unified dark-navy
      className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
        {running && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{running ? 'Running…' : 'Run Analysis'}
      </button>
      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 font-mono">{error}</div>}
      {result && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">{String(result.test ?? 'Results')}</p>
            {typeof result.significant === 'boolean' && (
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', result.significant ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                {result.significant ? 'Significant' : 'Not significant'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {Object.entries(result).filter(([k]) => k !== 'test').map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.replace(/_/g, ' ')}</p>
                <p className={cn('text-xs font-semibold', k === 'p_value' && typeof v === 'number' && v < 0.05 ? 'text-emerald-700' : '')}>{fmt(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SS_TESTS = [
  { value: 't-test-one-sample',     label: 'One-Sample t-Test' },
  { value: 't-test-two-sample',     label: 'Two-Sample t-Test' },
  { value: 't-test-paired',         label: 'Paired t-Test' },
  { value: 'proportion-one-sample', label: 'One-Sample Proportion' },
  { value: 'proportion-two-sample', label: 'Two-Sample Proportion' },
  { value: 'anova-one-way',         label: 'One-Way ANOVA' },
];
const EFFECT_HINTS: Record<string, string> = {
  't-test-one-sample': "Cohen's d: small=0.2, medium=0.5, large=0.8",
  't-test-two-sample': "Cohen's d: small=0.2, medium=0.5, large=0.8",
  't-test-paired':     "Cohen's d for the paired difference",
  'proportion-one-sample': "Cohen's h: small=0.2, medium=0.5",
  'proportion-two-sample': "Cohen's h: small=0.2, medium=0.5",
  'anova-one-way':     "Cohen's f: small=0.10, medium=0.25, large=0.40",
};

function SampleSizePanel() {
  const [testType, setTestType] = useState('t-test-two-sample');
  const [effect, setEffect] = useState('0.5');
  const [alpha, setAlpha] = useState('0.05');
  const [power, setPower] = useState('0.80');
  const [ratio, setRatio] = useState('1');
  const [calc, setCalc] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const calculate = async () => {
    setCalc(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${BIOSTAT_API}/stats/sample-size`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: testType, effect_size: parseFloat(effect), alpha: parseFloat(alpha), power: parseFloat(power), ratio: parseFloat(ratio) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.detail ?? `HTTP ${res.status}`); }
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally { setCalc(false); }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2">
        <p className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold">Power Analysis Calculator</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Study Design</label>
        <select value={testType} onChange={(e) => setTestType(e.target.value)} className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
          {SS_TESTS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Effect Size</label>
        <input type="number" step="0.01" min="0.01" value={effect} onChange={(e) => setEffect(e.target.value)}
          className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary" />
        <p className="text-[10px] text-muted-foreground mt-0.5">{EFFECT_HINTS[testType]}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'α Level', value: alpha, set: setAlpha, opts: ['0.01','0.05','0.10'] },
          { label: 'Power',   value: power, set: setPower, opts: ['0.70','0.80','0.90','0.95'] },
        ].map(({ label, value, set, opts }) => (
          <div key={label} className={label === 'Power' ? 'col-span-1' : ''}>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">{label}</label>
            <select value={value} onChange={(e) => set(e.target.value)} className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none">
              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">n₂/n₁</label>
          <input type="number" step="0.1" min="0.1" value={ratio} onChange={(e) => setRatio(e.target.value)}
            className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none" />
        </div>
      </div>
      <button onClick={calculate} disabled={calc || !effect.trim()}
        // BEFORE: bg-violet-600 hover:bg-violet-700
        // AFTER:  unified dark-navy
        className="w-full py-2 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
        {calc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
        {calc ? 'Calculating…' : 'Calculate Sample Size'}
      </button>
      {error && <div className="text-xs text-red-600 bg-red-50 rounded p-2 font-mono">{error}</div>}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">{String(result.test ?? 'Results')}</p>
          {result.note != null && <p className="text-[10px] text-amber-600 bg-amber-50 rounded p-1.5">{String(result.note)}</p>}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(result).filter(([k]) => !['test','note'].includes(k)).map(([k, v]) => (
              <div key={k} className="bg-white dark:bg-emerald-900/30 rounded p-2 border border-emerald-100">
                <p className="text-[10px] text-emerald-600 uppercase tracking-wide">{k.replace(/_/g, ' ')}</p>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  {typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(3)) : String(v)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DEFAULT_SCRIPT = `# Custom analysis script
# Available: np, pd, math, json, scipy_stats
import numpy as np
values = [1, 2, 3, 4, 5, 6, 7, 8]
result = {
    "mean":   round(float(np.mean(values)), 4),
    "std":    round(float(np.std(values, ddof=1)), 4),
    "median": float(np.median(values)),
    "n":      len(values),
}
print(f"Mean: {result['mean']}, Std: {result['std']}")
`;

function CustomScriptPanel() {
  const [code, setCode] = useState(DEFAULT_SCRIPT);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [resultData, setResultData] = useState<unknown>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true); setError(''); setOutput(''); setResultData(null);
    try {
      const res = await fetch(`${BIOSTAT_API}/stats/script`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.detail ?? `HTTP ${res.status}`); }
      const data = await res.json(); setOutput(data.output ?? '');
      if (data.result != null) setResultData(data.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Execution failed');
    } finally { setRunning(false); }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2">
        <p className="text-[11px] text-slate-300 font-semibold">Python · NumPy · pandas · scipy</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Define a <code className="text-slate-300">result</code> variable to display it as a card.</p>
      </div>
      <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} rows={8}
        className="w-full text-xs font-mono rounded-md border border-slate-700 bg-slate-950 text-green-400 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-slate-500 leading-relaxed" />
      <button onClick={run} disabled={running || !code.trim()}
        className="w-full py-2 text-xs font-semibold bg-slate-700 text-white rounded-md hover:bg-slate-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Code2 className="w-3.5 h-3.5" />}
        {running ? 'Running…' : '▶  Run Script'}
      </button>
      {error && <div className="text-xs text-red-400 bg-red-950/50 rounded p-2 font-mono whitespace-pre-wrap">{error}</div>}
      {output && (
        <div className="rounded border border-border bg-muted/30 p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">stdout</p>
          <pre className="text-xs font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">{output}</pre>
        </div>
      )}
      {resultData != null && (
        <div className="rounded border border-slate-700 bg-slate-900/50 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">result</p>
          {typeof resultData === 'object' && !Array.isArray(resultData) ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(resultData as Record<string, unknown>).map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{k.replace(/_/g, ' ')}</p>
                  <p className="text-xs font-semibold text-slate-200">{typeof v === 'number' ? v.toFixed(4) : String(v)}</p>
                </div>
              ))}
            </div>
          ) : (
            <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap">{JSON.stringify(resultData, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category chip ──────────────────────────────────────────────────────────

function CategoryChip({
  cat,
  isActive,
  chipTabIndex,
  onClick,
  onKeyDown,
  chipRef,
}: {
  cat: (typeof CATEGORIES)[number];
  isActive: boolean;
  /** Roving tabIndex: 0 for the focusable chip, -1 for the rest. */
  chipTabIndex: number;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  chipRef: React.RefCallback<HTMLButtonElement>;
}) {
  return (
    <button
      ref={chipRef}
      role="tab"
      aria-selected={isActive}
      tabIndex={chipTabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      title={cat.label}
      className={cn(
        // Base layout + focus ring
        'flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-xl px-2.5 py-2.5 min-w-[68px] transition-all duration-150 border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 focus-visible:ring-offset-2',
        // Resting: white bg, light border, muted text
        // Active: dark-navy bg #0f172a, white text — matches Finbox spec
        isActive
          ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.03]'
          : 'bg-white text-slate-500 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:scale-[1.02]'
      )}
    >
      <cat.icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-[9.5px] font-semibold leading-tight text-center whitespace-nowrap">{cat.label}</span>
    </button>
  );
}

// ── Horizontal chip scroller ───────────────────────────────────────────────

function CategoryChipRow({
  active,
  onSelect,
}: {
  active: CategoryId | null;
  onSelect: (id: CategoryId) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const check = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    check();
    const el = scrollRef.current;
    el?.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      el?.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 130 : -130, behavior: 'smooth' });
  };

  // Horizontal scroll via mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
  };

  // Keyboard navigation: arrow keys move focus within the tablist (roving tabindex pattern)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const total = CATEGORIES.length;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      chipRefs.current[(index + 1) % total]?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      chipRefs.current[(index - 1 + total) % total]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      chipRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      chipRefs.current[total - 1]?.focus();
    }
  };

  return (
    <div className="relative select-none">
      {/* Left fade + arrow */}
      {canLeft && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <button
            tabIndex={-1}
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-7 w-6 flex items-center justify-center bg-background/90 dark:bg-background/90 border border-border/50 rounded-r shadow-sm hover:bg-accent transition-colors"
            aria-label="Scroll categories left"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </>
      )}

      {/* Chips scroll container — role="tablist" for WAI-ARIA roving tabindex */}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Analysis categories"
        onWheel={handleWheel}
        className="flex gap-2 px-3 py-2.5 overflow-x-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--border)) transparent',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {CATEGORIES.map((cat, index) => {
          const isActive = active === cat.id;
          // Roving tabindex: the active chip (or first chip when none active) is reachable via Tab key
          const chipTabIndex = isActive || (active === null && index === 0) ? 0 : -1;
          return (
            <CategoryChip
              key={cat.id}
              cat={cat}
              isActive={isActive}
              chipTabIndex={chipTabIndex}
              onClick={() => onSelect(cat.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              chipRef={(el) => { chipRefs.current[index] = el; }}
            />
          );
        })}
      </div>

      {/* Right fade + arrow */}
      {canRight && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <button
            tabIndex={-1}
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-7 w-6 flex items-center justify-center bg-background/90 border border-border/50 rounded-l shadow-sm hover:bg-accent transition-colors"
            aria-label="Scroll categories right"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </>
      )}
    </div>
  );
}

// ── Sub-panel: Clean Data ─────────────────────────────────────────────────

function CleanSubPanel({ onAction }: { onAction: (cmd: string) => void }) {
  const currentDataset = useCurrentDatasetStore((s) => s.currentDataset);

  return (
    <div className="p-3 space-y-1">
      {CLEAN_ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => {
            if (action.id === 'export') {
              const cd = useCurrentDatasetStore.getState().currentDataset;
              if (!cd?.cleanedSessionId) { toast.info('Clean the dataset first before exporting.'); return; }
              window.open(`/api/v1/clean/export/${cd.cleanedSessionId}`, '_blank');
              return;
            }
            const fn = currentDataset?.filename ?? 'the dataset';
            onAction((action.command as (fn: string) => string)(fn));
          }}
          // BEFORE: hover:bg-amber-50 hover:border-amber-200, icon bg-amber-100 text-amber-600
          // AFTER:  unified slate hover, neutral icon container
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors border border-transparent hover:border-slate-200 group"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
            <action.icon className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <span className="text-xs font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Sub-panel: Measurement checkboxes ─────────────────────────────────────

function MeasurementSubPanel({
  categoryId,
  selectedIds,
  onToggle,
}: {
  categoryId: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const items = MEASUREMENTS.filter((m) => m.category === categoryId);

  return (
    <div className="p-3 space-y-0.5">
      {items.map((item) => {
        const isChecked = selectedIds.includes(item.id);
        return (
          <label
            key={item.id}
            title={item.description}
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors select-none',
              // BEFORE: 'hover:bg-accent/50' (category-colored accent)
              // AFTER: unified slate — dark row when checked, subtle hover when resting
              isChecked
                ? 'bg-slate-900 hover:bg-slate-800'
                : 'hover:bg-slate-50'
            )}
          >
            {/* Hidden native input for keyboard + screen-reader support */}
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onToggle(item.id)}
              className="sr-only peer"
              aria-label={item.name}
            />
            {/* Custom checkbox visual — peer-focus-visible picks up keyboard focus ring */}
            {/* BEFORE: native <input> with style={{ accentColor: getCategoryColor(id) }} */}
            {/* AFTER: custom div, dark-navy fill + white checkmark when checked */}
            <div
              className={cn(
                'w-3.5 h-3.5 flex-shrink-0 rounded border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/30 peer-focus-visible:ring-offset-1',
                isChecked
                  ? 'bg-slate-900 border-slate-900'
                  : 'bg-white border-slate-300'
              )}
            >
              {isChecked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <span className={cn('text-xs font-medium', isChecked ? 'text-white' : '')}>
                {item.name}
              </span>
              {item.description && (
                <span className={cn('block text-[10px] leading-tight truncate', isChecked ? 'text-slate-300' : 'text-muted-foreground')}>
                  {item.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function BiostatisticsMeasurementsPanel({
  onSelectMeasurement: _sel,
  onRemoveMeasurement: _rem,
}: BiostatisticsMeasurementsPanelProps) {
  const { setPendingMessage } = useMeasurementTriggerStore();
  const activeTabId = useTabStore((s) => s.activeTabId);

  // Which category chip is currently active (null = all collapsed, no sub-panel shown).
  // Default: null — no category is pre-selected on mount.
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);

  // Multi-select state: category id → array of selected measurement ids
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  // Reset both category selection and checked measurements whenever the active tab changes
  // (new tab created OR switched to). This gives each tab a clean, neutral starting state.
  useEffect(() => {
    setActiveCategory(null);
    setSelections({});
  }, [activeTabId]);

  const toggleMeasurement = useCallback((catId: string, measId: string) => {
    setSelections((prev) => {
      const current = prev[catId] ?? [];
      const updated = current.includes(measId)
        ? current.filter((id) => id !== measId)
        : [...current, measId];
      return { ...prev, [catId]: updated };
    });
  }, []);

  const totalSelected = Object.values(selections).flat().length;

  // Build a human-readable command from all current selections
  const buildCommand = (): string => {
    const parts = Object.entries(selections)
      .filter(([, ids]) => ids.length > 0)
      .map(([catId, ids]) => {
        const catLabel = CATEGORIES.find((c) => c.id === catId)?.label ?? catId;
        const names = ids.map((id) => MEASUREMENTS.find((m) => m.id === id)?.name ?? id);
        return `${names.join(', ')} (${catLabel})`;
      });
    return `Analyze my dataset: compute ${parts.join(' + ')}. Show results in the right panel.`;
  };

  const handleCategoryClick = (id: CategoryId) => {
    // Toggle: clicking the active category closes it
    setActiveCategory((prev) => (prev === id ? null : id));
  };

  // Render the sub-panel for the active category
  const renderSubPanel = () => {
    if (!activeCategory) return null;
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    if (!cat) return null;

    if (activeCategory === 'clean') {
      return <CleanSubPanel onAction={(cmd) => setPendingMessage(cmd, true)} />;
    }
    if (activeCategory === 'inferential') return <InferentialPanel />;
    if (activeCategory === 'samplesize') return <SampleSizePanel />;
    if (activeCategory === 'script') return <CustomScriptPanel />;

    // Regular measurement category
    return (
      <MeasurementSubPanel
        categoryId={activeCategory}
        selectedIds={selections[activeCategory] ?? []}
        onToggle={(id) => toggleMeasurement(activeCategory, id)}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-background border-r border-border overflow-hidden">

      {/* ── Sticky top section ───────────────────────────────────────── */}
      <div className="flex-shrink-0">
        {/* Horizontal scrollable category chips */}
        <div className="bg-background border-b border-border">
          <CategoryChipRow active={activeCategory} onSelect={handleCategoryClick} />
        </div>
      </div>

      {/* ── Sub-panel (scrollable, max 44vh so chat always visible) ─── */}
      {activeCategory && (
        <div className="flex-shrink-0 overflow-y-auto border-b border-border/60 bg-background/80"
          style={{ maxHeight: '44vh' }}>
          {renderSubPanel()}
        </div>
      )}

      {/* ── "Send to AI" command bar (appears when checkboxes selected) */}
      {totalSelected > 0 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-border">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-primary">
              {totalSelected} {totalSelected === 1 ? 'measure' : 'measures'} selected
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {Object.entries(selections).filter(([,v])=>v.length>0)
                .flatMap(([,ids]) => ids.map((id) => MEASUREMENTS.find((m) => m.id === id)?.name ?? id))
                .join(' · ')}
            </p>
          </div>
          <button
            onClick={() => setPendingMessage(buildCommand(), true)}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Send className="w-3 h-3" />
            Send to AI
          </button>
          <button onClick={() => setSelections({})} title="Clear all" className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* ── Compact AI chat (fills remaining space) ────────────────── */}
      <div className="flex-1 min-h-0">
        <AIBiostatisticsChatTabIntegrated compact />
      </div>
    </div>
  );
}
