/**
 * Regression Modeling tRPC Router
 * Endpoints for linear, logistic, and mixed effects regression
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  linearRegression,
  logisticRegression,
  mixedEffectsModel,
  RegressionResult,
} from "../ai/regressionModels";

export const regressionRouter = router({
  /**
   * Run regression analysis
   * Input: model type, outcome variable, predictors, data
   * Output: coefficients, statistics, diagnostics, plots
   */
  runRegression: publicProcedure
    .input(
      z.object({
        modelType: z.enum(["linear", "logistic", "mixed"]),
        outcomeVariable: z.string(),
        predictors: z.array(z.string()),
        data: z.array(z.record(z.string(), z.number())),
        groupVariable: z.string().optional(), // For mixed effects
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Extract outcome and predictors from data
        const y = input.data.map((row) => row[input.outcomeVariable]);
        const X = input.data.map((row) =>
          input.predictors.map((pred) => row[pred] || 0)
        );

        let result: RegressionResult;

        if (input.modelType === "linear") {
          result = linearRegression(y, X);
        } else if (input.modelType === "logistic") {
          result = logisticRegression(y, X);
        } else if (input.modelType === "mixed" && input.groupVariable) {
          const groups = input.data.map((row) => {
            const val = row[input.groupVariable!];
            return typeof val === "number" ? val : 0;
          });
          result = mixedEffectsModel(y, X, groups);
        } else {
          throw new Error("Invalid model type or missing group variable for mixed effects");
        }

        return {
          success: true,
          result,
          message: `${input.modelType} regression completed successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          message: "Regression analysis failed",
        };
      }
    }),

  /**
   * Get model diagnostics and validation
   */
  getModelDiagnostics: publicProcedure
    .input(
      z.object({
        result: z.any(), // RegressionResult
      })
    )
    .query(({ input }) => {
      const result = input.result as RegressionResult;

      const diagnostics = {
        multicollinearity: result.diagnostics.multicollinearity || {},
        heteroscedasticity: result.diagnostics.heteroscedasticity,
        normality: result.diagnostics.normality,
        assumptions: {
          linearityOK: true,
          normalityOK:
            (result.diagnostics.normality || 1) > 0.05,
          homoscedasticityOK:
            (result.diagnostics.heteroscedasticity || 1) > 0.05,
          multicollinearityOK: Object.values(
            result.diagnostics.multicollinearity || {}
          ).every((vif) => vif < 5),
        },
      };

      return {
        diagnostics,
        warnings: generateWarnings(diagnostics),
      };
    }),

  /**
   * Compare multiple models
   */
  compareModels: publicProcedure
    .input(
      z.object({
        models: z.array(
          z.object({
            name: z.string(),
            result: z.any(),
          })
        ),
      })
    )
    .query(({ input }) => {
      const comparison = input.models.map((m) => {
        const result = m.result as RegressionResult;
        return {
          name: m.name,
          type: result.modelType,
          rSquared: result.modelStats.rSquared,
          adjRSquared: result.modelStats.adjRSquared,
          aic: result.modelStats.aic,
          bic: result.modelStats.bic,
          significantCoefficients: result.coefficients.filter(
            (c) => c.significant
          ).length,
        };
      });

      return {
        comparison,
        recommendation: getBestModel(comparison),
      };
    }),
});

// ============ Helper Functions ============

function generateWarnings(
  diagnostics: Record<string, unknown>
): string[] {
  const warnings: string[] = [];

  const assumptions = diagnostics.assumptions as Record<string, boolean>;

  if (!assumptions.normalityOK) {
    warnings.push("Residuals may not be normally distributed. Consider transformation.");
  }

  if (!assumptions.homoscedasticityOK) {
    warnings.push("Heteroscedasticity detected. Consider weighted regression.");
  }

  if (!assumptions.multicollinearityOK) {
    warnings.push("High multicollinearity detected (VIF > 5). Consider removing correlated predictors.");
  }

  return warnings;
}

function getBestModel(
  comparison: Array<Record<string, unknown>>
): string {
  if (comparison.length === 0) return "No models to compare";

  let bestModel = comparison[0];
  let bestScore = (comparison[0].aic as number) || Infinity;

  for (const model of comparison) {
    const aic = model.aic as number;
    if (aic < bestScore) {
      bestScore = aic;
      bestModel = model;
    }
  }

  return `${bestModel.name} (AIC: ${bestScore.toFixed(2)})`;
}
