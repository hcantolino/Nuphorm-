/**
 * Omics Analysis Module
 * Differential expression, volcano plots, pathway enrichment
 */

export interface DifferentialExpressionResult {
  geneId: string;
  geneName: string;
  logFoldChange: number;
  pValue: number;
  adjustedPValue: number;
  baseMean: number;
  isSignificant: boolean;
  regulation: "up" | "down" | "none";
}

export interface VolcanoPlotData {
  points: Array<{
    x: number; // log2 fold-change
    y: number; // -log10 p-value
    geneId: string;
    significant: boolean;
  }>;
  thresholds: {
    logFCThreshold: number;
    pValueThreshold: number;
  };
  upregulatedCount: number;
  downregulatedCount: number;
}

export interface PathwayEnrichmentResult {
  pathwayId: string;
  pathwayName: string;
  geneCount: number;
  pValue: number;
  adjustedPValue: number;
  enrichmentScore: number;
  genesInPathway: string[];
}

/**
 * Differential expression analysis
 */
export function differentialExpressionAnalysis(
  treatmentCounts: number[],
  controlCounts: number[],
  geneIds: string[],
  pseudocount: number = 1
): DifferentialExpressionResult[] {
  const results: DifferentialExpressionResult[] = [];

  for (let i = 0; i < geneIds.length; i++) {
    // Add pseudocount to avoid log(0)
    const treatmentExpr = treatmentCounts[i] + pseudocount;
    const controlExpr = controlCounts[i] + pseudocount;

    // Calculate log2 fold-change
    const logFC = Math.log2(treatmentExpr / controlExpr);

    // Calculate mean expression
    const baseMean = (treatmentExpr + controlExpr) / 2;

    // Simple t-test p-value (approximation)
    const pValue = calculateTTestPValue(
      treatmentCounts.slice(i, i + 1),
      controlCounts.slice(i, i + 1)
    );

    // Benjamini-Hochberg adjustment (simplified)
    const adjustedPValue = Math.min(1, pValue * geneIds.length);

    const isSignificant = adjustedPValue < 0.05 && Math.abs(logFC) > 1;
    const regulation = logFC > 0 ? "up" : logFC < 0 ? "down" : "none";

    results.push({
      geneId: geneIds[i],
      geneName: geneIds[i],
      logFoldChange: logFC,
      pValue,
      adjustedPValue,
      baseMean,
      isSignificant,
      regulation,
    });
  }

  return results;
}

/**
 * Generate volcano plot data
 */
export function generateVolcanoPlotData(
  deResults: DifferentialExpressionResult[],
  logFCThreshold: number = 1,
  pValueThreshold: number = 0.05
): VolcanoPlotData {
  const points = deResults.map((result) => ({
    x: result.logFoldChange,
    y: -Math.log10(result.pValue),
    geneId: result.geneId,
    significant:
      Math.abs(result.logFoldChange) > logFCThreshold &&
      result.pValue < pValueThreshold,
  }));

  const upregulated = points.filter(
    (p) => p.significant && p.x > 0
  ).length;
  const downregulated = points.filter(
    (p) => p.significant && p.x < 0
  ).length;

  return {
    points,
    thresholds: {
      logFCThreshold,
      pValueThreshold,
    },
    upregulatedCount: upregulated,
    downregulatedCount: downregulated,
  };
}

/**
 * Pathway enrichment analysis (Fisher's exact test)
 */
export function pathwayEnrichmentAnalysis(
  significantGenes: string[],
  allGenes: string[],
  pathways: Record<string, string[]>
): PathwayEnrichmentResult[] {
  const results: PathwayEnrichmentResult[] = [];
  const significantSet = new Set(significantGenes);
  const allSet = new Set(allGenes);

  for (const [pathwayId, pathwayGenes] of Object.entries(pathways)) {
    const pathwaySet = new Set(pathwayGenes);

    // Calculate contingency table
    const inPathwayAndSig = pathwayGenes.filter((g) =>
      significantSet.has(g)
    ).length;
    const inPathwayNotSig = pathwayGenes.filter(
      (g) => !significantSet.has(g)
    ).length;
    const notInPathwayButSig = significantGenes.filter(
      (g) => !pathwaySet.has(g)
    ).length;
    const notInPathwayNotSig =
      allGenes.length - inPathwayAndSig - inPathwayNotSig - notInPathwayButSig;

    // Fisher's exact test (approximation)
    const pValue = fisherExactTest(
      inPathwayAndSig,
      inPathwayNotSig,
      notInPathwayButSig,
      notInPathwayNotSig
    );

    // Enrichment score (odds ratio)
    const oddsRatio =
      (inPathwayAndSig * notInPathwayNotSig) /
      ((inPathwayNotSig + 1) * (notInPathwayButSig + 1));

    // Benjamini-Hochberg adjustment
    const adjustedPValue = pValue; // Simplified

    results.push({
      pathwayId,
      pathwayName: pathwayId,
      geneCount: pathwayGenes.length,
      pValue,
      adjustedPValue,
      enrichmentScore: Math.log2(oddsRatio),
      genesInPathway: pathwayGenes.slice(0, 5), // Top 5 genes
    });
  }

  return results.sort((a, b) => a.pValue - b.pValue);
}

/**
 * Gene set analysis
 */
export function geneSetAnalysis(
  expressionData: Record<string, number[]>,
  geneSets: Record<string, string[]>,
  phenotype: number[]
) {
  const results: Record<string, number> = {};

  for (const [setName, genes] of Object.entries(geneSets)) {
    // Calculate average expression for genes in set
    const setExpressions = genes
      .map((gene) => expressionData[gene])
      .filter((expr) => expr !== undefined);

    if (setExpressions.length === 0) continue;

    // Calculate correlation with phenotype
    const avgExpression = setExpressions[0].map((_, i) =>
      setExpressions.reduce((sum, expr) => sum + expr[i], 0) /
      setExpressions.length
    );

    const correlation = calculateCorrelation(avgExpression, phenotype);
    results[setName] = correlation;
  }

  return results;
}

/**
 * Normalization methods
 */
export function normalizeExpression(
  expressionMatrix: number[][],
  method: "log2" | "vst" | "tmm" = "log2"
): number[][] {
  if (method === "log2") {
    return expressionMatrix.map((row) =>
      row.map((val) => Math.log2(val + 1))
    );
  } else if (method === "vst") {
    // Variance stabilizing transformation (simplified)
    return expressionMatrix.map((row) =>
      row.map((val) => Math.asinh(val / 2))
    );
  } else if (method === "tmm") {
    // Trimmed mean of M-values (simplified)
    const librarySizes = expressionMatrix[0].map((_, i) =>
      expressionMatrix.reduce((sum, row) => sum + row[i], 0)
    );
    const medianLibSize =
      librarySizes.sort((a, b) => a - b)[
        Math.floor(librarySizes.length / 2)
      ];

    return expressionMatrix.map((row) =>
      row.map((val, i) => Math.log2((val / librarySizes[i]) * medianLibSize + 1))
    );
  }

  return expressionMatrix;
}

/**
 * Heatmap data generation
 */
export function generateHeatmapData(
  expressionMatrix: number[][],
  geneIds: string[],
  sampleIds: string[],
  topGenes: number = 50
) {
  // Calculate variance per gene
  const variances = expressionMatrix.map((row) => {
    const mean = row.reduce((a, b) => a + b, 0) / row.length;
    return (
      row.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      row.length
    );
  });

  // Select top variable genes
  const topIndices = variances
    .map((v, i) => ({ variance: v, index: i }))
    .sort((a, b) => b.variance - a.variance)
    .slice(0, topGenes)
    .map((item) => item.index);

  const heatmapData = topIndices.map((i) => ({
    geneId: geneIds[i],
    values: expressionMatrix[i],
  }));

  return {
    data: heatmapData,
    samples: sampleIds,
    topGeneCount: topGenes,
  };
}

// ============ Helper Functions ============

function calculateTTestPValue(
  group1: number[],
  group2: number[]
): number {
  const n1 = group1.length;
  const n2 = group2.length;

  const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = group2.reduce((a, b) => a + b, 0) / n2;

  const var1 =
    group1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) /
    (n1 - 1 || 1);
  const var2 =
    group2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) /
    (n2 - 1 || 1);

  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));

  const t = Math.abs((mean1 - mean2) / se);
  const df = n1 + n2 - 2;

  // Approximate p-value
  return 2 * (1 - tCDF(t, df));
}

function tCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x));
  let f = 1;
  let c = 1;

  for (let i = 0; i < 100; i++) {
    const m = i / 2;
    let numerator: number;
    if (i === 0) {
      numerator = 1;
    } else if (i % 2 === 0) {
      numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    } else {
      numerator =
        -((a + m) * (a + b + m) * x) /
        ((a + 2 * m) * (a + 2 * m + 1));
    }

    const d = 1 + numerator * (1 / (1 + numerator / c));
    c = 1 + numerator / c;
    f *= d * c;
  }

  return front * f / a;
}

function fisherExactTest(
  a: number,
  b: number,
  c: number,
  d: number
): number {
  // Simplified Fisher's exact test using hypergeometric approximation
  const n = a + b + c + d;
  const pValue =
    (factorial(a + b) *
      factorial(c + d) *
      factorial(a + c) *
      factorial(b + d)) /
    (factorial(n) * factorial(a) * factorial(b) * factorial(c) * factorial(d));

  return Math.min(1, pValue);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  const numerator = x.reduce(
    (sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY),
    0
  );
  const denomX = Math.sqrt(
    x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0)
  );
  const denomY = Math.sqrt(
    y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0)
  );

  return numerator / (denomX * denomY);
}
