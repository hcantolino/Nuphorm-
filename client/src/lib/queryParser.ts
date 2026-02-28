/**
 * Natural Language Query Parser for Biostatistics
 * Parses user queries and extracts computation intents
 */

export interface ParsedQuery {
  intent: "stddev" | "mean" | "median" | "stats" | "fold_change" | "chart" | "table" | "unknown";
  column: string | null;
  confidence: number;
  parameters: Record<string, any>;
  rawQuery: string;
}

/**
 * Parse user query for statistical computation intent
 */
export function parseQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase().trim();

  // Standard deviation patterns
  if (
    /standard\s+deviation|std\s+dev|stddev|std\.dev|variance|spread|dispersion/.test(
      lowerQuery
    )
  ) {
    const column = extractColumnName(lowerQuery);
    return {
      intent: "stddev",
      column,
      confidence: 0.95,
      parameters: { type: "sample" },
      rawQuery: query,
    };
  }

  // Mean/average patterns
  if (/mean|average|avg|median/.test(lowerQuery) && !/median/.test(lowerQuery)) {
    const column = extractColumnName(lowerQuery);
    return {
      intent: "mean",
      column,
      confidence: 0.95,
      parameters: {},
      rawQuery: query,
    };
  }

  // Median patterns
  if (/median|middle\s+value/.test(lowerQuery)) {
    const column = extractColumnName(lowerQuery);
    return {
      intent: "median",
      column,
      confidence: 0.9,
      parameters: {},
      rawQuery: query,
    };
  }

  // Comprehensive statistics patterns
  if (
    /descriptive\s+stat|summary\s+stat|basic\s+stat|all\s+stat|comprehensive|overview|profile/.test(
      lowerQuery
    )
  ) {
    const column = extractColumnName(lowerQuery);
    return {
      intent: "stats",
      column,
      confidence: 0.92,
      parameters: { includeAll: true },
      rawQuery: query,
    };
  }

  // Fold change patterns
  if (/fold.?change|fc|log2|log\s+2|expression\s+ratio|ratio/.test(lowerQuery)) {
    return {
      intent: "fold_change",
      column: "fold_change",
      confidence: 0.88,
      parameters: { scale: "log2" },
      rawQuery: query,
    };
  }

  // Chart/visualization patterns
  if (/chart|plot|graph|visuali|histogram|bar|scatter|line/.test(lowerQuery)) {
    const column = extractColumnName(lowerQuery);
    return {
      intent: "chart",
      column,
      confidence: 0.85,
      parameters: { type: "auto" },
      rawQuery: query,
    };
  }

  // Table patterns
  if (/table|rows|data|display|show/.test(lowerQuery)) {
    const column = extractColumnName(lowerQuery);
    return {
      intent: "table",
      column,
      confidence: 0.8,
      parameters: { limit: 10 },
      rawQuery: query,
    };
  }

  // Unknown intent
  return {
    intent: "unknown",
    column: null,
    confidence: 0.3,
    parameters: {},
    rawQuery: query,
  };
}

/**
 * Extract column name from query
 * Looks for common patterns like "for column_name", "of column_name", etc.
 */
function extractColumnName(query: string): string | null {
  // Pattern: "for column_name" or "of column_name"
  const forMatch = query.match(/(?:for|of|in)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (forMatch) return forMatch[1];

  // Pattern: "column_name standard deviation"
  const prefixMatch = query.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+/i);
  if (prefixMatch && !["the", "a", "an", "compute", "calculate", "find"].includes(prefixMatch[1].toLowerCase())) {
    return prefixMatch[1];
  }

  // Default to fold_change if not specified
  if (query.includes("fold") || query.includes("fc") || query.includes("expression")) {
    return "fold_change";
  }

  return null;
}

/**
 * Generate helpful suggestions based on query
 */
export function generateSuggestions(query: string, availableColumns: string[]): string[] {
  const parsed = parseQuery(query);
  const suggestions: string[] = [];

  if (parsed.intent === "stddev") {
    suggestions.push("Compute standard deviation for another column?");
    suggestions.push("Want to see the full statistical summary?");
    suggestions.push("Compare standard deviation across groups?");
  } else if (parsed.intent === "mean") {
    suggestions.push("Calculate standard deviation alongside mean?");
    suggestions.push("View the full descriptive statistics?");
    suggestions.push("Compare means across groups?");
  } else if (parsed.intent === "stats") {
    suggestions.push("Visualize the data with a chart?");
    suggestions.push("Create a statistical comparison?");
    suggestions.push("Export results to PDF report?");
  } else if (parsed.intent === "fold_change") {
    suggestions.push("Show genes with highest fold change?");
    suggestions.push("Filter by fold change threshold (e.g., > 2)?");
    suggestions.push("Create volcano plot for fold change vs p-value?");
  } else if (parsed.intent === "unknown") {
    suggestions.push("Try: 'Calculate standard deviation for fold_change'");
    suggestions.push("Try: 'Show me descriptive statistics'");
    suggestions.push("Try: 'Create a chart of the data'");
  }

  return suggestions;
}

/**
 * Validate if query requires data to be loaded
 */
export function requiresData(query: string): boolean {
  const parsed = parseQuery(query);
  return parsed.intent !== "unknown";
}

/**
 * Extract multiple columns from query
 * Useful for comparisons
 */
export function extractMultipleColumns(query: string): string[] {
  const columns: string[] = [];

  // Look for "column1 vs column2" or "column1 and column2"
  const vsMatch = query.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:vs|versus|and|compared\s+to)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (vsMatch) {
    columns.push(vsMatch[1], vsMatch[2]);
    return columns;
  }

  // Look for "for columns: col1, col2, col3"
  const colsMatch = query.match(/(?:for|of)\s+columns?:\s*([a-zA-Z_][a-zA-Z0-9_,\s]*)/i);
  if (colsMatch) {
    return colsMatch[1].split(",").map((c) => c.trim());
  }

  // Single column
  const single = extractColumnName(query);
  if (single) columns.push(single);

  return columns;
}

/**
 * Check if query is asking for a specific statistical test
 */
export function detectStatisticalTest(query: string): "ttest" | "anova" | "correlation" | "none" {
  const lower = query.toLowerCase();

  if (/t.?test|compare\s+groups|group\s+comparison/.test(lower)) {
    return "ttest";
  }

  if (/anova|multiple\s+group|variance/.test(lower)) {
    return "anova";
  }

  if (/correlation|relationship|associate/.test(lower)) {
    return "correlation";
  }

  return "none";
}

/**
 * Generate a natural language response based on parsed query
 */
export function generateResponse(parsed: ParsedQuery, result: any): string {
  const column = parsed.column || "the data";

  switch (parsed.intent) {
    case "stddev":
      return `The standard deviation for ${column} is ${result?.toFixed(4) || "N/A"}. This measures how spread out the values are from the mean.`;

    case "mean":
      return `The mean (average) for ${column} is ${result?.toFixed(4) || "N/A"}.`;

    case "median":
      return `The median for ${column} is ${result?.toFixed(4) || "N/A"}. This is the middle value when data is sorted.`;

    case "stats":
      return `Here's the statistical summary for ${column}:\n${formatStatsResult(result)}`;

    case "fold_change":
      return `Fold change analysis:\n${formatFoldChangeResult(result)}`;

    case "chart":
      return `Chart generated for ${column}. Check the visualization panel.`;

    case "table":
      return `Data table displayed with ${result?.length || 0} rows.`;

    default:
      return "I'm not sure what you're asking. Try: 'Calculate standard deviation for fold_change' or 'Show descriptive statistics'.";
  }
}

/**
 * Format statistics result for display
 */
function formatStatsResult(stats: any): string {
  if (!stats) return "No data available";

  const lines = [
    `Count: ${stats.n}`,
    `Mean: ${stats.mean?.toFixed(4) || "N/A"}`,
    `Median: ${stats.median?.toFixed(4) || "N/A"}`,
    `Std Dev: ${stats.stdDev?.toFixed(4) || "N/A"}`,
    `Min: ${stats.min?.toFixed(4) || "N/A"}`,
    `Max: ${stats.max?.toFixed(4) || "N/A"}`,
    `Range: ${stats.range?.toFixed(4) || "N/A"}`,
  ];

  if (stats.cv !== null) lines.push(`Coefficient of Variation: ${stats.cv?.toFixed(2) || "N/A"}%`);

  return lines.join("\n");
}

/**
 * Format fold change result for display
 */
function formatFoldChangeResult(result: any): string {
  if (!result) return "No fold change data available";

  return [
    `Mean Fold Change: ${result.meanFoldChange?.toFixed(4) || "N/A"}`,
    `Std Dev: ${result.stdDevFoldChange?.toFixed(4) || "N/A"}`,
    `Median: ${result.medianFoldChange?.toFixed(4) || "N/A"}`,
    `Upregulated (>1.5x): ${result.upregulated}`,
    `Downregulated (<0.67x): ${result.downregulated}`,
    `Unchanged: ${result.unchanged}`,
  ].join("\n");
}
