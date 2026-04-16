/**
 * testSelector.ts — Stage 3: Autonomous statistical test selection.
 *
 * Given the analysis type and data characteristics, selects the appropriate
 * statistical test WITHOUT requiring the LLM to choose. Uses a decision tree
 * based on standard biostatistics methodology (number of groups, normality,
 * pairing, data type).
 *
 * The LLM's role is reduced to: (1) classify the query, (2) interpret results.
 * This module handles the method selection autonomously.
 */

export interface TestSelection {
  primaryTest: string;
  alternativeTest?: string;
  postHocTest?: string;
  assumptionChecks: string[];
  reasoning: string;
  params: Record<string, any>;
}

interface DataProfile {
  rowCount: number;
  numericColumns: string[];
  categoricalColumns: string[];
  groupColumn?: string;
  groupCount?: number;
  groupSizes?: Record<string, number>;
  isPaired?: boolean;
  outcomeColumn?: string;
  timeColumn?: string;
  eventColumn?: string;
}

const ID_PATTERNS = /^(subj|patient|id|ptno|randno|screen|enrol)/i;
const TIME_PATTERNS = /^(time|day|week|month|hour|t_|time_|duration|period|pfs|os_time|tte|follow)/i;
const EVENT_PATTERNS = /^(event|status|censor|dead|death|alive|os_status|pfs_status|cnsr)/i;
const GROUP_PATTERNS = /^(group|arm|treatment|trt|cohort|dose|condition|category|sex|gender)/i;
const PAIRED_PATTERNS = /^(pre|post|before|after|baseline|week|visit|timepoint|day_?\d)/i;

export function profileData(
  data: Record<string, any>[],
  columns: string[],
  classifications: Record<string, any>
): DataProfile {
  const numeric: string[] = [];
  const categorical: string[] = [];

  for (const col of columns) {
    if (ID_PATTERNS.test(col)) continue;

    const cls = classifications[col];
    if (cls?.dataType === "number" || cls?.scale === "continuous") {
      numeric.push(col);
    } else {
      const values = data.slice(0, 50).map(r => r[col]).filter(v => v !== null && v !== undefined && v !== "");
      const numRatio = values.filter(v => !isNaN(Number(v))).length / Math.max(values.length, 1);
      if (numRatio > 0.8) numeric.push(col);
      else categorical.push(col);
    }
  }

  // Detect group column
  let groupColumn: string | undefined;
  let groupCount = 0;
  const groupSizes: Record<string, number> = {};

  for (const col of categorical) {
    if (GROUP_PATTERNS.test(col)) {
      groupColumn = col;
      break;
    }
  }
  if (!groupColumn && categorical.length > 0) {
    // Pick the categorical column with the fewest unique values (likely the grouping var)
    let minUnique = Infinity;
    for (const col of categorical) {
      const unique = new Set(data.map(r => r[col]).filter(v => v !== null && v !== "")).size;
      if (unique >= 2 && unique <= 10 && unique < minUnique) {
        minUnique = unique;
        groupColumn = col;
      }
    }
  }

  if (groupColumn) {
    const vals = data.map(r => r[groupColumn!]).filter(v => v !== null && v !== "");
    const unique = new Set(vals);
    groupCount = unique.size;
    for (const v of vals) {
      const key = String(v);
      groupSizes[key] = (groupSizes[key] || 0) + 1;
    }
  }

  // Detect paired data
  const isPaired = columns.some(c => PAIRED_PATTERNS.test(c)) &&
    columns.filter(c => PAIRED_PATTERNS.test(c)).length >= 2;

  // Detect time/event for survival
  const timeColumn = columns.find(c => TIME_PATTERNS.test(c));
  const eventColumn = columns.find(c => EVENT_PATTERNS.test(c));

  // Pick the first non-ID numeric column as outcome
  const outcomeColumn = numeric.find(c => !TIME_PATTERNS.test(c) && !EVENT_PATTERNS.test(c));

  return {
    rowCount: data.length,
    numericColumns: numeric,
    categoricalColumns: categorical,
    groupColumn,
    groupCount,
    groupSizes,
    isPaired,
    outcomeColumn,
    timeColumn,
    eventColumn,
  };
}

export function selectTest(
  analysisType: string,
  profile: DataProfile,
  userQuery: string
): TestSelection {
  const q = userQuery.toLowerCase();

  switch (analysisType) {

    // ── Descriptive ──────────────────────────────────────────────────────────
    case "descriptive":
      return {
        primaryTest: "descriptive",
        assumptionChecks: [],
        reasoning: "Descriptive statistics requested. No inferential test needed.",
        params: {
          columns: profile.numericColumns,
          groupBy: profile.groupColumn,
        },
      };

    // ── Two-group comparison ─────────────────────────────────────────────────
    case "ttest": {
      if (profile.groupCount === 2) {
        if (profile.isPaired || q.includes("paired") || q.includes("before") || q.includes("pre")) {
          return {
            primaryTest: "paired_ttest",
            alternativeTest: "wilcoxon_signed_rank",
            assumptionChecks: ["shapiro_wilk"],
            reasoning: `Paired comparison detected (${profile.groupColumn}). Using paired t-test with Shapiro-Wilk normality check. Falls back to Wilcoxon signed-rank if non-normal.`,
            params: {
              groupColumn: profile.groupColumn,
              valueColumn: profile.outcomeColumn,
            },
          };
        }
        const smallSample = Math.min(...Object.values(profile.groupSizes || {})) < 30;
        return {
          primaryTest: smallSample ? "mann_whitney" : "unpaired_ttest",
          alternativeTest: smallSample ? "unpaired_ttest" : "mann_whitney",
          assumptionChecks: ["shapiro_wilk", "levene_test"],
          reasoning: smallSample
            ? `Small samples (n<30 per group). Defaulting to Mann-Whitney U (non-parametric). Will also run t-test for comparison.`
            : `Two independent groups in "${profile.groupColumn}" (${Object.keys(profile.groupSizes || {}).join(" vs ")}). Using unpaired t-test with normality (Shapiro-Wilk) and equal variance (Levene's) checks.`,
          params: {
            groupColumn: profile.groupColumn,
            valueColumn: profile.outcomeColumn,
          },
        };
      }
      // Fallback for >2 groups → suggest ANOVA
      return {
        primaryTest: "one_way_anova",
        alternativeTest: "kruskal_wallis",
        postHocTest: "tukey_hsd",
        assumptionChecks: ["shapiro_wilk", "levene_test"],
        reasoning: `${profile.groupCount} groups detected. Using one-way ANOVA (parametric) with Tukey HSD post-hoc. Falls back to Kruskal-Wallis if assumptions violated.`,
        params: {
          groupColumn: profile.groupColumn,
          valueColumn: profile.outcomeColumn,
        },
      };
    }

    // ── Multi-group comparison ────────────────────────────────────────────────
    case "anova": {
      if (profile.isPaired || q.includes("repeated") || q.includes("longitudinal")) {
        return {
          primaryTest: "repeated_measures_anova",
          alternativeTest: "friedman",
          postHocTest: "bonferroni",
          assumptionChecks: ["shapiro_wilk"],
          reasoning: "Repeated measures / longitudinal design detected. Using repeated-measures ANOVA with Bonferroni post-hoc.",
          params: {
            groupColumn: profile.groupColumn,
            valueColumn: profile.outcomeColumn,
          },
        };
      }
      return {
        primaryTest: "one_way_anova",
        alternativeTest: "kruskal_wallis",
        postHocTest: "tukey_hsd",
        assumptionChecks: ["shapiro_wilk", "levene_test"],
        reasoning: `${profile.groupCount} groups in "${profile.groupColumn}". Using one-way ANOVA with Tukey HSD post-hoc. Falls back to Kruskal-Wallis + Dunn's if non-normal.`,
        params: {
          groupColumn: profile.groupColumn,
          valueColumn: profile.outcomeColumn,
        },
      };
    }

    // ── Correlation ──────────────────────────────────────────────────────────
    case "correlation": {
      const n = profile.rowCount;
      return {
        primaryTest: n >= 30 ? "pearson" : "spearman",
        alternativeTest: n >= 30 ? "spearman" : "pearson",
        assumptionChecks: n >= 30 ? ["shapiro_wilk"] : [],
        reasoning: n >= 30
          ? "N≥30: Pearson correlation (parametric) as primary, Spearman as robustness check."
          : "N<30: Spearman rank correlation (non-parametric) as primary — more robust to non-normality with small samples.",
        params: {
          columns: profile.numericColumns.slice(0, 2),
        },
      };
    }

    // ── Chi-square ──────────────────────────────────────────────────────────
    case "chisquare": {
      const expectedSmall = profile.rowCount < 40;
      return {
        primaryTest: expectedSmall ? "fisher_exact" : "chi_squared",
        alternativeTest: expectedSmall ? "chi_squared" : "fisher_exact",
        assumptionChecks: [],
        reasoning: expectedSmall
          ? "Small sample (N<40): Fisher's exact test (more reliable than chi-square with small expected counts)."
          : "Chi-squared test for association between categorical variables.",
        params: {
          columns: profile.categoricalColumns.slice(0, 2),
        },
      };
    }

    // ── Survival ─────────────────────────────────────────────────────────────
    case "survival": {
      const hasCovariates = profile.numericColumns.length > 2;
      if (q.includes("cox") || q.includes("hazard") || hasCovariates) {
        return {
          primaryTest: "cox_proportional_hazards",
          assumptionChecks: ["log_rank"],
          reasoning: "Cox proportional hazards regression for survival with covariates. Log-rank test included for group comparison.",
          params: {
            timeColumn: profile.timeColumn,
            eventColumn: profile.eventColumn,
            groupColumn: profile.groupColumn,
            covariates: profile.numericColumns.filter(c => c !== profile.timeColumn),
          },
        };
      }
      return {
        primaryTest: "kaplan_meier",
        alternativeTest: "log_rank",
        assumptionChecks: [],
        reasoning: "Kaplan-Meier survival curves with log-rank test for group comparison.",
        params: {
          timeColumn: profile.timeColumn,
          eventColumn: profile.eventColumn,
          groupColumn: profile.groupColumn,
        },
      };
    }

    // ── Logistic regression ──────────────────────────────────────────────────
    case "logistic": {
      return {
        primaryTest: "logistic_regression",
        assumptionChecks: [],
        reasoning: "Binary outcome detected. Using logistic regression.",
        params: {
          outcomeColumn: profile.categoricalColumns.find(c => {
            const vals = new Set(Object.values(profile.groupSizes || {}));
            return vals.size === 2;
          }) || profile.categoricalColumns[0],
          predictors: profile.numericColumns,
        },
      };
    }

    // ── Distribution ─────────────────────────────────────────────────────────
    case "distribution": {
      return {
        primaryTest: "shapiro_wilk",
        assumptionChecks: [],
        reasoning: "Distribution analysis with Shapiro-Wilk normality test.",
        params: {
          columns: profile.numericColumns,
        },
      };
    }

    default:
      return {
        primaryTest: "descriptive",
        assumptionChecks: [],
        reasoning: `Analysis type "${analysisType}" — defaulting to descriptive statistics.`,
        params: {
          columns: profile.numericColumns,
          groupBy: profile.groupColumn,
        },
      };
  }
}
