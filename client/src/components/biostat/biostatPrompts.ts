/**
 * Biostatistics prompt suggestions
 *
 * Each entry has:
 *   category   — grouping label shown in the Browse Prompts dropdown
 *   label      — short chip label (≤40 chars)
 *   fullPrompt — the actual text inserted into the chat input
 *   description — tooltip / dropdown subtitle
 */

export interface BiostatPrompt {
  category: string;
  label: string;
  fullPrompt: string;
  description?: string;
  /** If true, show a "⚠ Interpret carefully" disclaimer chip in the UI */
  hasClinicalDisclaimer?: boolean;
}

export const BIOSTAT_PROMPTS: BiostatPrompt[] = [
  // ── Survival Analysis ────────────────────────────────────────────────────────
  {
    category: 'Survival Analysis',
    label: 'Kaplan-Meier curve',
    fullPrompt:
      'Plot a Kaplan-Meier survival curve with 95% confidence intervals and at-risk table. Label each arm and include the log-rank p-value.',
    description: 'KM curve with CIs, at-risk table, and log-rank test',
  },
  {
    category: 'Survival Analysis',
    label: 'Log-rank test',
    fullPrompt:
      'Run a log-rank test to compare survival distributions between treatment arms. Report the chi-squared statistic and p-value.',
    description: 'Compare survival between groups',
  },
  {
    category: 'Survival Analysis',
    label: 'Cox PH hazard ratios',
    fullPrompt:
      'Fit a Cox proportional-hazards model. Report hazard ratios with 95% CIs, p-values, and test the proportional hazards assumption.',
    description: 'Cox model with HR table and PH assumption check',
    hasClinicalDisclaimer: true,
  },
  {
    category: 'Survival Analysis',
    label: 'Median survival by arm',
    fullPrompt:
      'Calculate median survival time with 95% CIs for each treatment arm using the Kaplan-Meier estimator.',
    description: 'Median OS/PFS per arm with confidence intervals',
  },

  // ── Adverse Events ───────────────────────────────────────────────────────────
  {
    category: 'Adverse Events',
    label: 'AE incidence bar chart',
    fullPrompt:
      'Generate a bar chart of adverse event incidence rates by System Organ Class (SOC) and preferred term, sorted by frequency descending. Show counts and percentages per arm.',
    description: 'AE frequency by SOC and PT per treatment arm',
  },
  {
    category: 'Adverse Events',
    label: 'AE summary table (TLF)',
    fullPrompt:
      'Create a TLF-ready adverse events summary table: columns = treatment arms, rows = SOC > PT, cells = n (%), sorted by SOC frequency. Include any-AE and Grade ≥3 rows.',
    description: 'ICH-E3 / CIOMS AE summary table',
  },
  {
    category: 'Adverse Events',
    label: 'Serious AE analysis',
    fullPrompt:
      'Analyse serious adverse events (AESER = Y): incidence by arm, Fisher exact test for group differences, and list preferred terms with ≥2% difference between arms.',
    description: 'SAE incidence comparison with significance testing',
    hasClinicalDisclaimer: true,
  },

  // ── Descriptive Statistics ───────────────────────────────────────────────────
  {
    category: 'Descriptive Statistics',
    label: 'Baseline characteristics table',
    fullPrompt:
      'Generate a Table 1 of baseline demographics and clinical characteristics. Continuous variables: mean (SD), median [IQR]. Categorical variables: n (%). Include overall and by treatment arm, with appropriate p-values (t-test / chi-squared).',
    description: 'Table 1: demographics + clinical baseline by arm',
  },
  {
    category: 'Descriptive Statistics',
    label: 'Descriptive stats summary',
    fullPrompt:
      'Compute descriptive statistics for all numeric columns: n, mean, SD, median, Q1, Q3, min, max, missing count. Format as a publication-ready table.',
    description: 'Full descriptive stats for numeric variables',
  },
  {
    category: 'Descriptive Statistics',
    label: 'Box plots by group',
    fullPrompt:
      'Create side-by-side box plots for each numeric endpoint grouped by treatment arm. Add individual data points (jitter) and annotate medians.',
    description: 'Box + jitter plots per endpoint by treatment',
  },

  // ── Inferential Statistics ───────────────────────────────────────────────────
  {
    category: 'Inferential Statistics',
    label: 'Two-sample t-test',
    fullPrompt:
      "Perform an independent samples t-test (or Welch's t-test) comparing the primary endpoint between two treatment groups. Report mean difference, 95% CI, t-statistic, degrees of freedom, and p-value.",
    description: 'Independent samples t-test with effect size',
  },
  {
    category: 'Inferential Statistics',
    label: 'One-way ANOVA',
    fullPrompt:
      'Run a one-way ANOVA to compare the primary endpoint across treatment groups. Report F-statistic, p-value, and perform Tukey post-hoc tests if significant.',
    description: 'ANOVA with Tukey post-hoc comparisons',
  },
  {
    category: 'Inferential Statistics',
    label: 'Normality check (Shapiro-Wilk)',
    fullPrompt:
      'Test normality of each numeric endpoint using the Shapiro-Wilk test (n < 50) or Kolmogorov-Smirnov (n ≥ 50). Display Q-Q plots and histograms.',
    description: 'Normality tests + Q-Q plots for all numeric cols',
  },
  {
    category: 'Inferential Statistics',
    label: 'Mixed model MMRM',
    fullPrompt:
      'Fit a mixed model for repeated measures (MMRM) for the primary endpoint. Include visit, treatment, and their interaction as fixed effects; subject as random effect. Report LSMeans and treatment difference with 95% CI.',
    description: 'MMRM for repeated measures endpoint',
    hasClinicalDisclaimer: true,
  },

  // ── Visualisations ───────────────────────────────────────────────────────────
  {
    category: 'Visualisations',
    label: 'Forest plot (subgroups)',
    fullPrompt:
      'Create a forest plot showing hazard ratios (or odds ratios) with 95% CIs for pre-specified subgroups. Add a test-for-interaction p-value per subgroup. Include an overall estimate at the bottom.',
    description: 'Subgroup forest plot with interaction tests',
  },
  {
    category: 'Visualisations',
    label: 'Waterfall plot (response)',
    fullPrompt:
      'Generate a waterfall plot of best percent change from baseline in tumour size, sorted ascending. Colour bars by response category (CR, PR, SD, PD). Add a dashed line at −30% (PR threshold) and +20% (PD threshold).',
    description: 'Oncology waterfall plot with response categories',
  },
  {
    category: 'Visualisations',
    label: 'Volcano plot (biomarkers)',
    fullPrompt:
      'Create a volcano plot: x-axis = log2(fold-change), y-axis = −log10(p-value). Colour significant up/down-regulated biomarkers in red/blue. Label the top 10 most significant.',
    description: 'Volcano plot for biomarker differential analysis',
  },
  {
    category: 'Visualisations',
    label: 'Correlation heatmap',
    fullPrompt:
      'Compute Pearson (or Spearman) correlation matrix for all numeric columns and render it as a colour heatmap. Annotate cells with r values and mark statistically significant pairs (p < 0.05).',
    description: 'Correlation matrix heatmap with significance markers',
  },

  // ── Data Cleaning ────────────────────────────────────────────────────────────
  {
    category: 'Data Cleaning',
    label: 'Scan for quality issues',
    fullPrompt:
      'Analyse this dataset for data quality issues: missing values, outliers (IQR method), invalid dates, duplicate records, and categorical mismatches (e.g. SEX, AESEV). Report each issue with a suggested fix and confidence score.',
    description: 'AI scan for data quality issues with fixes',
  },
  {
    category: 'Data Cleaning',
    label: 'Missing value summary',
    fullPrompt:
      'Show a missing value analysis: count and percentage missing per column, visualised as a bar chart. Recommend imputation strategies for each column based on its distribution and data type.',
    description: 'Missing data summary with imputation recommendations',
  },
  {
    category: 'Data Cleaning',
    label: 'Outlier detection',
    fullPrompt:
      'Detect outliers in all numeric columns using the IQR method (Q1 − 1.5·IQR, Q3 + 1.5·IQR) and pharma domain range rules (e.g. AGE 0–120, SBP 60–250 mmHg). List affected rows and suggest Winsorization or removal.',
    description: 'IQR + pharma domain outlier detection',
  },

  // ── Sample Size & Power ──────────────────────────────────────────────────────
  {
    category: 'Sample Size & Power',
    label: 'Sample size calculation',
    fullPrompt:
      'Calculate the required sample size for a two-sample superiority trial. Assume α = 0.05 (two-sided), power = 80%, and a clinically meaningful difference of [X] with SD = [Y]. Show the formula and iterate over a power range of 70–90%.',
    description: 'Sample size for two-arm superiority design',
    hasClinicalDisclaimer: true,
  },
  {
    category: 'Sample Size & Power',
    label: 'Power curve',
    fullPrompt:
      'Plot a power curve showing statistical power vs. sample size per arm for the primary endpoint. Use α = 0.05, assumed effect size and SD from the dataset. Highlight the n needed for 80% and 90% power.',
    description: 'Power vs. sample size curve',
  },
];

/** All unique categories, in display order */
export const PROMPT_CATEGORIES = Array.from(
  new Set(BIOSTAT_PROMPTS.map((p) => p.category))
);
