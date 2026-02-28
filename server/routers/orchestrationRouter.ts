/**
 * Orchestration Router
 * Coordinates all biostatistics analyses and workflows
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { randomForest, kMeansClustering } from "../ai/mlBasics";
import { linearRegression, logisticRegression } from "../ai/regressionModels";
import { generateDataSummary } from "../ai/dataExploration";

export const orchestrationRouter = router({
  /**
   * Auto-analyze: Generate baseline report with suggestions
   */
  autoAnalyze: publicProcedure
    .input(
      z.object({
        data: z.array(z.record(z.string(), z.number())),
        dataName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const exploration = generateDataSummary(input.data);

        // Detect data patterns and suggest analyses
        const suggestions: string[] = [];
        const numericCols = exploration.columns.filter(
          (col: any) => col.type === "numeric"
        );
        const categoricalCols = exploration.columns.filter(
          (col: any) => col.type === "categorical"
        );

        if (numericCols.length >= 2) {
          suggestions.push("correlation analysis");
        }
        if (categoricalCols.length > 0 && numericCols.length > 0) {
          suggestions.push("group comparison (t-test/ANOVA)");
        }
        if (input.data.length > 50) {
          suggestions.push("machine learning (random forest for feature importance)");
        }
        if (
          numericCols.some((col) => col.name.toLowerCase().includes("time")) &&
          categoricalCols.some((col) => col.name.toLowerCase().includes("event"))
        ) {
          suggestions.push("survival analysis (Kaplan-Meier)");
        }

        return {
          success: true,
          baseline: {
            dataName: input.dataName,
            nRows: input.data.length,
            nCols: input.data[0] ? Object.keys(input.data[0]).length : 0,
            exploration,
          },
          suggestions,
          nextSteps: [
            `You have ${input.data.length} observations across ${numericCols.length} numeric and ${categoricalCols.length} categorical variables.`,
            `Suggested analyses: ${suggestions.join(", ")}.`,
            "Try: 'Analyze efficacy by treatment group' or 'Find important biomarkers'",
          ],
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Workflow: Execute multi-step analysis pipeline
   */
  executeWorkflow: publicProcedure
    .input(
      z.object({
        workflowType: z.enum([
          "clinical_trial",
          "biomarker_discovery",
          "pk_pd",
          "safety_analysis",
        ]),
        data: z.array(z.record(z.string(), z.number())),
        parameters: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const results: Record<string, unknown> = {};

        switch (input.workflowType) {
          case "clinical_trial":
            // Step 1: Baseline stats
            results.baseline = generateDataSummary(input.data);

            // Step 2: Group comparison (if treatment/control columns exist)
            const treatmentCol = Object.keys(input.data[0] || {}).find((k) =>
              k.toLowerCase().includes("treatment")
            );
            if (treatmentCol) {
              results.groupComparison = "t-test results would go here";
            }

            // Step 3: Safety analysis
            results.safety = "Adverse event analysis would go here";
            break;

          case "biomarker_discovery":
            // Step 1: Data exploration
            results.exploration = generateDataSummary(input.data);

            // Step 2: Feature importance (random forest)
            const outcomeCol = Object.keys(input.data[0] || {}).find((k) =>
              k.toLowerCase().includes("response")
            );
            if (outcomeCol && input.data.length > 10) {
              const y = input.data.map((row) => row[outcomeCol as string]);
              const X = input.data.map((row) => {
                const keys = Object.keys(row);
                return keys
                  .filter((k) => k !== outcomeCol)
                  .map((k) => row[k]);
              });
              results.featureImportance = randomForest(X, y, 50, true, 5);
            }

            // Step 3: Clustering
            if (input.data.length > 20) {
              const X = input.data.map((row) => Object.values(row));
              results.clustering = kMeansClustering(X, 5);
            }
            break;

          case "pk_pd":
            results.exploration = generateDataSummary(input.data);
            results.pkPdAnalysis = "Dose-response modeling would go here";
            break;

          case "safety_analysis":
            results.exploration = generateDataSummary(input.data);
            results.safetySignals = "Safety signal detection would go here";
            break;
        }

        return {
          success: true,
          workflowType: input.workflowType,
          results,
          message: `${input.workflowType} workflow completed successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),

  /**
   * Get analysis recommendations based on data
   */
  getRecommendations: publicProcedure
    .input(
      z.object({
        data: z.array(z.record(z.string(), z.number())),
        userQuery: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const exploration = generateDataSummary(input.data);
      const recommendations: Array<{
        analysis: string;
        reason: string;
        command: string;
      }> = [];

      // Analyze data structure
      const numericCols = exploration.columns.filter(
        (col: any) => col.type === "numeric"
      ).length;
      const categoricalCols = exploration.columns.filter(
        (col: any) => col.type === "categorical"
      ).length;
      const n = input.data.length;

      // Generate recommendations
      if (numericCols >= 2) {
        recommendations.push({
          analysis: "Correlation Analysis",
          reason: "Multiple numeric variables detected",
          command: "Analyze correlations between variables",
        });
      }

      if (categoricalCols > 0 && numericCols > 0) {
        recommendations.push({
          analysis: "Group Comparison",
          reason: "Categorical grouping variable available",
          command: "Compare outcomes across groups",
        });
      }

      if (n > 50 && numericCols > 3) {
        recommendations.push({
          analysis: "Machine Learning",
          reason: "Sufficient data for predictive modeling",
          command: "Run random forest for feature importance",
        });
      }

      if (n > 100) {
        recommendations.push({
          analysis: "Clustering",
          reason: "Large dataset suitable for segmentation",
          command: "Perform k-means clustering",
        });
      }

      // Parse user query for specific intent
      if (input.userQuery) {
        const query = input.userQuery.toLowerCase();
        if (
          query.includes("survival") ||
          query.includes("time-to-event") ||
          query.includes("kaplan")
        ) {
          recommendations.unshift({
            analysis: "Survival Analysis",
            reason: "User query mentions survival/time-to-event",
            command: "Run Kaplan-Meier and Cox regression",
          });
        }
        if (
          query.includes("predict") ||
          query.includes("forecast") ||
          query.includes("response")
        ) {
          recommendations.unshift({
            analysis: "Predictive Modeling",
            reason: "User query indicates prediction task",
            command: "Run logistic/linear regression or random forest",
          });
        }
      }

      return {
        recommendations: recommendations.slice(0, 5), // Top 5
        totalSuggestions: recommendations.length,
      };
    }),

  /**
   * Export analysis results
   */
  exportResults: publicProcedure
    .input(
      z.object({
        results: z.any(),
        format: z.enum(["json", "csv", "pdf", "html"]),
        includeCode: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      try {
        let exportData = "";

        switch (input.format) {
          case "json":
            exportData = JSON.stringify(input.results, null, 2);
            break;
          case "csv":
            // Convert results to CSV format
            exportData = "Analysis Results\n";
            exportData += JSON.stringify(input.results, null, 2);
            break;
          case "pdf":
            exportData = "PDF export would be generated here";
            break;
          case "html":
            exportData = `
              <html>
                <head><title>Analysis Report</title></head>
                <body>
                  <h1>Biostatistics Analysis Report</h1>
                  <pre>${JSON.stringify(input.results, null, 2)}</pre>
                </body>
              </html>
            `;
            break;
        }

        if (input.includeCode) {
          exportData +=
            "\n\n# Reproducible Code\n# R equivalent:\n# Your analysis code here";
        }

        return {
          success: true,
          format: input.format,
          data: exportData,
          message: `Results exported as ${input.format}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
});
