import { describe, it, expect } from 'vitest';
import {
  computeFoldChange,
  calculateMeanFold,
  calculateStdDev,
  parseGeneExpressionQuery,
  analyzeGeneExpression,
} from './geneExpressionAnalysis';

describe('Gene Expression Analysis', () => {
  describe('computeFoldChange', () => {
    it('should compute log2 fold change correctly', () => {
      const result = computeFoldChange(100, 200);
      expect(result).toBeCloseTo(1, 5); // log2(200/100) = log2(2) = 1
    });

    it('should handle fold change of 1 (no change)', () => {
      const result = computeFoldChange(100, 100);
      expect(result).toBeCloseTo(0, 5); // log2(100/100) = log2(1) = 0
    });

    it('should handle downregulation (negative fold change)', () => {
      const result = computeFoldChange(200, 100);
      expect(result).toBeCloseTo(-1, 5); // log2(100/200) = log2(0.5) = -1
    });

    it('should handle small values', () => {
      const result = computeFoldChange(1, 4);
      expect(result).toBeCloseTo(2, 5); // log2(4/1) = log2(4) = 2
    });

    it('should handle very large fold changes', () => {
      const result = computeFoldChange(1, 1024);
      expect(result).toBeCloseTo(10, 5); // log2(1024/1) = log2(1024) = 10
    });

    it('should handle fractional values', () => {
      const result = computeFoldChange(100.5, 201);
      expect(result).toBeCloseTo(1, 1); // approximately log2(2) = 1
    });
  });

  describe('calculateMeanFold', () => {
    it('should calculate mean of fold changes', () => {
      const foldChanges = [1, 2, 3];
      const result = calculateMeanFold(foldChanges);
      expect(result).toBeCloseTo(2, 5); // (1+2+3)/3 = 2
    });

    it('should handle single value', () => {
      const foldChanges = [5];
      const result = calculateMeanFold(foldChanges);
      expect(result).toBeCloseTo(5, 5);
    });

    it('should handle negative values', () => {
      const foldChanges = [-1, 0, 1];
      const result = calculateMeanFold(foldChanges);
      expect(result).toBeCloseTo(0, 5); // (-1+0+1)/3 = 0
    });

    it('should handle mixed positive and negative', () => {
      const foldChanges = [2, -1, 3, -2];
      const result = calculateMeanFold(foldChanges);
      expect(result).toBeCloseTo(0.5, 5); // (2-1+3-2)/4 = 0.5
    });

    it('should return 0 for empty array', () => {
      const foldChanges: number[] = [];
      const result = calculateMeanFold(foldChanges);
      expect(result).toBe(0);
    });
  });

  describe('calculateStdDev', () => {
    it('should calculate standard deviation with n-1 denominator', () => {
      const values = [1, 2, 3, 4, 5];
      const result = calculateStdDev(values);
      // Mean = 3, variance = ((1-3)^2 + (2-3)^2 + (3-3)^2 + (4-3)^2 + (5-3)^2) / 4 = 10/4 = 2.5
      // Std dev = sqrt(2.5) ≈ 1.581
      expect(result).toBeCloseTo(1.581, 2);
    });

    it('should handle identical values (std dev = 0)', () => {
      const values = [5, 5, 5, 5];
      const result = calculateStdDev(values);
      expect(result).toBeCloseTo(0, 5);
    });

    it('should handle two values', () => {
      const values = [1, 3];
      const result = calculateStdDev(values);
      // Mean = 2, variance = ((1-2)^2 + (3-2)^2) / 1 = 2/1 = 2
      // Std dev = sqrt(2) ≈ 1.414
      expect(result).toBeCloseTo(1.414, 2);
    });

    it('should handle negative values', () => {
      const values = [-2, -1, 0, 1, 2];
      const result = calculateStdDev(values);
      // Mean = 0, variance = (4 + 1 + 0 + 1 + 4) / 4 = 10/4 = 2.5
      // Std dev = sqrt(2.5) ≈ 1.581
      expect(result).toBeCloseTo(1.581, 2);
    });

    it('should return 0 for single value', () => {
      const values = [5];
      const result = calculateStdDev(values);
      expect(result).toBe(0); // Can't calculate std dev with n=1 (n-1=0)
    });

    it('should return 0 for empty array', () => {
      const values: number[] = [];
      const result = calculateStdDev(values);
      expect(result).toBe(0);
    });
  });

  describe('parseGeneExpressionQuery', () => {
    it('should detect fold change request', () => {
      const result = parseGeneExpressionQuery('compute fold change');
      expect(result.requestsFoldChange).toBe(true);
    });

    it('should detect std dev request', () => {
      const result = parseGeneExpressionQuery('what is the standard deviation of fold change');
      expect(result.requestsStdDev).toBe(true);
    });

    it('should detect mean request', () => {
      const result = parseGeneExpressionQuery('calculate mean fold change');
      expect(result.requestsMean).toBe(true);
    });

    it('should be case insensitive', () => {
      const result = parseGeneExpressionQuery('COMPUTE FOLD CHANGE');
      expect(result.requestsFoldChange).toBe(true);
    });

    it('should handle multiple requests in one query', () => {
      const result = parseGeneExpressionQuery('compute fold change and standard deviation');
      expect(result.requestsFoldChange).toBe(true);
      expect(result.requestsStdDev).toBe(true);
    });

    it('should detect chart request', () => {
      const result = parseGeneExpressionQuery('show me a bar chart of fold changes');
      expect(result.requestsChart).toBe(true);
    });

    it('should detect table request', () => {
      const result = parseGeneExpressionQuery('show top genes in a table');
      expect(result.requestsTable).toBe(true);
    });

    it('should return empty flags for non-gene expression query', () => {
      const result = parseGeneExpressionQuery('what is the weather');
      expect(result.requestsFoldChange).toBe(false);
      expect(result.requestsStdDev).toBe(false);
      expect(result.requestsMean).toBe(false);
    });
  });

  describe('analyzeGeneExpression', () => {
    it('should compute fold changes for all genes', () => {
      const data = [
        { gene_id: 'BRCA1', control_value: 100, treated_value: 200 },
        { gene_id: 'TP53', control_value: 150, treated_value: 75 },
      ];
      const result = analyzeGeneExpression(data);
      expect(result.foldChanges).toHaveLength(2);
      expect(result.foldChanges[0]).toBeCloseTo(1, 5); // log2(200/100) = 1
      expect(result.foldChanges[1]).toBeCloseTo(-1, 5); // log2(75/150) = -1
    });

    it('should calculate mean and std dev', () => {
      const data = [
        { gene_id: 'BRCA1', control_value: 100, treated_value: 200 },
        { gene_id: 'TP53', control_value: 100, treated_value: 200 },
        { gene_id: 'EGFR', control_value: 100, treated_value: 200 },
      ];
      const result = analyzeGeneExpression(data);
      expect(result.meanFold).toBeCloseTo(1, 5); // All fold changes are 1
      expect(result.stdDev).toBeCloseTo(0, 5); // No variation
    });

    it('should add fold_change column to data', () => {
      const data = [
        { gene_id: 'BRCA1', control_value: 100, treated_value: 200 },
      ];
      const result = analyzeGeneExpression(data);
      expect(result.dataWithFoldChange).toHaveLength(1);
      expect(result.dataWithFoldChange[0]).toHaveProperty('fold_change');
      expect(result.dataWithFoldChange[0].fold_change).toBeCloseTo(1, 5);
    });

    it('should handle empty data', () => {
      const data: any[] = [];
      const result = analyzeGeneExpression(data);
      expect(result.foldChanges).toHaveLength(0);
      expect(result.meanFold).toBe(0);
      expect(result.stdDev).toBe(0);
    });

    it('should handle data with missing control or treated values', () => {
      const data = [
        { gene_id: 'BRCA1', control_value: 100, treated_value: 200 },
        { gene_id: 'TP53', control_value: 150 }, // Missing treated_value
      ];
      const result = analyzeGeneExpression(data);
      // Should only process valid rows
      expect(result.foldChanges.length).toBeGreaterThan(0);
    });

    it('should create chart data with genes and fold changes', () => {
      const data = [
        { gene_id: 'BRCA1', control_value: 100, treated_value: 200 },
        { gene_id: 'TP53', control_value: 150, treated_value: 75 },
      ];
      const result = analyzeGeneExpression(data);
      expect(result.chartData).toBeDefined();
      expect(result.chartData.length).toBe(2);
      expect(result.chartData[0]).toHaveProperty('gene');
      expect(result.chartData[0]).toHaveProperty('foldChange');
      expect(result.chartData[0]).toHaveProperty('stdDev');
    });

    it('should create results table data', () => {
      const data = [
        { gene_id: 'BRCA1', control_value: 100, treated_value: 200 },
        { gene_id: 'TP53', control_value: 150, treated_value: 75 },
      ];
      const result = analyzeGeneExpression(data);
      expect(result.resultsTable).toBeDefined();
      expect(result.resultsTable.length).toBeGreaterThan(0);
      // Should include statistics rows
      const hasStatistics = result.resultsTable.some(
        (row: any) => row.metric && (row.metric.includes('Mean') || row.metric.includes('Std Dev'))
      );
      expect(hasStatistics).toBe(true);
    });
  });
});
