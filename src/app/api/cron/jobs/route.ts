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

import { NextRequest, NextResponse } from "next/server";
import { jobQueue } from "@/lib/utils/job-queue";
import { env } from "@/lib/config";

// Secret for authenticating cron requests
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Verify cron request authorization
 */
function isAuthorized(request: NextRequest): boolean {
  // In development, allow without auth
  if (!env.isProduction) {
    return true;
  }

  // In production, require CRON_SECRET
  if (!CRON_SECRET) {
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

  return token === CRON_SECRET;
}

/**
 * GET /api/cron/jobs
 * Process pending jobs
 */
export async function GET(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    // Get stats before processing
    const statsBefore = jobQueue.getStats();

    // Process pending jobs (limit to 20 per run to avoid timeout)
    const result = await jobQueue.processPending(20);

    // Cleanup old completed/failed jobs
    const cleaned = jobQueue.cleanup(3600); // 1 hour

    // Get stats after processing
    const statsAfter = jobQueue.getStats();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      processed: result.processed,
      failed: result.failed,
      cleaned,
      stats: {
        before: statsBefore,
        after: statsAfter,
      },
    });
  } catch (error) {
    console.error("[Cron] Job processing error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/jobs
 * Manually enqueue a job (for testing)
 */
export async function POST(request: NextRequest) {
  // Check authorization
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { type, payload, delay, maxAttempts } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Job type is required" },
        { status: 400 }
      );
    }

    const jobId = await jobQueue.enqueue(type, payload || {}, {
      delay,
      maxAttempts,
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Job ${jobId} enqueued`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
