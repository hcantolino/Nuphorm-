/**
 * Smart NLP Engine
 * Uses pattern matching and keyword detection for intelligent analysis suggestions
 * Simulates nlp.js functionality with regex-based NLP
 */

export interface NLPAnalysisIntent {
  intent: string;
  confidence: number;
  suggested_analysis: string;
  suggested_query: string;
  explanation: string;
  parameters: Record<string, any>;
}

export interface NLPResponse {
  user_query: string;
  detected_intents: NLPAnalysisIntent[];
  primary_intent: NLPAnalysisIntent | null;
  follow_up_suggestions: string[];
  data_insights: string[];
}

/**
 * Pattern definitions for different analysis types
 */
const ANALYSIS_PATTERNS = {
  kaplan_meier: {
    keywords: [
      "survival",
      "time to event",
      "event",
      "censored",
      "kaplan",
      "meier",
      "km curve",
      "survival curve",
    ],
    regex: /survival|time.?to.?event|kaplan.?meier|km.?curve|censored/i,
    confidence_boost: 0.2,
  },
  pk_pd: {
    keywords: [
      "pharmacokinetic",
      "pharmacodynamic",
      "pk",
      "pd",
      "concentration",
      "cmax",
      "tmax",
      "auc",
      "exposure",
    ],
    regex: /pharmacokinetic|pharmacodynamic|pk|pd|cmax|tmax|auc|concentration|exposure/i,
    confidence_boost: 0.2,
  },
  ba_be: {
    keywords: [
      "bioavailability",
      "bioequivalence",
      "ba",
      "be",
      "formulation",
      "generic",
      "reference",
      "test",
    ],
    regex: /bioavailability|bioequivalence|ba\/be|generic|formulation|reference.?product|test.?product/i,
    confidence_boost: 0.25,
  },
  dose_response: {
    keywords: [
      "dose",
      "response",
      "dose-response",
      "dose response",
      "ec50",
      "emax",
      "potency",
      "efficacy",
    ],
    regex: /dose.?response|ec50|emax|potency|dose.?effect|dose.?titration/i,
    confidence_boost: 0.2,
  },
  efficacy: {
    keywords: [
      "efficacy",
      "effectiveness",
      "response",
      "responder",
      "outcome",
      "endpoint",
      "treatment effect",
    ],
    regex: /efficacy|effectiveness|responder.?rate|treatment.?effect|clinical.?outcome/i,
    confidence_boost: 0.15,
  },
  safety: {
    keywords: [
      "safety",
      "adverse",
      "ae",
      "adverse event",
      "toxicity",
      "side effect",
      "tolerability",
    ],
    regex: /safety|adverse.?event|ae|toxicity|side.?effect|tolerability|safety.?signal/i,
    confidence_boost: 0.15,
  },
  correlation: {
    keywords: ["correlation", "relationship", "association", "covariate", "predictor"],
    regex: /correlation|relationship|association|covariate|predictor|influence/i,
    confidence_boost: 0.1,
  },
  comparison: {
    keywords: [
      "compare",
      "difference",
      "between",
      "group",
      "treatment",
      "control",
      "vs",
    ],
    regex: /compare|difference|between.?group|treatment.?vs|control.?vs|group.?comparison/i,
    confidence_boost: 0.1,
  },
};

/**
 * Detect analysis intent from user query
 */
export function detectAnalysisIntent(
  userQuery: string,
  dataCharacteristics: Record<string, boolean>
): NLPAnalysisIntent[] {
  const intents: NLPAnalysisIntent[] = [];
  const queryLower = userQuery.toLowerCase();

  for (const [analysisType, pattern] of Object.entries(ANALYSIS_PATTERNS)) {
    if (pattern.regex.test(userQuery)) {
      // Base confidence from pattern match
      let confidence = 0.6;

      // Boost confidence if data has relevant characteristics
      if (analysisType === "kaplan_meier" && dataCharacteristics.has_survival_data) {
        confidence += pattern.confidence_boost + 0.2;
      } else if (analysisType === "pk_pd" && dataCharacteristics.has_concentration_data) {
        confidence += pattern.confidence_boost + 0.2;
      } else if (analysisType === "ba_be" && dataCharacteristics.has_control_treated) {
        confidence += pattern.confidence_boost + 0.15;
      } else if (analysisType === "dose_response" && dataCharacteristics.has_dose_data) {
        confidence += pattern.confidence_boost + 0.15;
      } else if (analysisType === "efficacy" && dataCharacteristics.has_efficacy_data) {
        confidence += pattern.confidence_boost + 0.15;
      } else if (analysisType === "safety" && dataCharacteristics.has_safety_data) {
        confidence += pattern.confidence_boost + 0.15;
      } else {
        confidence += pattern.confidence_boost;
      }

      // Cap confidence at 0.99
      confidence = Math.min(0.99, confidence);

      intents.push({
        intent: analysisType,
        confidence,
        suggested_analysis: getSuggestedAnalysis(analysisType),
        suggested_query: getSuggestedQuery(analysisType),
        explanation: getIntentExplanation(analysisType),
        parameters: extractParameters(analysisType, userQuery),
      });
    }
  }

  // Sort by confidence
  intents.sort((a, b) => b.confidence - a.confidence);

  return intents;
}

/**
 * Get suggested analysis for intent
 */
function getSuggestedAnalysis(intent: string): string {
  const suggestions: Record<string, string> = {
    kaplan_meier:
      "Kaplan-Meier Survival Analysis - Visualize survival curves and compare groups",
    pk_pd: "Pharmacokinetic/Pharmacodynamic Modeling - Link concentration to effect",
    ba_be: "Bioavailability/Bioequivalence Analysis - Compare formulations against FDA criteria",
    dose_response: "Dose-Response Modeling - Estimate EC50, Emax, and potency",
    efficacy: "Efficacy Analysis - Calculate responder rates and effect sizes",
    safety: "Safety Assessment - Identify adverse events and risk signals",
    correlation: "Correlation Analysis - Explore relationships between variables",
    comparison: "Group Comparison - Perform t-tests or ANOVA",
  };
  return suggestions[intent] || "Statistical Analysis";
}

/**
 * Get suggested query for intent
 */
function getSuggestedQuery(intent: string): string {
  const queries: Record<string, string> = {
    kaplan_meier:
      "Run Kaplan-Meier analysis with survival curves and log-rank test",
    pk_pd: "Perform PK/PD modeling and estimate key parameters",
    ba_be: "Calculate bioequivalence ratio and 90% CI, check FDA criteria",
    dose_response: "Model dose-response relationship and estimate EC50/Emax",
    efficacy: "Calculate responder rate, effect size, and NNT",
    safety: "Assess adverse event rates and safety signals",
    correlation: "Calculate Pearson correlation and p-values",
    comparison: "Compare groups with appropriate statistical test",
  };
  return queries[intent] || "Perform analysis";
}

/**
 * Get explanation for intent
 */
function getIntentExplanation(intent: string): string {
  const explanations: Record<string, string> = {
    kaplan_meier:
      "Your data appears to contain survival/time-to-event information. Kaplan-Meier analysis is ideal for visualizing survival curves and comparing treatment groups.",
    pk_pd: "Your query mentions pharmacokinetic or pharmacodynamic parameters. We can model the relationship between drug concentration and effect.",
    ba_be: "Your data suggests a bioavailability/bioequivalence study. We'll calculate the ratio and confidence interval to assess FDA compliance.",
    dose_response:
      "Your data contains dose information. We can model the dose-response relationship to estimate key parameters like EC50.",
    efficacy:
      "Your query focuses on efficacy. We can calculate responder rates, effect sizes, and number needed to treat.",
    safety:
      "Your data contains safety information. We'll assess adverse event rates and identify potential safety signals.",
    correlation:
      "You're interested in relationships between variables. We can perform correlation analysis with statistical testing.",
    comparison:
      "You want to compare groups. We'll perform appropriate statistical tests based on your data structure.",
  };
  return explanations[intent] || "Analysis recommended based on your query.";
}

/**
 * Extract parameters from query
 */
function extractParameters(intent: string, query: string): Record<string, any> {
  const params: Record<string, any> = {};
  const queryLower = query.toLowerCase();

  // Extract confidence level
  const ciMatch = query.match(/(\d+)%\s*(?:ci|confidence)/i);
  if (ciMatch) {
    params.confidence_level = parseInt(ciMatch[1]);
  }

  // Extract significance level
  const alphaMatch = query.match(/(?:alpha|p.?value|significance)\s*[=<]\s*0\.(\d+)/i);
  if (alphaMatch) {
    params.alpha = parseFloat(`0.${alphaMatch[1]}`);
  }

  // Extract group names
  if (queryLower.includes("treatment") || queryLower.includes("control")) {
    params.has_groups = true;
  }

  // Extract time reference
  if (queryLower.includes("month") || queryLower.includes("week")) {
    params.time_unit = queryLower.includes("month") ? "month" : "week";
  }

  return params;
}

/**
 * Generate follow-up suggestions
 */
export function generateFollowUpSuggestions(
  primaryIntent: NLPAnalysisIntent,
  dataCharacteristics: Record<string, boolean>
): string[] {
  const suggestions: string[] = [];

  switch (primaryIntent.intent) {
    case "kaplan_meier":
      suggestions.push("Would you like to perform a log-rank test to compare survival curves?");
      suggestions.push("Should we stratify by treatment group or other covariates?");
      if (dataCharacteristics.has_safety_data) {
        suggestions.push("Want to assess safety events alongside survival?");
      }
      break;

    case "pk_pd":
      suggestions.push("Should we estimate individual PK parameters?");
      suggestions.push("Want to perform population PK modeling?");
      if (dataCharacteristics.has_dose_data) {
        suggestions.push("Should we model dose-exposure-response relationships?");
      }
      break;

    case "ba_be":
      suggestions.push("Want to perform a detailed bioequivalence assessment?");
      suggestions.push("Should we check EMA criteria in addition to FDA?");
      suggestions.push("Would you like to assess individual bioequivalence?");
      break;

    case "dose_response":
      suggestions.push("Should we fit a sigmoid or linear dose-response model?");
      suggestions.push("Want to estimate therapeutic window or margin of safety?");
      if (dataCharacteristics.has_safety_data) {
        suggestions.push("Should we compare efficacy vs safety dose-response curves?");
      }
      break;

    case "efficacy":
      suggestions.push("Want to calculate confidence intervals around effect estimates?");
      suggestions.push("Should we perform subgroup efficacy analysis?");
      if (dataCharacteristics.has_safety_data) {
        suggestions.push("Want to assess efficacy-safety trade-offs?");
      }
      break;

    case "safety":
      suggestions.push("Should we perform risk stratification by patient characteristics?");
      suggestions.push("Want to assess dose-safety relationships?");
      suggestions.push("Should we calculate number needed to harm (NNH)?");
      break;

    default:
      suggestions.push("Would you like to perform additional statistical tests?");
      suggestions.push("Want to generate a comprehensive analysis report?");
  }

  return suggestions;
}

/**
 * Generate data insights
 */
export function generateDataInsights(
  dataCharacteristics: Record<string, boolean>,
  dataQualityScore: number
): string[] {
  const insights: string[] = [];

  if (dataQualityScore < 50) {
    insights.push(
      "⚠ Data quality score is low. Consider reviewing for missing values and outliers."
    );
  } else if (dataQualityScore < 75) {
    insights.push(
      "Data quality is moderate. Some data cleaning may improve analysis reliability."
    );
  } else {
    insights.push("✓ Data quality is good. Proceed with confidence.");
  }

  if (dataCharacteristics.has_survival_data) {
    insights.push(
      "📊 Survival/time-to-event data detected. Kaplan-Meier analysis is recommended."
    );
  }

  if (dataCharacteristics.has_dose_data) {
    insights.push(
      "💊 Dose data detected. Consider dose-response or PK/PD modeling."
    );
  }

  if (dataCharacteristics.has_efficacy_data && dataCharacteristics.has_safety_data) {
    insights.push(
      "⚖️ Both efficacy and safety data present. Benefit-risk analysis recommended."
    );
  }

  if (dataCharacteristics.has_paired_data) {
    insights.push(
      "🔄 Paired/longitudinal data detected. Consider repeated measures analysis."
    );
  }

  return insights;
}

/**
 * Process user query and generate NLP response
 */
export function processQuery(
  userQuery: string,
  dataCharacteristics: Record<string, boolean>,
  dataQualityScore: number = 85
): NLPResponse {
  const detectedIntents = detectAnalysisIntent(userQuery, dataCharacteristics);
  const primaryIntent = detectedIntents.length > 0 ? detectedIntents[0] : null;

  const followUpSuggestions = primaryIntent
    ? generateFollowUpSuggestions(primaryIntent, dataCharacteristics)
    : [];
  const dataInsights = generateDataInsights(dataCharacteristics, dataQualityScore);

  return {
    user_query: userQuery,
    detected_intents: detectedIntents,
    primary_intent: primaryIntent,
    follow_up_suggestions: followUpSuggestions,
    data_insights: dataInsights,
  };
}
