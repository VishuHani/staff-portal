"use client";

import dynamic from "next/dynamic";

export const MyShiftsClient = dynamic(
  () => import("./my-shifts-view").then((mod) => mod.MyShiftsClient),
  {
    loading: () => (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        Loading shifts...
      </div>
    ),
  }
);
