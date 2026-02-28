/**
 * Gene Expression Analysis Module
 * Handles fold-change computation, statistics, and biostatistics for gene expression data
 */

export interface GeneExpressionRow {
  gene_id: string;
  control_value: number;
  treated_value: number;
  [key: string]: any;
}

export interface FoldChangeData {
  gene_id: string;
  control_value: number;
  treated_value: number;
  fold_change: number;
  log2_fold_change: number;
}

export interface GeneExpressionStats {
  mean_fold_change: number;
  mean_log2_fold_change: number;
  std_dev_fold_change: number;
  std_dev_log2_fold_change: number;
  min_fold_change: number;
  max_fold_change: number;
  median_fold_change: number;
  total_genes: number;
}

/**
 * Detect if data contains gene expression columns (control_value, treated_value)
 */
export function isGeneExpressionData(data: any[]): boolean {
  if (!data || data.length === 0) return false;
  const firstRow = data[0];
  return (
    'gene_id' in firstRow &&
    'control_value' in firstRow &&
    'treated_value' in firstRow
  );
}

/**
 * Compute fold-change for each gene
 * fold_change = treated_value / control_value
 * log2_fold_change = log2(treated_value / control_value)
 */
export function computeFoldChanges(data: GeneExpressionRow[]): FoldChangeData[] {
  return data.map((row) => {
    const control = parseFloat(String(row.control_value)) || 0;
    const treated = parseFloat(String(row.treated_value)) || 0;

    // Avoid division by zero
    const foldChange = control > 0 ? treated / control : 0;
    const log2FoldChange = control > 0 ? Math.log2(treated / control) : 0;

    return {
      gene_id: row.gene_id,
      control_value: control,
      treated_value: treated,
      fold_change: foldChange,
      log2_fold_change: log2FoldChange,
    };
  });
}

/**
 * Calculate mean of an array using sample mean (n-1 denominator for std dev)
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation using sample std dev formula: sqrt(sum((x - mean)^2) / (n-1))
 */
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = calculateMean(values);
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const sumSquaredDiffs = squaredDiffs.reduce((sum, val) => sum + val, 0);

  // Use n-1 for sample standard deviation (Bessel's correction)
  return Math.sqrt(sumSquaredDiffs / (values.length - 1));
}

/**
 * Calculate median of an array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Compute comprehensive gene expression statistics
 */
export function computeGeneExpressionStats(
  foldChangeData: FoldChangeData[]
): GeneExpressionStats {
  const foldChanges = foldChangeData.map((d) => d.fold_change);
  const log2FoldChanges = foldChangeData.map((d) => d.log2_fold_change);

  return {
    mean_fold_change: calculateMean(foldChanges),
    mean_log2_fold_change: calculateMean(log2FoldChanges),
    std_dev_fold_change: calculateStdDev(foldChanges),
    std_dev_log2_fold_change: calculateStdDev(log2FoldChanges),
    min_fold_change: Math.min(...foldChanges),
    max_fold_change: Math.max(...foldChanges),
    median_fold_change: calculateMedian(foldChanges),
    total_genes: foldChangeData.length,
  };
}

/**
 * Get top N genes by absolute log2 fold change
 */
export function getTopGenesByFoldChange(
  foldChangeData: FoldChangeData[],
  topN: number = 10
): FoldChangeData[] {
  return [...foldChangeData]
    .sort((a, b) => Math.abs(b.log2_fold_change) - Math.abs(a.log2_fold_change))
    .slice(0, topN);
}

/**
 * Compute per-group statistics (control and treated groups)
 */
export function computePerGroupStats(data: GeneExpressionRow[]): {
  control_mean: number;
  control_std_dev: number;
  treated_mean: number;
  treated_std_dev: number;
} {
  const controlValues = data
    .map((row) => parseFloat(String(row.control_value)) || 0)
    .filter((val) => !isNaN(val));
  const treatedValues = data
    .map((row) => parseFloat(String(row.treated_value)) || 0)
    .filter((val) => !isNaN(val));

  return {
    control_mean: calculateMean(controlValues),
    control_std_dev: calculateStdDev(controlValues),
    treated_mean: calculateMean(treatedValues),
    treated_std_dev: calculateStdDev(treatedValues),
  };
}

/**
 * Prepare data for bar chart visualization
 * Returns array of {gene_id, log2_fold_change, std_dev_error}
 */
export function prepareChartData(
  foldChangeData: FoldChangeData[],
  stats: GeneExpressionStats,
  topN: number = 10
): Array<{
  gene_id: string;
  log2_fold_change: number;
  error: number;
}> {
  const topGenes = getTopGenesByFoldChange(foldChangeData, topN);

  return topGenes.map((gene) => ({
    gene_id: gene.gene_id,
    log2_fold_change: gene.log2_fold_change,
    // Use overall std_dev as error bar
    error: stats.std_dev_log2_fold_change,
  }));
}
