/**
 * analysisValidator.ts — Stage 2: Analysis-type-specific data validation.
 *
 * Before running any analysis, validates that the uploaded data has the
 * required columns, sufficient rows, and correct data types for the
 * requested analysis type. Returns actionable error messages.
 */

export interface ValidationResult {
  valid: boolean;
  analysisType: string;
  errors: string[];
  warnings: string[];
  detectedColumns: {
    numeric: string[];
    categorical: string[];
    date: string[];
    id: string[];
  };
  suggestion?: string;
}

const ID_PATTERNS = /^(subj|patient|id|ptno|randno|screen|enrol)/i;
const DATE_PATTERNS = /^(date|dt|visit_date|collection_date|sample_date)/i;
const TIME_PATTERNS = /^(time|day|week|month|hour|t_|time_|duration|period|pfs|os_time|tte|follow)/i;
const EVENT_PATTERNS = /^(event|status|censor|dead|death|alive|os_status|pfs_status|cnsr)/i;
const GROUP_PATTERNS = /^(group|arm|treatment|trt|cohort|dose|condition|category|sex|gender|race)/i;

function classifyColumns(
  data: Record<string, any>[],
  columns: string[]
): ValidationResult["detectedColumns"] {
  const numeric: string[] = [];
  const categorical: string[] = [];
  const date: string[] = [];
  const id: string[] = [];

  for (const col of columns) {
    if (ID_PATTERNS.test(col)) { id.push(col); continue; }
    if (DATE_PATTERNS.test(col)) { date.push(col); continue; }

    const values = data.slice(0, 50).map(r => r[col]).filter(v => v !== null && v !== undefined && v !== "");
    if (values.length === 0) continue;

    const numericCount = values.filter(v => !isNaN(Number(v))).length;
    const numericRatio = numericCount / values.length;

    if (numericRatio > 0.8) {
      numeric.push(col);
    } else {
      categorical.push(col);
    }
  }

  return { numeric, categorical, date, id };
}

function findColumnByPattern(columns: string[], pattern: RegExp): string | null {
  return columns.find(c => pattern.test(c)) ?? null;
}

export function validateDataForAnalysis(
  analysisType: string,
  data: Record<string, any>[],
  columns: string[],
  classifications: Record<string, any>
): ValidationResult {
  const detected = classifyColumns(data, columns);
  const result: ValidationResult = {
    valid: true,
    analysisType,
    errors: [],
    warnings: [],
    detectedColumns: detected,
  };

  // Universal checks
  if (!data || data.length === 0) {
    result.valid = false;
    result.errors.push("No data rows provided. Upload a dataset before running analysis.");
    return result;
  }

  if (columns.length === 0) {
    result.valid = false;
    result.errors.push("No columns detected in the dataset.");
    return result;
  }

  // Analysis-specific validation
  switch (analysisType) {
    case "descriptive": {
      if (detected.numeric.length === 0) {
        result.valid = false;
        result.errors.push("Descriptive statistics require at least one numeric column. Found only categorical columns: " + detected.categorical.slice(0, 5).join(", "));
        result.suggestion = "Check that your numeric columns don't contain text values (e.g., '<LOQ', 'N/A').";
      }
      break;
    }

    case "ttest": {
      if (detected.numeric.length === 0) {
        result.valid = false;
        result.errors.push("T-test requires at least one numeric outcome column.");
      }
      if (detected.categorical.length === 0) {
        result.warnings.push("No grouping column detected. A t-test compares two groups — ensure your data has a column identifying groups (e.g., 'Treatment', 'Group', 'Arm').");
      } else {
        const groupCol = findColumnByPattern(columns, GROUP_PATTERNS) ?? detected.categorical[0];
        const uniqueGroups = new Set(data.map(r => r[groupCol]).filter(v => v !== null && v !== ""));
        if (uniqueGroups.size < 2) {
          result.valid = false;
          result.errors.push(`Column "${groupCol}" has only ${uniqueGroups.size} unique group(s). A t-test requires exactly 2 groups.`);
        } else if (uniqueGroups.size > 2) {
          result.warnings.push(`Column "${groupCol}" has ${uniqueGroups.size} groups. A t-test compares exactly 2 groups. Consider ANOVA for 3+ groups, or specify which 2 groups to compare.`);
        }
      }
      if (data.length < 6) {
        result.warnings.push(`Only ${data.length} rows. T-tests typically need ≥30 observations per group for reliable results. With small samples, consider a non-parametric alternative (Mann-Whitney U).`);
      }
      break;
    }

    case "anova": {
      if (detected.numeric.length === 0) {
        result.valid = false;
        result.errors.push("ANOVA requires at least one numeric outcome column.");
      }
      const groupCol = findColumnByPattern(columns, GROUP_PATTERNS) ?? detected.categorical[0];
      if (!groupCol) {
        result.valid = false;
        result.errors.push("ANOVA requires a grouping column (e.g., 'Treatment', 'Group', 'Arm'). No categorical column found.");
      } else {
        const uniqueGroups = new Set(data.map(r => r[groupCol]).filter(v => v !== null && v !== ""));
        if (uniqueGroups.size < 3) {
          result.warnings.push(`Column "${groupCol}" has ${uniqueGroups.size} groups. ANOVA is for 3+ groups. For 2 groups, use a t-test instead.`);
        }
      }
      break;
    }

    case "survival": {
      const timeCol = findColumnByPattern(columns, TIME_PATTERNS);
      const eventCol = findColumnByPattern(columns, EVENT_PATTERNS);

      if (!timeCol) {
        result.valid = false;
        result.errors.push("Survival analysis requires a TIME column (e.g., 'PFS_DAYS', 'OS_TIME', 'DURATION', 'TIME'). None detected.");
        result.suggestion = "Rename your time column to include 'time', 'days', 'months', or 'duration'.";
      }
      if (!eventCol) {
        result.valid = false;
        result.errors.push("Survival analysis requires an EVENT/CENSOR column (e.g., 'EVENT', 'STATUS', 'CENSOR', 'DEAD'). None detected.");
        result.suggestion = "Add a column with 1=event, 0=censored.";
      }
      if (timeCol && detected.numeric.indexOf(timeCol) === -1) {
        result.warnings.push(`Time column "${timeCol}" may not be numeric. Survival analysis requires numeric time values.`);
      }
      if (data.length < 10) {
        result.warnings.push(`Only ${data.length} observations. Kaplan-Meier estimates are unreliable with <10 subjects.`);
      }
      break;
    }

    case "correlation": {
      if (detected.numeric.length < 2) {
        result.valid = false;
        result.errors.push(`Correlation requires at least 2 numeric columns. Found ${detected.numeric.length}: ${detected.numeric.join(", ") || "none"}.`);
      }
      if (data.length < 5) {
        result.warnings.push(`Only ${data.length} observations. Correlation estimates need ≥10 pairs for meaningful results.`);
      }
      break;
    }

    case "chisquare": {
      if (detected.categorical.length < 2) {
        result.valid = false;
        result.errors.push(`Chi-square test requires at least 2 categorical columns. Found ${detected.categorical.length}: ${detected.categorical.join(", ") || "none"}.`);
      }
      break;
    }

    case "logistic": {
      if (detected.numeric.length === 0) {
        result.valid = false;
        result.errors.push("Logistic regression requires at least one numeric predictor column.");
      }
      // Check for binary outcome
      const binaryCandidates = detected.categorical.filter(col => {
        const vals = new Set(data.map(r => r[col]).filter(v => v !== null && v !== ""));
        return vals.size === 2;
      });
      if (binaryCandidates.length === 0) {
        result.warnings.push("No binary outcome column detected. Logistic regression requires a column with exactly 2 categories (e.g., 'Response': Yes/No).");
      }
      break;
    }

    case "bioequivalence": {
      const needsCols = ["cmax", "auc", "tmax"];
      const found = needsCols.filter(need =>
        columns.some(c => c.toLowerCase().includes(need))
      );
      if (found.length === 0) {
        result.warnings.push("Bioequivalence analysis typically requires PK parameters (Cmax, AUC, Tmax). None detected in column names.");
      }
      const periodCol = columns.find(c => /period|sequence|formulation|treatment/i.test(c));
      if (!periodCol) {
        result.warnings.push("No period/sequence column detected. Crossover BE studies require period and sequence identifiers.");
      }
      break;
    }

    case "nca": {
      const timeCol = findColumnByPattern(columns, /time|hour|min|day|t_/i);
      const concCol = columns.find(c => /conc|concentration|dv|cp|plasma/i.test(c));
      if (!timeCol) {
        result.valid = false;
        result.errors.push("NCA requires a TIME column (e.g., 'TIME', 'HOURS', 'TAFD'). None detected.");
      }
      if (!concCol) {
        result.valid = false;
        result.errors.push("NCA requires a CONCENTRATION column (e.g., 'CONC', 'DV', 'CONCENTRATION'). None detected.");
      }
      break;
    }

    case "sample_size": {
      // Sample size calculations don't require data — they use effect size, power, alpha
      // No data validation needed, but warn if they uploaded data
      if (data.length > 0) {
        result.warnings.push("Sample size/power calculations use effect size and significance level, not raw data. Your uploaded data won't be used directly — specify the expected effect size, alpha, and desired power.");
      }
      break;
    }

    default: {
      // General / visualization queries — minimal validation
      if (data.length < 2) {
        result.warnings.push(`Dataset has only ${data.length} row(s). Most analyses need at least 2 rows.`);
      }
    }
  }

  return result;
}
