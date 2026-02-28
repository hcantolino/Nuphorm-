/**
 * tRPC Job Router
 * Handles async biostatistics analysis job submission and status polling
 */

import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getJobStore, initializeJobSystem } from "../jobQueue";

// Initialize job system on router creation
initializeJobSystem();

export const jobRouter = router({
  /**
   * Submit a new biostatistics analysis job
   */
  startBiostatisticsAnalysis: publicProcedure
    .input(
      z.object({
        query: z.string().min(1, "Query cannot be empty"),
        selectedFiles: z.array(z.string()).optional().default([]),
        csvData: z.array(z.record(z.string(), z.any())).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const jobStore = getJobStore();

      // Get user ID from context (or use anonymous)
      const userId = String(ctx.user?.id || `anon_${Date.now()}`);

      // Create job
      const job = jobStore.createJob(userId, input.query, input.selectedFiles);

      return {
        jobId: job.jobId,
        status: job.status,
        message: job.message,
        createdAt: job.createdAt,
      };
    }),

  /**
   * Get job status and progress
   */
  getAnalysisStatus: publicProcedure
    .input(
      z.object({
        jobId: z.string().min(1, "Job ID required"),
      })
    )
    .query(({ input }) => {
      const jobStore = getJobStore();
      const job = jobStore.getJob(input.jobId);

      if (!job) {
        return {
          error: "Job not found",
          status: "not_found" as const,
        };
      }

      // Calculate elapsed time
      const now = new Date();
      const elapsed = Math.round(
        (now.getTime() - job.createdAt.getTime()) / 1000
      );

      return {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        message: job.message,
        elapsedSeconds: elapsed,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        result: job.result,
        error: job.error,
      };
    }),

  /**
   * Get job result (after completion)
   */
  getAnalysisResult: publicProcedure
    .input(
      z.object({
        jobId: z.string().min(1, "Job ID required"),
      })
    )
    .query(({ input }) => {
      const jobStore = getJobStore();
      const job = jobStore.getJob(input.jobId);

      if (!job) {
        return {
          error: "Job not found",
          status: "not_found" as const,
        };
      }

      if (job.status !== "completed") {
        return {
          error: `Job is still ${job.status}`,
          status: job.status,
        };
      }

      if (job.error) {
        return {
          error: job.error.message,
          status: "failed" as const,
          details: job.error.details,
        };
      }

      return {
        status: "completed" as const,
        result: job.result,
      };
    }),

  /**
   * Cancel a job
   */
  cancelAnalysis: publicProcedure
    .input(
      z.object({
        jobId: z.string().min(1, "Job ID required"),
      })
    )
    .mutation(({ input }) => {
      const jobStore = getJobStore();
      const job = jobStore.getJob(input.jobId);

      if (!job) {
        return {
          error: "Job not found",
          success: false,
        };
      }

      if (job.status === "completed" || job.status === "failed") {
        return {
          error: `Cannot cancel ${job.status} job`,
          success: false,
        };
      }

      jobStore.updateJobStatus(
        input.jobId,
        "failed",
        "Cancelled by user",
        job.progress || 0
      );

      return {
        success: true,
        message: "Job cancelled",
      };
    }),

  /**
   * Get user's job history
   */
  getUserJobs: publicProcedure.query(({ ctx }) => {
    const jobStore = getJobStore();
    const userId = String(ctx.user?.id || `anon_${Date.now()}`);

    const jobs = jobStore.getUserJobs(userId);

    return jobs.map((job) => ({
      jobId: job.jobId,
      query: job.query,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      hasResult: !!job.result,
      hasError: !!job.error,
    }));
  }),

  /**
   * Get job queue statistics
   */
  getQueueStats: publicProcedure.query(() => {
    const jobStore = getJobStore();

    return {
      queuedCount: jobStore.getQueueSize(),
      processingCount: jobStore.getProcessingCount(),
      timestamp: new Date().toISOString(),
    };
  }),
});
