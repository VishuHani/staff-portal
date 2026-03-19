import { describe, expect, it } from "vitest";
import {
  buildCampaignRunIdempotencyKey,
  isCampaignRunSchemaMissingError,
} from "@/lib/email-workspace/campaign-runs";

describe("Campaign Run Helpers", () => {
  it("builds deterministic idempotency keys for same inputs", () => {
    const scheduledFor = new Date("2026-03-19T10:00:00.000Z");
    const first = buildCampaignRunIdempotencyKey({
      campaignId: "cmp_1",
      scheduledFor,
      triggerSource: "SCHEDULED",
    });
    const second = buildCampaignRunIdempotencyKey({
      campaignId: "cmp_1",
      scheduledFor,
      triggerSource: "SCHEDULED",
    });

    expect(first).toBe(second);
    expect(first.startsWith("cmp_run_")).toBe(true);
  });

  it("builds different keys for different run slots", () => {
    const first = buildCampaignRunIdempotencyKey({
      campaignId: "cmp_1",
      scheduledFor: new Date("2026-03-19T10:00:00.000Z"),
      triggerSource: "SCHEDULED",
    });
    const second = buildCampaignRunIdempotencyKey({
      campaignId: "cmp_1",
      scheduledFor: new Date("2026-03-19T10:05:00.000Z"),
      triggerSource: "SCHEDULED",
    });

    expect(first).not.toBe(second);
  });

  it("detects schema-missing errors from generic text fallback", () => {
    expect(isCampaignRunSchemaMissingError("relation \"email_campaign_runs\" does not exist")).toBe(
      true
    );
    expect(isCampaignRunSchemaMissingError("some other database error")).toBe(false);
  });
});
