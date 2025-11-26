/**
 * Background Job Queue - Phase 5 Advanced Features (Nov 2025)
 *
 * Simple, serverless-friendly job queue for background tasks.
 * Works with Vercel/serverless deployments via scheduled functions or webhooks.
 *
 * Features:
 * - In-memory queue for development
 * - Delayed job execution
 * - Retry with exponential backoff
 * - Job status tracking
 * - Multiple job types support
 *
 * Usage:
 * ```ts
 * // Define a job handler
 * jobQueue.registerHandler('send-email', async (payload) => {
 *   await sendEmail(payload.to, payload.subject, payload.body);
 * });
 *
 * // Enqueue a job
 * await jobQueue.enqueue('send-email', {
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   body: 'Hello...'
 * });
 *
 * // Process pending jobs (call from cron endpoint)
 * const results = await jobQueue.processPending();
 * ```
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "retrying";

export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
}

export interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

type JobHandler<T = unknown> = (payload: T) => Promise<void>;

// In-memory job store
class InMemoryJobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();

  /**
   * Register a handler for a job type
   */
  registerHandler<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
    console.log(`[JobQueue] Registered handler for: ${type}`);
  }

  /**
   * Enqueue a new job
   */
  async enqueue<T>(
    type: string,
    payload: T,
    options: {
      delay?: number; // Delay in seconds
      maxAttempts?: number;
    } = {}
  ): Promise<string> {
    const id = this.generateId();
    const now = new Date();
    const scheduledFor = options.delay
      ? new Date(now.getTime() + options.delay * 1000)
      : now;

    const job: Job<T> = {
      id,
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      createdAt: now,
      scheduledFor,
    };

    this.jobs.set(id, job as Job);
    console.log(
      `[JobQueue] Enqueued job ${id} (${type})${options.delay ? ` scheduled for ${scheduledFor.toISOString()}` : ""}`
    );

    return id;
  }

  /**
   * Process all pending jobs that are ready
   */
  async processPending(limit: number = 10): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    let processed = 0;
    let failed = 0;

    // Get pending jobs that are ready
    const pendingJobs = Array.from(this.jobs.values())
      .filter(
        (job) =>
          (job.status === "pending" || job.status === "retrying") &&
          job.scheduledFor <= now
      )
      .slice(0, limit);

    for (const job of pendingJobs) {
      const result = await this.processJob(job);
      if (result) {
        processed++;
      } else {
        failed++;
      }
    }

    return { processed, failed };
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<boolean> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      console.error(`[JobQueue] No handler for job type: ${job.type}`);
      job.status = "failed";
      job.error = `No handler registered for job type: ${job.type}`;
      return false;
    }

    job.status = "processing";
    job.startedAt = new Date();
    job.attempts++;

    console.log(
      `[JobQueue] Processing job ${job.id} (${job.type}) - attempt ${job.attempts}/${job.maxAttempts}`
    );

    try {
      await handler(job.payload);

      job.status = "completed";
      job.completedAt = new Date();
      console.log(`[JobQueue] Job ${job.id} completed successfully`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[JobQueue] Job ${job.id} failed: ${errorMessage}`);

      if (job.attempts < job.maxAttempts) {
        // Retry with exponential backoff
        const backoffMs = Math.pow(2, job.attempts) * 1000; // 2s, 4s, 8s, etc.
        job.status = "retrying";
        job.scheduledFor = new Date(Date.now() + backoffMs);
        job.error = errorMessage;
        console.log(
          `[JobQueue] Job ${job.id} will retry in ${backoffMs / 1000}s`
        );
      } else {
        job.status = "failed";
        job.error = errorMessage;
        console.error(
          `[JobQueue] Job ${job.id} failed permanently after ${job.attempts} attempts`
        );
      }
      return false;
    }
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get jobs by type
   */
  getJobsByType(type: string): Job[] {
    return Array.from(this.jobs.values()).filter((job) => job.type === type);
  }

  /**
   * Get job statistics
   */
  getStats(): JobStats {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter((j) => j.status === "pending" || j.status === "retrying")
        .length,
      processing: jobs.filter((j) => j.status === "processing").length,
      completed: jobs.filter((j) => j.status === "completed").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      total: jobs.length,
    };
  }

  /**
   * Clear completed and failed jobs older than specified seconds
   */
  cleanup(olderThanSeconds: number = 3600): number {
    const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
    let count = 0;

    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.completedAt &&
        job.completedAt < cutoff
      ) {
        this.jobs.delete(id);
        count++;
      }
    }

    if (count > 0) {
      console.log(`[JobQueue] Cleaned up ${count} old jobs`);
    }

    return count;
  }

  /**
   * Generate unique job ID
   */
  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
const queue = new InMemoryJobQueue();

// Cleanup old jobs every hour
setInterval(() => {
  queue.cleanup();
}, 60 * 60 * 1000);

/**
 * Job Queue Interface
 */
export const jobQueue = {
  /**
   * Register a job handler
   */
  registerHandler: <T>(type: string, handler: JobHandler<T>) =>
    queue.registerHandler(type, handler),

  /**
   * Enqueue a job
   */
  enqueue: <T>(
    type: string,
    payload: T,
    options?: { delay?: number; maxAttempts?: number }
  ) => queue.enqueue(type, payload, options),

  /**
   * Process pending jobs
   */
  processPending: (limit?: number) => queue.processPending(limit),

  /**
   * Get job by ID
   */
  getJob: (id: string) => queue.getJob(id),

  /**
   * Get jobs by type
   */
  getJobsByType: (type: string) => queue.getJobsByType(type),

  /**
   * Get queue statistics
   */
  getStats: () => queue.getStats(),

  /**
   * Cleanup old jobs
   */
  cleanup: (olderThanSeconds?: number) => queue.cleanup(olderThanSeconds),
};

/**
 * Common job types
 */
export const JobTypes = {
  SEND_EMAIL: "send-email",
  SEND_NOTIFICATION: "send-notification",
  GENERATE_REPORT: "generate-report",
  CLEANUP_OLD_DATA: "cleanup-old-data",
  SYNC_EXTERNAL: "sync-external",
  AUDIT_LOG_BACKUP: "audit-log-backup",
  CACHE_WARMUP: "cache-warmup",
} as const;

export type JobType = (typeof JobTypes)[keyof typeof JobTypes];
