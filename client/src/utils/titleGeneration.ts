/**
 * Title Generation Utilities
 * Generates meaningful tab titles from AI queries and analysis types
 */

/**
 * Keywords that indicate specific analysis types
 */
const ANALYSIS_KEYWORDS = {
  mean: ['mean', 'average', 'avg'],
  median: ['median', 'med'],
  stdDev: ['std dev', 'standard deviation', 'sd', 'stdev'],
  variance: ['variance', 'var'],
  min: ['minimum', 'min'],
  max: ['maximum', 'max'],
  sum: ['sum', 'total'],
  count: ['count', 'n'],
  correlation: ['correlation', 'corr', 'r-squared', 'r2'],
  tTest: ['t-test', 't test', 'ttest', 'paired t', 'independent t'],
  anova: ['anova', 'one-way', 'two-way'],
  regression: ['regression', 'linear regression', 'logistic'],
  volcano: ['volcano', 'volcano plot'],
  boxplot: ['boxplot', 'box plot'],
  histogram: ['histogram', 'distribution'],
  scatter: ['scatter', 'scatter plot'],
  lineChart: ['line chart', 'line plot', 'trend'],
  barChart: ['bar chart', 'bar plot'],
  heatmap: ['heatmap', 'heat map'],
  pca: ['pca', 'principal component'],
  clustering: ['clustering', 'cluster', 'kmeans', 'k-means'],
  survival: ['survival', 'kaplan', 'cox'],
  powerAnalysis: ['power', 'sample size'],
  equivalence: ['equivalence', 'bioequivalence', 'tost'],
  subgroup: ['subgroup', 'stratified'],
  foldChange: ['fold change', 'fc', 'log2fc'],
  pValue: ['p-value', 'p value', 'pvalue'],
  confidence: ['confidence interval', 'ci', '95%'],
};

/**
 * Extract metric/column names from query
 * Looks for common patterns like "of column_name" or "for column_name"
 */
function extractMetricName(query: string): string | null {
  const patterns = [
    /(?:of|for|on|in)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
    /([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:column|field|metric|variable)/i,
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\b\s+(?:values?|data)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Identify analysis type from query keywords
 */
function identifyAnalysisType(
  query: string
): { type: string; keyword: string } | null {
  const lowerQuery = query.toLowerCase();

  for (const [type, keywords] of Object.entries(ANALYSIS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return { type, keyword };
      }
    }
  }

  return null;
}

/**
 * Format analysis type for display
 */
function formatAnalysisType(type: string): string {
  const formatMap: Record<string, string> = {
    mean: 'Mean',
    median: 'Median',
    stdDev: 'Std Dev',
    variance: 'Variance',
    min: 'Min',
    max: 'Max',
    sum: 'Sum',
    count: 'Count',
    correlation: 'Correlation',
    tTest: 'T-Test',
    anova: 'ANOVA',
    regression: 'Regression',
    volcano: 'Volcano Plot',
    boxplot: 'Boxplot',
    histogram: 'Histogram',
    scatter: 'Scatter Plot',
    lineChart: 'Line Chart',
    barChart: 'Bar Chart',
    heatmap: 'Heatmap',
    pca: 'PCA',
    clustering: 'Clustering',
    survival: 'Survival Analysis',
    powerAnalysis: 'Power Analysis',
    equivalence: 'Equivalence Test',
    subgroup: 'Subgroup Analysis',
    foldChange: 'Fold Change',
    pValue: 'P-Value',
    confidence: 'Confidence Interval',
  };

  return formatMap[type] || type;
}

/**
 * Generate a meaningful tab title from an AI query
 *
 * Examples:
 * - "create a mean for fold_change" → "Mean fold_change"
 * - "calculate median expression_level" → "Median expression_level"
 * - "generate a volcano plot" → "Volcano Plot"
 * - "run a t-test on treatment vs control" → "T-Test"
 *
 * @param query The user's AI query
 * @returns A meaningful tab title (max 30 characters)
 */
export function generateTitleFromQuery(query: string): string {
  if (!query || query.trim().length === 0) {
    return 'Analysis';
  }

  // Try to identify analysis type
  const analysis = identifyAnalysisType(query);

  if (!analysis) {
    // Fallback: use first few words
    const words = query.trim().split(/\s+/).slice(0, 3);
    return words.join(' ').substring(0, 30);
  }

  // Extract metric name if available
  const metric = extractMetricName(query);
  const formattedType = formatAnalysisType(analysis.type);

  if (metric) {
    const title = `${formattedType} ${metric}`;
    return title.substring(0, 40);
  }

  return formattedType.substring(0, 30);
}

/**
 * Generate a title from analysis results
 * Used when analysis completes and we have structured results
 *
 * @param analysisType Type of analysis performed
 * @param metric Column/metric being analyzed
 * @param statistic Optional statistic name (e.g., "p-value", "r-squared")
 * @returns A meaningful tab title
 */
export function generateTitleFromAnalysis(
  analysisType: string,
  metric?: string,
  statistic?: string
): string {
  const formatted = formatAnalysisType(analysisType);

  if (metric && statistic) {
    return `${formatted} ${metric} (${statistic})`.substring(0, 40);
  }

  if (metric) {
    return `${formatted} ${metric}`.substring(0, 40);
  }

  return formatted.substring(0, 30);
}

/**
 * Sanitize tab title for safe display
 * Removes special characters and limits length
 */
export function sanitizeTabTitle(title: string): string {
  return title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
    .trim()
    .substring(0, 50);
}

/**
 * Generate a default title based on timestamp
 */
export function generateDefaultTitle(): string {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `Analysis ${time}`;
}

/**
 * Detect if a query is a follow-up question or a new analysis
 * Follow-ups typically reference previous results or use pronouns
 */
export function isFollowUpQuery(query: string): boolean {
  const followUpPatterns = [
    /\b(also|additionally|then|next|now|what about)\b/i,
    /\b(the|this|that|these|those)\s+(result|data|chart|plot)/i,
    /\b(compare|contrast|difference)\b/i,
    /\b(more|less|higher|lower)\s+(than|to)\b/i,
  ];

  return followUpPatterns.some((pattern) => pattern.test(query));
}

/**
 * Extract column names from query
 * Useful for tracking which metrics are being analyzed
 */
export function extractColumnNames(query: string): string[] {
  const columns: string[] = [];

  // Pattern: "column_name" or 'column_name' or `column_name`
  const quotedPattern = /[`'""]([a-zA-Z_][a-zA-Z0-9_]*)[`'""]|([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match;

  while ((match = quotedPattern.exec(query)) !== null) {
    const column = match[1] || match[2];
    if (column && !columns.includes(column)) {
      columns.push(column);
    }
  }

  return columns;
}

/**
 * Generate a descriptive title for common pharmaceutical analyses
 */
export function generatePharmaTitle(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Specific pharma patterns
  if (lowerQuery.includes('pk') || lowerQuery.includes('pharmacokinetic')) {
    return 'PK Analysis';
  }
  if (lowerQuery.includes('pd') || lowerQuery.includes('pharmacodynamic')) {
    return 'PD Analysis';
  }
  if (lowerQuery.includes('bioequivalence') || lowerQuery.includes('be study')) {
    return 'Bioequivalence';
  }
  if (lowerQuery.includes('safety') || lowerQuery.includes('adverse')) {
    return 'Safety Analysis';
  }
  if (lowerQuery.includes('efficacy') || lowerQuery.includes('effectiveness')) {
    return 'Efficacy Analysis';
  }
  if (lowerQuery.includes('dose response') || lowerQuery.includes('dose-response')) {
    return 'Dose Response';
  }
  if (lowerQuery.includes('intent to treat') || lowerQuery.includes('itt')) {
    return 'ITT Analysis';
  }
  if (lowerQuery.includes('per protocol') || lowerQuery.includes('pp')) {
    return 'Per Protocol';
  }

  // Fallback to general title generation
  return generateTitleFromQuery(query);
}
