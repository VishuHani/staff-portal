"use client";

import dynamic from "next/dynamic";

export const CampaignDetailClient = dynamic(
  () => import("./campaign-detail-view").then((mod) => mod.CampaignDetailClient),
  {
    loading: () => (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Loading campaign details...
      </div>
    ),
  }
);
