import { invokeLLM } from './_core/llm';
import { calculateDescriptiveStats, calculatePearsonCorrelation, calculateTTest, calculateANOVA, calculateHistogramData } from './statisticsCalculator';
import { chiSquareTest, logisticRegression, kaplanMeierAnalysis } from './advancedStatistics';
import {
  isGeneExpressionData,
  computeFoldChanges,
  computeGeneExpressionStats,
  prepareChartData,
  computePerGroupStats,
  getTopGenesByFoldChange,
} from './geneExpressionAnalysis';
import { parseGeneExpressionQuery, analyzeGeneExpression } from './ai/geneExpressionAnalysis';
import { convertAnalysisResultsToChartData } from './chartDataConverter';

/**
 * Detect analysis type from user query
 */
export function detectAnalysisType(
  userQuery: string,
  columns: string[]
): string {
  const query = userQuery.toLowerCase();

  // ── Scatter / bivariate plot — check FIRST, before fold_change ─────────────
  // Any "scatter plot", "plot X vs Y", or "plot X and Y" is bivariate scatter.
  const isScatterKeyword =
    query.includes("scatter") ||
    query.includes("scatter plot") ||
    query.includes("scatterplot");
  const isBivariatePhrase =
    (query.includes("plot") || query.includes("graph") || query.includes("visuali")) &&
    (query.includes(" vs ") || query.includes(" versus ") || query.includes(" and ") || query.includes(" against "));

  if (isScatterKeyword || isBivariatePhrase) {
    return "scatter";
  }

  // Check for gene expression / fold-change analysis
  if (
    query.includes("fold change") ||
    query.includes("fold-change") ||
    query.includes("fold_change") ||
    query.includes("log2") ||
    query.includes("log fold") ||
    query.includes("lfc") ||
    query.includes("upregulated") ||
    query.includes("downregulated")
  ) {
    return "fold_change";
  }

  if (
    query.includes("correlation") ||
    query.includes("relationship") ||
    query.includes("association")
  ) {
    return "correlation";
  }
  if (
    query.includes("t-test") ||
    query.includes("t test") ||
    query.includes("compare") ||
    query.includes("difference")
  ) {
    return "ttest";
  }
  if (
    query.includes("anova") ||
    query.includes("multiple groups") ||
    query.includes("group comparison")
  ) {
    return "anova";
  }
  if (
    query.includes("histogram") ||
    query.includes("distribution") ||
    query.includes("frequency")
  ) {
    return "distribution";
  }
  if (
    query.includes("chi-square") ||
    query.includes("chi square") ||
    query.includes("categorical")
  ) {
    return "chisquare";
  }
  if (
    query.includes("logistic") ||
    query.includes("binary") ||
    query.includes("probability")
  ) {
    return "logistic";
  }
  if (
    query.includes("survival") ||
    query.includes("kaplan") ||
    query.includes("meier")
  ) {
    return "survival";
  }
  // Check for descriptive/summary statistics (std dev, variance, quartiles, etc.)
  if (
    query.includes("mean") ||
    query.includes("median") ||
    query.includes("standard deviation") ||
    query.includes("std dev") ||
    query.includes("std") ||
    query.includes("variance") ||
    query.includes("quartile") ||
    query.includes("q1") ||
    query.includes("q3") ||
    query.includes("min") ||
    query.includes("max") ||
    query.includes("range") ||
    query.includes("descriptive") ||
    query.includes("summary") ||
    query.includes("statistics")
  ) {
    return "descriptive";
  }

  return "general";
}

/**
 * Detect which column the user is asking about from their query
 */
function detectColumnFromQuery(
  query: string,
  columns: string[]
): string | undefined {
  const q = query.toLowerCase();
  // Exact substring match first (case-insensitive)
  for (const col of columns) {
    if (q.includes(col.toLowerCase())) return col;
  }
  // Common aliases
  const aliases: Record<string, string[]> = {
    age: ["age", "years old", "patient age"],
    bp: ["blood pressure", "systolic", "diastolic", "sbp", "dbp"],
    bmi: ["bmi", "body mass", "weight index"],
    weight: ["weight", "body weight"],
    height: ["height", "stature"],
    dose: ["dose", "dosage", "concentration"],
    glucose: ["glucose", "sugar", "blood sugar"],
    cholesterol: ["cholesterol", "ldl", "hdl"],
    survival: ["survival", "time to event", "event time"],
  };
  for (const col of columns) {
    const colLower = col.toLowerCase();
    for (const [key, terms] of Object.entries(aliases)) {
      if (colLower.includes(key) && terms.some((t) => q.includes(t))) {
        return col;
      }
    }
  }
  return undefined;
}

/**
 * Build a rich analysis text from computed results (used when LLM is unavailable)
 */
function buildAnalysisText(analysisResults: any, userQuery: string): string {
  if (!analysisResults) return "Analysis completed.";
  const type = analysisResults.analysis_type;
  const fmt = (v: any) =>
    typeof v === "number" ? Number(v).toFixed(4) : String(v ?? "—");

  if (type === "descriptive") {
    const col = analysisResults.column || "the column";
    const t = analysisResults.results_table || [];
    const get = (metric: string) =>
      fmt(t.find((r: any) => r.metric === metric)?.value);
    return `**Descriptive Statistics — ${col}**\n\n| Metric | Value |\n|--------|-------|\n${t
      .map((r: any) => `| ${r.metric} | ${fmt(r.value)} |`)
      .join(
        "\n"
      )}\n\n**Interpretation:** The column *${col}* has a mean of **${get(
      "Mean"
    )}** and a median of **${get(
      "Median"
    )}**, with a standard deviation of **${get(
      "Std Dev"
    )}**. The range spans from **${get("Min")}** to **${get(
      "Max"
    )}** (IQR: **${get("Q1")}** – **${get("Q3")}**).`;
  }

  if (type === "correlation") {
    const c1 = analysisResults.column1 || "Variable 1";
    const c2 = analysisResults.column2 || "Variable 2";
    const r = fmt(analysisResults.correlation);
    const p = fmt(analysisResults.pValue);
    const sig = analysisResults.pValue < 0.05 ? "statistically significant" : "not statistically significant";
    const strength =
      Math.abs(analysisResults.correlation) > 0.7
        ? "strong"
        : Math.abs(analysisResults.correlation) > 0.4
        ? "moderate"
        : "weak";
    const dir = analysisResults.correlation >= 0 ? "positive" : "negative";
    return `**Pearson Correlation — ${c1} vs ${c2}**\n\n| Metric | Value |\n|--------|-------|\n| Pearson r | ${r} |\n| p-value | ${p} |\n| Significant | ${analysisResults.pValue < 0.05 ? "Yes (p < 0.05)" : "No (p ≥ 0.05)"} |\n\n**Interpretation:** There is a **${strength} ${dir} correlation** (r = ${r}) between *${c1}* and *${c2}*, which is ${sig} at the α = 0.05 level.`;
  }

  if (type === "ttest") {
    const vc = analysisResults.valueColumn || "outcome";
    const gc = analysisResults.groupColumn || "group";
    const t = fmt(analysisResults.tStatistic);
    const p = fmt(analysisResults.pValue);
    const sig = analysisResults.pValue < 0.05;
    const tbl = analysisResults.results_table || [];
    return `**Independent Samples T-Test — ${vc} by ${gc}**\n\n| Metric | Value |\n|--------|-------|\n${tbl
      .map((r: any) => `| ${r.metric} ${r.value ?? ""} ${r.submetric ? `(${r.submetric})` : ""} | ${fmt(r.subvalue ?? r.value)} |`)
      .join(
        "\n"
      )}\n\n**Result:** The t-statistic is **${t}** with a p-value of **${p}**. The difference between groups is **${
      sig ? "statistically significant (p < 0.05)" : "not statistically significant (p ≥ 0.05)"
    }**.`;
  }

  if (type === "anova") {
    const p = fmt(analysisResults.pValue);
    const f = fmt(analysisResults.fStatistic);
    const sig = analysisResults.pValue < 0.05;
    return `**One-Way ANOVA**\n\nF-statistic: **${f}** | p-value: **${p}**\n\n**Result:** The difference between groups is **${
      sig ? "statistically significant (p < 0.05)" : "not statistically significant (p ≥ 0.05)"
    }**.`;
  }

  if (type === "chisquare") {
    const c1 = analysisResults.var1 || "Variable 1";
    const c2 = analysisResults.var2 || "Variable 2";
    const chi = fmt(analysisResults.chiSquare);
    const p = fmt(analysisResults.pValue);
    const sig = analysisResults.pValue < 0.05;
    return `**Chi-Square Test of Independence — ${c1} vs ${c2}**\n\nχ² = **${chi}** | p = **${p}**\n\n**Result:** The association between *${c1}* and *${c2}* is **${
      sig ? "statistically significant (p < 0.05)" : "not statistically significant (p ≥ 0.05)"
    }**.`;
  }

  if (type === "fold_change") {
    const tbl = analysisResults.results_table || [];
    return `**Fold-Change Analysis**\n\n| Metric | Value |\n|--------|-------|\n${tbl
      .slice(0, 8)
      .map((r: any) => `| ${r.metric} | ${fmt(r.value)} |`)
      .join("\n")}\n\nThe analysis computed fold changes across your dataset. See the chart below for a visual overview.`;
  }

  // Generic fallback
  const tbl = analysisResults.results_table || [];
  if (tbl.length > 0) {
    return `**Analysis Results — ${userQuery}**\n\n| Metric | Value |\n|--------|-------|\n${tbl
      .map((r: any) => `| ${r.metric} | ${fmt(r.value)} |`)
      .join("\n")}`;
  }

  return `Analysis completed for: *${userQuery}*. See the results table and chart below.`;
}

/**
 * Parse the first markdown table found in plain text into a results_table array.
 * Used as a fallback when the LLM returns data in markdown format instead of JSON.
 */
function parseMarkdownTableToResults(
  text: string
): Array<{ metric: string; value: any }> | null {
  const lines = text.split("\n");
  const tableStart = lines.findIndex((l) => l.trim().startsWith("|"));
  if (tableStart === -1) return null;

  const tableLines = lines.slice(tableStart);
  const sepIdx = tableLines.findIndex((l) => /^\|?[\s\-:|]+\|/.test(l));
  if (sepIdx < 1) return null;

  const parseRow = (line: string): string[] => {
    const parts = line.split("|");
    if (parts[0].trim() === "") parts.shift();
    if (parts[parts.length - 1].trim() === "") parts.pop();
    return parts.map((c) => c.trim());
  };

  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(sepIdx + 1).map(parseRow);

  if (rows.length === 0 || headers.length < 2) return null;

  if (headers.length === 2) {
    // Simple 2-column table → direct metric/value mapping
    return rows
      .filter((r) => r.length >= 2)
      .map((r) => ({
        metric: r[0] ?? "",
        value: !isNaN(Number(r[1])) && r[1] !== "" ? Number(r[1]) : (r[1] ?? ""),
      }));
  }

  // Multi-column table → first column is metric, remaining columns joined
  return rows
    .filter((r) => r.length >= 2)
    .map((r) => ({
      metric: r[0] ?? "",
      value: r.slice(1).join(" | "),
    }));
}

/**
 * Build system prompt for biostatistics analysis
 */
function buildSystemPrompt(): string {
  return `You are an expert biostatistician AI assistant embedded in NuPharm, a pharmaceutical clinical trial analysis platform. You work alongside scientists analyzing clinical trial data for drug development and regulatory submissions.

## Your primary role
Provide rich clinical interpretation of biostatistical results. Think like a senior biostatistician reviewing results for an IND, NDA, or BLA submission.

## When PRE-COMPUTED STATISTICS are included in the user message
The platform already computed exact statistics locally. You MUST:
- Use those exact numeric values — do NOT recalculate or contradict them
- Focus entirely on clinical interpretation: what do these numbers mean for the drug/treatment?
- Reference statistical significance thresholds (α = 0.05), effect sizes, confidence intervals when relevant
- Apply clinical benchmarks (e.g., MCID, clinically meaningful differences, ICH E9/E9(R1) guidance)
- Identify assumption violations or data quality concerns (normality, homoscedasticity, sample size adequacy)
- Suggest follow-on analyses that build on the computed result

## When no pre-computed stats are provided
Perform the analysis directly from the data columns and preview. Choose the most appropriate statistical test for the data type and research question. Explain your choice.

## Data context
Data is typically clinical trial data: patient demographics, biomarkers, efficacy endpoints, safety/AE summaries, PK/PD profiles, survival times.

## Formatting rules
- "analysis" field: narrative prose only — **bold** key findings, bullet points for interpretations. NO markdown tables in "analysis".
- Be specific — name the columns, name the test, state the p-value / CI when given
- 2–4 suggestions maximum, each concrete and actionable
- Do NOT ask clarifying questions — analyze and interpret directly

## CRITICAL: Response format
You MUST respond with ONLY valid JSON. No text before or after. No markdown code fences.

{
  "analysis": "2-5 sentence narrative clinical interpretation. Bold key findings. No markdown tables here — only prose.",
  "suggestions": ["Specific actionable next step 1", "Specific next step 2"],
  "measurements": [{"name": "Metric name", "description": "Clinical meaning of this metric"}],
  "chartSuggestions": [{"type": "bar|line|scatter|box|km", "title": "Descriptive chart title", "description": "Why this visualization adds insight"}],
  "analysisResults": {"analysis_type": "llm_table", "results_table": [{"metric": "Parameter", "value": "Value"}]},
  "graphTitle": "Publication-style title (max 8 words) e.g. 'PK Parameters — 24-Subject BE Study'"
}

## CRITICAL — analysisResults field rules:
1. "analysis" MUST be narrative prose only — NO markdown tables. Write 2-5 sentences interpreting findings clinically.
2. ALWAYS populate "analysisResults" when the user requests ANY of the following:
   - Tabular results: summary tables, parameter listings, results tables, statistical output
   - Generated or simulated data: PK parameters, BE summaries, descriptive statistics, patient datasets
   - Data synthesis: example datasets, reference ranges, normative values, dose-response tables
   - Statistical tests: t-test results, ANOVA tables, chi-square, correlation matrices, regression output
   - Pharmacokinetic/pharmacodynamic analyses: AUC, Cmax, Tmax, half-life, clearance tables
   Format: {"analysis_type": "llm_table", "results_table": [{"metric": "Row label", "value": "Cell value"}, ...]}
   - Use "metric" for the row/parameter name and "value" for the corresponding result.
   - Extract EVERY data row. If generating a dataset with multiple subjects, list each as a separate metric/value pair or use "Subject N — Parameter" as the metric.
   - Keep "analysis" as brief narrative prose (do NOT duplicate the table data there).
3. Set "analysisResults" to null ONLY for purely conversational answers with NO tabular data whatsoever (e.g., "What is a t-test?" or "How does ANOVA work?").
4. Always include "graphTitle" — a clean, professional, publication-style title (max 8 words).`;
}

/**
 * Parse uploaded data file
 */
export async function parseDataFile(
  fileBuffer: Buffer,
  fileName: string
): Promise<{
  columns: string[];
  preview: any[];
  fullData: any[];
  classifications: Record<string, any>;
}> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    const content = fileBuffer.toString("utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("CSV file is empty");
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const data = lines.slice(1).map((line) => {
      const values = line.split(",");
      const row: Record<string, any> = {};
      headers.forEach((header, idx) => {
        const value = values[idx]?.trim();
        row[header] = isNaN(Number(value)) ? value : Number(value);
      });
      return row;
    });

    const classifications: Record<string, any> = {};
    headers.forEach((col) => {
      const values = data.map((row) => row[col]);
      const numericValues = values.filter((v) => typeof v === "number");
      const isNumeric = numericValues.length > values.length * 0.5;

      classifications[col] = {
        dataType: isNumeric ? "number" : "string",
        uniqueValues: new Set(values).size,
        suggestedAnalyses: isNumeric ? ["mean", "median", "correlation"] : ["frequency"],
      };
    });

    return {
      columns: headers,
      preview: data.slice(0, 3),
      fullData: data,
      classifications,
    };
  }

  throw new Error("Unsupported file format");
}

// ─── Synthetic dataset generator ─────────────────────────────────────────────

interface DatasetParams {
  n: number;
  dose: number;
  isCrossover: boolean;
  formulations: [string, string];
}

function parseDatasetParams(userQuery: string): DatasetParams {
  const q = userQuery.toLowerCase();

  // Sample size
  let n = 12;
  const nMatch =
    q.match(/n\s*=\s*(\d+)/) ??
    q.match(/n\s*of\s*(\d+)/) ??
    q.match(/(\d+)\s+(?:healthy|subject|patient|volunteer)/) ??
    q.match(/(\d+)\s+subject/);
  if (nMatch) n = Math.max(2, Math.min(200, parseInt(nMatch[1])));

  // Dose (mg)
  let dose = 100;
  const doseMatch = q.match(/(\d+)\s*mg/);
  if (doseMatch) dose = parseInt(doseMatch[1]);

  const isCrossover =
    q.includes("crossover") || q.includes("cross-over") || q.includes("cross over");

  const formulations: [string, string] =
    q.includes("test") && q.includes("reference")
      ? ["Test", "Reference"]
      : q.includes("treatment a") || q.includes("treatment b")
      ? ["Treatment A", "Treatment B"]
      : ["Test", "Reference"];

  return { n, dose, isCrossover, formulations };
}

function generateSyntheticPKDataset(params: DatasetParams): {
  tableData: { headers: string[]; rows: (string | number)[][] };
  results_table: Array<{ metric: string; value: any }>;
  graphTitle: string;
  subtitle: string;
  tableNote: string;
} {
  const { n, dose, isCrossover, formulations } = params;
  const periods = isCrossover ? 2 : 1;

  const headers = [
    "SubjectID", "Sequence", "Period", "Formulation",
    "AUC0-t (h·ng/mL)", "AUC0-inf (h·ng/mL)", "Cmax (ng/mL)",
    "Tmax (h)", "t½ (h)", "CL/F (L/h)", "Vz/F (L)", "AUC_%extrap (%)",
  ];

  const rows: (string | number)[][] = [];
  const testAUC: number[] = [];
  const refAUC: number[] = [];
  const testCmax: number[] = [];
  const refCmax: number[] = [];

  // Means for each formulation (slight T/R difference → GMR ~1.02)
  const MEAN: Record<string, { auc: number; cmax: number; t12: number }> = {
    [formulations[0]]: { auc: 1510, cmax: 325, t12: 9.8 },
    [formulations[1]]: { auc: 1475, cmax: 312, t12: 9.8 },
  };

  for (let s = 1; s <= n; s++) {
    // 2-sequence assignment: first ceil(n/2) → TR, rest → RT
    const sequence = isCrossover
      ? (s <= Math.ceil(n / 2) ? `${formulations[0][0]}R` : `R${formulations[0][0]}`)
      : "—";

    // Inter-subject variability factor: uniform [0.85, 1.15]  →  ~±15%
    const isv = 0.85 + Math.random() * 0.30;

    for (let period = 1; period <= periods; period++) {
      let formulation: string;
      if (!isCrossover) {
        formulation = period === 1 ? formulations[0] : formulations[1];
      } else {
        const trFirst = s <= Math.ceil(n / 2);
        formulation =
          (trFirst && period === 1) || (!trFirst && period === 2)
            ? formulations[0]
            : formulations[1];
      }

      const m = MEAN[formulation] ?? MEAN[formulations[0]];

      // Intra-subject / period variability: uniform [0.94, 1.06]  →  ~±6%
      const iov = 0.94 + Math.random() * 0.12;

      const t12     = m.t12 * isv;                              // h
      const aucInf  = m.auc  * isv * iov;                      // h·ng/mL
      const extrapPct = 0.5 + Math.random() * 2.0;             // 0.5–2.5 %
      const auct    = aucInf * (1 - extrapPct / 100);
      const cmax    = m.cmax * isv * iov;
      const tmax    = 1.5 + Math.random() * 1.5;               // 1.5–3.0 h
      const lz      = Math.LN2 / t12;
      const clf     = (dose * 1e3) / aucInf;                   // L/h
      const vzf     = clf / lz;                                  // L

      if (formulation === formulations[0]) {
        testAUC.push(auct);
        testCmax.push(cmax);
      } else {
        refAUC.push(auct);
        refCmax.push(cmax);
      }

      rows.push([
        s,
        sequence,
        period,
        formulation,
        auct.toFixed(2),
        aucInf.toFixed(2),
        cmax.toFixed(2),
        tmax.toFixed(1),
        t12.toFixed(2),
        clf.toFixed(2),
        vzf.toFixed(2),
        extrapPct.toFixed(2),
      ]);
    }
  }

  // Summary stats
  const mean   = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const gmean  = (a: number[]) =>
    a.length ? Math.exp(a.reduce((s, v) => s + Math.log(v), 0) / a.length) : 1;

  const gmrAUC  = refAUC.length  ? (gmean(testAUC)  / gmean(refAUC)).toFixed(4)  : "N/A";
  const gmrCmax = refCmax.length ? (gmean(testCmax) / gmean(refCmax)).toFixed(4) : "N/A";

  const results_table = [
    { metric: "Study Design",          value: isCrossover ? "2-Period, 2-Sequence Crossover" : "Parallel Group" },
    { metric: "Subjects (n)",          value: n },
    { metric: "Total Observations",    value: rows.length },
    { metric: "Dose",                  value: `${dose} mg oral` },
    { metric: `Mean AUC0-t – ${formulations[0]}`, value: `${mean(testAUC).toFixed(2)} h·ng/mL` },
    { metric: `Mean AUC0-t – ${formulations[1]}`, value: refAUC.length ? `${mean(refAUC).toFixed(2)} h·ng/mL` : "N/A" },
    { metric: `Mean Cmax – ${formulations[0]}`,   value: `${mean(testCmax).toFixed(2)} ng/mL` },
    { metric: `Mean Cmax – ${formulations[1]}`,   value: refCmax.length ? `${mean(refCmax).toFixed(2)} ng/mL` : "N/A" },
    { metric: "GMR AUC0-t (T/R)",      value: gmrAUC },
    { metric: "GMR Cmax (T/R)",        value: gmrCmax },
  ];

  return {
    tableData: { headers, rows },
    results_table,
    graphTitle: `Bioequivalence Study – Individual PK Parameters (n=${n} Subjects)`,
    subtitle: "Synthetic dataset for testing and visualization. Realistic ranges applied.",
    tableNote: "Data is synthetic and for demonstration purposes only.",
  };
}

/**
 * Detect whether the query is asking for synthetic/generated dataset data
 * (no uploaded file required — purely generative)
 */
function isDatasetGenerationQuery(userQuery: string): boolean {
  const q = userQuery.toLowerCase();
  const generativeVerbs =
    q.includes("generate") || q.includes("create") ||
    q.includes("simulate") || q.includes("make") ||
    q.includes("produce") || q.includes("build");
  const datasetTarget =
    q.includes("dataset") || q.includes("data set") ||
    q.includes("fake data") || q.includes("synthetic data") ||
    q.includes("mock data") || q.includes("dummy data") ||
    q.includes("sample data") || q.includes("example data") ||
    (q.includes("data") && (q.includes("study") || q.includes("trial") || q.includes("crossover")));
  const pkDataset =
    q.includes("pk parameter") || q.includes("pk table") ||
    q.includes("pharmacokinetic") && q.includes("table") ||
    q.includes("bioequivalence") && (q.includes("data") || q.includes("table"));
  return (generativeVerbs && datasetTarget) || pkDataset;
}

// ─── Interactive Data Cleaning Engine ────────────────────────────────────────

interface ColumnScanInfo {
  missingCount: number;
  outlierCount: number;
  outlierP5:    number;
  outlierP95:   number;
  outlierLower: number;
  outlierUpper: number;
}

interface DataScanResult {
  totalRows:                 number;
  duplicateCount:            number;
  missingByColumn:           Record<string, number>;
  outliersByColumn:          Record<string, ColumnScanInfo>;
  inconsistentCategoricals:  Record<string, string[]>;
  hasIssues:                 boolean;
}

function scanDataIssues(
  fullData: any[],
  dataColumns: string[],
  classifications: Record<string, any>
): DataScanResult {
  const totalRows = fullData.length;

  // ── Duplicates ────────────────────────────────────────────────────────────
  const rowKeys = fullData.map((row) =>
    JSON.stringify(dataColumns.map((c) => row[c]))
  );
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const key of rowKeys) {
    if (seen.has(key)) duplicateCount++;
    else seen.add(key);
  }

  // ── Missing values ────────────────────────────────────────────────────────
  const missingByColumn: Record<string, number> = {};
  for (const col of dataColumns) {
    const missing = fullData.filter(
      (row) =>
        row[col] === null ||
        row[col] === undefined ||
        row[col] === "" ||
        (typeof row[col] === "number" && isNaN(row[col]))
    ).length;
    if (missing > 0) missingByColumn[col] = missing;
  }

  // ── Outliers (IQR method) ─────────────────────────────────────────────────
  const outliersByColumn: Record<string, ColumnScanInfo> = {};
  for (const col of dataColumns) {
    const isNumeric =
      classifications[col]?.dataType === "number" ||
      fullData.filter((r) => typeof r[col] === "number").length >
        fullData.length * 0.5;
    if (!isNumeric) continue;

    const vals = fullData
      .map((row) => row[col])
      .filter((v): v is number => typeof v === "number" && !isNaN(v))
      .sort((a, b) => a - b);
    if (vals.length < 4) continue;

    const q1 = vals[Math.floor(vals.length * 0.25)];
    const q3 = vals[Math.floor(vals.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const outlierCount = vals.filter((v) => v < lower || v > upper).length;
    if (outlierCount === 0) continue;

    const p5  = vals[Math.max(0, Math.floor(vals.length * 0.05))];
    const p95 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
    outliersByColumn[col] = {
      missingCount: 0,
      outlierCount,
      outlierP5: p5,
      outlierP95: p95,
      outlierLower: lower,
      outlierUpper: upper,
    };
  }

  // ── Categorical inconsistencies ───────────────────────────────────────────
  const inconsistentCategoricals: Record<string, string[]> = {};
  for (const col of dataColumns) {
    if (
      classifications[col]?.dataType === "number" ||
      fullData.filter((r) => typeof r[col] === "number").length >
        fullData.length * 0.5
    )
      continue;

    const vals = [
      ...new Set(
        fullData.map((row) => String(row[col] ?? "")).filter((v) => v !== "")
      ),
    ];
    if (vals.length > 30) continue; // high-cardinality columns skipped

    // Group by lowercase — find variant groups with > 1 surface form
    const groups: Record<string, string[]> = {};
    for (const v of vals) {
      const key = v.toLowerCase().trim();
      (groups[key] = groups[key] ?? []).push(v);
    }
    const hasVariants = Object.values(groups).some((g) => g.length > 1);
    if (hasVariants) inconsistentCategoricals[col] = vals;
  }

  const hasIssues =
    duplicateCount > 0 ||
    Object.keys(missingByColumn).length > 0 ||
    Object.keys(outliersByColumn).length > 0 ||
    Object.keys(inconsistentCategoricals).length > 0;

  return {
    totalRows,
    duplicateCount,
    missingByColumn,
    outliersByColumn,
    inconsistentCategoricals,
    hasIssues,
  };
}

function formatScanForPrompt(scan: DataScanResult, filename: string): string {
  const lines: string[] = [
    `=== DATA SCAN: ${filename} (${scan.totalRows} rows) ===`,
  ];

  if (scan.duplicateCount > 0)
    lines.push(`• Duplicates: ${scan.duplicateCount} duplicate rows`);

  const missingCols = Object.entries(scan.missingByColumn);
  if (missingCols.length > 0) {
    lines.push("• Missing values:");
    for (const [col, n] of missingCols)
      lines.push(
        `  - ${col}: ${n} missing (${((n / scan.totalRows) * 100).toFixed(1)}%)`
      );
  }

  const outlierCols = Object.entries(scan.outliersByColumn);
  if (outlierCols.length > 0) {
    lines.push("• Outliers (IQR method):");
    for (const [col, info] of outlierCols)
      lines.push(
        `  - ${col}: ${info.outlierCount} outliers | 5th pct=${info.outlierP5.toFixed(2)}, 95th pct=${info.outlierP95.toFixed(2)}`
      );
  }

  const inconsistCols = Object.entries(scan.inconsistentCategoricals);
  if (inconsistCols.length > 0) {
    lines.push("• Categorical inconsistencies:");
    for (const [col, vals] of inconsistCols)
      lines.push(`  - ${col}: [${vals.join(", ")}]`);
  }

  if (!scan.hasIssues)
    lines.push("✓ No significant issues detected. Data appears clean.");

  return lines.join("\n");
}

function buildCleaningSystemPrompt(): string {
  return `You are an expert data scientist running an interactive data cleaning session inside NuPhorm, a pharmaceutical biostatistics platform.

## Your role
Guide the user through reviewing and approving each data quality issue found in their dataset. You received a DATA SCAN summary — use it to drive the conversation.

## Conversation rules
1. Ask EXACTLY ONE question per response. Do not ask multiple questions at once.
2. Ask issues in this order: Duplicates → Outliers (per column) → Missing values (per column) → Categorical inconsistencies (per column).
3. After the user answers, acknowledge their choice clearly, then ask the next question.
4. When ALL issues have been addressed (or if there were none), output a brief summary of all confirmed choices, then write: "**All choices confirmed. Type APPLY to clean the dataset and see results in the right panel.**"

## Question format for each issue type
- Duplicates: "I detected [N] duplicate rows. **Remove them?** (Yes / No)"
- Outliers: "I detected [N] outliers in **[Column]** (values outside the IQR range). **How to handle them?** Options: **Winsorize** at 5th/95th percentiles | **Remove** affected rows | **Leave as-is**"
- Missing: "**[Column]** has [N] missing values ([%]). **How to impute?** Options: **Median** imputation | **Mean** imputation | **Delete** rows with missing | **Leave as NA**"
- Inconsistencies: "**[Column]** has inconsistent formats: [list values]. **Standardize to canonical form?** (Yes / No)"

## CRITICAL: Response format
You MUST respond with ONLY valid JSON — no text before or after, no markdown fences.

{
  "analysis": "Your question or summary in markdown",
  "suggestions": [],
  "measurements": [],
  "chartSuggestions": [],
  "analysisResults": null,
  "graphTitle": null
}`;
}

function applyDataCleaning(
  fullData: any[],
  dataColumns: string[],
  scan: DataScanResult
): {
  cleanedData:  any[];
  summary:      Array<{ metric: string; value: any }>;
} {
  let data = fullData.map((row) => ({ ...row })); // shallow clone each row
  const summary: Array<{ metric: string; value: any }> = [
    { metric: "Original rows", value: data.length },
  ];

  // 1. Remove duplicates
  if (scan.duplicateCount > 0) {
    const seen = new Set<string>();
    const before = data.length;
    data = data.filter((row) => {
      const key = JSON.stringify(dataColumns.map((c) => row[c]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    summary.push({
      metric: "Duplicate rows removed",
      value: before - data.length,
    });
  }

  // 2. Impute missing (median for numeric, mode for categorical)
  for (const col of Object.keys(scan.missingByColumn)) {
    const presentVals = data
      .map((r) => r[col])
      .filter(
        (v) =>
          v !== null &&
          v !== undefined &&
          v !== "" &&
          !(typeof v === "number" && isNaN(v))
      );
    if (presentVals.length === 0) continue;

    const allNumeric = presentVals.every((v) => typeof v === "number");
    if (allNumeric) {
      const sorted = [...(presentVals as number[])].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      let count = 0;
      data = data.map((row) => {
        if (
          row[col] === null ||
          row[col] === undefined ||
          row[col] === "" ||
          isNaN(row[col])
        ) {
          count++;
          return { ...row, [col]: median };
        }
        return row;
      });
      summary.push({
        metric: `${col} — median imputed`,
        value: `${count} → ${median.toFixed(3)}`,
      });
    } else {
      const freq: Record<string, number> = {};
      for (const v of presentVals as string[])
        freq[String(v)] = (freq[String(v)] ?? 0) + 1;
      const mode = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (mode) {
        let count = 0;
        data = data.map((row) => {
          if (!row[col] || row[col] === "") {
            count++;
            return { ...row, [col]: mode };
          }
          return row;
        });
        summary.push({
          metric: `${col} — mode imputed`,
          value: `${count} → "${mode}"`,
        });
      }
    }
  }

  // 3. Winsorize outliers at 5th / 95th percentile
  for (const [col, info] of Object.entries(scan.outliersByColumn)) {
    let count = 0;
    data = data.map((row) => {
      if (typeof row[col] !== "number") return row;
      if (row[col] < info.outlierP5) {
        count++;
        return { ...row, [col]: info.outlierP5 };
      }
      if (row[col] > info.outlierP95) {
        count++;
        return { ...row, [col]: info.outlierP95 };
      }
      return row;
    });
    if (count > 0)
      summary.push({
        metric: `${col} — winsorized`,
        value: `${count} values → [${info.outlierP5.toFixed(2)}, ${info.outlierP95.toFixed(2)}]`,
      });
  }

  // 4. Standardize categorical inconsistencies
  const sexMap: Record<string, string> = {
    m: "M", male: "M", man: "M",
    f: "F", female: "F", woman: "F",
  };
  for (const [col, vals] of Object.entries(scan.inconsistentCategoricals)) {
    // Build a canonical map: lowercase → first alphabetically sorted variant
    const groups: Record<string, string> = {};
    for (const v of [...vals].sort()) {
      const key = v.toLowerCase().trim();
      if (!groups[key]) groups[key] = v;
    }
    const standardize = (v: string): string => {
      const lower = v.toLowerCase().trim();
      if (col.toLowerCase().includes("sex") || col.toLowerCase().includes("gender"))
        return sexMap[lower] ?? groups[lower] ?? v;
      return groups[lower] ?? v;
    };
    let count = 0;
    data = data.map((row) => {
      const orig = String(row[col] ?? "");
      const std  = standardize(orig);
      if (std !== orig) count++;
      return { ...row, [col]: std };
    });
    if (count > 0)
      summary.push({ metric: `${col} — standardized`, value: `${count} values` });
  }

  summary.push({ metric: "Cleaned rows",    value: data.length });
  summary.push({ metric: "Columns",         value: dataColumns.length });

  return { cleanedData: data, summary };
}

function isCleaningTrigger(userQuery: string): boolean {
  const q = userQuery.toLowerCase();
  return (
    q.includes("scan my dataset") ||
    q.includes("scan the dataset") ||
    q.includes("interactive clean") ||
    q.includes("clean my data") ||
    (q.includes("clean") && q.includes("detect") && q.includes("issue")) ||
    // command string from the panel button
    (q.includes("data quality issues") && q.includes("ask me"))
  );
}

function isContinuingCleaningConversation(
  conversationHistory: Array<{ role: string; content: string }>
): boolean {
  // The initial user trigger is stored in history once the conversation starts
  return conversationHistory.some(
    (msg) =>
      msg.role === "user" &&
      (msg.content.toLowerCase().includes("scan my dataset") ||
        msg.content.toLowerCase().includes("data quality issues") ||
        msg.content.toLowerCase().includes("interactive clean") ||
        msg.content.toLowerCase().includes("scan the dataset"))
  );
}

function isApplyCleaningSignal(
  userQuery: string,
  conversationHistory: Array<{ role: string; content: string }>
): boolean {
  const q = userQuery.toLowerCase().trim();
  const applyWords = new Set([
    "apply",
    "apply cleaning",
    "apply clean",
    "yes apply",
    "yes, apply",
    "proceed",
    "ok apply",
    "go ahead",
    "confirm",
    "yes proceed",
    "yes, proceed",
    "do it",
    "run cleaning",
  ]);
  return applyWords.has(q) && isContinuingCleaningConversation(conversationHistory);
}

/**
 * Main biostatistics analysis function
 */
export async function analyzeBiostatistics(
  userQuery: string,
  dataPreview: string,
  dataColumns: string[],
  classifications: Record<string, any>,
  conversationHistory: Array<{ role: string; content: string }>,
  fullData?: any[]
): Promise<{
  analysis: string;
  suggestions: string[];
  measurements: Array<{ name: string; description: string; formula?: string }>;
  chartSuggestions: Array<{ type: string; title: string; description: string }>;
  analysisResults?: any;
  chartConfig?: any;
  tableData?: any;
  llmUnavailable?: boolean;
  llmError?: string;
  llmUsed?: boolean;
}> {
  // ── Dataset generation — short-circuit LLM, return locally generated data ──
  if (isDatasetGenerationQuery(userQuery)) {
    console.log("[analyzeBiostatistics] Dataset generation query detected — generating locally");
    const params = parseDatasetParams(userQuery);
    const generated = generateSyntheticPKDataset(params);

    return {
      analysis:
        `**${generated.graphTitle}**\n\n` +
        `${generated.subtitle}\n\n` +
        `Generated ${generated.tableData.rows.length} observations for ${params.n} subjects. ` +
        `View the complete table in the Results panel →`,
      suggestions: [
        "Log-transform AUC and Cmax values before running ANOVA",
        `Calculate GMR and 90% CI to formally assess bioequivalence (80–125% bounds)`,
        "Export the CSV and import into Phoenix WinNonlin or R for NCA",
        "Run a mixed-effects model (PROC MIXED / lme4) for a reference-replicate design",
      ],
      measurements: [],
      chartSuggestions: [
        { type: "scatter", title: "AUC0-t: Test vs Reference", description: "Subject-level scatter to visualise T/R concordance" },
        { type: "bar",     title: "Mean Cmax by Formulation",  description: "Bar chart of geometric means ± 90% CI" },
      ],
      analysisResults: {
        analysis_type: "dataset_generation",
        results_table: generated.results_table,
        subtitle:      generated.subtitle,
        tableNote:     generated.tableNote,
      },
      tableData:   generated.tableData,
      graphTitle:  generated.graphTitle,
      llmUsed:     false,
    };
  }

  // ── Interactive cleaning: APPLY signal — apply cleaning locally, skip LLM ──
  if (isApplyCleaningSignal(userQuery, conversationHistory) && fullData && fullData.length > 0) {
    console.log("[analyzeBiostatistics] Apply-cleaning signal detected — running locally");
    const scan = scanDataIssues(fullData, dataColumns, classifications);
    const { cleanedData, summary } = applyDataCleaning(fullData, dataColumns, scan);

    const headers = dataColumns;
    const rows = cleanedData.map((row) =>
      headers.map((col) => {
        const v = row[col];
        return v === null || v === undefined ? "" : v;
      })
    );

    const issueList = summary
      .filter((s) => !["Original rows", "Cleaned rows", "Columns"].includes(s.metric))
      .map((s) => `${s.metric}: ${s.value}`)
      .join(" · ");

    return {
      analysis:
        `**Cleaning complete.** ${issueList || "No changes needed."}\n\n` +
        `The cleaned dataset (${cleanedData.length} rows, ${dataColumns.length} columns) is ready in the Results panel. ` +
        `Use **Export CSV** to download.`,
      suggestions: [
        "Run descriptive statistics on the cleaned dataset to verify distributions",
        "Compare cleaned vs original using a box plot or histogram",
        "Export the cleaned CSV for regulatory submission or further analysis",
      ],
      measurements: [],
      chartSuggestions: [],
      analysisResults: {
        analysis_type: "data_cleaning",
        results_table:  summary,
        subtitle:       `Cleaning applied: ${cleanedData.length} rows retained`,
        tableNote:      "Duplicate rows removed · Missing values imputed (median/mode) · Outliers winsorized at 5th/95th percentile · Categorical formats standardized.",
      },
      tableData:  { headers, rows },
      graphTitle: "Cleaned Dataset — Data Quality Report",
      llmUsed:    false,
    };
  }

  // ── Interactive cleaning: determine system prompt ─────────────────────────
  const isCleaningConversation =
    isCleaningTrigger(userQuery) || isContinuingCleaningConversation(conversationHistory);

  const systemPrompt = isCleaningConversation
    ? buildCleaningSystemPrompt()
    : buildSystemPrompt();

  const classificationContext = Object.entries(classifications)
    .map(([col, info]: [string, any]) => {
      const scale = info?.scale ?? (info?.dataType === "number" ? "continuous" : "nominal");
      const analyses = Array.isArray(info?.suggestedAnalyses) ? info.suggestedAnalyses.join(", ") : info?.dataType ?? "unknown";
      return `${col}: ${scale} scale (${analyses})`;
    })
    .join("\n");

  // For the first cleaning trigger message, inject the scan results so the LLM
  // knows exactly what issues to ask about.
  let scanInjection = "";
  if (isCleaningTrigger(userQuery) && fullData && fullData.length > 0) {
    const scan = scanDataIssues(fullData, dataColumns, classifications);
    scanInjection = `\n\n${formatScanForPrompt(scan, "the dataset")}\n\nStart the conversation by asking about the FIRST detected issue only.`;
    console.log("[analyzeBiostatistics] Cleaning trigger — scan injected into prompt");
  }

  const userMessage = isCleaningConversation
    ? `${userQuery}${scanInjection}`
    : `
Available Columns: ${dataColumns.join(", ")}

Column Classifications:
${classificationContext}

Data Preview (first 3 rows):
${dataPreview}

User Query: ${userQuery}

Analyze this data and provide:
1. Immediate analysis if the query matches a known method
2. Structured JSON results with chart data
3. Clinical interpretation and next steps
4. Do NOT ask generic "What would you like?" - perform the analysis directly`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    console.time("[analyzeBiostatistics] Total analysis time");
    console.log(`[analyzeBiostatistics] Query: "${userQuery}"`);
    console.log(`[analyzeBiostatistics] Data rows: ${fullData?.length || 0}, Columns: ${dataColumns.length}`);
    
    // Detect analysis type and perform real calculations if data is available
    let analysisResults: any = null;

    if (fullData && fullData.length > 0) {
      console.time("[analyzeBiostatistics] Analysis type detection");
      const analysisType = detectAnalysisType(userQuery, dataColumns);
      console.timeEnd("[analyzeBiostatistics] Analysis type detection");
      console.log(`[analyzeBiostatistics] Detected analysis type: ${analysisType}`);

      // Detect numeric columns from actual data if classifications aren't available
      let numericColumns = dataColumns.filter(
        (col) => classifications[col]?.dataType === "number"
      );

      // If no numeric columns detected via classifications, detect from data
      if (numericColumns.length === 0) {
        numericColumns = dataColumns.filter((col) => {
          const values = fullData.map((row) => row[col]);
          const numericValues = values.filter((v) => typeof v === "number");
          return numericValues.length > values.length * 0.5;
        });
      }

      try {
        // ── Scatter / bivariate plot ─────────────────────────────────────────
        if (analysisType === "scatter" && numericColumns.length >= 2) {
          const queryLower = userQuery.toLowerCase();

          // Pick X and Y columns: match any numeric column name mentioned in the query
          let xCol: string | undefined;
          let yCol: string | undefined;
          for (const col of numericColumns) {
            if (queryLower.includes(col.toLowerCase())) {
              if (!xCol) xCol = col;
              else if (!yCol) { yCol = col; break; }
            }
          }
          // Fallback: first two numeric columns
          if (!xCol) xCol = numericColumns[0];
          if (!yCol) yCol = numericColumns[1];

          // Label column — gene_id, gene, id, name, sample_id, sample, or first string col
          const labelCol =
            dataColumns.find((col) => {
              const c = col.toLowerCase();
              return (
                c === "gene_id" || c === "gene" || c === "id" ||
                c === "name"    || c === "sample_id" || c === "sample"
              );
            }) ??
            dataColumns.find((col) => classifications[col]?.dataType === "string");

          const points = fullData
            .filter(
              (row: any) =>
                typeof row[xCol!] === "number" && typeof row[yCol!] === "number"
            )
            .map((row: any) => ({
              x: row[xCol!],
              y: row[yCol!],
              ...(labelCol ? { label: String(row[labelCol]) } : {}),
            }));

          const xVals = points.map((p: any) => p.x as number);
          const yVals = points.map((p: any) => p.y as number);

          analysisResults = {
            analysis_type: "scatter",
            xColumn: xCol,
            yColumn: yCol,
            labelColumn: labelCol,
            n_valid: points.length,
            results_table: [
              { metric: "X Column",    value: xCol },
              { metric: "Y Column",    value: yCol },
              { metric: "Data Points", value: points.length },
              { metric: "X Min",       value: xVals.length ? Math.min(...xVals).toFixed(3) : "—" },
              { metric: "X Max",       value: xVals.length ? Math.max(...xVals).toFixed(3) : "—" },
              { metric: "Y Min",       value: yVals.length ? Math.min(...yVals).toFixed(3) : "—" },
              { metric: "Y Max",       value: yVals.length ? Math.max(...yVals).toFixed(3) : "—" },
            ],
            chart_data: {
              type: "scatter",
              xAxisLabel: xCol,
              yAxisLabel: yCol,
              datasets: [
                {
                  label: `${xCol} vs ${yCol}`,
                  data: points,
                  borderColor: "#3b82f6",
                  backgroundColor: "rgba(59, 130, 246, 0.6)",
                },
              ],
            },
          };
        }

        // Check for gene expression data and fold-change analysis
        if (!analysisResults && analysisType === "fold_change") {
          // Try standard gene expression format first
          if (isGeneExpressionData(fullData)) {
            const foldChangeData = computeFoldChanges(fullData);
            const stats = computeGeneExpressionStats(foldChangeData);
            const chartData = prepareChartData(foldChangeData, stats, 10);
            const perGroupStats = computePerGroupStats(fullData);
            const topGenes = getTopGenesByFoldChange(foldChangeData, 10);

            analysisResults = {
              analysis_type: "fold_change",
              results_table: [
                { metric: "Total Genes", value: stats.total_genes },
                { metric: "Mean Fold Change", value: stats.mean_fold_change.toFixed(3) },
                { metric: "Mean Log2 Fold Change", value: stats.mean_log2_fold_change.toFixed(3) },
                { metric: "Std Dev (Fold Change)", value: stats.std_dev_fold_change.toFixed(3) },
                { metric: "Std Dev (Log2 FC)", value: stats.std_dev_log2_fold_change.toFixed(3) },
                { metric: "Min Fold Change", value: stats.min_fold_change.toFixed(3) },
                { metric: "Max Fold Change", value: stats.max_fold_change.toFixed(3) },
                { metric: "Median Fold Change", value: stats.median_fold_change.toFixed(3) },
                { metric: "Control Mean", value: perGroupStats.control_mean.toFixed(3) },
                { metric: "Control Std Dev", value: perGroupStats.control_std_dev.toFixed(3) },
                { metric: "Treated Mean", value: perGroupStats.treated_mean.toFixed(3) },
                { metric: "Treated Std Dev", value: perGroupStats.treated_std_dev.toFixed(3) },
                ...topGenes.slice(0, 10).map((gene, idx) => ({
                  metric: `Gene ${idx + 1}`,
                  value: gene.gene_id,
                  submetric: "Log2 FC",
                  subvalue: gene.log2_fold_change.toFixed(3),
                })),
              ],
              chart_data: {
                type: "bar",
                points: chartData.map((d) => ({
                  x: d.gene_id,
                  y: d.log2_fold_change,
                  error: d.error,
                })),
              },
            };
          } else {
            // Fallback: look for a fold_change column and compute stats on it
            const foldChangeCol = dataColumns.find(col => col.toLowerCase().includes('fold_change') || col.toLowerCase().includes('fold change'));
            if (foldChangeCol && numericColumns.length > 0) {
              console.log(`[analyzeBiostatistics] Using fallback fold_change computation on column: ${foldChangeCol}`);
              const stats = calculateDescriptiveStats(fullData, foldChangeCol);
              const foldChangeValues = fullData.map((row: any) => row[foldChangeCol]).filter((v: any) => typeof v === 'number');
              
              analysisResults = {
                analysis_type: "fold_change",
                column: foldChangeCol,
                results_table: [
                  { metric: "Mean Fold Change", value: stats.mean.toFixed(3) },
                  { metric: "Median Fold Change", value: stats.median.toFixed(3) },
                  { metric: "Std Dev", value: stats.stdDev.toFixed(3) },
                  { metric: "Min", value: stats.min.toFixed(3) },
                  { metric: "Max", value: stats.max.toFixed(3) },
                  { metric: "Q1", value: stats.q1.toFixed(3) },
                  { metric: "Q3", value: stats.q3.toFixed(3) },
                  { metric: "Count", value: foldChangeValues.length },
                ],
                chart_data: {
                  type: "bar",
                  labels: fullData.map((_: any, idx: number) => idx + 1),
                  datasets: [
                    {
                      label: foldChangeCol,
                      data: foldChangeValues,
                      borderColor: "#3b82f6",
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                    }
                  ]
                },
              };
            }
          }
        } else if (analysisType === "descriptive" && numericColumns.length > 0) {
          // Prefer a column explicitly named in the query; fall back to first numeric
          const targetColumn =
            detectColumnFromQuery(userQuery, numericColumns) ?? numericColumns[0];
          const stats = calculateDescriptiveStats(fullData, targetColumn);
          const columnValues = fullData.map((row: any, idx: number) => [idx + 1, row[targetColumn]]);

          analysisResults = {
            analysis_type: "descriptive",
            column: targetColumn,
            value: stats.median,
            n_valid: fullData.length,
            results_table: [
              { metric: "Mean", value: stats.mean },
              { metric: "Median", value: stats.median },
              { metric: "Std Dev", value: stats.stdDev },
              { metric: "Min", value: stats.min },
              { metric: "Max", value: stats.max },
              { metric: "Q1", value: stats.q1 },
              { metric: "Q3", value: stats.q3 },
            ],
            chart_data: {
              type: "line",
              labels: fullData.map((_: any, idx: number) => idx + 1),
              datasets: [
                {
                  label: targetColumn,
                  data: fullData.map((row: any) => row[targetColumn]),
                  borderColor: "#3b82f6",
                  backgroundColor: "rgba(59, 130, 246, 0.1)",
                  fill: true,
                  tension: 0.1
                },
                {
                  label: "Median",
                  data: fullData.map(() => stats.median),
                  borderColor: "#ef4444",
                  borderDash: [5, 5],
                  fill: false,
                  tension: 0
                }
              ]
            },
            tableData: {
              headers: ["Row", targetColumn],
              rows: columnValues.slice(0, 20)
            },
            points: [
              { x: "Mean", y: stats.mean },
              { x: "Median", y: stats.median },
              { x: "Std Dev", y: stats.stdDev },
            ],
          };
        } else if (analysisType === "correlation" && numericColumns.length >= 2) {
          const corr = calculatePearsonCorrelation(fullData, numericColumns[0], numericColumns[1]);
          const scatterPoints = fullData.map((row: any) => ({
            x: row[numericColumns[0]],
            y: row[numericColumns[1]]
          }));

          analysisResults = {
            analysis_type: "correlation",
            column1: numericColumns[0],
            column2: numericColumns[1],
            correlation: corr.correlation,
            pValue: corr.pValue,
            significant: corr.pValue < 0.05,
            value: corr.correlation,
            n_valid: fullData.length,
            results_table: [
              { metric: "Pearson r", value: corr.correlation },
              { metric: "p-value", value: corr.pValue },
              { metric: "Significant", value: corr.pValue < 0.05 ? "Yes" : "No" },
            ],
            chart_data: {
              type: "scatter",
              labels: scatterPoints.map((_: any, idx: number) => idx + 1),
              datasets: [
                {
                  label: `${numericColumns[0]} vs ${numericColumns[1]}`,
                  data: scatterPoints,
                  borderColor: "#3b82f6",
                  backgroundColor: "rgba(59, 130, 246, 0.6)"
                }
              ]
            },
            tableData: {
              headers: ["Row", numericColumns[0], numericColumns[1]],
              rows: fullData.slice(0, 20).map((row: any, idx: number) => [idx + 1, row[numericColumns[0]], row[numericColumns[1]]])
            },
            points: scatterPoints,
          };
        } else if (analysisType === "ttest" && numericColumns.length > 0) {
          // Look for a grouping column
          const groupingColumn = dataColumns.find(
            (col) =>
              classifications[col]?.dataType === "string" ||
              (classifications[col]?.uniqueValues < 10 && classifications[col]?.dataType !== "number")
          );

          if (groupingColumn) {
            const ttest = calculateTTest(fullData, numericColumns[0], groupingColumn);

            analysisResults = {
              analysis_type: "ttest",
              valueColumn: numericColumns[0],
              groupColumn: groupingColumn,
              tStatistic: ttest.tStatistic,
              pValue: ttest.pValue,
              significant: ttest.significant,
              results_table: [
                { metric: "Group", value: ttest.group1, submetric: "Mean", subvalue: ttest.mean1 },
                { metric: "Group", value: ttest.group2, submetric: "Mean", subvalue: ttest.mean2 },
                { metric: "t-statistic", value: ttest.tStatistic },
                { metric: "p-value", value: ttest.pValue },
              ],
              chart_data: {
                type: "bar",
                points: [
                  { x: ttest.group1, y: ttest.mean1 },
                  { x: ttest.group2, y: ttest.mean2 },
                ],
              },
            };
          }
        } else if (analysisType === "anova" && numericColumns.length > 0) {
          // Look for a grouping column
          const groupingColumn = dataColumns.find(
            (col) =>
              classifications[col]?.dataType === "string" ||
              (classifications[col]?.uniqueValues < 10 && classifications[col]?.dataType !== "number")
          );

          if (groupingColumn) {
            const anova = calculateANOVA(fullData, numericColumns[0], groupingColumn);

            analysisResults = {
              analysis_type: "anova",
              valueColumn: numericColumns[0],
              groupColumn: groupingColumn,
              fStatistic: anova.fStatistic,
              pValue: anova.pValue,
              significant: anova.significant,
              results_table: anova.groups.map((g) => ({
                metric: "Group",
                value: g.name,
                submetric: "Mean",
                subvalue: g.mean,
                n: g.n,
              })),
              chart_data: {
                type: "bar",
                points: anova.groups.map((g) => ({
                  x: g.name,
                  y: g.mean,
                })),
              },
            };
          }
        } else if (analysisType === "distribution" && numericColumns.length > 0) {
          const histogramData = calculateHistogramData(fullData, numericColumns[0]);

          analysisResults = {
            analysis_type: "distribution",
            column: numericColumns[0],
            results_table: histogramData.map((h) => ({
              metric: "Bin",
              value: h.bin,
              count: h.count,
            })),
            chart_data: {
              type: "bar",
              points: histogramData.map((h) => ({
                x: h.bin,
                y: h.count,
              })),
            },
          };
        } else if (analysisType === "chisquare" && dataColumns.length >= 2) {
          const cat1 = dataColumns.find((col) => classifications[col]?.dataType === "string");
          const cat2 = dataColumns.find((col) => col !== cat1 && classifications[col]?.dataType === "string");
          
          if (cat1 && cat2) {
            const chiSq = chiSquareTest(fullData, cat1, cat2);
            analysisResults = {
              analysis_type: "chisquare",
              var1: cat1,
              var2: cat2,
              chiSquare: chiSq.chiSquare,
              pValue: chiSq.pValue,
              significant: chiSq.significant,
              results_table: [
                { metric: "Chi-Square", value: chiSq.chiSquare },
                { metric: "p-value", value: chiSq.pValue },
                { metric: "Degrees of Freedom", value: chiSq.degreesOfFreedom },
                { metric: "Significant", value: chiSq.significant ? "Yes" : "No" },
              ],
              chart_data: {
                type: "bar",
                points: Object.entries(chiSq.contingencyTable).map(([key, vals]) => ({
                  x: key,
                  y: Object.values(vals as Record<string, number>).reduce((a, b) => a + b, 0),
                })),
              },
            };
          }
        }
      } catch (calcError) {
        console.error("[analyzeBiostatistics] Calculation error:", calcError);
        // Fall through to AI-only response if calculation fails
      }
    }

    // Pre-compute chart/table config so it's available in every response path.
    let chartConfig: any;
    let tableData: any;
    if (analysisResults) {
      const converted = convertAnalysisResultsToChartData(analysisResults, userQuery);
      chartConfig = converted.chartConfig;
      tableData = converted.tableData;

      // Enhance the last user message with the already-computed statistics so
      // Claude can interpret real numbers instead of guessing from a data preview.
      const statsText = buildAnalysisText(analysisResults, userQuery);
      const statsJsonPreview = JSON.stringify(
        (analysisResults.results_table ?? []).slice(0, 25),
        null, 2
      );
      const lastMsgIdx = messages.length - 1;
      messages[lastMsgIdx] = {
        ...(messages[lastMsgIdx] as any),
        content:
          (messages[lastMsgIdx] as any).content +
          `\n\n=== PRE-COMPUTED STATISTICS (accurate — do NOT recalculate) ===\n` +
          statsText +
          `\n\nRaw JSON results:\n${statsJsonPreview}\n\n` +
          `Based on these exact values, provide clinical interpretation, key findings, assumption checks, and specific next steps.`,
      };
      console.log("[analyzeBiostatistics] ✓ Local stats computed — enhancing LLM prompt with results");
    }

    // Call LLM with exponential-backoff retry logic.
    // Note: response_format/json_schema is omitted — the system prompt already
    // instructs the model to return pure JSON, and Anthropic doesn't support
    // OpenAI-style json_schema enforcement anyway.
    let response;
    const MAX_LLM_ATTEMPTS = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_LLM_ATTEMPTS; attempt++) {
      try {
        response = await invokeLLM({ messages: messages as any });
        break; // success
      } catch (llmError) {
        lastError = llmError as Error;
        const errMsg = lastError.message ?? "";

        // Non-retriable errors: authentication / bad request
        if (errMsg.includes("401") || errMsg.includes("400") || errMsg.toLowerCase().includes("invalid x-api-key")) {
          console.error(`[analyzeBiostatistics] Non-retriable LLM error (attempt ${attempt + 1}):`, errMsg);
          break;
        }

        if (attempt < MAX_LLM_ATTEMPTS - 1) {
          const delayMs = Math.pow(2, attempt) * 1000; // 1 s → 2 s → (never, only 2 retries)
          console.log(`[analyzeBiostatistics] LLM error (attempt ${attempt + 1}/${MAX_LLM_ATTEMPTS}), retrying in ${delayMs}ms… ${errMsg}`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    if (!response) {
      const errMsg = lastError?.message ?? "Unknown error";
      console.error("[analyzeBiostatistics] LLM failed after all attempts:", errMsg);

      // Classify error to give the user an actionable hint
      const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("overloaded");
      const isAuth = errMsg.includes("401") || errMsg.toLowerCase().includes("authentication") || errMsg.toLowerCase().includes("invalid x-api-key");
      const isNetwork = errMsg.toLowerCase().includes("fetch") || errMsg.toLowerCase().includes("network") || errMsg.toLowerCase().includes("econnrefused");

      let hint: string;
      if (isRateLimit) hint = "The AI service is rate-limited. Please wait a moment and retry.";
      else if (isAuth)  hint = "AI API key is invalid or missing. Check `ANTHROPIC_API_KEY` in your `.env` file.";
      else if (isNetwork) hint = "Could not reach the AI service — check your network connection.";
      else hint = "The AI service is temporarily unavailable.";

      // Three distinct scenarios require different messaging:
      //  A) Local JS stats were computed → show them + mention AI is down
      //  B) Data loaded but analysis type needs AI (KM, AE, general) → explain alternatives
      //  C) No data at all → prompt to upload
      let fallbackAnalysis: string;
      let fallbackSuggestions: string[];

      if (analysisResults) {
        // ── A: Offline stats computed successfully ─────────────────────────
        fallbackAnalysis =
          `${buildAnalysisText(analysisResults, userQuery)}\n\n` +
          `---\n` +
          `**Basic statistics computed (offline mode).** ` +
          `${hint} The numbers above are accurate — click **Retry AI interpretation** to get enhanced narrative and clinical context when the service recovers.`;
        fallbackSuggestions = [
          "Click \"Retry AI interpretation\" below to get an enhanced summary",
          "Results are also visible in the chart/table on the right",
          ...(isAuth ? ["Fix ANTHROPIC_API_KEY in .env and restart the server"] : []),
        ];
      } else if (fullData && fullData.length > 0) {
        // ── B: Data loaded, but this query type requires AI ────────────────
        fallbackAnalysis =
          `**Your data is loaded (${fullData.length.toLocaleString()} rows) but this analysis requires AI.**\n\n` +
          `${hint}\n\n` +
          `**Available offline analyses** (select from the left panel):\n` +
          `- Descriptive — mean, median, SD, quartiles, IQR\n` +
          `- Efficacy — T-test, ANOVA, Wilcoxon / Mann-Whitney\n` +
          `- Inferential — chi-square, correlation\n` +
          `- Distribution — histogram / frequency chart\n\n` +
          `Click **Retry AI interpretation** to attempt AI analysis again.`;
        fallbackSuggestions = [
          "Select Descriptive or Efficacy from the left panel for offline analysis",
          "Click \"Retry AI interpretation\" to re-attempt when the service recovers",
          ...(isAuth ? ["Fix ANTHROPIC_API_KEY in .env and restart the server"] : []),
        ];
      } else if (dataColumns.length > 0) {
        // ── D: Column structure known from source preview, but full rows not loaded ──
        // Occurs when a project source was uploaded with a short preview (< 600 chars)
        // and the component couldn't parse enough rows to populate fullData.
        const colList = dataColumns.slice(0, 8).join(', ') + (dataColumns.length > 8 ? ` … (${dataColumns.length} total)` : '');
        fallbackAnalysis =
          `**Dataset structure recognised** — columns: \`${colList}\`\n\n` +
          `The full row data isn't loaded yet. To run analyses, use the **↑ upload button** in the AI bar to load the complete file.\n\n` +
          `${hint}\n\n` +
          `Once loaded, all offline analyses (descriptive stats, hypothesis tests, correlations) run instantly.`;
        fallbackSuggestions = [
          "Use the ↑ upload button in the AI bar to load the full CSV file",
          "After loading, ask for Descriptive Statistics for an instant result",
          ...(isAuth ? ["Fix ANTHROPIC_API_KEY in .env and restart the server"] : []),
        ];
      } else {
        // ── C: No dataset attached ─────────────────────────────────────────
        fallbackAnalysis =
          `**No dataset attached yet.**\n\n` +
          `Use the **↑ upload** or **📎 paperclip** button in the AI bar below to attach a CSV or TSV file, then ask your question again.\n\n` +
          `Once data is loaded, most analyses (descriptive stats, hypothesis tests, correlations) run instantly without needing the AI service.`;
        fallbackSuggestions = [
          "Upload a CSV/TSV file using the upload button in the AI bar",
          "After uploading, try Descriptive Statistics for an instant offline result",
        ];
      }

      return {
        analysis: fallbackAnalysis,
        suggestions: fallbackSuggestions,
        measurements: [],
        chartSuggestions: [],
        analysisResults,
        llmUnavailable: true,
        llmError: errMsg,
      };
    }

    const content = response.choices[0].message.content;
    if (typeof content === "string") {
      // Strip markdown code fences that models sometimes add (```json ... ```)
      const rawJson = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      let parsed: any;
      try {
        parsed = JSON.parse(rawJson);
      } catch (parseErr) {
        console.error("[analyzeBiostatistics] JSON.parse failed. Raw content:", content.slice(0, 300));
        // Claude responded but not in JSON — show the raw text + local stats
        return {
          analysis: analysisResults
            ? `${buildAnalysisText(analysisResults, userQuery)}\n\n---\n${content}`
            : content,
          suggestions: ["Try a more specific query", "Upload data and ask about a column"],
          measurements: [],
          chartSuggestions: [],
          analysisResults,
          chartConfig,
          tableData,
          llmUsed: false,
        };
      }

      // Merge local computations into Claude's response (local stats always win)
      if (analysisResults) {
        parsed.analysisResults = analysisResults;
        console.log("[analyzeBiostatistics] ✓ Merged local stats into Claude response");
      }

      // Fallback: if the LLM returned null for analysisResults but embedded a markdown
      // table inside the analysis text, extract it into a proper results_table so the
      // Results panel can render it as a structured table instead of raw text.
      if (!parsed.analysisResults && parsed.analysis) {
        const extracted = parseMarkdownTableToResults(parsed.analysis);
        if (extracted && extracted.length > 0) {
          parsed.analysisResults = {
            analysis_type: "llm_table",
            results_table: extracted,
          };
          // Strip the markdown table from the analysis prose to avoid duplication
          parsed.analysis = parsed.analysis
            .replace(/(\|[^\n]+\n)+/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          console.log(`[analyzeBiostatistics] ✓ Extracted markdown table → results_table (${extracted.length} rows)`);
        }
      }

      if (chartConfig) parsed.chartConfig = chartConfig;
      if (tableData) parsed.tableData = tableData;
      parsed.llmUsed = true;

      return parsed;
    }

    return {
      analysis: "Analysis completed",
      suggestions: [],
      measurements: [],
      chartSuggestions: [],
      analysisResults,
      chartConfig,
      tableData,
      llmUsed: false,
    };
  } catch (error) {
    console.error("[analyzeBiostatistics] Error:", error);
    throw new Error(
      `Failed to analyze biostatistics: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Suggest biostatistical keywords based on data characteristics
 */
export function suggestKeywords(columns: string[], dataPreview: string): string[] {
  const keywords = [
    "mean",
    "median",
    "standard deviation",
    "variance",
    "range",
    "correlation",
    "t-test",
    "ANOVA",
    "chi-square",
    "regression",
    "confidence interval",
    "p-value",
    "effect size",
    "power analysis",
  ];

  return keywords;
}
