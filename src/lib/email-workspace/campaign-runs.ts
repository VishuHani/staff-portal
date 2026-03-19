import { Prisma } from "@prisma/client";
import { createHash } from "crypto";

export function buildCampaignRunIdempotencyKey(input: {
  campaignId: string;
  scheduledFor: Date;
  triggerSource: "MANUAL" | "SCHEDULED";
}): string {
  const seed = `${input.campaignId}:${input.scheduledFor.toISOString()}:${input.triggerSource}`;
  const digest = createHash("sha256").update(seed).digest("hex").slice(0, 40);
  return `cmp_run_${digest}`;
}

export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function isCampaignRunSchemaMissingError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const meta = error.meta as { code?: string; message?: string } | undefined;
      if (meta?.code === "42P01" || meta?.code === "42703") {
        return true;
      }

      if (typeof meta?.message === "string") {
        const message = meta.message.toLowerCase();
        if (message.includes("email_campaign_runs")) {
          return true;
        }
      }
    }
  }

  const text = String(error).toLowerCase();
  return text.includes("email_campaign_runs");
}
