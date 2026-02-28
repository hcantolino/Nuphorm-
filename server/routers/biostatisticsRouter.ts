/**
 * Biostatistics tRPC Router
 * Handles biostatistics computations and returns structured JSON with actual numbers
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { computeBiostatistics } from "../biostatisticsCompute";

export const biostatisticsRouter = router({
  /**
   * Compute biostatistics from CSV data
   * Returns structured JSON with actual computed values, not narrative text
   */
  compute: publicProcedure
    .input(
      z.object({
        query: z.string().describe("User query (e.g., 'standard deviation for fold_change')"),
        csvData: z.array(z.record(z.string(), z.any())).describe("Array of CSV rows"),
        columnName: z.string().optional().describe("Optional specific column to analyze"),
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      try {
        if (!input.csvData || input.csvData.length === 0) {
          throw new Error("No CSV data provided");
        }

        // Compute biostatistics
        const result = computeBiostatistics(
          input.csvData,
          input.query,
          input.columnName
        );

        return {
          success: true,
          data: result,
          error: null,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        return {
          success: false,
          data: null,
          error: errorMessage,
        };
      }
    }),

  /**
   * Batch compute multiple statistics
   * Useful for comprehensive analysis
   */
  computeMultiple: publicProcedure
    .input(
      z.object({
        queries: z.array(z.string()).describe("Array of queries to compute"),
        csvData: z.array(z.record(z.string(), z.any())).describe("Array of CSV rows"),
      })
    )
    .mutation(async ({ input }: { input: any }) => {
      try {
        if (!input.csvData || input.csvData.length === 0) {
          throw new Error("No CSV data provided");
        }

        const results = input.queries.map((query: string) => {
          try {
            const result = computeBiostatistics(input.csvData, query);
            return {
              query,
              success: true,
              data: result,
              error: null,
            };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            return {
              query,
              success: false,
              data: null,
              error: errorMessage,
            };
          }
        });

        return {
          success: true,
          results,
          error: null,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        return {
          success: false,
          results: [],
          error: errorMessage,
        };
      }
    }),

  /**
   * Get data characteristics
   * Analyzes CSV data to detect data types and suggest analyses
   */
  analyzeData: publicProcedure
    .input(
      z.object({
        csvData: z.array(z.record(z.string(), z.any())).describe("Array of CSV rows"),
      })
    )
    .query(async ({ input }: any) => {
      try {
        if (!input.csvData || input.csvData.length === 0) {
          throw new Error("No CSV data provided");
        }

        const firstRow = input.csvData[0];
        const columns = Object.keys(firstRow);

        // Detect column types
        const columnTypes: Record<string, string> = {};
        columns.forEach((col: string) => {
          const values = input.csvData.map((row: any) => row[col]);
          const numericCount = values.filter(
            (v: any) => !isNaN(Number(v)) && v !== null && v !== ""
          ).length;
          const numericPercentage = (numericCount / values.length) * 100;

          if (numericPercentage > 80) {
            columnTypes[col] = "numeric";
          } else if (values.some((v: any) => typeof v === "boolean")) {
            columnTypes[col] = "boolean";
          } else {
            columnTypes[col] = "text";
          }
        });

        // Detect data characteristics
        const lowerColumns = columns.map((c: string) => c.toLowerCase());
        const characteristics = {
          hasGeneExpression: lowerColumns.some((c: string) =>
            /gene|expression|fold.?change|control|treated/.test(c)
          ),
          hasSurvivalData: lowerColumns.some((c: string) =>
            /survival|time.?event|event|censored|status/.test(c)
          ),
          hasDoseData: lowerColumns.some((c: string) =>
            /dose|concentration|exposure|auc|cmax/.test(c)
          ),
          hasEfficacyData: lowerColumns.some((c: string) =>
            /efficacy|response|responder|improvement|outcome/.test(c)
          ),
          hasSafetyData: lowerColumns.some((c: string) =>
            /adverse|safety|ae|event|toxicity/.test(c)
          ),
          hasTimeSeriesData: lowerColumns.some((c: string) =>
            /time|week|day|month|hour/.test(c)
          ),
        };

        // Suggest analyses
        const suggestions: string[] = [];
        if (characteristics.hasGeneExpression) {
          suggestions.push("Analyze fold-change statistics");
          suggestions.push("Compute log2 fold-change");
          suggestions.push("Identify upregulated/downregulated genes");
        }
        if (characteristics.hasSurvivalData) {
          suggestions.push("Generate Kaplan-Meier curves");
          suggestions.push("Perform survival analysis");
        }
        if (characteristics.hasDoseData) {
          suggestions.push("Analyze dose-response relationship");
          suggestions.push("Compute PK/PD parameters");
        }
        if (characteristics.hasEfficacyData) {
          suggestions.push("Analyze efficacy metrics");
          suggestions.push("Compute response rates");
        }

        return {
          success: true,
          data: {
            rowCount: input.csvData.length,
            columnCount: columns.length,
            columns,
            columnTypes,
            characteristics,
            suggestions,
          },
          error: null,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        return {
          success: false,
          data: null,
          error: errorMessage,
        };
      }
    }),
});
