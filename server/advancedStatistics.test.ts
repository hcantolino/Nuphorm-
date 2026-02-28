import { describe, it, expect } from 'vitest';
import { chiSquareTest, logisticRegression, kaplanMeierAnalysis } from './advancedStatistics';

describe('Advanced Statistical Analysis Functions', () => {
  describe('Chi-Square Test', () => {
    it('should calculate chi-square statistic for independent variables', () => {
      const data = [
        { group: 'A', outcome: 'Yes' },
        { group: 'A', outcome: 'Yes' },
        { group: 'A', outcome: 'No' },
        { group: 'B', outcome: 'Yes' },
        { group: 'B', outcome: 'No' },
        { group: 'B', outcome: 'No' },
      ];

      const result = chiSquareTest(data, 'group', 'outcome');

      expect(result.chiSquare).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
      expect(result.degreesOfFreedom).toBeGreaterThan(0);
      expect(result.contingencyTable).toBeDefined();
    });

    it('should identify significant associations', () => {
      const data = [
        { group: 'A', outcome: 'Yes' },
        { group: 'A', outcome: 'Yes' },
        { group: 'A', outcome: 'Yes' },
        { group: 'A', outcome: 'Yes' },
        { group: 'B', outcome: 'No' },
        { group: 'B', outcome: 'No' },
        { group: 'B', outcome: 'No' },
        { group: 'B', outcome: 'No' },
      ];

      const result = chiSquareTest(data, 'group', 'outcome');

      // With perfect association, chi-square should be large and p-value small
      expect(result.chiSquare).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThanOrEqual(0.1); // Approximate p-value
    });
  });

  describe('Logistic Regression', () => {
    it('should fit logistic regression model', () => {
      const data = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ];

      const result = logisticRegression(data, 'x', 'y');

      expect(result.intercept).toBeDefined();
      expect(result.slope).toBeDefined();
      expect(result.rSquared).toBeGreaterThanOrEqual(0);
      expect(result.rSquared).toBeLessThanOrEqual(1);
      expect(result.predictions.length).toBe(5);
    });

    it('should generate predictions between 0 and 1', () => {
      const data = [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ];

      const result = logisticRegression(data, 'x', 'y');

      result.predictions.forEach((pred) => {
        expect(pred.predicted).toBeGreaterThanOrEqual(0);
        expect(pred.predicted).toBeLessThanOrEqual(1);
      });
    });

    it('should handle insufficient data gracefully', () => {
      const data = [{ x: 1, y: 0 }];

      const result = logisticRegression(data, 'x', 'y');

      expect(result.intercept).toBe(0);
      expect(result.slope).toBe(0);
      expect(result.rSquared).toBe(0);
      expect(result.predictions.length).toBe(0);
    });
  });

  describe('Kaplan-Meier Survival Analysis', () => {
    it('should calculate survival curve', () => {
      const data = [
        { time: 10, event: 1 },
        { time: 20, event: 1 },
        { time: 30, event: 0 },
        { time: 40, event: 1 },
        { time: 50, event: 0 },
      ];

      const result = kaplanMeierAnalysis(data, 'time', 'event');

      expect(result.survivalCurve.length).toBeGreaterThan(0);
      expect(result.medianSurvivalTime).toBeGreaterThanOrEqual(0);
      expect(result.survivalAt1Year).toBeGreaterThanOrEqual(0);
      expect(result.survivalAt1Year).toBeLessThanOrEqual(1);
      expect(result.survivalAt5Year).toBeGreaterThanOrEqual(0);
      expect(result.survivalAt5Year).toBeLessThanOrEqual(1);
    });

    it('should handle empty data gracefully', () => {
      const data: any[] = [];

      const result = kaplanMeierAnalysis(data, 'time', 'event');

      expect(result.survivalCurve.length).toBe(0);
      expect(result.medianSurvivalTime).toBe(0);
      expect(result.survivalAt1Year).toBe(1);
      expect(result.survivalAt5Year).toBe(1);
    });

    it('should calculate survival probabilities correctly', () => {
      const data = [
        { time: 1, event: 1 },
        { time: 2, event: 1 },
        { time: 3, event: 1 },
        { time: 4, event: 1 },
      ];

      const result = kaplanMeierAnalysis(data, 'time', 'event');

      // With 4 events at times 1, 2, 3, 4
      // Survival at time 1: (4-1)/4 = 0.75
      // Survival at time 2: 0.75 * (3-1)/3 = 0.5
      // Survival at time 3: 0.5 * (2-1)/2 = 0.25
      // Survival at time 4: 0.25 * (1-1)/1 = 0

      expect(result.survivalCurve.length).toBe(4);
      expect(result.survivalCurve[0].survival).toBeCloseTo(0.75, 2);
      expect(result.survivalCurve[1].survival).toBeCloseTo(0.5, 2);
      expect(result.survivalCurve[2].survival).toBeCloseTo(0.25, 2);
      expect(result.survivalCurve[3].survival).toBeCloseTo(0, 2);
    });
  });
});
