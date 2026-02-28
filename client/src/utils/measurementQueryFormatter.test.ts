import { describe, it, expect } from "vitest";
import { formatMeasurementQuery, getFirstNumericColumn } from "./measurementQueryFormatter";

describe("formatMeasurementQuery", () => {
  it("should format mean query", () => {
    const query = formatMeasurementQuery("mean", "Mean", "fold_change");
    expect(query).toBe("create a mean for fold_change");
  });

  it("should format std_dev query", () => {
    const query = formatMeasurementQuery("std_dev", "Standard Deviation", "expression_level");
    expect(query).toBe("calculate the standard deviation of expression_level");
  });

  it("should format t_test query", () => {
    const query = formatMeasurementQuery("t_test", "T-tests", "treatment_response");
    expect(query).toBe("perform a t-test on treatment_response");
  });

  it("should format kaplan-meier query", () => {
    const query = formatMeasurementQuery("km", "Kaplan-Meier Estimator", "survival_time");
    expect(query).toBe("compute kaplan-meier estimates for survival_time");
  });

  it("should use 'the data' as default column", () => {
    const query = formatMeasurementQuery("mean", "Mean");
    expect(query).toBe("create a mean for the data");
  });

  it("should handle unknown measurement IDs", () => {
    const query = formatMeasurementQuery("unknown_id", "Unknown Measurement", "column");
    expect(query).toBe("analyze Unknown Measurement for column");
  });

  it("should format multiple different measurements", () => {
    const queries = [
      formatMeasurementQuery("median", "Median", "values"),
      formatMeasurementQuery("variance", "Variance", "values"),
      formatMeasurementQuery("range", "Range", "values"),
    ];
    expect(queries[0]).toBe("compute the median of values");
    expect(queries[1]).toBe("compute the variance of values");
    expect(queries[2]).toBe("calculate the range of values");
  });
});

describe("getFirstNumericColumn", () => {
  it("should return first numeric column", () => {
    const data = [
      { name: "Sample1", value: 10, category: "A" },
      { name: "Sample2", value: 20, category: "B" },
    ];
    const column = getFirstNumericColumn(data);
    expect(column).toBe("value");
  });

  it("should return undefined for empty data", () => {
    const column = getFirstNumericColumn([]);
    expect(column).toBeUndefined();
  });

  it("should skip non-numeric columns", () => {
    const data = [
      { name: "Sample1", category: "A", value: 10 },
    ];
    const column = getFirstNumericColumn(data);
    expect(column).toBe("value");
  });

  it("should return undefined if no numeric columns", () => {
    const data = [
      { name: "Sample1", category: "A" },
    ];
    const column = getFirstNumericColumn(data);
    expect(column).toBeUndefined();
  });
});
