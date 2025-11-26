/**
 * Health Check API Endpoint - Phase 5 Advanced Features (Nov 2025)
 *
 * Provides health status for monitoring, load balancers, and deployment checks.
 *
 * Endpoints:
 * - GET /api/health - Basic health check (fast, for load balancers)
 * - GET /api/health?deep=true - Deep health check (includes DB, cache, services)
 *
 * Response Format:
 * ```json
 * {
 *   "status": "healthy" | "degraded" | "unhealthy",
 *   "timestamp": "2025-11-26T10:30:00.000Z",
 *   "version": "1.0.0",
 *   "uptime": 3600,
 *   "checks": {
 *     "database": { "status": "healthy", "latency": 5 },
 *     "cache": { "status": "healthy", "stats": { ... } }
 *   }
 * }
 * ```
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cache } from "@/lib/utils/cache";

// Track server start time for uptime calculation
const serverStartTime = Date.now();

type HealthStatus = "healthy" | "degraded" | "unhealthy";

interface CheckResult {
  status: HealthStatus;
  latency?: number;
  error?: string;
  stats?: Record<string, unknown>;
}

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks?: Record<string, CheckResult>;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "healthy",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Database connection failed",
    };
  }
}

/**
 * Check cache status
 */
async function checkCache(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Test write and read
    const testKey = "_health_check_";
    const testValue = Date.now().toString();

    await cache.set(testKey, testValue, 10);
    const retrieved = await cache.get<string>(testKey);
    await cache.delete(testKey);

    if (retrieved !== testValue) {
      return {
        status: "degraded",
        latency: Date.now() - start,
        error: "Cache read/write mismatch",
      };
    }

    return {
      status: "healthy",
      latency: Date.now() - start,
      stats: cache.getStats(),
    };
  } catch (error) {
    return {
      status: "degraded", // Cache failure is not critical
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Cache check failed",
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): CheckResult {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const usagePercent = Math.round((used.heapUsed / used.heapTotal) * 100);

  // Warn if memory usage is above 80%
  const status: HealthStatus = usagePercent > 90 ? "degraded" : "healthy";

  return {
    status,
    stats: {
      heapUsedMB,
      heapTotalMB,
      usagePercent,
      rssMB: Math.round(used.rss / 1024 / 1024),
    },
  };
}

/**
 * Determine overall health status from individual checks
 */
function determineOverallStatus(checks: Record<string, CheckResult>): HealthStatus {
  const statuses = Object.values(checks).map((c) => c.status);

  if (statuses.includes("unhealthy")) {
    return "unhealthy";
  }
  if (statuses.includes("degraded")) {
    return "degraded";
  }
  return "healthy";
}

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const isDeepCheck = searchParams.get("deep") === "true";

  const baseResponse: HealthResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: Math.round((Date.now() - serverStartTime) / 1000),
  };

  // Basic health check (fast, for load balancers)
  if (!isDeepCheck) {
    return NextResponse.json(baseResponse, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Deep health check (includes service checks)
  const checks: Record<string, CheckResult> = {};

  // Run checks in parallel
  const [dbResult, cacheResult] = await Promise.all([
    checkDatabase(),
    checkCache(),
  ]);

  checks.database = dbResult;
  checks.cache = cacheResult;
  checks.memory = checkMemory();

  const overallStatus = determineOverallStatus(checks);

  const response: HealthResponse = {
    ...baseResponse,
    status: overallStatus,
    checks,
  };

  // Return appropriate HTTP status
  const httpStatus = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * HEAD /api/health
 * Lightweight health check (just status code)
 */
export async function HEAD() {
  try {
    // Quick DB check
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
