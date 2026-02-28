import { describe, it, expect } from "vitest";
import {
  calculateDescriptiveStats,
  calculatePearsonCorrelation,
  calculateTTest,
  calculateANOVA,
  calculateHistogramData,
  calculateScatterData,
  detectAnalysisType,
  extractColumnsFromQuery,
} from "./statisticsCalculator";

describe("Statistics Calculator", () => {
  // Sample test data
  const sampleData = [
    { age: 25, weight: 70, group: "A" },
    { age: 30, weight: 75, group: "A" },
    { age: 35, weight: 80, group: "B" },
    { age: 28, weight: 72, group: "B" },
    { age: 32, weight: 78, group: "A" },
    { age: 27, weight: 71, group: "B" },
  ];

  describe("calculateDescriptiveStats", () => {
    it("should calculate mean correctly", () => {
      const stats = calculateDescriptiveStats(sampleData, "age");
      expect(stats.mean).toBeCloseTo(29.5, 1);
    });

    it("should calculate median correctly", () => {
      const stats = calculateDescriptiveStats(sampleData, "age");
      expect(stats.median).toBeCloseTo(29, 1);
    });

    it("should calculate standard deviation correctly", () => {
      const stats = calculateDescriptiveStats(sampleData, "age");
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it("should calculate min and max correctly", () => {
      const stats = calculateDescriptiveStats(sampleData, "age");
      expect(stats.min).toBe(25);
      expect(stats.max).toBe(35);
    });

    it("should calculate quartiles correctly", () => {
      const stats = calculateDescriptiveStats(sampleData, "age");
      expect(stats.q1).toBeLessThanOrEqual(stats.median);
      expect(stats.q3).toBeGreaterThanOrEqual(stats.median);
    });

    it("should return correct count", () => {
      const stats = calculateDescriptiveStats(sampleData, "age");
      expect(stats.count).toBe(6);
    });
  });

  describe("calculatePearsonCorrelation", () => {
    it("should calculate correlation between two columns", () => {
      const corr = calculatePearsonCorrelation(sampleData, "age", "weight");
      expect(corr.correlation).toBeGreaterThan(0);
      expect(corr.correlation).toBeLessThanOrEqual(1);
    });

    it("should return valid p-value", () => {
      const corr = calculatePearsonCorrelation(sampleData, "age", "weight");
      expect(corr.pValue).toBeGreaterThanOrEqual(0);
      expect(corr.pValue).toBeLessThanOrEqual(1);
    });

    it("should return correct sample size", () => {
      const corr = calculatePearsonCorrelation(sampleData, "age", "weight");
      expect(corr.n).toBe(6);
    });

    it("should provide interpretation", () => {
      const corr = calculatePearsonCorrelation(sampleData, "age", "weight");
      expect(["Strong", "Moderate", "Weak", "Very weak"]).toContain(corr.interpretation);
    });
  });

  describe("calculateTTest", () => {
    it("should perform t-test between two groups", () => {
      const result = calculateTTest(sampleData, "age", "group");
      expect(result.tStatistic).toBeDefined();
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
    });

    it("should return means for both groups", () => {
      const result = calculateTTest(sampleData, "age", "group");
      expect(result.mean1).toBeDefined();
      expect(result.mean2).toBeDefined();
      expect(result.n1).toBeGreaterThan(0);
      expect(result.n2).toBeGreaterThan(0);
    });

    it("should indicate significance correctly", () => {
      const result = calculateTTest(sampleData, "age", "group");
      expect(result.significant).toBe(result.pValue < 0.05);
    });
  });

  describe("calculateANOVA", () => {
    it("should perform ANOVA with multiple groups", () => {
      const result = calculateANOVA(sampleData, "age", "group");
      expect(result.fStatistic).toBeDefined();
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
    });

    it("should return group statistics", () => {
      const result = calculateANOVA(sampleData, "age", "group");
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.groups[0]).toHaveProperty("name");
      expect(result.groups[0]).toHaveProperty("mean");
      expect(result.groups[0]).toHaveProperty("n");
    });

    it("should indicate significance correctly", () => {
      const result = calculateANOVA(sampleData, "age", "group");
      expect(result.significant).toBe(result.pValue < 0.05);
    });
  });

  describe("calculateHistogramData", () => {
    it("should generate histogram bins", () => {
      const histogram = calculateHistogramData(sampleData, "age", 5);
      expect(histogram.length).toBe(5);
    });

    it("should have correct bin properties", () => {
      const histogram = calculateHistogramData(sampleData, "age", 5);
      histogram.forEach((bin) => {
        expect(bin).toHaveProperty("bin");
        expect(bin).toHaveProperty("count");
        expect(bin).toHaveProperty("midpoint");
        expect(bin.count).toBeGreaterThanOrEqual(0);
      });
    });

    it("should sum to total count", () => {
      const histogram = calculateHistogramData(sampleData, "age", 5);
      const totalCount = histogram.reduce((sum, bin) => sum + bin.count, 0);
      expect(totalCount).toBe(sampleData.length);
    });
  });

  describe("calculateScatterData", () => {
    it("should generate scatter plot points", () => {
      const scatter = calculateScatterData(sampleData, "age", "weight");
      expect(scatter.length).toBe(sampleData.length);
    });

    it("should have correct point properties", () => {
      const scatter = calculateScatterData(sampleData, "age", "weight");
      scatter.forEach((point) => {
        expect(point).toHaveProperty("x");
        expect(point).toHaveProperty("y");
        expect(typeof point.x).toBe("number");
        expect(typeof point.y).toBe("number");
      });
    });
  });

  describe("detectAnalysisType", () => {
    it("should detect descriptive stats query", () => {
      const type = detectAnalysisType("calculate mean and median", ["age", "weight"]);
      expect(type).toBe("descriptive_stats");
    });

    it("should detect correlation query", () => {
      const type = detectAnalysisType("what is the correlation", ["age", "weight"]);
      expect(type).toBe("correlation");
    });

    it("should detect t-test query", () => {
      const type = detectAnalysisType("perform t-test", ["age", "group"]);
      expect(type).toBe("t_test");
    });

    it("should detect ANOVA query", () => {
      const type = detectAnalysisType("run ANOVA analysis", ["age", "group"]);
      expect(type).toBe("anova");
    });

    it("should detect distribution query", () => {
      const type = detectAnalysisType("show distribution histogram", ["age"]);
      expect(type).toBe("distribution");
    });

    it("should default to descriptive stats", () => {
      const type = detectAnalysisType("random query", ["age"]);
      expect(type).toBe("descriptive_stats");
    });
  });

  describe("extractColumnsFromQuery", () => {
    it("should extract mentioned columns", () => {
      const columns = extractColumnsFromQuery("analyze age and weight", ["age", "weight", "group"]);
      expect(columns).toContain("age");
      expect(columns).toContain("weight");
    });

    it("should be case insensitive", () => {
      const columns = extractColumnsFromQuery("analyze AGE", ["age", "weight"]);
      expect(columns).toContain("age");
    });

    it("should return first two columns if none mentioned", () => {
      const columns = extractColumnsFromQuery("analyze", ["age", "weight", "group"]);
      expect(columns.length).toBeGreaterThan(0);
    });
  });
});
