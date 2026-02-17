"use client";

import { Badge } from "@/components/ui/badge";
import { RosterStatus } from "@prisma/client";
import { FileEdit, Clock, CheckCircle, Send, Archive } from "lucide-react";

interface RosterStatusBadgeProps {
  status: RosterStatus;
  size?: "sm" | "default";
}

const statusConfig: Record<RosterStatus, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ElementType;
  className: string;
}> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    icon: FileEdit,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    variant: "outline",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300",
  },
  APPROVED: {
    label: "Finalized",
    variant: "outline",
    icon: CheckCircle,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300",
  },
  PUBLISHED: {
    label: "Published",
    variant: "default",
    icon: Send,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  ARCHIVED: {
    label: "Archived",
    variant: "outline",
    icon: Archive,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

export function RosterStatusBadge({ status, size = "default" }: RosterStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
    >
      <Icon className={`${size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} mr-1`} />
      {config.label}
    </Badge>
  );
}
