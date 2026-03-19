import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cache backend guardrails", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when the cache backend is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(import("@/lib/utils/cache")).rejects.toThrow(
      "Production cache backend is not configured"
    );
  });

  it("loads in development without redis config", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    const cacheModule = await import("@/lib/utils/cache");

    expect(cacheModule.cache).toBeDefined();
    expect(cacheModule.cacheKeys).toBeDefined();
  });
});
