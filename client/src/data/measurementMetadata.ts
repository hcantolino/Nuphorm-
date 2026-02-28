export interface MeasurementMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
  formula: string;
  useCases: string[];
  interpretation: string;
  example?: string;
}

export const measurementMetadata: Record<string, MeasurementMetadata> = {
  // Measures of Central Tendency
  mean: {
    id: "mean",
    name: "Mean",
    category: "Measures of Central Tendency",
    description: "The average value of a dataset, calculated by summing all values and dividing by the number of observations.",
    formula: "μ = (Σx) / n",
    useCases: [
      "Summarizing typical patient age in clinical trials",
      "Calculating average treatment duration",
      "Comparing baseline characteristics between groups",
    ],
    interpretation:
      "A higher mean indicates a larger average value. Sensitive to outliers, so use with median for skewed distributions.",
    example: "Mean age of 45.3 years in a patient cohort",
  },
  median: {
    id: "median",
    name: "Median",
    category: "Measures of Central Tendency",
    description: "The middle value when data is ordered. Divides the dataset into two equal halves.",
    formula: "Median = middle value when n is odd; average of two middle values when n is even",
    useCases: [
      "Reporting income or cost data (resistant to outliers)",
      "Describing skewed distributions",
      "Presenting patient survival times",
    ],
    interpretation:
      "More robust than mean for skewed data. Useful when extreme values are present.",
    example: "Median survival time of 24 months",
  },
  mode: {
    id: "mode",
    name: "Mode",
    category: "Measures of Central Tendency",
    description: "The most frequently occurring value in a dataset.",
    formula: "Mode = value with highest frequency",
    useCases: [
      "Identifying most common diagnosis codes",
      "Finding most frequent dosing schedule",
      "Describing categorical data distributions",
    ],
    interpretation:
      "Useful for categorical data. A dataset can have multiple modes (bimodal, multimodal).",
    example: "Most common adverse event reported in 45% of patients",
  },

  // Measures of Dispersion
  std_dev: {
    id: "std_dev",
    name: "Standard Deviation",
    category: "Measures of Dispersion",
    description: "Measures how spread out data points are from the mean. Square root of variance.",
    formula: "σ = √(Σ(x - μ)² / n)",
    useCases: [
      "Assessing variability in patient measurements",
      "Calculating confidence intervals",
      "Comparing consistency between treatment groups",
    ],
    interpretation:
      "Larger SD indicates more variability. ~68% of data falls within 1 SD of mean in normal distribution.",
    example: "SD of 12.5 mmHg for systolic blood pressure",
  },
  variance: {
    id: "variance",
    name: "Variance",
    category: "Measures of Dispersion",
    description: "The average of squared deviations from the mean. Measures spread of data.",
    formula: "σ² = Σ(x - μ)² / n",
    useCases: [
      "Statistical testing and modeling",
      "Comparing group homogeneity",
      "Assessing measurement precision",
    ],
    interpretation:
      "Larger variance indicates greater spread. Less intuitive than SD due to squared units.",
    example: "Variance of 156.25 for patient weight measurements",
  },
  range: {
    id: "range",
    name: "Range",
    category: "Measures of Dispersion",
    description: "The difference between the maximum and minimum values in a dataset.",
    formula: "Range = Max - Min",
    useCases: [
      "Identifying data entry errors or outliers",
      "Describing acceptable parameter ranges",
      "Quick assessment of data spread",
    ],
    interpretation:
      "Simple but sensitive to outliers. Provides no information about distribution between min and max.",
    example: "Age range: 18-85 years",
  },
  iqr: {
    id: "iqr",
    name: "Interquartile Range (IQR)",
    category: "Measures of Dispersion",
    description: "The range between the 25th and 75th percentiles, containing the middle 50% of data.",
    formula: "IQR = Q3 - Q1",
    useCases: [
      "Identifying outliers (values beyond 1.5×IQR)",
      "Describing skewed distributions",
      "Box plot construction",
    ],
    interpretation:
      "Robust to outliers. Useful for non-normal distributions. Larger IQR indicates more variability.",
    example: "IQR of 15 mmHg for diastolic blood pressure",
  },

  // Frequencies and Percentages
  freq: {
    id: "freq",
    name: "Frequencies",
    category: "Frequencies and Percentages",
    description: "Count of how many times each value occurs in a dataset.",
    formula: "Frequency = count of occurrences",
    useCases: [
      "Tabulating adverse event counts",
      "Reporting patient demographics",
      "Analyzing categorical outcomes",
    ],
    interpretation:
      "Provides absolute counts. Useful for understanding distribution of categorical variables.",
    example: "Headache reported in 127 patients, nausea in 89 patients",
  },
  percent: {
    id: "percent",
    name: "Percentages",
    category: "Frequencies and Percentages",
    description: "Proportion of a value relative to the total, expressed as a percentage.",
    formula: "Percentage = (Frequency / Total) × 100%",
    useCases: [
      "Reporting adverse event rates",
      "Describing demographic proportions",
      "Communicating efficacy rates",
    ],
    interpretation:
      "Easier to interpret than raw frequencies. Must report both frequency and percentage.",
    example: "32.5% of patients experienced headache",
  },
  cum_freq: {
    id: "cum_freq",
    name: "Cumulative Frequencies",
    category: "Frequencies and Percentages",
    description: "Running total of frequencies, showing how many observations fall below each value.",
    formula: "Cumulative Frequency = sum of all frequencies up to current value",
    useCases: [
      "Calculating percentiles",
      "Determining median and quartiles",
      "Assessing cumulative efficacy over time",
    ],
    interpretation:
      "Useful for understanding distribution shape. Final cumulative frequency equals total sample size.",
    example: "Cumulative percentage reaching 90% efficacy by week 8",
  },

  // P-values
  p_value: {
    id: "p_value",
    name: "P-values",
    category: "P-values",
    description: "Probability of observing results as extreme as those obtained, assuming null hypothesis is true.",
    formula: "p = P(test statistic | H₀ is true)",
    useCases: [
      "Determining statistical significance",
      "Hypothesis testing in clinical trials",
      "Comparing treatment efficacy",
    ],
    interpretation:
      "p < 0.05 typically indicates statistical significance. Smaller p-value = stronger evidence against null hypothesis.",
    example: "p = 0.032 indicates significant difference between groups",
  },

  // T-tests / ANOVA
  t_test: {
    id: "t_test",
    name: "T-tests / ANOVA",
    category: "T-tests / ANOVA",
    description:
      "Statistical tests comparing means. T-test for 2 groups, ANOVA for 3+ groups.",
    formula: "t = (x̄₁ - x̄₂) / (SE of difference)",
    useCases: [
      "Comparing baseline characteristics between treatment groups",
      "Testing efficacy differences between interventions",
      "Analyzing continuous outcomes in clinical trials",
    ],
    interpretation:
      "Larger |t| value indicates greater difference. ANOVA F-statistic tests overall group differences.",
    example: "t(98) = 2.45, p = 0.016 for treatment vs. control",
  },

  // Chi-square / Fisher's Exact
  chi_square: {
    id: "chi_square",
    name: "Chi-square / Fisher's Exact Test",
    category: "Chi-square / Fisher's Exact Test",
    description: "Tests association between categorical variables. Fisher's exact for small samples.",
    formula: "χ² = Σ((O - E)² / E)",
    useCases: [
      "Comparing adverse event rates between groups",
      "Analyzing treatment response (yes/no)",
      "Testing independence of categorical variables",
    ],
    interpretation:
      "Larger χ² indicates stronger association. Fisher's exact preferred when expected frequencies < 5.",
    example: "χ² = 6.24, p = 0.012 for adverse event rate comparison",
  },

  // Survival Analysis
  km: {
    id: "km",
    name: "Kaplan-Meier Estimator",
    category: "Survival Analysis",
    description: "Non-parametric method estimating survival probability over time, accounting for censoring.",
    formula: "S(t) = ∏(1 - dᵢ/nᵢ) for all times ≤ t",
    useCases: [
      "Analyzing time-to-event data (disease progression, death)",
      "Comparing survival curves between treatment groups",
      "Estimating median survival time",
    ],
    interpretation:
      "Survival probability decreases over time. Handles censored observations (patients lost to follow-up).",
    example: "Median overall survival: 24 months (95% CI: 18-30)",
  },
  log_rank: {
    id: "log_rank",
    name: "Log-Rank Test",
    category: "Survival Analysis",
    description: "Tests whether survival curves differ significantly between groups.",
    formula: "χ² = (O₁ - E₁)² / E₁ + (O₂ - E₂)² / E₂",
    useCases: [
      "Comparing survival between treatment arms",
      "Testing efficacy in oncology trials",
      "Analyzing time-to-event outcomes",
    ],
    interpretation:
      "p < 0.05 indicates significant difference in survival curves. Assumes proportional hazards.",
    example: "Log-rank test: χ² = 5.12, p = 0.024",
  },
  cox: {
    id: "cox",
    name: "Cox Proportional Hazards Model",
    category: "Survival Analysis",
    description: "Semi-parametric regression model analyzing relationship between covariates and survival.",
    formula: "h(t) = h₀(t) × exp(β₁X₁ + β₂X₂ + ...)",
    useCases: [
      "Adjusting for confounders in survival analysis",
      "Identifying prognostic factors",
      "Calculating hazard ratios",
    ],
    interpretation:
      "HR > 1 indicates increased hazard (worse outcome). HR < 1 indicates decreased hazard (better outcome).",
    example: "HR = 1.45 (95% CI: 1.12-1.87) for treatment effect",
  },

  // Regression Analysis
  linear_reg: {
    id: "linear_reg",
    name: "Linear Regression",
    category: "Regression Analysis",
    description: "Models linear relationship between continuous outcome and predictor variables.",
    formula: "Y = β₀ + β₁X₁ + β₂X₂ + ... + ε",
    useCases: [
      "Predicting continuous outcomes (e.g., blood pressure)",
      "Quantifying treatment effect",
      "Adjusting for covariates",
    ],
    interpretation:
      "β coefficient = change in outcome per unit increase in predictor. R² indicates model fit.",
    example: "Each 10 mg dose increase associated with 2.3 mmHg BP reduction",
  },
  logistic_reg: {
    id: "logistic_reg",
    name: "Logistic Regression",
    category: "Regression Analysis",
    description: "Models probability of binary outcome based on predictor variables.",
    formula: "log(odds) = β₀ + β₁X₁ + β₂X₂ + ...",
    useCases: [
      "Predicting treatment response (success/failure)",
      "Analyzing adverse event risk factors",
      "Calculating odds ratios",
    ],
    interpretation:
      "OR > 1 indicates increased odds of outcome. OR < 1 indicates decreased odds.",
    example: "OR = 2.15 (95% CI: 1.42-3.26) for adverse event risk",
  },
  ancova: {
    id: "ancova",
    name: "ANCOVA (Analysis of Covariance)",
    category: "Regression Analysis",
    description: "Analyzes group differences in outcome while controlling for continuous covariates.",
    formula: "Y = β₀ + β₁Group + β₂Covariate + ε",
    useCases: [
      "Comparing treatment groups adjusting for baseline values",
      "Controlling for confounding variables",
      "Increasing statistical power",
    ],
    interpretation:
      "Tests group effect after adjusting for covariate. Reduces error variance.",
    example: "Treatment effect significant after adjusting for baseline score (p = 0.008)",
  },

  // Study Design
  sample_size: {
    id: "sample_size",
    name: "Sample Size",
    category: "Study Design",
    description: "Minimum number of participants needed to detect clinically meaningful effect with adequate power.",
    formula: "n = (Zα + Zβ)² × (σ₁² + σ₂²) / (μ₁ - μ₂)²",
    useCases: [
      "Planning clinical trials",
      "Ensuring adequate statistical power",
      "Budget and resource allocation",
    ],
    interpretation:
      "Larger effect size requires smaller sample. Larger variability requires larger sample.",
    example: "Sample size: 150 per group for 80% power to detect 15% difference",
  },
  power: {
    id: "power",
    name: "Power Analysis",
    category: "Study Design",
    description: "Probability of detecting true effect if it exists. 1 - Type II error (β).",
    formula: "Power = 1 - β",
    useCases: [
      "Determining adequate sample size",
      "Assessing study feasibility",
      "Calculating required follow-up duration",
    ],
    interpretation:
      "80% power standard in clinical research. Higher power = lower risk of false negative.",
    example: "Study powered at 85% to detect 20% treatment difference",
  },
  itt: {
    id: "itt",
    name: "Intention-to-Treat (ITT) vs. Per-Protocol (PP)",
    category: "Study Design",
    description:
      "ITT analyzes all randomized patients as assigned. PP analyzes only protocol-adherent patients.",
    formula: "ITT = all randomized; PP = protocol adherent only",
    useCases: [
      "Primary analysis in RCTs (ITT)",
      "Sensitivity analysis (PP)",
      "Assessing treatment efficacy vs. effectiveness",
    ],
    interpretation:
      "ITT conservative, reflects real-world use. PP optimistic, reflects ideal conditions.",
    example: "ITT analysis showed 35% efficacy; PP analysis showed 48% efficacy",
  },
  bioequiv: {
    id: "bioequiv",
    name: "Bioequivalence (BE) Metrics",
    category: "Study Design",
    description: "Metrics comparing bioavailability of generic vs. reference drug formulations.",
    formula: "90% CI for AUC and Cmax ratios must be 0.80-1.25",
    useCases: [
      "Generic drug approval studies",
      "Comparing formulation bioavailability",
      "Regulatory compliance",
    ],
    interpretation:
      "If 90% CI falls within 0.80-1.25, formulations considered bioequivalent.",
    example: "AUC ratio: 0.95 (90% CI: 0.88-1.03) - bioequivalent",
  },
};
