/**
 * Gene Expression Analysis Module
 * Handles fold-change computation, statistical calculations, and query parsing
 */

/**
 * Compute log2 fold change between control and treated values
 * Formula: log2(treated_value / control_value)
 */
export function computeFoldChange(controlValue: number, treatedValue: number): number {
  if (controlValue <= 0 || treatedValue <= 0) {
    return 0; // Handle invalid values
  }
  return Math.log2(treatedValue / controlValue);
}

/**
 * Calculate mean of fold changes
 */
export function calculateMeanFold(foldChanges: number[]): number {
  if (foldChanges.length === 0) return 0;
  const sum = foldChanges.reduce((acc, val) => acc + val, 0);
  return sum / foldChanges.length;
}

/**
 * Calculate standard deviation using n-1 denominator (sample std dev)
 * Formula: sqrt(sum((x - mean)^2) / (n - 1))
 */
export function calculateStdDev(values: number[]): number {
  if (values.length <= 1) return 0;

  const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Parse natural language query to detect gene expression analysis requests
 */
export interface QueryParseResult {
  requestsFoldChange: boolean;
  requestsStdDev: boolean;
  requestsMean: boolean;
  requestsChart: boolean;
  requestsTable: boolean;
}

export function parseGeneExpressionQuery(query: string): QueryParseResult {
  const lowerQuery = query.toLowerCase();

  return {
    requestsFoldChange:
      /fold.?change|fc|log2|upregulated|downregulated|expression.?level/i.test(lowerQuery),
    requestsStdDev:
      /std.?dev|standard.?deviation|variability|variation|spread|dispersion/i.test(lowerQuery),
    requestsMean: /mean|average|median|central/i.test(lowerQuery),
    requestsChart: /chart|plot|graph|visualize|bar|scatter|line/i.test(lowerQuery),
    requestsTable: /table|list|top|ranking|sort/i.test(lowerQuery),
  };
}

/**
 * Analyze gene expression data
 * Computes fold changes, statistics, and formatted results
 */
export interface GeneExpressionResult {
  foldChanges: number[];
  meanFold: number;
  stdDev: number;
  dataWithFoldChange: Array<Record<string, any>>;
  chartData: Array<{
    gene: string;
    foldChange: number;
    stdDev: number;
  }>;
  resultsTable: Array<{
    metric: string;
    value: string | number;
    submetric?: string;
    subvalue?: string | number;
  }>;
}

export function analyzeGeneExpression(data: Array<Record<string, any>>): GeneExpressionResult {
  const foldChanges: number[] = [];
  const dataWithFoldChange: Array<Record<string, any>> = [];

  // Compute fold changes for each gene
  for (const row of data) {
    if (row.control_value && row.treated_value) {
      const fc = computeFoldChange(row.control_value, row.treated_value);
      foldChanges.push(fc);
      dataWithFoldChange.push({
        ...row,
        fold_change: fc,
      });
    }
  }

  // Calculate statistics
  const meanFold = calculateMeanFold(foldChanges);
  const stdDev = calculateStdDev(foldChanges);

  // Create chart data (bar chart format)
  const chartData = dataWithFoldChange.map((row) => ({
    gene: row.gene_id || `Gene_${dataWithFoldChange.indexOf(row)}`,
    foldChange: row.fold_change,
    stdDev: stdDev, // Same std dev for all (overall variation)
  }));

  // Create results table data
  const resultsTable: Array<{
    metric: string;
    value: string | number;
    submetric?: string;
    subvalue?: string | number;
  }> = [
    {
      metric: 'Mean Fold Change',
      value: meanFold.toFixed(3),
    },
    {
      metric: 'Standard Deviation',
      value: stdDev.toFixed(3),
    },
    {
      metric: 'Number of Genes',
      value: dataWithFoldChange.length,
    },
    {
      metric: 'Min Fold Change',
      value: foldChanges.length > 0 ? Math.min(...foldChanges).toFixed(3) : 'N/A',
    },
    {
      metric: 'Max Fold Change',
      value: foldChanges.length > 0 ? Math.max(...foldChanges).toFixed(3) : 'N/A',
    },
  ];

  // Add top 10 genes to results table
  const topGenes = dataWithFoldChange
    .sort((a, b) => Math.abs(b.fold_change) - Math.abs(a.fold_change))
    .slice(0, 10);

  for (const gene of topGenes) {
    resultsTable.push({
      metric: gene.gene_id || `Gene_${topGenes.indexOf(gene)}`,
      value: gene.fold_change.toFixed(3),
      submetric: 'Fold Change',
      subvalue: gene.fold_change.toFixed(3),
    });
  }

  return {
    foldChanges,
    meanFold,
    stdDev,
    dataWithFoldChange,
    chartData,
    resultsTable,
  };
}
