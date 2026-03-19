/**
 * Cron Job Processing Endpoint - Phase 5 Advanced Features (Nov 2025)
 *
 * Processes pending background jobs. Call this endpoint via:
 * - Vercel Cron: Configure in vercel.json
 * - External cron service (e.g., cron-job.org)
 * - Manual trigger for testing
 *
 * Security:
 * - Requires CRON_SECRET header in production
 * - Returns job processing statistics
 *
 * Usage:
 * ```bash
 * # With secret (production)
 * curl -H "Authorization: Bearer $CRON_SECRET" https://example.com/api/cron/jobs
 *
 * # Local development
 * curl http://localhost:3000/api/cron/jobs
 * ```
 *
 * Vercel Cron Config (vercel.json):
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/jobs",
 *     "schedule": "* * * * *"
 *   }]
 * }
 * ```
 */

import { NextRequest } from "next/server";
import { jobQueue } from "@/lib/utils/job-queue";
import { processEmailWorkspaceJobs } from "@/lib/jobs/email-workspace";
import { cronJobsRateLimiter } from "@/lib/utils/public-rate-limit";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

/**
 * Verify cron request authorization
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("[Cron] CRON_SECRET not configured - cron endpoint disabled");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <token>" and just "<token>"
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return token === cronSecret;
}

/**
 * GET /api/cron/jobs
 * Process pending jobs
 */
export async function GET(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return apiError("Unauthorized", 401);
  }

  const startTime = Date.now();

  try {
    // Get stats before processing
    const statsBefore = jobQueue.getStats();

    // Process pending jobs (limit to 20 per run to avoid timeout)
    const result = await jobQueue.processPending(20);

    // Process email workspace due schedules (campaigns + reports)
    const emailWorkspace = await processEmailWorkspaceJobs();

    // Cleanup old completed/failed jobs
    const cleaned = jobQueue.cleanup(3600); // 1 hour

    // Get stats after processing
    const statsAfter = jobQueue.getStats();

    const duration = Date.now() - startTime;

    return apiSuccess({
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      processed: result.processed,
      failed: result.failed,
      cleaned,
      emailWorkspace,
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    });
  } catch (error) {
    console.error("[Cron] Job processing error:", error);

    return apiError(error instanceof Error ? error.message : "Unknown error", 500, {
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * POST /api/cron/jobs
 * Manually enqueue a job (for testing)
 */
export async function POST(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return apiError("Unauthorized", 401);
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rateLimit = await cronJobsRateLimiter.check(ipAddress);
  if (!rateLimit.allowed) {
    const response = apiError(
      rateLimit.reason || "Rate limit exceeded. Please try again later.",
      429
    );
    if (rateLimit.retryAfter) {
      response.headers.set("Retry-After", String(rateLimit.retryAfter));
    }
    return response;
  }

  try {
    const body = await request.json();
    const { type, payload, delay, maxAttempts } = body;

    if (!type) {
      return apiError("Job type is required", 400);
    }

    const jobId = await jobQueue.enqueue(type, payload || {}, {
      delay,
      maxAttempts,
    });

    return apiSuccess({
      jobId,
      message: `Job ${jobId} enqueued`,
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Unknown error");
  }
}
