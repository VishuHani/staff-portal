"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  ChartSpline,
  ChevronDown,
  ChevronUp,
  Download,
  FileJson,
  History,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FolderManagerClient } from "@/components/email-workspace/folder-manager-client";
import {
  createReportDefinition,
  deleteReportDefinition,
  listReportDefinitions,
  listReportRuns,
  pauseReportDefinitionSchedule,
  resumeReportDefinitionSchedule,
  runReportDefinition,
  updateReportDefinition,
  type EmailReportDeliveryConfig,
  type EmailReportDefinitionSummary,
  type EmailReportRunDetails,
} from "@/lib/actions/email-workspace/report-definitions";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import {
  getNextRunAt,
  validateRecurrenceRule,
  type EmailRecurrenceRule,
} from "@/lib/email-workspace/recurrence";

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const runStatusColors: Record<
  EmailReportRunDetails["status"],
  string
> = {
  PENDING: "bg-slate-100 text-slate-700",
  RUNNING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-amber-100 text-amber-800",
};

type DeliveryHealthStatus = "HEALTHY" | "DEGRADED" | "FAILING";

const deliveryHealthColors: Record<DeliveryHealthStatus, string> = {
  HEALTHY: "bg-green-100 text-green-800",
  DEGRADED: "bg-amber-100 text-amber-800",
  FAILING: "bg-red-100 text-red-800",
};

function flattenFolderOptions(
  nodes: EmailFolderNode[],
  depth: number = 0
): Array<{ id: string; label: string }> {
  const rows: Array<{ id: string; label: string }> = [];

  for (const node of nodes) {
    rows.push({
      id: node.id,
      label: `${"-- ".repeat(depth)}${node.name}`,
    });
    rows.push(...flattenFolderOptions(node.children, depth + 1));
  }

  return rows;
}

function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function parseMonthDaysInput(value: string): number[] {
  const parts = value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part >= 1 && part <= 31);

  return [...new Set(parts)].sort((a, b) => a - b);
}

function toggleNumberInArray(values: number[], value: number): number[] {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  return [...values, value].sort((a, b) => a - b);
}

function stringifyCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function escapeCsvValue(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function resultJsonToCsv(resultJson: unknown): string | null {
  if (!isRecord(resultJson)) {
    return null;
  }

  const rows: Array<[string, string]> = [["field", "value"]];
  for (const [key, value] of Object.entries(resultJson)) {
    if (isRecord(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        rows.push([`${key}.${nestedKey}`, stringifyCsvValue(nestedValue)]);
      }
      continue;
    }
    rows.push([key, stringifyCsvValue(value)]);
  }

  return rows.map(([field, value]) => `${escapeCsvValue(field)},${escapeCsvValue(value)}`).join("\n");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function downloadTextFile(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function describeRecurrence(rule: EmailRecurrenceRule | null): string {
  if (!rule) {
    return "Scheduled";
  }

  const interval = Math.max(1, rule.interval || 1);
  let cadence = "";

  if (rule.frequency === "DAILY") {
    cadence = interval === 1 ? "Daily" : `Every ${interval} days`;
  } else if (rule.frequency === "WEEKLY") {
    cadence = interval === 1 ? "Weekly" : `Every ${interval} weeks`;
  } else {
    cadence = interval === 1 ? "Monthly" : `Every ${interval} months`;
  }

  return `${cadence} at ${rule.time} (${rule.timezone})`;
}

function describeDeliveryConfig(config: EmailReportDeliveryConfig | null): string {
  if (!config) {
    return "No delivery destination";
  }

  if (config.channel === "EMAIL") {
    return `Email: ${config.destination}`;
  }

  return `Webhook: ${config.destination}`;
}

function parseRunDeliveryConfig(value: unknown): EmailReportDeliveryConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const channel = (value as { channel?: unknown }).channel;
  const destination = (value as { destination?: unknown }).destination;

  if ((channel !== "EMAIL" && channel !== "WEBHOOK") || typeof destination !== "string") {
    return null;
  }

  const trimmedDestination = destination.trim();
  if (!trimmedDestination) {
    return null;
  }

  return {
    channel,
    destination: trimmedDestination,
  };
}

function parseRunDeliveryDispatch(value: unknown): {
  attempted: boolean;
  delivered: boolean;
  attemptedAt: string | null;
  error: string | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const dispatch = (value as { dispatch?: unknown }).dispatch;
  if (!dispatch || typeof dispatch !== "object" || Array.isArray(dispatch)) {
    return null;
  }

  const attempted = (dispatch as { attempted?: unknown }).attempted;
  const delivered = (dispatch as { delivered?: unknown }).delivered;
  const attemptedAt = (dispatch as { attemptedAt?: unknown }).attemptedAt;
  const error = (dispatch as { error?: unknown }).error;

  if (typeof attempted !== "boolean" || typeof delivered !== "boolean") {
    return null;
  }

  return {
    attempted,
    delivered,
    attemptedAt: typeof attemptedAt === "string" ? attemptedAt : null,
    error: typeof error === "string" && error.trim() ? error : null,
  };
}

function resolveRecurrenceDefaults(rule: EmailRecurrenceRule | null): {
  frequency: EmailRecurrenceRule["frequency"];
  timezone: string;
  timeOfDay: string;
  interval: string;
  weekdays: number[];
  monthDays: string;
  startDate: string;
  endDate: string;
} {
  return {
    frequency: rule?.frequency || "WEEKLY",
    timezone: rule?.timezone || getDefaultTimezone(),
    timeOfDay: rule?.time || "09:00",
    interval: String(Math.max(1, rule?.interval || 1)),
    weekdays: rule?.weekdays && rule.weekdays.length > 0 ? rule.weekdays : [1],
    monthDays:
      rule?.monthDays && rule.monthDays.length > 0 ? rule.monthDays.join(",") : "1",
    startDate: rule?.startDate || "",
    endDate: rule?.endDate || "",
  };
}

export function ReportsWorkbenchClient() {
  const [isCreating, startCreate] = useTransition();
  const [definitions, setDefinitions] = useState<EmailReportDefinitionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [runsLoadingId, setRunsLoadingId] = useState<string | null>(null);
  const [scheduleActionId, setScheduleActionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runHistoryByDefinition, setRunHistoryByDefinition] = useState<
    Record<string, EmailReportRunDetails[]>
  >({});
  const [expandedRunHistory, setExpandedRunHistory] = useState<Record<string, boolean>>({});
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reportType, setReportType] = useState("campaign_performance");
  const [scope, setScope] = useState<"PRIVATE" | "TEAM" | "SYSTEM">("PRIVATE");
  const [windowDays, setWindowDays] = useState("30");
  const [folderId, setFolderId] = useState("none");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [deliveryChannel, setDeliveryChannel] = useState<"NONE" | "EMAIL" | "WEBHOOK">("NONE");
  const [deliveryDestination, setDeliveryDestination] = useState("");

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [frequency, setFrequency] = useState<EmailRecurrenceRule["frequency"]>("WEEKLY");
  const [timezone, setTimezone] = useState(getDefaultTimezone());
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [interval, setInterval] = useState("1");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [monthDays, setMonthDays] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [editFrequency, setEditFrequency] =
    useState<EmailRecurrenceRule["frequency"]>("WEEKLY");
  const [editTimezone, setEditTimezone] = useState(getDefaultTimezone());
  const [editTimeOfDay, setEditTimeOfDay] = useState("09:00");
  const [editInterval, setEditInterval] = useState("1");
  const [editWeekdays, setEditWeekdays] = useState<number[]>([1]);
  const [editMonthDays, setEditMonthDays] = useState("1");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const timezoneOptions = useMemo(
    () =>
      Array.from(
        new Set([
          getDefaultTimezone(),
          "UTC",
          "America/New_York",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "Europe/London",
          "Asia/Singapore",
          "Australia/Sydney",
        ])
      ),
    []
  );

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await listReportDefinitions({
        search: search.trim() || undefined,
        folderId: folderFilter === "all" ? undefined : folderFilter,
        reportType: typeFilter === "all" ? undefined : typeFilter,
      });

      if (!response.success || !response.definitions) {
        const message = response.error || "Failed to load report definitions.";
        setLoadError(message);
        setDefinitions([]);
        return;
      }

      setDefinitions(response.definitions);
    } catch (error) {
      console.error("Error loading report definitions:", error);
      setLoadError("Failed to load report definitions.");
      setDefinitions([]);
    } finally {
      setLoading(false);
    }
  }, [folderFilter, search, typeFilter]);

  useEffect(() => {
    void loadFolders();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadDefinitions();
    }, 200);
    return () => clearTimeout(timeout);
  }, [loadDefinitions]);

  const resolveRecurrenceRule = useCallback(() => {
    if (!scheduleEnabled) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
      };
    }

    const parsedInterval = Number(interval);
    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
        error: "Interval must be a positive integer.",
      };
    }

    const rule: EmailRecurrenceRule = {
      frequency,
      timezone: timezone.trim(),
      time: timeOfDay.trim(),
      interval: parsedInterval,
    };

    if (frequency === "WEEKLY") {
      if (weekdays.length === 0) {
        return {
          rule: null as EmailRecurrenceRule | null,
          nextRunAt: null as Date | null,
          error: "Select at least one weekday for weekly schedules.",
        };
      }
      rule.weekdays = weekdays;
    }

    if (frequency === "MONTHLY") {
      const parsedMonthDays = parseMonthDaysInput(monthDays);
      if (parsedMonthDays.length === 0) {
        return {
          rule: null as EmailRecurrenceRule | null,
          nextRunAt: null as Date | null,
          error: "Provide one or more valid month days (1-31).",
        };
      }
      rule.monthDays = parsedMonthDays;
    }

    if (startDate) {
      rule.startDate = startDate;
    }
    if (endDate) {
      rule.endDate = endDate;
    }

    const validation = validateRecurrenceRule(rule);
    if (!validation.valid) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
        error: validation.errors[0] || "Invalid recurrence settings.",
      };
    }

    const nextRunAt = getNextRunAt(rule, new Date());
    if (!nextRunAt) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
        error: "Unable to calculate the next run from current recurrence settings.",
      };
    }

    return {
      rule,
      nextRunAt,
    };
  }, [scheduleEnabled, interval, frequency, timezone, timeOfDay, weekdays, monthDays, startDate, endDate]);

  const schedulePreview = useMemo(() => {
    if (!scheduleEnabled) {
      return null;
    }

    const resolved = resolveRecurrenceRule();
    if (resolved.error) {
      return {
        isError: true,
        message: resolved.error,
      };
    }

    return {
      isError: false,
      message: resolved.nextRunAt
        ? `Next run: ${resolved.nextRunAt.toLocaleString()}`
        : "No upcoming run from current settings.",
    };
  }, [scheduleEnabled, resolveRecurrenceRule]);

  const resolveEditedRecurrenceRule = useCallback(() => {
    const parsedInterval = Number(editInterval);
    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
        error: "Interval must be a positive integer.",
      };
    }

    const rule: EmailRecurrenceRule = {
      frequency: editFrequency,
      timezone: editTimezone.trim(),
      time: editTimeOfDay.trim(),
      interval: parsedInterval,
    };

    if (editFrequency === "WEEKLY") {
      if (editWeekdays.length === 0) {
        return {
          rule: null as EmailRecurrenceRule | null,
          nextRunAt: null as Date | null,
          error: "Select at least one weekday for weekly schedules.",
        };
      }
      rule.weekdays = editWeekdays;
    }

    if (editFrequency === "MONTHLY") {
      const parsedMonthDays = parseMonthDaysInput(editMonthDays);
      if (parsedMonthDays.length === 0) {
        return {
          rule: null as EmailRecurrenceRule | null,
          nextRunAt: null as Date | null,
          error: "Provide one or more valid month days (1-31).",
        };
      }
      rule.monthDays = parsedMonthDays;
    }

    if (editStartDate) {
      rule.startDate = editStartDate;
    }
    if (editEndDate) {
      rule.endDate = editEndDate;
    }

    const validation = validateRecurrenceRule(rule);
    if (!validation.valid) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
        error: validation.errors[0] || "Invalid recurrence settings.",
      };
    }

    const nextRunAt = getNextRunAt(rule, new Date());
    if (!nextRunAt) {
      return {
        rule: null as EmailRecurrenceRule | null,
        nextRunAt: null as Date | null,
        error: "Unable to calculate the next run from current recurrence settings.",
      };
    }

    return {
      rule,
      nextRunAt,
    };
  }, [
    editInterval,
    editFrequency,
    editTimezone,
    editTimeOfDay,
    editWeekdays,
    editMonthDays,
    editStartDate,
    editEndDate,
  ]);

  const editSchedulePreview = useMemo(() => {
    if (!editingScheduleId) {
      return null;
    }

    const resolved = resolveEditedRecurrenceRule();
    if (resolved.error) {
      return {
        isError: true,
        message: resolved.error,
      };
    }

    return {
      isError: false,
      message: resolved.nextRunAt
        ? `Next run: ${resolved.nextRunAt.toLocaleString()}`
        : "No upcoming run from current settings.",
    };
  }, [editingScheduleId, resolveEditedRecurrenceRule]);

  async function loadFolders() {
    try {
      const response = await listFolderTree({ module: "reports" });
      if (!response.success || !response.tree) {
        return;
      }
      setFolderOptions(flattenFolderOptions(response.tree));
    } catch (error) {
      console.error("Error loading report folders:", error);
    }
  }

  async function loadRunHistory(reportDefinitionId: string) {
    setRunsLoadingId(reportDefinitionId);
    try {
      const response = await listReportRuns({ reportDefinitionId, take: 10 });
      if (!response.success || !response.runs) {
        toast.error(response.error || "Failed to load run history.");
        return;
      }

      setRunHistoryByDefinition((prev) => ({
        ...prev,
        [reportDefinitionId]: response.runs || [],
      }));
    } catch (error) {
      console.error("Error loading run history:", error);
      toast.error("Failed to load run history.");
    } finally {
      setRunsLoadingId(null);
    }
  }

  async function toggleRunHistory(definitionId: string) {
    const currentlyOpen = expandedRunHistory[definitionId] === true;
    const shouldOpen = !currentlyOpen;

    setExpandedRunHistory((prev) => ({
      ...prev,
      [definitionId]: shouldOpen,
    }));

    if (shouldOpen) {
      await loadRunHistory(definitionId);
    }
  }

  function toggleScheduleEditor(definition: EmailReportDefinitionSummary) {
    if (editingScheduleId === definition.id) {
      setEditingScheduleId(null);
      return;
    }

    const defaults = resolveRecurrenceDefaults(definition.recurrenceRuleJson);
    setEditFrequency(defaults.frequency);
    setEditTimezone(defaults.timezone);
    setEditTimeOfDay(defaults.timeOfDay);
    setEditInterval(defaults.interval);
    setEditWeekdays(defaults.weekdays);
    setEditMonthDays(defaults.monthDays);
    setEditStartDate(defaults.startDate);
    setEditEndDate(defaults.endDate);
    setEditingScheduleId(definition.id);
  }

  function resetCreateForm() {
    setName("");
    setDescription("");
    setReportType("campaign_performance");
    setScope("PRIVATE");
    setWindowDays("30");
    setFolderId("none");
    setDeliveryChannel("NONE");
    setDeliveryDestination("");
    setScheduleEnabled(false);
    setFrequency("WEEKLY");
    setTimezone(getDefaultTimezone());
    setTimeOfDay("09:00");
    setInterval("1");
    setWeekdays([1]);
    setMonthDays("1");
    setStartDate("");
    setEndDate("");
  }

  function handleCreateDefinition() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Report definition name is required.");
      return;
    }

    const parsedWindowDays = Number(windowDays);
    if (!Number.isFinite(parsedWindowDays) || parsedWindowDays < 1) {
      toast.error("Window days must be a positive number.");
      return;
    }

    if (deliveryChannel !== "NONE" && !deliveryDestination.trim()) {
      toast.error("Provide a delivery destination for the selected channel.");
      return;
    }

    const recurrence = resolveRecurrenceRule();
    if (scheduleEnabled && (!recurrence.rule || !recurrence.nextRunAt)) {
      toast.error(recurrence.error || "Invalid recurrence settings.");
      return;
    }

    startCreate(async () => {
      const response = await createReportDefinition({
        name: trimmedName,
        description: description.trim() || undefined,
        reportType,
        scope,
        folderId: folderId === "none" ? undefined : folderId,
        configJson: {
          windowDays: Math.floor(parsedWindowDays),
          metrics: ["recipients", "delivered", "opened", "clicked", "bounced", "unsubscribed"],
          delivery:
            deliveryChannel === "NONE"
              ? undefined
              : {
                  channel: deliveryChannel,
                  destination: deliveryDestination.trim(),
                },
        },
        isScheduled: scheduleEnabled,
        recurrenceRuleJson: scheduleEnabled ? recurrence.rule : null,
        nextRunAt: scheduleEnabled ? recurrence.nextRunAt : null,
      });

      if (!response.success || !response.definition) {
        toast.error(response.error || "Failed to create report definition.");
        return;
      }

      toast.success("Report definition created.");
      resetCreateForm();
      await loadDefinitions();
    });
  }

  async function handleRunDefinition(id: string) {
    setRunningId(id);
    try {
      const response = await runReportDefinition({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to run report definition.");
        return;
      }

      toast.success("Report run completed.");
      await Promise.all([
        loadDefinitions(),
        expandedRunHistory[id] ? loadRunHistory(id) : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Error running report definition:", error);
      toast.error("Failed to run report definition.");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDeleteDefinition(id: string) {
    setDeletingId(id);
    try {
      const response = await deleteReportDefinition({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to delete report definition.");
        return;
      }

      toast.success("Report definition deleted.");
      setRunHistoryByDefinition((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setExpandedRunHistory((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadDefinitions();
    } catch (error) {
      console.error("Error deleting report definition:", error);
      toast.error("Failed to delete report definition.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePauseSchedule(id: string) {
    setScheduleActionId(id);
    try {
      const response = await pauseReportDefinitionSchedule({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to pause report schedule.");
        return;
      }

      toast.success("Report schedule paused.");
      if (editingScheduleId === id) {
        setEditingScheduleId(null);
      }
      await loadDefinitions();
    } catch (error) {
      console.error("Error pausing report schedule:", error);
      toast.error("Failed to pause report schedule.");
    } finally {
      setScheduleActionId(null);
    }
  }

  async function handleResumeSchedule(id: string) {
    setScheduleActionId(id);
    try {
      const response = await resumeReportDefinitionSchedule({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to resume report schedule.");
        return;
      }

      toast.success("Report schedule resumed.");
      await loadDefinitions();
    } catch (error) {
      console.error("Error resuming report schedule:", error);
      toast.error("Failed to resume report schedule.");
    } finally {
      setScheduleActionId(null);
    }
  }

  async function handleSaveSchedule(id: string) {
    const resolved = resolveEditedRecurrenceRule();
    if (!resolved.rule || !resolved.nextRunAt) {
      toast.error(resolved.error || "Invalid recurrence settings.");
      return;
    }

    setScheduleActionId(id);
    try {
      const response = await updateReportDefinition({
        id,
        isScheduled: true,
        recurrenceRuleJson: resolved.rule,
        nextRunAt: resolved.nextRunAt,
      });

      if (!response.success) {
        toast.error(response.error || "Failed to update report schedule.");
        return;
      }

      toast.success("Report schedule updated.");
      setEditingScheduleId(null);
      await loadDefinitions();
    } catch (error) {
      console.error("Error updating report schedule:", error);
      toast.error("Failed to update report schedule.");
    } finally {
      setScheduleActionId(null);
    }
  }

  function handleExportRun(
    definition: EmailReportDefinitionSummary,
    run: EmailReportRunDetails,
    format: "csv" | "json"
  ) {
    if (!run.resultJson) {
      toast.error("This run has no result payload to export.");
      return;
    }

    const fileBase = `${slugify(definition.name || "email-report")}-${run.id}`;

    if (format === "json") {
      downloadTextFile(
        `${fileBase}.json`,
        JSON.stringify(run.resultJson, null, 2),
        "application/json;charset=utf-8;"
      );
      return;
    }

    const csv = resultJsonToCsv(run.resultJson);
    if (!csv) {
      toast.error("Run payload is not exportable to CSV.");
      return;
    }

    downloadTextFile(`${fileBase}.csv`, csv, "text/csv;charset=utf-8;");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartSpline className="h-4 w-4" />
              Custom Metrics
            </CardTitle>
            <CardDescription>
              Configure reusable report definitions over campaign delivery and engagement metrics.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Recurring Runs
            </CardTitle>
            <CardDescription>
              Scheduled report definitions are executed by the cron worker and recorded in run history.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <FolderManagerClient
        module="reports"
        title="Report Folders"
        description="Organize report definitions and scheduled report jobs with nested folders."
        createPlaceholder="New report folder"
        emptyMessage="No report folders yet. Create your first report folder."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create Report Definition</CardTitle>
          <CardDescription>
            Save report definitions by type, scope, folder, and optional recurring schedule.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="report-definition-name">Definition name</Label>
            <Input
              id="report-definition-name"
              placeholder="Definition name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-window-days">Window days</Label>
            <Input
              id="report-window-days"
              value={windowDays}
              onChange={(event) => setWindowDays(event.target.value)}
              placeholder="30"
            />
          </div>

          <div className="space-y-2">
            <Label>Report type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign_performance">Campaign Performance</SelectItem>
                <SelectItem value="delivery_health">Delivery Health</SelectItem>
                <SelectItem value="audience_engagement">Audience Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(value: "PRIVATE" | "TEAM" | "SYSTEM") => setScope(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIVATE">Private</SelectItem>
                <SelectItem value="TEAM">Team</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder (root)</SelectItem>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="report-description">Description</Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Description (optional)"
            />
          </div>

          <div className="rounded-md border p-4 lg:col-span-3 space-y-3">
            <p className="text-sm font-medium">Delivery Destination (Optional)</p>
            <p className="text-xs text-muted-foreground">
              Persist delivery metadata for runs. Dispatch integrations are still pending.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={deliveryChannel}
                  onValueChange={(value: "NONE" | "EMAIL" | "WEBHOOK") => setDeliveryChannel(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="WEBHOOK">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="report-delivery-destination">Destination</Label>
                <Input
                  id="report-delivery-destination"
                  value={deliveryDestination}
                  onChange={(event) => setDeliveryDestination(event.target.value)}
                  placeholder={
                    deliveryChannel === "WEBHOOK"
                      ? "https://example.com/webhook"
                      : "ops@example.com, team@example.com"
                  }
                  disabled={deliveryChannel === "NONE"}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border p-4 lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="schedule-enabled"
                checked={scheduleEnabled}
                onCheckedChange={(value) => setScheduleEnabled(value === true)}
              />
              <Label htmlFor="schedule-enabled" className="cursor-pointer">
                Schedule recurring runs
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Enabled schedules are processed by `/api/cron/jobs` based on the recurrence rule.
            </p>

            {scheduleEnabled && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={frequency}
                    onValueChange={(value: EmailRecurrenceRule["frequency"]) => setFrequency(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((timezoneValue) => (
                        <SelectItem key={timezoneValue} value={timezoneValue}>
                          {timezoneValue}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-time">Time (24h)</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={timeOfDay}
                    onChange={(event) => setTimeOfDay(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-interval">Interval</Label>
                  <Input
                    id="schedule-interval"
                    value={interval}
                    onChange={(event) => setInterval(event.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-start-date">Start date (optional)</Label>
                  <Input
                    id="schedule-start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule-end-date">End date (optional)</Label>
                  <Input
                    id="schedule-end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>

                {frequency === "WEEKLY" && (
                  <div className="space-y-2 md:col-span-3">
                    <Label>Weekdays</Label>
                    <div className="flex flex-wrap gap-3">
                      {WEEKDAY_OPTIONS.map((day) => (
                        <label key={day.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={weekdays.includes(day.value)}
                            onCheckedChange={() =>
                              setWeekdays((prev) => toggleNumberInArray(prev, day.value))
                            }
                          />
                          <span>{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {frequency === "MONTHLY" && (
                  <div className="space-y-2 md:col-span-3">
                    <Label htmlFor="schedule-month-days">Month days</Label>
                    <Input
                      id="schedule-month-days"
                      value={monthDays}
                      onChange={(event) => setMonthDays(event.target.value)}
                      placeholder="1,15,28"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated values between 1 and 31.
                    </p>
                  </div>
                )}

                {schedulePreview && (
                  <p
                    className={`text-xs md:col-span-3 ${
                      schedulePreview.isError ? "text-red-600" : "text-muted-foreground"
                    }`}
                  >
                    {schedulePreview.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 flex justify-end">
            <Button onClick={handleCreateDefinition} disabled={isCreating}>
              {isCreating ? "Saving..." : "Save Report Definition"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Report Definitions</CardTitle>
          <CardDescription>
            Run, inspect history, export run results, and filter definitions by folder/type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search definitions"
              className="md:col-span-2"
            />
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All folders</SelectItem>
                <SelectItem value="none">No folder</SelectItem>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="campaign_performance">Campaign Performance</SelectItem>
                <SelectItem value="delivery_health">Delivery Health</SelectItem>
                <SelectItem value="audience_engagement">Audience Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadError && <p className="text-sm text-red-600">{loadError}</p>}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading report definitions...</p>
          ) : definitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No report definitions found.</p>
          ) : (
            <div className="space-y-3">
              {definitions.map((definition) => {
                const isHistoryExpanded = expandedRunHistory[definition.id] === true;
                const runHistory = runHistoryByDefinition[definition.id] || [];
                return (
                  <div key={definition.id} className="rounded-md border p-3 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{definition.name}</p>
                        {definition.description && (
                          <p className="text-sm text-muted-foreground">{definition.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{definition.reportType}</Badge>
                          <Badge variant="outline">{definition.scope}</Badge>
                          <Badge variant="outline">Runs: {definition.runCount}</Badge>
                          {definition.isScheduled ? (
                            <>
                              <Badge variant="outline">Scheduled</Badge>
                              <Badge variant="secondary">
                                {describeRecurrence(definition.recurrenceRuleJson)}
                              </Badge>
                            </>
                          ) : (
                            <Badge variant="secondary">Manual runs</Badge>
                          )}
                          {definition.nextRunAt && (
                            <Badge variant="outline">
                              Next: {new Date(definition.nextRunAt).toLocaleString()}
                            </Badge>
                          )}
                          {definition.deliveryConfigJson && (
                            <Badge variant="secondary">
                              {describeDeliveryConfig(definition.deliveryConfigJson)}
                            </Badge>
                          )}
                          {definition.deliveryHealth && (
                            <Badge
                              className={deliveryHealthColors[definition.deliveryHealth.status]}
                              variant="outline"
                            >
                              Delivery {definition.deliveryHealth.status}
                            </Badge>
                          )}
                        </div>
                        {definition.deliveryHealth && (
                          <p className="text-xs text-muted-foreground">
                            Delivery success:{" "}
                            {(definition.deliveryHealth.successRate * 100).toFixed(0)}% (
                            {definition.deliveryHealth.successfulAttempts}/
                            {definition.deliveryHealth.totalAttempts})
                            {definition.deliveryHealth.consecutiveFailures > 0
                              ? `, consecutive failures: ${definition.deliveryHealth.consecutiveFailures}`
                              : ""}
                            {definition.deliveryHealth.lastError
                              ? `, last error: ${definition.deliveryHealth.lastError}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRunDefinition(definition.id)}
                          disabled={runningId === definition.id}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          {runningId === definition.id ? "Running..." : "Run"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleScheduleEditor(definition)}
                          disabled={scheduleActionId === definition.id}
                        >
                          {editingScheduleId === definition.id ? "Close Schedule" : "Edit Schedule"}
                        </Button>
                        {definition.isScheduled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handlePauseSchedule(definition.id)}
                            disabled={scheduleActionId === definition.id}
                          >
                            {scheduleActionId === definition.id ? "Pausing..." : "Pause Schedule"}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleResumeSchedule(definition.id)}
                            disabled={
                              scheduleActionId === definition.id ||
                              !definition.recurrenceRuleJson
                            }
                          >
                            {scheduleActionId === definition.id ? "Resuming..." : "Resume Schedule"}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggleRunHistory(definition.id)}
                          disabled={runsLoadingId === definition.id}
                        >
                          <History className="mr-2 h-4 w-4" />
                          {isHistoryExpanded ? "Hide Runs" : "Run History"}
                          {isHistoryExpanded ? (
                            <ChevronUp className="ml-2 h-4 w-4" />
                          ) : (
                            <ChevronDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleDeleteDefinition(definition.id)}
                          disabled={deletingId === definition.id}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deletingId === definition.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>

                    {editingScheduleId === definition.id && (
                      <div className="border-t pt-3 space-y-3">
                        <p className="text-sm font-medium">Schedule Settings</p>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Frequency</Label>
                            <Select
                              value={editFrequency}
                              onValueChange={(value: EmailRecurrenceRule["frequency"]) =>
                                setEditFrequency(value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DAILY">Daily</SelectItem>
                                <SelectItem value="WEEKLY">Weekly</SelectItem>
                                <SelectItem value="MONTHLY">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Timezone</Label>
                            <Select value={editTimezone} onValueChange={setEditTimezone}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timezoneOptions.map((timezoneValue) => (
                                  <SelectItem key={timezoneValue} value={timezoneValue}>
                                    {timezoneValue}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-schedule-time-${definition.id}`}>Time (24h)</Label>
                            <Input
                              id={`edit-schedule-time-${definition.id}`}
                              type="time"
                              value={editTimeOfDay}
                              onChange={(event) => setEditTimeOfDay(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-schedule-interval-${definition.id}`}>Interval</Label>
                            <Input
                              id={`edit-schedule-interval-${definition.id}`}
                              value={editInterval}
                              onChange={(event) => setEditInterval(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-schedule-start-${definition.id}`}>Start date (optional)</Label>
                            <Input
                              id={`edit-schedule-start-${definition.id}`}
                              type="date"
                              value={editStartDate}
                              onChange={(event) => setEditStartDate(event.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-schedule-end-${definition.id}`}>End date (optional)</Label>
                            <Input
                              id={`edit-schedule-end-${definition.id}`}
                              type="date"
                              value={editEndDate}
                              onChange={(event) => setEditEndDate(event.target.value)}
                            />
                          </div>

                          {editFrequency === "WEEKLY" && (
                            <div className="space-y-2 md:col-span-3">
                              <Label>Weekdays</Label>
                              <div className="flex flex-wrap gap-3">
                                {WEEKDAY_OPTIONS.map((day) => (
                                  <label key={day.value} className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                      checked={editWeekdays.includes(day.value)}
                                      onCheckedChange={() =>
                                        setEditWeekdays((prev) => toggleNumberInArray(prev, day.value))
                                      }
                                    />
                                    <span>{day.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {editFrequency === "MONTHLY" && (
                            <div className="space-y-2 md:col-span-3">
                              <Label htmlFor={`edit-schedule-month-days-${definition.id}`}>Month days</Label>
                              <Input
                                id={`edit-schedule-month-days-${definition.id}`}
                                value={editMonthDays}
                                onChange={(event) => setEditMonthDays(event.target.value)}
                                placeholder="1,15,28"
                              />
                            </div>
                          )}

                          {editSchedulePreview && (
                            <p
                              className={`text-xs md:col-span-3 ${
                                editSchedulePreview.isError ? "text-red-600" : "text-muted-foreground"
                              }`}
                            >
                              {editSchedulePreview.message}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingScheduleId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void handleSaveSchedule(definition.id)}
                            disabled={scheduleActionId === definition.id}
                          >
                            {scheduleActionId === definition.id ? "Saving..." : "Save Schedule"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {isHistoryExpanded && (
                      <div className="border-t pt-3">
                        {runsLoadingId === definition.id ? (
                          <p className="text-sm text-muted-foreground">Loading run history...</p>
                        ) : runHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No runs recorded yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {runHistory.map((run) => {
                              const runDeliveryConfig = parseRunDeliveryConfig(run.deliveryConfigJson);
                              const runDeliveryDispatch = parseRunDeliveryDispatch(run.deliveryConfigJson);
                              return (
                                <div key={run.id} className="rounded-md border p-2">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={runStatusColors[run.status]} variant="outline">
                                      {run.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(run.createdAt).toLocaleString()}
                                    </span>
                                    {run.error && (
                                      <span className="text-xs text-red-600">{run.error}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleExportRun(definition, run, "json")}
                                      disabled={!run.resultJson}
                                    >
                                      <FileJson className="mr-2 h-4 w-4" />
                                      JSON
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleExportRun(definition, run, "csv")}
                                      disabled={!run.resultJson}
                                    >
                                      <Download className="mr-2 h-4 w-4" />
                                      CSV
                                    </Button>
                                  </div>
                                </div>
                                {runDeliveryConfig && (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Delivery: {describeDeliveryConfig(runDeliveryConfig)}
                                  </p>
                                )}
                                {runDeliveryDispatch && (
                                  <p
                                    className={`mt-1 text-xs ${
                                      runDeliveryDispatch.delivered
                                        ? "text-green-700"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    Dispatch: {runDeliveryDispatch.delivered ? "Delivered" : "Failed"}
                                    {runDeliveryDispatch.attemptedAt
                                      ? ` at ${new Date(runDeliveryDispatch.attemptedAt).toLocaleString()}`
                                      : ""}
                                    {runDeliveryDispatch.error ? ` (${runDeliveryDispatch.error})` : ""}
                                  </p>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
