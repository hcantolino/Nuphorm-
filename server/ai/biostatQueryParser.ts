/**
 * Pharmaceutical Biostatistician Query Parser
 * Detects statistical intent, pharma-specific analyses, and data requirements
 */

export interface ParsedQuery {
  intent: StatisticalIntent;
  pharmaIntent?: PharmaIntent;
  dataRequirements: DataRequirement[];
  clarifyingQuestions: string[];
  suggestedAnalyses: string[];
  confidence: number;
  rawQuery: string;
}

export type StatisticalIntent =
  | "descriptive"
  | "t_test"
  | "anova"
  | "regression"
  | "survival"
  | "correlation"
  | "chi_square"
  | "mann_whitney"
  | "kruskal_wallis"
  | "wilcoxon"
  | "logistic_regression"
  | "unknown";

export type PharmaIntent =
  | "bioequivalence"
  | "dose_response"
  | "pk_pd"
  | "efficacy"
  | "safety"
  | "none";

export interface DataRequirement {
  name: string;
  type: "numeric" | "categorical" | "date" | "any";
  required: boolean;
  description: string;
}

/**
 * Parse user query to detect statistical intent
 */
export function parseQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  // Initialize result
  const result: ParsedQuery = {
    intent: "unknown",
    pharmaIntent: "none",
    dataRequirements: [],
    clarifyingQuestions: [],
    suggestedAnalyses: [],
    confidence: 0,
    rawQuery: query,
  };

  // Detect statistical intent
  if (
    /descriptive|summary|overview|explore|distribution|histogram|mean|median|sd|std dev/i.test(
      query
    )
  ) {
    result.intent = "descriptive";
    result.confidence = 0.9;
    result.dataRequirements = [
      {
        name: "any_numeric_column",
        type: "numeric",
        required: true,
        description: "Any numeric column to summarize",
      },
    ];
  } else if (
    /t.?test|compare.*group|difference.*treatment|paired|unpaired|independent/i.test(
      query
    )
  ) {
    result.intent = "t_test";
    result.confidence = 0.85;
    result.dataRequirements = [
      {
        name: "group_column",
        type: "categorical",
        required: true,
        description: "Column defining treatment groups",
      },
      {
        name: "outcome_column",
        type: "numeric",
        required: true,
        description: "Numeric outcome to compare",
      },
    ];

    // Ask clarifying questions
    if (!/paired|unpaired|independent/i.test(query)) {
      result.clarifyingQuestions.push(
        "Is this a paired or unpaired (independent) t-test?"
      );
    }
  } else if (/anova|analysis.*variance|compare.*groups|multiple.*group/i.test(query)) {
    result.intent = "anova";
    result.confidence = 0.85;
    result.dataRequirements = [
      {
        name: "group_column",
        type: "categorical",
        required: true,
        description: "Column defining treatment groups (3+ levels)",
      },
      {
        name: "outcome_column",
        type: "numeric",
        required: true,
        description: "Numeric outcome to compare",
      },
    ];
    result.clarifyingQuestions.push(
      "Do you want post-hoc tests (Tukey) to compare specific groups?"
    );
  } else if (
    /regress|predict|relationship|correlation|linear.*model|slope/i.test(query)
  ) {
    result.intent = "regression";
    result.confidence = 0.8;
    result.dataRequirements = [
      {
        name: "predictor_columns",
        type: "numeric",
        required: true,
        description: "Independent variables (predictors)",
      },
      {
        name: "outcome_column",
        type: "numeric",
        required: true,
        description: "Dependent variable (outcome)",
      },
    ];
  } else if (
    /survival|kaplan|meier|cox|time.*event|censored|hazard/i.test(query)
  ) {
    result.intent = "survival";
    result.confidence = 0.85;
    result.dataRequirements = [
      {
        name: "time_column",
        type: "numeric",
        required: true,
        description: "Time to event (days, months, years)",
      },
      {
        name: "event_column",
        type: "categorical",
        required: true,
        description: "Event status (0=censored, 1=event)",
      },
      {
        name: "group_column",
        type: "categorical",
        required: false,
        description: "Optional: Group for stratified analysis",
      },
    ];
  } else if (/correlat|association|relationship/i.test(query)) {
    result.intent = "correlation";
    result.confidence = 0.8;
    result.dataRequirements = [
      {
        name: "numeric_columns",
        type: "numeric",
        required: true,
        description: "Two or more numeric columns",
      },
    ];
  } else if (/chi.?square|categorical|contingency|independence/i.test(query)) {
    result.intent = "chi_square";
    result.confidence = 0.8;
    result.dataRequirements = [
      {
        name: "categorical_columns",
        type: "categorical",
        required: true,
        description: "Two categorical variables",
      },
    ];
  } else if (/mann.?whitney|wilcoxon|rank|non.?parametric/i.test(query)) {
    result.intent = "mann_whitney";
    result.confidence = 0.8;
    result.dataRequirements = [
      {
        name: "group_column",
        type: "categorical",
        required: true,
        description: "Two groups to compare",
      },
      {
        name: "outcome_column",
        type: "numeric",
        required: true,
        description: "Numeric outcome",
      },
    ];
  } else if (/kruskal.?wallis|multiple.*rank/i.test(query)) {
    result.intent = "kruskal_wallis";
    result.confidence = 0.8;
    result.dataRequirements = [
      {
        name: "group_column",
        type: "categorical",
        required: true,
        description: "Multiple groups (3+)",
      },
      {
        name: "outcome_column",
        type: "numeric",
        required: true,
        description: "Numeric outcome",
      },
    ];
  } else if (/logistic|binary|odds|probability/i.test(query)) {
    result.intent = "logistic_regression";
    result.confidence = 0.8;
    result.dataRequirements = [
      {
        name: "predictor_columns",
        type: "numeric",
        required: true,
        description: "Independent variables",
      },
      {
        name: "outcome_column",
        type: "categorical",
        required: true,
        description: "Binary outcome (0/1 or yes/no)",
      },
    ];
  }

  // Detect pharma-specific intent
  if (/bioequivalence|be|90.*ci|tost/i.test(query)) {
    result.pharmaIntent = "bioequivalence";
    result.confidence = Math.max(result.confidence, 0.9);
    result.dataRequirements.push({
      name: "treatment_column",
      type: "categorical",
      required: true,
      description: "Reference vs Test treatment",
    });
    result.clarifyingQuestions.push(
      "What is the bioequivalence margin (e.g., 80-125% for AUC)?"
    );
  } else if (/dose.?response|dose.*effect|concentration.*response/i.test(query)) {
    result.pharmaIntent = "dose_response";
    result.confidence = Math.max(result.confidence, 0.85);
    result.dataRequirements.push({
      name: "dose_column",
      type: "numeric",
      required: true,
      description: "Dose or concentration levels",
    });
  } else if (/pk|pd|auc|cmax|tmax|half.?life|clearance/i.test(query)) {
    result.pharmaIntent = "pk_pd";
    result.confidence = Math.max(result.confidence, 0.9);
    result.dataRequirements.push({
      name: "time_column",
      type: "numeric",
      required: true,
      description: "Time points for PK sampling",
    });
    result.dataRequirements.push({
      name: "concentration_column",
      type: "numeric",
      required: true,
      description: "Drug concentration values",
    });
  } else if (/efficacy|response|improvement|responder/i.test(query)) {
    result.pharmaIntent = "efficacy";
    result.confidence = Math.max(result.confidence, 0.8);
  } else if (/safety|adverse|ae|toxicity|side.?effect/i.test(query)) {
    result.pharmaIntent = "safety";
    result.confidence = Math.max(result.confidence, 0.8);
  }

  // Generate analysis suggestions
  result.suggestedAnalyses = generateSuggestions(query, result);

  return result;
}

/**
 * Generate suggested analyses based on query and data characteristics
 */
function generateSuggestions(
  query: string,
  parsed: ParsedQuery
): string[] {
  const suggestions: string[] = [];

  if (parsed.intent === "descriptive") {
    suggestions.push("Generate summary statistics and histograms");
    suggestions.push("Check for outliers and missing values");
  } else if (parsed.intent === "t_test") {
    suggestions.push("Check normality assumption (Shapiro-Wilk test)");
    suggestions.push("Check equal variance assumption (Levene's test)");
    suggestions.push("Consider non-parametric alternative (Mann-Whitney)");
  } else if (parsed.intent === "anova") {
    suggestions.push("Check normality and homogeneity of variance");
    suggestions.push("Perform post-hoc tests (Tukey HSD)");
    suggestions.push("Consider Kruskal-Wallis if assumptions violated");
  } else if (parsed.intent === "regression") {
    suggestions.push("Check for multicollinearity (VIF)");
    suggestions.push("Examine residual plots");
    suggestions.push("Consider interaction terms");
  } else if (parsed.intent === "survival") {
    suggestions.push("Generate Kaplan-Meier survival curves");
    suggestions.push("Perform log-rank test for group comparison");
    suggestions.push("Fit Cox proportional hazards model");
  }

  if (parsed.pharmaIntent === "bioequivalence") {
    suggestions.push("Calculate 90% confidence intervals");
    suggestions.push("Perform TOST (Two One-Sided Tests)");
    suggestions.push("Check FDA bioequivalence criteria (80-125%)");
  } else if (parsed.pharmaIntent === "dose_response") {
    suggestions.push("Fit dose-response curves (linear, exponential, sigmoid)");
    suggestions.push("Estimate ED50 and confidence intervals");
  } else if (parsed.pharmaIntent === "pk_pd") {
    suggestions.push("Calculate AUC (area under curve)");
    suggestions.push("Estimate Cmax and Tmax");
    suggestions.push("Estimate half-life and clearance");
  }

  return suggestions;
}

/**
 * Generate clarifying questions for ambiguous queries
 */
export function generateClarifyingQuestions(
  query: string,
  dataColumns: string[]
): string[] {
  const questions: string[] = [];
  const lowerQuery = query.toLowerCase();

  // Check if data requirements are ambiguous
  if (/compare|difference|test/i.test(query) && !/(paired|unpaired|independent)/i.test(query)) {
    questions.push("Is this a paired comparison (same subjects) or unpaired (different subjects)?");
  }

  if (/group|treatment|dose/i.test(query) && dataColumns.length > 0) {
    questions.push(
      `Which column represents the grouping variable? (Available: ${dataColumns.slice(0, 3).join(", ")})`
    );
  }

  if (/outcome|response|result/i.test(query) && dataColumns.length > 0) {
    questions.push(
      `Which column is the outcome variable? (Available: ${dataColumns.slice(0, 3).join(", ")})`
    );
  }

  if (/significant|p.?value|alpha/i.test(query) && !/0\.05|0\.01/i.test(query)) {
    questions.push("What significance level would you like to use? (Default: 0.05)");
  }

  return questions;
}

/**
 * Suggest analyses based on data structure
 */
export function suggestAnalysesByData(
  columns: string[],
  dataTypes: Record<string, string>
): string[] {
  const suggestions: string[] = [];
  const numericCols = Object.entries(dataTypes)
    .filter(([, type]) => type === "numeric")
    .map(([col]) => col);
  const categoricalCols = Object.entries(dataTypes)
    .filter(([, type]) => type === "categorical")
    .map(([col]) => col);

  // Suggest based on data structure
  if (numericCols.length > 0) {
    suggestions.push("Descriptive statistics and distributions");
  }

  if (numericCols.length >= 2) {
    suggestions.push("Correlation analysis");
  }

  if (numericCols.length > 0 && categoricalCols.length > 0) {
    suggestions.push("Compare groups (t-test or ANOVA)");
  }

  if (categoricalCols.length >= 2) {
    suggestions.push("Chi-square test for independence");
  }

  // Pharma-specific suggestions
  if (
    columns.some((c) => /fold.?change|log2|expression/i.test(c)) &&
    numericCols.length > 0
  ) {
    suggestions.push("Gene expression analysis (fold-change)");
  }

  if (
    columns.some((c) => /dose|concentration|exposure/i.test(c)) &&
    numericCols.length > 0
  ) {
    suggestions.push("Dose-response analysis");
  }

  if (
    columns.some((c) => /time|event|censored|status/i.test(c)) &&
    numericCols.length > 0
  ) {
    suggestions.push("Survival analysis (Kaplan-Meier)");
  }

  if (
    columns.some((c) => /auc|cmax|tmax|pk|concentration/i.test(c)) &&
    numericCols.length > 0
  ) {
    suggestions.push("PK/PD parameter estimation");
  }

  return suggestions;
}
