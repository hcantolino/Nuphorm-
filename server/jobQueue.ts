/**
 * Job Queue Management System
 * Handles async biostatistics analysis jobs
 */

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface AnalysisJob {
  jobId: string;
  userId: string;
  query: string;
  selectedFiles: string[];
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  message: string;
  result?: {
    statistic: string;
    value: number;
    column?: string;
    chartData?: Record<string, unknown>;
    explanation: string;
    tables?: Array<Record<string, unknown>>;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * In-memory job store
 * In production, use database (Redis, PostgreSQL, etc.)
 */
class JobStore {
  private jobs: Map<string, AnalysisJob> = new Map();
  private jobTimeout: number = 3 * 60 * 1000; // 3 minutes

  /**
   * Create a new job
   */
  createJob(
    userId: string,
    query: string,
    selectedFiles: string[]
  ): AnalysisJob {
    const jobId = generateJobId();
    const job: AnalysisJob = {
      jobId,
      userId,
      query,
      selectedFiles,
      status: "queued",
      createdAt: new Date(),
      progress: 0,
      message: "Queued for analysis...",
    };

    this.jobs.set(jobId, job);

    // Auto-cleanup after timeout
    setTimeout(() => {
      if (this.jobs.has(jobId)) {
        const job = this.jobs.get(jobId)!;
        if (job.status !== "completed") {
          job.status = "failed";
          job.error = {
            code: "TIMEOUT",
            message: "Analysis timed out after 3 minutes",
          };
          job.completedAt = new Date();
        }
      }
    }, this.jobTimeout);

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): AnalysisJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Update job status
   */
  updateJobStatus(
    jobId: string,
    status: JobStatus,
    message: string,
    progress: number = 0
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = status;
    job.message = message;
    job.progress = progress;

    if (status === "processing" && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === "completed" || status === "failed") {
      job.completedAt = new Date();
    }
  }

  /**
   * Set job result
   */
  setJobResult(
    jobId: string,
    result: AnalysisJob["result"]
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.result = result;
    job.status = "completed";
    job.message = "Analysis complete";
    job.progress = 100;
    job.completedAt = new Date();
  }

  /**
   * Set job error
   */
  setJobError(
    jobId: string,
    error: AnalysisJob["error"]
  ): void {
    const job = this.jobs.get(jobId);
    if (!job || !error) return;

    job.error = error;
    job.status = "failed";
    job.message = `Error: ${error.message}`;
    job.completedAt = new Date();
  }

  /**
   * Get user's jobs
   */
  getUserJobs(userId: string): AnalysisJob[] {
    const jobs: AnalysisJob[] = [];
    this.jobs.forEach((job) => {
      if (job.userId === userId) {
        jobs.push(job);
      }
    });
    return jobs;
  }

  /**
   * Clean up old jobs (older than 24 hours)
   */
  cleanup(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const jobsToDelete: string[] = [];
    this.jobs.forEach((job, jobId) => {
      if (job.completedAt && job.completedAt < cutoff) {
        jobsToDelete.push(jobId);
      }
    });

    jobsToDelete.forEach((jobId) => this.jobs.delete(jobId));
  }

  /**
   * Get job queue size
   */
  getQueueSize(): number {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === "queued"
    ).length;
  }

  /**
   * Get processing jobs count
   */
  getProcessingCount(): number {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === "processing"
    ).length;
  }
}

/**
 * Job processor queue
 * Processes jobs sequentially to avoid overload
 */
class JobProcessor {
  private jobStore: JobStore;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private maxConcurrent: number = 3;
  private activeJobs: Set<string> = new Set();

  constructor(jobStore: JobStore) {
    this.jobStore = jobStore;
  }

  /**
   * Start processing jobs
   */
  start(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processNextJob();
    }, 1000); // Check every second
  }

  /**
   * Stop processing jobs
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process next job in queue
   */
  private async processNextJob(): Promise<void> {
    if (this.activeJobs.size >= this.maxConcurrent) {
      return;
    }

    const userJobs = Array.from(this.jobStore["jobs"].values());
    const queuedJob = userJobs.find((job) => job.status === "queued");

    if (!queuedJob) return;

    this.activeJobs.add(queuedJob.jobId);

    try {
      this.jobStore.updateJobStatus(
        queuedJob.jobId,
        "processing",
        "Processing your analysis...",
        10
      );

      // Simulate processing with progress updates
      await this.simulateJobProcessing(queuedJob.jobId);
    } catch (error) {
      this.jobStore.setJobError(queuedJob.jobId, {
        code: "PROCESSING_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      this.activeJobs.delete(queuedJob.jobId);
    }
  }

  /**
   * Simulate job processing with progress updates
   */
  private async simulateJobProcessing(jobId: string): Promise<void> {
    const job = this.jobStore.getJob(jobId);
    if (!job) return;

    // Simulate different processing stages
    const stages = [
      { progress: 20, message: "Parsing data..." },
      { progress: 40, message: "Computing statistics..." },
      { progress: 60, message: "Generating visualizations..." },
      { progress: 80, message: "Preparing results..." },
      { progress: 100, message: "Complete" },
    ];

    for (const stage of stages) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.jobStore.updateJobStatus(
        jobId,
        "processing",
        stage.message,
        stage.progress
      );
    }

    // Mock result
    const result = {
      statistic: "sample_std_dev",
      value: 1.2345,
      column: "fold_change",
      explanation: "Sample standard deviation calculated from fold-change values.",
      chartData: {
        type: "bar",
        labels: ["Gene1", "Gene2", "Gene3"],
        values: [1.2, 0.8, 1.5],
      },
    };

    this.jobStore.setJobResult(jobId, result);
  }
}

/**
 * Global job store instance
 */
let jobStore: JobStore | null = null;
let jobProcessor: JobProcessor | null = null;

/**
 * Initialize job system
 */
export function initializeJobSystem(): void {
  if (!jobStore) {
    jobStore = new JobStore();
    jobProcessor = new JobProcessor(jobStore);
    jobProcessor.start();

    // Cleanup old jobs every hour
    setInterval(() => {
      jobStore?.cleanup();
    }, 60 * 60 * 1000);
  }
}

/**
 * Get job store instance
 */
export function getJobStore(): JobStore {
  if (!jobStore) {
    initializeJobSystem();
  }
  return jobStore!;
}

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export for testing
 */
export { JobStore, JobProcessor };
