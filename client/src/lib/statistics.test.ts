/**
 * Unit Tests for Statistics Library
 */

import { describe, it, expect } from "vitest";
import {
  computeSampleStdDev,
  computePopulationStdDev,
  computeMean,
  computeMedian,
  computeQuartiles,
  computeMinMax,
  computeRange,
  computeCV,
  computeSkewness,
  computeKurtosis,
  computeSEM,
  compute95CI,
  filterNumericValues,
  computeDescriptiveStats,
  computeFoldChangeStats,
  computeLog2FoldChange,
  computeFoldChange,
  computeTTest,
  computeCohenD,
} from "./statistics";

describe("Statistics Library", () => {
  describe("Sample Standard Deviation", () => {
    it("should compute sample std dev correctly", () => {
      const values = [1, 2, 3, 4, 5];
      const result = computeSampleStdDev(values);
      expect(result).toBeCloseTo(1.5811, 3);
    });

    it("should return null for less than 2 values", () => {
      expect(computeSampleStdDev([1])).toBeNull();
      expect(computeSampleStdDev([])).toBeNull();
    });

    it("should compute std dev for identical values", () => {
      const result = computeSampleStdDev([5, 5, 5, 5]);
      expect(result).toBe(0);
    });
  });

  describe("Population Standard Deviation", () => {
    it("should compute population std dev correctly", () => {
      const values = [1, 2, 3, 4, 5];
      const result = computePopulationStdDev(values);
      expect(result).toBeCloseTo(1.4142, 3);
    });

    it("should return null for empty array", () => {
      expect(computePopulationStdDev([])).toBeNull();
    });
  });

  describe("Mean", () => {
    it("should compute mean correctly", () => {
      const result = computeMean([1, 2, 3, 4, 5]);
      expect(result).toBe(3);
    });

    it("should return null for empty array", () => {
      expect(computeMean([])).toBeNull();
    });

    it("should handle negative numbers", () => {
      const result = computeMean([-5, -3, 0, 3, 5]);
      expect(result).toBe(0);
    });
  });

  describe("Median", () => {
    it("should compute median for odd length array", () => {
      const result = computeMedian([1, 2, 3, 4, 5]);
      expect(result).toBe(3);
    });

    it("should compute median for even length array", () => {
      const result = computeMedian([1, 2, 3, 4]);
      expect(result).toBe(2.5);
    });

    it("should return null for empty array", () => {
      expect(computeMedian([])).toBeNull();
    });
  });

  describe("Quartiles", () => {
    it("should compute quartiles correctly", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = computeQuartiles(values);
      expect(result).not.toBeNull();
      expect(result?.q2).toBe(5);
    });

    it("should return null for less than 4 values", () => {
      expect(computeQuartiles([1, 2, 3])).toBeNull();
    });
  });

  describe("Min/Max", () => {
    it("should compute min and max correctly", () => {
      const result = computeMinMax([3, 1, 4, 1, 5, 9, 2, 6]);
      expect(result?.min).toBe(1);
      expect(result?.max).toBe(9);
    });

    it("should return null for empty array", () => {
      expect(computeMinMax([])).toBeNull();
    });
  });

  describe("Range", () => {
    it("should compute range correctly", () => {
      const result = computeRange([1, 2, 3, 4, 5]);
      expect(result).toBe(4);
    });

    it("should return null for empty array", () => {
      expect(computeRange([])).toBeNull();
    });
  });

  describe("Coefficient of Variation", () => {
    it("should compute CV correctly", () => {
      const values = [10, 20, 30, 40, 50];
      const result = computeCV(values);
      expect(result).toBeCloseTo(47.14, 1);
    });

    it("should return null for zero mean", () => {
      const result = computeCV([-5, 0, 5]);
      expect(result).toBeNull();
    });
  });

  describe("Fold Change", () => {
    it("should compute log2 fold change correctly", () => {
      const result = computeLog2FoldChange(100, 50);
      expect(result).toBeCloseTo(1, 1);
    });

    it("should compute simple fold change correctly", () => {
      const result = computeFoldChange(100, 50);
      expect(result).toBe(2);
    });

    it("should return null for zero control", () => {
      expect(computeLog2FoldChange(100, 0)).toBeNull();
      expect(computeFoldChange(100, 0)).toBeNull();
    });

    it("should return null for zero or negative treated", () => {
      expect(computeLog2FoldChange(0, 100)).toBeNull();
      expect(computeLog2FoldChange(-10, 100)).toBeNull();
    });
  });

  describe("Fold Change Statistics", () => {
    it("should compute fold change stats correctly", () => {
      const foldChanges = [2, 3, 1.2, 0.5, 0.4, 1.1, 2.5];
      const result = computeFoldChangeStats(foldChanges);
      expect(result.upregulated).toBeGreaterThan(0);
      expect(result.downregulated).toBeGreaterThan(0);
      expect(result.meanFoldChange).not.toBeNull();
    });

    it("should filter non-numeric values", () => {
      const foldChanges = [2, "invalid", 3, null, 1.2];
      const result = computeFoldChangeStats(foldChanges as any);
      expect(result.meanFoldChange).not.toBeNull();
    });
  });

  describe("Filter Numeric Values", () => {
    it("should filter numeric values correctly", () => {
      const values = [1, "2", NaN, 3, null, 4, undefined, Infinity];
      const result = filterNumericValues(values);
      expect(result).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Descriptive Statistics", () => {
    it("should compute comprehensive stats", () => {
      const values = [1, 2, 3, 4, 5];
      const result = computeDescriptiveStats(values);
      expect(result.n).toBe(5);
      expect(result.mean).toBe(3);
      expect(result.stdDev).not.toBeNull();
      expect(result.ci95).not.toBeNull();
    });
  });

  describe("T-Test", () => {
    it("should compute t-test statistic", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [2, 3, 4, 5, 6];
      const result = computeTTest(group1, group2);
      expect(result).not.toBeNull();
      expect(result?.tStatistic).toBeLessThan(0);
      expect(result?.degreesOfFreedom).toBe(8);
    });

    it("should return null for insufficient data", () => {
      expect(computeTTest([1], [2, 3])).toBeNull();
    });
  });

  describe("Cohen's d", () => {
    it("should compute Cohen's d correctly", () => {
      const group1 = [100, 105, 110, 115, 120];
      const group2 = [80, 85, 90, 95, 100];
      const result = computeCohenD(group1, group2);
      expect(result).toBeGreaterThan(0);
    });

    it("should return null for insufficient data", () => {
      expect(computeCohenD([1], [2, 3])).toBeNull();
    });
  });

  describe("Standard Error of Mean", () => {
    it("should compute SEM correctly", () => {
      const values = [1, 2, 3, 4, 5];
      const result = computeSEM(values);
      expect(result).toBeCloseTo(0.7071, 3);
    });

    it("should return null for empty array", () => {
      expect(computeSEM([])).toBeNull();
    });
  });

  describe("95% Confidence Interval", () => {
    it("should compute 95% CI correctly", () => {
      const values = [1, 2, 3, 4, 5];
      const result = compute95CI(values);
      expect(result).not.toBeNull();
      expect(result?.lower).toBeLessThan(3);
      expect(result?.upper).toBeGreaterThan(3);
    });

    it("should return null for less than 2 values", () => {
      expect(compute95CI([1])).toBeNull();
    });
  });
});
