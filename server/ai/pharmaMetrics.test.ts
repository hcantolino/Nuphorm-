/**
 * Unit Tests for Pharma Metrics Module
 */

import { describe, it, expect } from "vitest";
import {
  calculateBioavailability,
  calculateBioequivalenceRatio,
  checkFDABECriteria,
  calculateCohenD,
  calculateNNT,
  calculateOddsRatio,
  calculateRelativeRisk,
  calculateARR,
  calculate90CI,
  assessRegulatoryCompliance,
  generatePharmaInsights,
} from "./pharmaMetrics";

describe("Pharma Metrics Module", () => {
  describe("Bioavailability Calculations", () => {
    it("should calculate bioavailability correctly", () => {
      const testAUC = 1000;
      const refAUC = 1000;
      const result = calculateBioavailability(testAUC, refAUC);
      expect(result).toBe(100);
    });

    it("should handle zero reference AUC", () => {
      const result = calculateBioavailability(1000, 0);
      expect(result).toBe(0);
    });

    it("should calculate bioavailability with different values", () => {
      const result = calculateBioavailability(800, 1000);
      expect(result).toBe(80);
    });
  });

  describe("Bioequivalence Ratio Calculations", () => {
    it("should calculate BE ratio within FDA criteria", () => {
      const ratio = calculateBioequivalenceRatio(1000, 1000);
      expect(ratio).toBe(100);
    });

    it("should calculate BE ratio below reference", () => {
      const ratio = calculateBioequivalenceRatio(900, 1000);
      expect(ratio).toBe(90);
    });

    it("should calculate BE ratio above reference", () => {
      const ratio = calculateBioequivalenceRatio(1100, 1000);
      expect(ratio).toBeCloseTo(110, 1);
    });

    it("should handle zero reference value", () => {
      const ratio = calculateBioequivalenceRatio(1000, 0);
      expect(ratio).toBe(0);
    });
  });

  describe("FDA BE Criteria Checking", () => {
    it("should pass FDA criteria when within 80-125%", () => {
      const result = checkFDABECriteria(85, 115);
      expect(result).toBe(true);
    });

    it("should fail FDA criteria when below 80%", () => {
      const result = checkFDABECriteria(75, 115);
      expect(result).toBe(false);
    });

    it("should fail FDA criteria when above 125%", () => {
      const result = checkFDABECriteria(85, 130);
      expect(result).toBe(false);
    });

    it("should pass at exact boundaries", () => {
      expect(checkFDABECriteria(80, 125)).toBe(true);
      expect(checkFDABECriteria(80, 124.9)).toBe(true);
      expect(checkFDABECriteria(80.1, 125)).toBe(true);
    });
  });

  describe("Cohen's d Effect Size", () => {
    it("should calculate Cohen's d correctly", () => {
      const d = calculateCohenD(100, 90, 10, 10, 30, 30);
      expect(d).toBeCloseTo(1, 1);
    });

    it("should handle equal means", () => {
      const d = calculateCohenD(100, 100, 10, 10, 30, 30);
      expect(d).toBe(0);
    });

    it("should handle zero pooled std dev", () => {
      const d = calculateCohenD(100, 90, 0, 0, 30, 30);
      expect(d).toBe(0);
    });

    it("should calculate negative effect size", () => {
      const d = calculateCohenD(90, 100, 10, 10, 30, 30);
      expect(d).toBeCloseTo(-1, 1);
    });
  });

  describe("Number Needed to Treat", () => {
    it("should calculate NNT correctly", () => {
      const nnt = calculateNNT(0.6, 0.4);
      expect(nnt).toBeCloseTo(5, 1);
    });

    it("should handle equal rates", () => {
      const nnt = calculateNNT(0.5, 0.5);
      expect(Number.isFinite(nnt)).toBe(false);
    });

    it("should calculate NNT with small difference", () => {
      const nnt = calculateNNT(0.51, 0.50);
      expect(nnt).toBeCloseTo(100, 0);
    });

    it("should handle zero difference", () => {
      const nnt = calculateNNT(0.5, 0.5);
      expect(Number.isFinite(nnt)).toBe(false);
    });
  });

  describe("Odds Ratio Calculation", () => {
    it("should calculate odds ratio correctly", () => {
      // 2x2 table: a=20, b=10, c=10, d=20
      const or = calculateOddsRatio(20, 10, 10, 20);
      expect(or).toBe(4);
    });

    it("should handle zero denominator", () => {
      const or = calculateOddsRatio(20, 0, 10, 20);
      expect(or).toBe(0);
    });

    it("should calculate OR of 1 for equal odds", () => {
      const or = calculateOddsRatio(10, 10, 10, 10);
      expect(or).toBeCloseTo(1, 5);
    });
  });

  describe("Relative Risk Calculation", () => {
    it("should calculate relative risk correctly", () => {
      // Treatment: 20/30 = 0.667, Control: 10/30 = 0.333
      const rr = calculateRelativeRisk(20, 10, 10, 20);
      expect(rr).toBeCloseTo(2, 1);
    });

    it("should handle zero control rate", () => {
      const rr = calculateRelativeRisk(20, 10, 0, 30);
      expect(rr).toBe(0);
    });

    it("should calculate RR of 1 for equal rates", () => {
      const rr = calculateRelativeRisk(10, 20, 10, 20);
      expect(rr).toBeCloseTo(1, 5);
    });
  });

  describe("Absolute Risk Reduction", () => {
    it("should calculate ARR correctly", () => {
      const arr = calculateARR(0.4, 0.6);
      expect(arr).toBeCloseTo(0.2, 5);
    });

    it("should handle zero ARR", () => {
      const arr = calculateARR(0.5, 0.5);
      expect(arr).toBeCloseTo(0, 5);
    });

    it("should calculate negative ARR", () => {
      const arr = calculateARR(0.6, 0.4);
      expect(arr).toBeCloseTo(-0.2, 5);
    });
  });

  describe("90% Confidence Interval Calculation", () => {
    it("should calculate 90% CI correctly", () => {
      const ci = calculate90CI(1.0, 0.2, 30);
      expect(ci.lower).toBeLessThan(100);
      expect(ci.upper).toBeGreaterThan(100);
      expect(ci.upper - ci.lower).toBeGreaterThan(0);
    });

    it("should have narrower CI with larger sample size", () => {
      const ci30 = calculate90CI(1.0, 0.2, 30);
      const ci100 = calculate90CI(1.0, 0.2, 100);
      expect(ci100.upper - ci100.lower).toBeLessThan(ci30.upper - ci30.lower);
    });

    it("should have wider CI with higher CV", () => {
      const ci_low_cv = calculate90CI(1.0, 0.1, 30);
      const ci_high_cv = calculate90CI(1.0, 0.3, 30);
      expect(ci_high_cv.upper - ci_high_cv.lower).toBeGreaterThan(
        ci_low_cv.upper - ci_low_cv.lower
      );
    });
  });

  describe("Regulatory Compliance Assessment", () => {
    it("should pass all compliance checks", () => {
      const babeResult = {
        test_auc: 1000,
        reference_auc: 1000,
        test_cmax: 500,
        reference_cmax: 500,
        be_ratio_auc: 100,
        be_ratio_cmax: 100,
        ci_lower_auc: 90,
        ci_upper_auc: 110,
        ci_lower_cmax: 90,
        ci_upper_cmax: 110,
        meets_fda_criteria: true,
      };

      const efficacy = {
        responder_rate: 0.7,
        response_magnitude: 50,
        effect_size: 0.8,
        nnt: 3,
        nnth: 100,
        relative_risk: 2,
        odds_ratio: 3,
        absolute_risk_reduction: 0.2,
      };

      const safety = {
        adverse_event_rate: 0.02,
        serious_ae_rate: 0.01,
        discontinuation_rate: 0.05,
        mortality_rate: 0,
        safety_index: 10,
      };

      const result = assessRegulatoryCompliance(babeResult, efficacy, safety);
      expect(result.meets_fda_ba_be).toBe(true);
      expect(result.meets_efficacy_threshold).toBe(true);
      expect(result.meets_safety_threshold).toBe(true);
    });

    it("should flag compliance failures", () => {
      const babeResult = {
        test_auc: 1000,
        reference_auc: 1000,
        test_cmax: 500,
        reference_cmax: 500,
        be_ratio_auc: 70,
        be_ratio_cmax: 100,
        ci_lower_auc: 70,
        ci_upper_auc: 70,
        ci_lower_cmax: 90,
        ci_upper_cmax: 110,
        meets_fda_criteria: false,
      };

      const efficacy = {
        responder_rate: 0.3,
        response_magnitude: 10,
        effect_size: 0.1,
        nnt: 50,
        nnth: 5,
        relative_risk: 1.1,
        odds_ratio: 1.2,
        absolute_risk_reduction: 0.01,
      };

      const safety = {
        adverse_event_rate: 0.15,
        serious_ae_rate: 0.1,
        discontinuation_rate: 0.2,
        mortality_rate: 0.01,
        safety_index: 1,
      };

      const result = assessRegulatoryCompliance(babeResult, efficacy, safety);
      expect(result.meets_fda_ba_be).toBe(false);
      expect(result.meets_efficacy_threshold).toBe(false);
      expect(result.meets_safety_threshold).toBe(false);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("Pharma Insights Generation", () => {
    it("should generate BA/BE insights", () => {
      const insights = generatePharmaInsights("ba_be", {
        be_ratio_auc: 100,
        be_ratio_cmax: 105,
        ci_lower_auc: 90,
        ci_upper_auc: 110,
        ci_lower_cmax: 95,
        ci_upper_cmax: 115,
        meets_fda_criteria: true,
      });
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toContain("Bioequivalence");
    });

    it("should generate efficacy insights", () => {
      const insights = generatePharmaInsights("efficacy", {
        responder_rate: 0.6,
        effect_size: 0.75,
        nnt: 4,
        relative_risk: 1.5,
      });
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toContain("Responder");
    });

    it("should generate safety insights", () => {
      const insights = generatePharmaInsights("safety", {
        adverse_event_rate: 0.15,
        serious_ae_rate: 0.05,
        discontinuation_rate: 0.12,
      });
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0]).toContain("Adverse");
    });
  });
});
