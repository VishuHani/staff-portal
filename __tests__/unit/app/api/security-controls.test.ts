import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRateLimits = vi.hoisted(() => ({
  documentUploadRateLimiter: {
    check: vi.fn(),
    reset: vi.fn(),
  },
  emailWebhookRateLimiter: {
    check: vi.fn(),
    reset: vi.fn(),
  },
  cronJobsRateLimiter: {
    check: vi.fn(),
    reset: vi.fn(),
  },
}));

const mockCreateClient = vi.hoisted(() => vi.fn());
const mockHasPermission = vi.hoisted(() => vi.fn());
const mockStorageUpload = vi.hoisted(() => vi.fn());
const mockGetPublicUrl = vi.hoisted(() => vi.fn());
const mockStorageFrom = vi.hoisted(() =>
  vi.fn(() => ({
    upload: mockStorageUpload,
    getPublicUrl: mockGetPublicUrl,
  }))
);

const mockPrisma = vi.hoisted(() => ({
  emailWebhookEvent: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  emailRecipient: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  userEmailPreference: {
    update: vi.fn(),
  },
  emailCampaign: {
    update: vi.fn(),
  },
  emailCampaignAnalytics: {
    upsert: vi.fn(),
  },
}));

const mockJobQueue = vi.hoisted(() => ({
  getStats: vi.fn(),
  processPending: vi.fn(),
  cleanup: vi.fn(),
  enqueue: vi.fn(),
}));

const mockProcessEmailWorkspaceJobs = vi.hoisted(() => vi.fn());

vi.mock("@/lib/utils/public-rate-limit", () => mockRateLimits);
vi.mock("@/lib/auth/supabase-server", () => ({
  createClient: mockCreateClient,
}));
vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: mockHasPermission,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: mockStorageFrom,
    },
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));
vi.mock("@/lib/utils/job-queue", () => ({
  jobQueue: mockJobQueue,
}));
vi.mock("@/lib/jobs/email-workspace", () => ({
  processEmailWorkspaceJobs: mockProcessEmailWorkspaceJobs,
}));

import { POST as uploadPOST } from "@/app/api/documents/upload/route";
import { POST as webhookPOST } from "@/app/api/email-campaigns/webhook/route";
import { GET as cronGET, POST as cronPOST } from "@/app/api/cron/jobs/route";

function jsonRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function formRequest(url: string, formData: FormData, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers,
    body: formData,
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  delete process.env.BREVO_WEBHOOK_TOKEN;
  delete process.env.BREVO_WEBHOOK_SECRET;
  delete process.env.BREVO_WEBHOOK_SIGNATURE_SECRET;
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("document upload security", () => {
  it("rejects anonymous uploads", async () => {
    mockRateLimits.documentUploadRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(),
    });
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });

    const formData = new FormData();
    formData.append("file", new File(["pdf"], "test.pdf", { type: "application/pdf" }));
    formData.append("venueId", "cltestvenueavenueaaaa");
    formData.append("type", "template");

    const response = await uploadPOST(
      formRequest("http://localhost/api/documents/upload", formData) as never
    );

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ success: false, error: "Unauthorized" });
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it("rejects uploads when the user lacks venue document access", async () => {
    mockRateLimits.documentUploadRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(),
    });
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "cltest001user1aaaa", email: "user1@example.com" } },
          error: null,
        }),
      },
    });
    mockHasPermission.mockResolvedValue(false);

    const formData = new FormData();
    formData.append("file", new File(["pdf"], "test.pdf", { type: "application/pdf" }));
    formData.append("venueId", "cltestvenueavenueaaaa");
    formData.append("type", "template");

    const response = await uploadPOST(
      formRequest("http://localhost/api/documents/upload", formData) as never
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toMatchObject({ success: false, error: "Forbidden" });
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("applies baseline upload rate limiting", async () => {
    mockRateLimits.documentUploadRateLimiter.check.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
      retryAfter: 30,
      reason: "Rate limit exceeded. Please try again later.",
    });

    const response = await uploadPOST(
      formRequest("http://localhost/api/documents/upload", new FormData()) as never
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Rate limit exceeded. Please try again later.",
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("allows an authorized upload to reach storage", async () => {
    mockRateLimits.documentUploadRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(),
    });
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "cltest001user1aaaa", email: "user1@example.com" } },
          error: null,
        }),
      },
    });
    mockHasPermission.mockResolvedValue(true);
    mockStorageUpload.mockResolvedValue({
      data: { path: "documents/cltestvenueavenueaaaa/template/new/123_test.pdf" },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/test.pdf" },
    });

    const formData = new FormData();
    formData.append("file", new File(["pdf"], "test.pdf", { type: "application/pdf" }));
    formData.append("venueId", "cltestvenueavenueaaaa");
    formData.append("type", "template");

    const response = await uploadPOST(
      formRequest("http://localhost/api/documents/upload", formData) as never
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      success: true,
      method: "supabase",
      url: "https://example.com/test.pdf",
    });
    expect(mockStorageUpload).toHaveBeenCalled();
  });
});

describe("email webhook security", () => {
  it("fails closed in production when webhook auth is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockRateLimits.emailWebhookRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 119,
      resetAt: new Date(),
    });

    const response = await webhookPOST(
      jsonRequest("http://localhost/api/email-campaigns/webhook", {
        event: "opened",
        email: "recipient@example.com",
        "message-id": "msg-1",
      }) as never
    );

    expect(response.status).toBe(503);
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Webhook verification is not configured",
    });
    expect(mockPrisma.emailWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("rejects webhook requests with the wrong bearer token", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BREVO_WEBHOOK_TOKEN", "expected-token");
    mockRateLimits.emailWebhookRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 119,
      resetAt: new Date(),
    });

    const response = await webhookPOST(
      jsonRequest(
        "http://localhost/api/email-campaigns/webhook",
        {
          event: "opened",
          email: "recipient@example.com",
          "message-id": "msg-1",
        },
        {
          authorization: "Bearer wrong-token",
        }
      ) as never
    );

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Invalid webhook authorization token",
    });
    expect(mockPrisma.emailWebhookEvent.create).not.toHaveBeenCalled();
  });

  it("accepts a webhook request when the bearer token matches", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BREVO_WEBHOOK_TOKEN", "expected-token");
    mockRateLimits.emailWebhookRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 119,
      resetAt: new Date(),
    });
    mockPrisma.emailWebhookEvent.create.mockResolvedValue({ id: "evt-1" });
    mockPrisma.emailWebhookEvent.updateMany.mockResolvedValue({ count: 1 });

    const response = await webhookPOST(
      jsonRequest(
        "http://localhost/api/email-campaigns/webhook",
        {
          event: "opened",
          email: "recipient@example.com",
          "message-id": "msg-1",
        },
        {
          authorization: "Bearer expected-token",
        }
      ) as never
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({ success: true, status: "ok" });
    expect(mockPrisma.emailWebhookEvent.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.emailWebhookEvent.updateMany).toHaveBeenCalledTimes(1);
  });

  it("applies baseline webhook rate limiting", async () => {
    mockRateLimits.emailWebhookRateLimiter.check.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 45_000),
      retryAfter: 45,
      reason: "Rate limit exceeded. Please try again later.",
    });

    const response = await webhookPOST(
      jsonRequest("http://localhost/api/email-campaigns/webhook", {
        event: "opened",
        email: "recipient@example.com",
        "message-id": "msg-1",
      }) as never
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(await readJson(response)).toMatchObject({
      success: false,
      error: "Rate limit exceeded. Please try again later.",
    });
  });
});

describe("cron job route security", () => {
  it("rejects cron requests without the shared secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    const response = await cronGET(
      new Request("http://localhost/api/cron/jobs", { method: "GET" }) as never
    );

    expect(response.status).toBe(401);
    expect(await readJson(response)).toMatchObject({ success: false, error: "Unauthorized" });
  });

  it("rejects cron enqueue requests when rate limited", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mockRateLimits.cronJobsRateLimiter.check.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 60,
      reason: "Rate limit exceeded. Please try again later.",
    });

    const response = await cronPOST(
      jsonRequest(
        "http://localhost/api/cron/jobs",
        {
          type: "email-workspace",
          payload: { test: true },
        },
        {
          authorization: "Bearer cron-secret",
        }
      ) as never
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await readJson(response)).toEqual({
      success: false,
      error: "Rate limit exceeded. Please try again later.",
    });
    expect(mockJobQueue.enqueue).not.toHaveBeenCalled();
  });

  it("enqueues cron jobs when authorized", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mockRateLimits.cronJobsRateLimiter.check.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date(),
    });
    mockJobQueue.enqueue.mockResolvedValue("job-123");

    const response = await cronPOST(
      jsonRequest(
        "http://localhost/api/cron/jobs",
        {
          type: "email-workspace",
          payload: { test: true },
          delay: 0,
          maxAttempts: 3,
        },
        {
          authorization: "Bearer cron-secret",
        }
      ) as never
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      success: true,
      jobId: "job-123",
      message: "Job job-123 enqueued",
    });
    expect(mockJobQueue.enqueue).toHaveBeenCalledWith(
      "email-workspace",
      { test: true },
      { delay: 0, maxAttempts: 3 }
    );
  });
});
