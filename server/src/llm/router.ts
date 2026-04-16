/**
 * router.ts — Stage 3 Method Router (LLM-free)
 *
 * Picks the specific statistical method to run based on the classified topic,
 * data characteristics, and assumption checks. Rule-based — no LLM.
 */

export type MethodSelection = {
  method_id: string;
  method_name: string;
  assumptions_to_check: string[];
  compute_function: string;
  rationale: string;
};

export function selectMethod(
  topic: string,
  subtopic: string | undefined,
  detectedFields: any,
  columnTypes: Record<string, string>,
  rowCount: number
): MethodSelection {

  // ── HYPOTHESIS TESTING ──────────────────────────────────────────────────
  if (topic === "hypothesis_testing") {
    if (subtopic === "two_sample_comparison") {
      return {
        method_id: rowCount < 30 ? "mann_whitney_u" : "welch_t_test",
        method_name: rowCount < 30
          ? "Mann-Whitney U test (non-parametric, small n)"
          : "Welch's t-test (unequal variances, robust default)",
        assumptions_to_check: rowCount < 30
          ? ["independence"]
          : ["normality", "independence"],
        compute_function: rowCount < 30 ? "mann_whitney" : "welch_t_test",
        rationale: rowCount < 30
          ? "Sample size < 30. Non-parametric test avoids assuming normality."
          : "Welch's t-test is the robust default — handles unequal variances without requiring a prior F-test.",
      };
    }

    if (subtopic === "paired_comparison") {
      return {
        method_id: "paired_t_test",
        method_name: "Paired t-test",
        assumptions_to_check: ["normality_of_differences"],
        compute_function: "paired_t_test",
        rationale: "Two paired numeric columns detected (e.g. pre/post).",
      };
    }

    if (subtopic?.includes("anova") || subtopic === "multi_group_comparison") {
      const numericPredictors = Object.values(columnTypes).filter(t => t === "numeric").length;
      if (numericPredictors > 1 && detectedFields?.group_column) {
        return {
          method_id: "two_way_anova",
          method_name: "Two-way ANOVA",
          assumptions_to_check: ["normality", "homogeneity_of_variance"],
          compute_function: "two_way_anova",
          rationale: "Multiple factors detected. Two-way ANOVA tests main effects and interaction.",
        };
      }
      return {
        method_id: "one_way_anova",
        method_name: "One-way ANOVA",
        assumptions_to_check: ["normality", "homogeneity_of_variance"],
        compute_function: "one_way_anova",
        rationale: "One numeric outcome, one categorical with 3+ groups.",
      };
    }

    if (subtopic === "chi_square" || subtopic === "categorical_association") {
      const hasSmallExpected = rowCount < 40;
      return {
        method_id: hasSmallExpected ? "fisher_exact" : "chi_squared",
        method_name: hasSmallExpected
          ? "Fisher's exact test"
          : "Chi-squared test of independence",
        assumptions_to_check: hasSmallExpected ? [] : ["expected_cell_count_gte_5"],
        compute_function: hasSmallExpected ? "fisher_exact" : "chi_squared",
        rationale: hasSmallExpected
          ? "Small sample — Fisher's exact test is more reliable than chi-square."
          : "Standard chi-squared test for association between two categorical variables.",
      };
    }
  }

  // ── SURVIVAL ANALYSIS ──────────────────────────────────────────────────
  if (topic === "survival_analysis") {
    if (!detectedFields?.group_column) {
      return {
        method_id: "kaplan_meier",
        method_name: "Kaplan-Meier survival curve",
        assumptions_to_check: ["independent_censoring"],
        compute_function: "kaplan_meier",
        rationale: "Survival curve without group comparison.",
      };
    }

    const hasCovariates = Object.values(columnTypes).filter(t => t === "numeric").length > 3;
    if (hasCovariates || subtopic === "cox") {
      return {
        method_id: "cox_ph",
        method_name: "Cox proportional hazards regression",
        assumptions_to_check: [
          "independent_censoring",
          "proportional_hazards",
          "no_multicollinearity",
        ],
        compute_function: "cox_proportional_hazards",
        rationale: "Survival with covariates — Cox PH model adjusts for confounders.",
      };
    }

    return {
      method_id: "km_with_logrank",
      method_name: "Kaplan-Meier curves with log-rank test",
      assumptions_to_check: [
        "independent_censoring",
        "proportional_hazards_logrank",
      ],
      compute_function: "km_logrank",
      rationale: "Survival curves by group with log-rank test for between-group comparison.",
    };
  }

  // ── REGRESSION — LINEAR ────────────────────────────────────────────────
  if (topic === "regression_linear") {
    return {
      method_id: "ols_linear",
      method_name: "Ordinary least squares linear regression",
      assumptions_to_check: [
        "linearity",
        "independence",
        "homoscedasticity",
        "normality_of_residuals",
        "no_multicollinearity",
      ],
      compute_function: "ols_linear",
      rationale: "Numeric outcome + numeric/categorical predictors.",
    };
  }

  // ── REGRESSION — LOGISTIC ──────────────────────────────────────────────
  if (topic === "regression_logistic") {
    return {
      method_id: "logistic_regression",
      method_name: "Logistic regression",
      assumptions_to_check: [
        "linearity_of_logit",
        "independence",
        "no_multicollinearity",
        "adequate_events_per_predictor",
      ],
      compute_function: "logistic_regression",
      rationale: "Binary outcome + predictors.",
    };
  }

  // ── REGRESSION — MIXED ─────────────────────────────────────────────────
  if (topic === "regression_mixed") {
    return {
      method_id: "linear_mixed_model",
      method_name: "Linear mixed-effects model",
      assumptions_to_check: [
        "linearity",
        "normality_of_residuals",
        "normality_of_random_effects",
      ],
      compute_function: "linear_mixed_model",
      rationale: "Repeated measures / nested data detected.",
    };
  }

  // ── CORRELATION ────────────────────────────────────────────────────────
  if (topic === "correlation") {
    return {
      method_id: rowCount >= 30 ? "pearson" : "spearman",
      method_name: rowCount >= 30
        ? "Pearson product-moment correlation"
        : "Spearman rank correlation",
      assumptions_to_check: rowCount >= 30
        ? ["normality", "linearity"]
        : ["monotonic_relationship"],
      compute_function: rowCount >= 30 ? "pearson" : "spearman",
      rationale: rowCount >= 30
        ? "N≥30: Pearson (parametric) as primary with normality check."
        : "N<30: Spearman (non-parametric) — robust to non-normality.",
    };
  }

  // ── DESCRIPTIVE ────────────────────────────────────────────────────────
  if (topic === "descriptive_stats" || topic === "descriptive") {
    return {
      method_id: "descriptive_summary",
      method_name: "Descriptive statistics summary",
      assumptions_to_check: [],
      compute_function: "descriptive_summary",
      rationale: "Standard summary: mean, median, SD, IQR, min, max, n, missing.",
    };
  }

  // ── DISTRIBUTION ──────────────────────────────────────────────────────
  if (topic === "distribution") {
    return {
      method_id: "normality_tests",
      method_name: "Normality assessment (Shapiro-Wilk + D'Agostino-Pearson)",
      assumptions_to_check: [],
      compute_function: "normality_tests",
      rationale: "Distribution analysis with formal normality testing.",
    };
  }

  // ── BIOEQUIVALENCE ────────────────────────────────────────────────────
  if (topic === "bioequivalence") {
    return {
      method_id: "tost_be",
      method_name: "Two One-Sided Tests (TOST) for bioequivalence",
      assumptions_to_check: [
        "normality_of_log_transformed",
        "crossover_design_balance",
      ],
      compute_function: "tost_bioequivalence",
      rationale: "Standard 90% CI approach with 80-125% acceptance criteria.",
    };
  }

  // ── NCA / PHARMACOKINETICS ────────────────────────────────────────────
  if (topic === "nca" || topic === "pharmacokinetics") {
    return {
      method_id: "nca_analysis",
      method_name: "Non-compartmental pharmacokinetic analysis",
      assumptions_to_check: [],
      compute_function: "nca_parameters",
      rationale: "Standard NCA: Cmax, Tmax, AUC, t½, CL/F, Vd/F.",
    };
  }

  // ── FALLBACK ──────────────────────────────────────────────────────────
  throw new Error(`No method routing defined for topic: ${topic} / ${subtopic}`);
}
