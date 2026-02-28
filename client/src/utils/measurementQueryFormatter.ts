/**
 * Format a measurement into an AI query string
 * Examples:
 * - "mean" → "create a mean for fold_change"
 * - "t_test" → "perform a t-test on expression_level"
 * - "km" → "compute kaplan-meier estimates for survival_time"
 */
export function formatMeasurementQuery(
  measurementId: string,
  measurementName: string,
  columnName?: string
): string {
  const col = columnName || "the data";

  const queryMap: Record<string, string> = {
    // Descriptive Statistics
    mean: `create a mean for ${col}`,
    median: `compute the median of ${col}`,
    mode: `find the mode of ${col}`,
    std_dev: `calculate the standard deviation of ${col}`,
    variance: `compute the variance of ${col}`,
    range: `calculate the range of ${col}`,
    iqr: `compute the interquartile range of ${col}`,
    min_max: `find the min and max values of ${col}`,
    freq: `compute frequencies and percentages for ${col}`,
    patient_disp: `create a patient disposition table`,
    exposure: `summarize treatment exposure`,

    // Efficacy Analyses
    t_test: `perform a t-test on ${col}`,
    wilcoxon: `perform a Wilcoxon rank-sum test on ${col}`,
    chi_square: `perform a chi-square test on ${col}`,
    fisher_exact: `perform Fisher's exact test on ${col}`,
    ancova: `perform ANCOVA analysis on ${col}`,
    anova: `perform ANOVA on ${col}`,
    logistic_reg: `perform logistic regression on ${col}`,
    mmrm: `perform mixed models for repeated measures on ${col}`,
    non_inferiority: `perform non-inferiority testing on ${col}`,
    ci: `compute confidence intervals for ${col}`,
    p_value: `calculate p-values for ${col}`,

    // Survival and Time-to-Event
    km: `compute kaplan-meier estimates for ${col}`,
    log_rank: `perform log-rank test on ${col}`,
    cox: `perform Cox proportional hazards regression on ${col}`,
    pfs: `analyze progression-free survival for ${col}`,
    os: `analyze overall survival for ${col}`,
    ttp: `analyze time to progression for ${col}`,

    // Safety Analyses
    ae_incidence: `create adverse event incidence tables`,
    sae: `summarize serious adverse events`,
    shift_tables: `create shift tables for lab values`,
    lab_summaries: `summarize laboratory parameters`,
    vital_signs: `summarize vital signs`,
    ecg: `summarize ECG findings`,

    // PK/PD Analyses
    auc: `calculate AUC for ${col}`,
    cmax: `calculate Cmax for ${col}`,
    tmax: `calculate Tmax for ${col}`,
    t_half: `calculate half-life for ${col}`,
    clearance: `calculate clearance for ${col}`,
    vd: `calculate volume of distribution for ${col}`,
    pop_pk: `perform population PK modeling on ${col}`,
    exposure_response: `analyze exposure-response relationships for ${col}`,
    conc_time: `create concentration-time profiles for ${col}`,

    // Bioequivalence/Biosimilarity
    be_ci: `compute 90% confidence intervals for ${col}`,
    avg_be: `perform average bioequivalence testing on ${col}`,
    ind_be: `perform individual bioequivalence testing on ${col}`,
    pop_be: `perform population bioequivalence testing on ${col}`,
    biosim_comp: `analyze biosimilarity comparability for ${col}`,
  };

  return queryMap[measurementId] || `analyze ${measurementName} for ${col}`;
}

/**
 * Get the first numeric column name from data
 * Used as default column when user clicks + button
 */
export function getFirstNumericColumn(data: Record<string, any>[]): string | undefined {
  if (!data || data.length === 0) return undefined;

  const firstRow = data[0];
  for (const [key, value] of Object.entries(firstRow)) {
    if (typeof value === "number") {
      return key;
    }
  }

  return undefined;
}
