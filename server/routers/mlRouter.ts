/**
 * Machine Learning tRPC Router
 * Random Forests, K-means clustering, feature importance
 */

import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { randomForest, kMeansClustering } from "../ai/mlBasics";

export const mlRouter = router({
  /**
   * Run random forest classification or regression
   */
  runRandomForest: publicProcedure
    .input(
      z.object({
        data: z.array(z.record(z.string(), z.number())),
        outcomeVariable: z.string(),
        predictors: z.array(z.string()),
        isClassification: z.boolean(),
        nTrees: z.number().default(100),
        cvFolds: z.number().default(5),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Extract X and y
        const y = input.data.map((row) => row[input.outcomeVariable]);
        const X = input.data.map((row) =>
          input.predictors.map((pred) => row[pred] || 0)
        );

        const result = randomForest(
          X,
          y,
          input.nTrees,
          input.isClassification,
          input.cvFolds
        );

        return {
          success: true,
          result,
          message: `Random forest model trained with ${input.nTrees} trees`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          message: "Random forest training failed",
        };
      }
    }),

  /**
   * Run k-means clustering
   */
  runKMeans: publicProcedure
    .input(
      z.object({
        data: z.array(z.record(z.string(), z.number())),
        features: z.array(z.string()),
        maxK: z.number().default(10),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Extract X
        const X = input.data.map((row) =>
          input.features.map((feat) => row[feat] || 0)
        );

        const result = kMeansClustering(X, input.maxK);

        return {
          success: true,
          result,
          message: `K-means clustering completed with ${result.nClusters} clusters`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          message: "K-means clustering failed",
        };
      }
    }),

  /**
   * Get feature importance interpretation
   */
  interpretFeatureImportance: publicProcedure
    .input(
      z.object({
        importances: z.array(
          z.object({
            feature: z.number(),
            importance: z.number(),
          })
        ),
        featureNames: z.array(z.string()),
      })
    )
    .query(({ input }) => {
      // Sort by importance
      const sorted = [...input.importances].sort(
        (a, b) => b.importance - a.importance
      );

      // Generate interpretation
      const topFeatures = sorted.slice(0, 3);
      const interpretation = `Top biomarkers: ${topFeatures
        .map((f) => `${input.featureNames[f.feature]} (${(f.importance * 100).toFixed(1)}%)`)
        .join(", ")}. These features are most predictive of the outcome.`;

      return {
        topFeatures,
        interpretation,
        allImportances: sorted,
      };
    }),

  /**
   * Get clustering interpretation
   */
  interpretClustering: publicProcedure
    .input(
      z.object({
        assignments: z.array(z.number()),
        nClusters: z.number(),
        silhouetteScore: z.number(),
      })
    )
    .query(({ input }) => {
      const clusterSizes = Array(input.nClusters).fill(0);
      for (const assignment of input.assignments) {
        clusterSizes[assignment]++;
      }

      const interpretation =
        input.silhouetteScore > 0.5
          ? "Strong cluster separation detected. Clusters are well-defined and distinct."
          : input.silhouetteScore > 0.25
            ? "Moderate cluster separation. Clusters overlap somewhat but are identifiable."
            : "Weak cluster separation. Consider using fewer clusters or different features.";

      return {
        clusterSizes,
        silhouetteScore: input.silhouetteScore,
        interpretation,
        recommendation:
          input.silhouetteScore > 0.5
            ? "Clusters are suitable for patient segmentation"
            : "Consider refining features or cluster parameters",
      };
    }),
});
