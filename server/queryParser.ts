/**
 * Natural Language Query Parser for Biostatistics Commands
 * Parses user queries to extract analysis type and parameters
 */

export interface ParsedQuery {
  analysisType: 'fold_change' | 'descriptive' | 'correlation' | 'ttest' | 'anova' | 'unknown';
  keywords: string[];
  targetColumns: string[];
  groupColumn?: string;
  confidence: number; // 0-1, how confident we are in the parse
}

/**
 * Parse natural language query for biostatistics analysis
 */
export function parseQuery(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase();
  const keywords = extractKeywords(lowerQuery);
  const analysisType = detectAnalysisType(lowerQuery, keywords);
  const targetColumns = extractColumnReferences(lowerQuery);
  const groupColumn = extractGroupColumn(lowerQuery);

  return {
    analysisType,
    keywords,
    targetColumns,
    groupColumn,
    confidence: calculateConfidence(analysisType, keywords),
  };
}

/**
 * Extract keywords from query
 */
function extractKeywords(query: string): string[] {
  const keywordPatterns = [
    'fold.?change',
    'log2',
    'log.?fold',
    'lfc',
    'mean',
    'median',
    'std.?dev',
    'standard.?deviation',
    'variance',
    'correlation',
    'pearson',
    'spearman',
    't.?test',
    'ttest',
    'anova',
    'anova',
    'chi.?square',
    'chi2',
    'histogram',
    'distribution',
    'scatter',
    'box.?plot',
    'compare',
    'difference',
    'significant',
    'p.?value',
    'pvalue',
    'control',
    'treated',
    'treatment',
    'group',
    'upregulated',
    'downregulated',
    'expression',
    'gene',
  ];

  const foundKeywords: string[] = [];
  for (const pattern of keywordPatterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    if (regex.test(query)) {
      foundKeywords.push(pattern.replace(/\?/g, ''));
    }
  }

  return foundKeywords;
}

/**
 * Detect analysis type from keywords
 */
function detectAnalysisType(
  query: string,
  keywords: string[]
): ParsedQuery['analysisType'] {
  const lowerQuery = query.toLowerCase();

  // Fold-change analysis
  if (
    /fold.?change|log2|log.?fold|lfc|upregulated|downregulated/.test(lowerQuery)
  ) {
    return 'fold_change';
  }

  // Correlation analysis
  if (/correlation|pearson|spearman|relationship/.test(lowerQuery)) {
    return 'correlation';
  }

  // T-test
  if (/t.?test|ttest|compare.*two|difference.*two/.test(lowerQuery)) {
    return 'ttest';
  }

  // ANOVA
  if (/anova|compare.*group|multiple.*group/.test(lowerQuery)) {
    return 'anova';
  }

  // Descriptive statistics
  if (
    /mean|median|std.?dev|standard.?deviation|variance|min|max|quartile|histogram|distribution/.test(
      lowerQuery
    )
  ) {
    return 'descriptive';
  }

  return 'unknown';
}

/**
 * Extract column references from query
 * Looks for patterns like "for age", "of expression_level", "column gene_id"
 */
function extractColumnReferences(query: string): string[] {
  const columns: string[] = [];

  // Pattern: "for <column>" or "of <column>" or "column <column>"
  const patterns = [
    /(?:for|of|column)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
    /(?:in|with)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      const col = match[1].toLowerCase();
      if (!columns.includes(col)) {
        columns.push(col);
      }
    }
  }

  return columns;
}

/**
 * Extract group column reference
 * Looks for patterns like "grouped by", "by group", "stratified by"
 */
function extractGroupColumn(query: string): string | undefined {
  const patterns = [
    /(?:grouped|stratified)\s+by\s+([a-zA-Z_][a-zA-Z0-9_]*)/i,
    /by\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:group|category)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(query);
    if (match) {
      return match[1].toLowerCase();
    }
  }

  return undefined;
}

/**
 * Calculate confidence score for the parse
 */
function calculateConfidence(
  analysisType: ParsedQuery['analysisType'],
  keywords: string[]
): number {
  if (analysisType === 'unknown') return 0.3;
  if (keywords.length === 0) return 0.5;
  if (keywords.length >= 2) return 0.9;
  return 0.7;
}

/**
 * Check if query is asking for fold-change analysis
 */
export function isFoldChangeQuery(query: string): boolean {
  const parsed = parseQuery(query);
  return parsed.analysisType === 'fold_change';
}

/**
 * Check if query is asking for descriptive statistics
 */
export function isDescriptiveQuery(query: string): boolean {
  const parsed = parseQuery(query);
  return parsed.analysisType === 'descriptive';
}

/**
 * Check if query is asking for group comparison
 */
export function isGroupComparisonQuery(query: string): boolean {
  const parsed = parseQuery(query);
  return (
    parsed.analysisType === 'ttest' ||
    parsed.analysisType === 'anova' ||
    !!parsed.groupColumn
  );
}

/**
 * Get human-readable description of parsed query
 */
export function getQueryDescription(parsed: ParsedQuery): string {
  const parts: string[] = [];

  parts.push(`Analysis: ${parsed.analysisType}`);

  if (parsed.targetColumns.length > 0) {
    parts.push(`Columns: ${parsed.targetColumns.join(', ')}`);
  }

  if (parsed.groupColumn) {
    parts.push(`Grouped by: ${parsed.groupColumn}`);
  }

  parts.push(`Confidence: ${(parsed.confidence * 100).toFixed(0)}%`);

  return parts.join(' | ');
}
