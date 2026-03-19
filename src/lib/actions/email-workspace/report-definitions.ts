"use server";

import { Prisma } from "@prisma/client";
import type { EmailContentScope as PrismaEmailContentScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import {
  hasPermission,
  isAdmin,
  type PermissionAction,
} from "@/lib/rbac/permissions";
import {
  getNextRunAt,
  validateRecurrenceRule,
  type EmailRecurrenceRule,
} from "@/lib/email-workspace/recurrence";
import {
  dispatchReportDelivery,
  extractDeliveryConfigFromConfigJson,
  buildRunDeliveryMetadata,
  type ReportDeliveryConfig,
} from "@/lib/email-workspace/report-delivery";
import {
  isFolderSchemaMissingError,
  validateFolderAssignment,
} from "@/lib/email-workspace/folder-access";

type EmailContentScope = PrismaEmailContentScope;

type ReportDefinitionCreateData = Parameters<
  typeof prisma.emailReportDefinition.create
>[0]["data"];
type ReportDefinitionUpdateData = Parameters<
  typeof prisma.emailReportDefinition.update
>[0]["data"];
type ReportDefinitionWhereInput = Prisma.EmailReportDefinitionWhereInput;

export type EmailReportDeliveryConfig = ReportDeliveryConfig;

export interface EmailReportDeliveryHealth {
  status: "HEALTHY" | "DEGRADED" | "FAILING";
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
  consecutiveFailures: number;
  lastAttemptAt: Date | null;
  lastError: string | null;
}

export interface EmailReportDefinitionSummary {
  id: string;
  folderId: string | null;
  name: string;
  description: string | null;
  reportType: string;
  scope: EmailContentScope;
  venueId: string | null;
  ownerId: string;
  isScheduled: boolean;
  recurrenceRuleJson: EmailRecurrenceRule | null;
  deliveryConfigJson: EmailReportDeliveryConfig | null;
  deliveryHealth: EmailReportDeliveryHealth | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  runCount: number;
}

export interface EmailReportRunSummary {
  id: string;
  reportDefinitionId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface EmailReportRunDetails extends EmailReportRunSummary {
  resultJson: Prisma.JsonValue | null;
  deliveryConfigJson: Prisma.JsonValue | null;
}

export interface ListReportDefinitionsInput {
  search?: string;
  folderId?: string;
  reportType?: string;
  take?: number;
}

export interface ListReportRunsInput {
  reportDefinitionId: string;
  take?: number;
}

export interface CreateReportDefinitionInput {
  name: string;
  description?: string;
  reportType: string;
  configJson?: Record<string, unknown>;
  folderId?: string | null;
  scope?: EmailContentScope;
  venueId?: string | null;
  isScheduled?: boolean;
  recurrenceRuleJson?: EmailRecurrenceRule | null;
  nextRunAt?: Date | null;
}

export interface UpdateReportDefinitionInput {
  id: string;
  name?: string;
  description?: string;
  reportType?: string;
  configJson?: Record<string, unknown>;
  folderId?: string | null;
  scope?: EmailContentScope;
  venueId?: string | null;
  isScheduled?: boolean;
  recurrenceRuleJson?: EmailRecurrenceRule | null;
  nextRunAt?: Date | null;
}

export interface DeleteReportDefinitionInput {
  id: string;
}

export interface RunReportDefinitionInput {
  id: string;
}

export interface PauseReportDefinitionScheduleInput {
  id: string;
}

export interface ResumeReportDefinitionScheduleInput {
  id: string;
}

export interface ReportDefinitionsOutput {
  success: boolean;
  definitions?: EmailReportDefinitionSummary[];
  error?: string;
}

export interface ReportDefinitionMutationOutput {
  success: boolean;
  definition?: EmailReportDefinitionSummary;
  error?: string;
}

export interface ReportDefinitionDeleteOutput {
  success: boolean;
  error?: string;
}

export interface RunReportDefinitionOutput {
  success: boolean;
  run?: EmailReportRunSummary;
  error?: string;
}

export interface ReportRunsOutput {
  success: boolean;
  runs?: EmailReportRunDetails[];
  error?: string;
}

function isReportSchemaMissingError(error: unknown): boolean {
  if (isFolderSchemaMissingError(error)) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const meta = error.meta as
        | { code?: string; message?: string }
        | undefined;
      if (meta?.code === "42P01" || meta?.code === "42703") {
        return true;
      }

      if (typeof meta?.message === "string") {
        const message = meta.message.toLowerCase();
        if (
          message.includes("email_report_definitions") ||
          message.includes("email_report_runs")
        ) {
          return true;
        }
      }
    }
  }

  const message = String(error).toLowerCase();
  return (
    message.includes("email_report_definitions") ||
    message.includes("email_report_runs")
  );
}

function getSchemaMissingMessage() {
  return "Email report features are not available yet. Run the pending Prisma migration first.";
}

function revalidateReportPaths() {
  const paths = ["/emails/reports", "/system/emails", "/manage/emails"];
  for (const path of paths) {
    revalidatePath(path);
  }
}

async function getUserVenueIds(userId: string): Promise<string[]> {
  const rows = await prisma.userVenue.findMany({
    where: { userId },
    select: { venueId: true },
  });

  return rows.map((row) => row.venueId);
}

async function canMutateReportDefinitions(
  userId: string,
  action: Extract<PermissionAction, "create" | "update" | "delete">
): Promise<boolean> {
  if (await isAdmin(userId)) {
    return true;
  }

  if (await hasPermission(userId, "email_workspace", "manage")) {
    return true;
  }

  if (await hasPermission(userId, "email_reports", "manage")) {
    return true;
  }

  return hasPermission(userId, "email_reports", action);
}

function canReadDefinition(
  definition: {
    scope: EmailContentScope;
    ownerId: string;
    venueId: string | null;
  },
  userId: string,
  isAdminUser: boolean,
  userVenueIds: string[]
): boolean {
  if (isAdminUser) {
    return true;
  }

  if (definition.scope === "SYSTEM") {
    return true;
  }

  if (definition.ownerId === userId) {
    return true;
  }

  if (
    definition.scope === "TEAM" &&
    definition.venueId &&
    userVenueIds.includes(definition.venueId)
  ) {
    return true;
  }

  return false;
}

function buildVisibilityWhere(
  userId: string,
  isAdminUser: boolean,
  userVenueIds: string[]
): ReportDefinitionWhereInput {
  if (isAdminUser) {
    return {};
  }

  return {
    OR: [
      { scope: "SYSTEM" },
      { ownerId: userId },
      { scope: "TEAM", venueId: { in: userVenueIds } },
    ],
  };
}

function getResolvedScopeAndVenue(input: {
  isAdminUser: boolean;
  userVenueIds: string[];
  requestedScope: EmailContentScope;
  requestedVenueId: string | null;
}): { scope: EmailContentScope; venueId: string | null; error?: string } {
  if (input.isAdminUser) {
    return {
      scope: input.requestedScope,
      venueId: input.requestedVenueId,
    };
  }

  if (input.requestedScope === "SYSTEM") {
    return {
      scope: "PRIVATE",
      venueId: null,
      error: "Only admins can create system-scoped report definitions.",
    };
  }

  if (input.requestedScope === "TEAM") {
    const venueId = input.requestedVenueId || input.userVenueIds[0] || null;
    if (!venueId) {
      return {
        scope: "TEAM",
        venueId: null,
        error: "Select a venue for team-scoped report definitions.",
      };
    }

    if (!input.userVenueIds.includes(venueId)) {
      return {
        scope: "TEAM",
        venueId,
        error: "You don't have permission to use the selected venue.",
      };
    }

    return {
      scope: "TEAM",
      venueId,
    };
  }

  if (
    input.requestedVenueId &&
    !input.userVenueIds.includes(input.requestedVenueId)
  ) {
    return {
      scope: "PRIVATE",
      venueId: null,
      error: "You don't have permission to use the selected venue.",
    };
  }

  return {
    scope: "PRIVATE",
    venueId: input.requestedVenueId || null,
  };
}

function parseRecurrenceRule(
  value: Prisma.JsonValue | null
): EmailRecurrenceRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<EmailRecurrenceRule>;
  if (!candidate.frequency || !candidate.timezone || !candidate.time) {
    return null;
  }

  return {
    frequency: candidate.frequency,
    timezone: candidate.timezone,
    time: candidate.time,
    interval: candidate.interval,
    weekdays: candidate.weekdays,
    monthDays: candidate.monthDays,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
  };
}

function parseDeliveryConfig(
  value: Prisma.JsonValue
): EmailReportDeliveryConfig | null {
  return extractDeliveryConfigFromConfigJson(value);
}

function parseRunDeliveryDispatch(value: Prisma.JsonValue | null): {
  attempted: boolean;
  delivered: boolean;
  attemptedAt: Date | null;
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
    attemptedAt:
      typeof attemptedAt === "string" && !Number.isNaN(Date.parse(attemptedAt))
        ? new Date(attemptedAt)
        : null,
    error: typeof error === "string" && error.trim() ? error : null,
  };
}

function computeDeliveryHealth(
  runs: Array<{ deliveryConfigJson: Prisma.JsonValue | null }>
): EmailReportDeliveryHealth | null {
  const dispatches = runs
    .map((run) => parseRunDeliveryDispatch(run.deliveryConfigJson))
    .filter((dispatch): dispatch is NonNullable<typeof dispatch> =>
      Boolean(dispatch)
    );

  if (dispatches.length === 0) {
    return null;
  }

  const totalAttempts = dispatches.length;
  const successfulAttempts = dispatches.filter(
    (dispatch) => dispatch.delivered
  ).length;
  const successRate = successfulAttempts / totalAttempts;

  let consecutiveFailures = 0;
  for (const dispatch of dispatches) {
    if (dispatch.delivered) {
      break;
    }
    consecutiveFailures += 1;
  }

  let status: EmailReportDeliveryHealth["status"] = "HEALTHY";
  if (consecutiveFailures >= 3 || successRate < 0.5) {
    status = "FAILING";
  } else if (consecutiveFailures >= 1 || successRate < 0.9) {
    status = "DEGRADED";
  }

  const latest = dispatches[0];

  return {
    status,
    totalAttempts,
    successfulAttempts,
    successRate,
    consecutiveFailures,
    lastAttemptAt: latest?.attemptedAt || null,
    lastError: latest?.error || null,
  };
}

function toDefinitionSummary(definition: {
  id: string;
  folderId: string | null;
  name: string;
  description: string | null;
  reportType: string;
  scope: EmailContentScope;
  venueId: string | null;
  ownerId: string;
  isScheduled: boolean;
  configJson: Prisma.JsonValue;
  recurrenceRuleJson: Prisma.JsonValue | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { runs: number };
  runs?: Array<{
    deliveryConfigJson: Prisma.JsonValue | null;
  }>;
}): EmailReportDefinitionSummary {
  return {
    id: definition.id,
    folderId: definition.folderId,
    name: definition.name,
    description: definition.description,
    reportType: definition.reportType,
    scope: definition.scope,
    venueId: definition.venueId,
    ownerId: definition.ownerId,
    isScheduled: definition.isScheduled,
    recurrenceRuleJson: parseRecurrenceRule(definition.recurrenceRuleJson),
    deliveryConfigJson: parseDeliveryConfig(definition.configJson),
    deliveryHealth: computeDeliveryHealth(definition.runs || []),
    nextRunAt: definition.nextRunAt,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
    runCount: definition._count?.runs ?? 0,
  };
}

function toRunSummary(run: {
  id: string;
  reportDefinitionId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
}): EmailReportRunSummary {
  return {
    id: run.id,
    reportDefinitionId: run.reportDefinitionId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    error: run.error,
    createdAt: run.createdAt,
  };
}

function toRunDetails(run: {
  id: string;
  reportDefinitionId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  createdAt: Date;
  resultJson: Prisma.JsonValue | null;
  deliveryConfigJson: Prisma.JsonValue | null;
}): EmailReportRunDetails {
  return {
    id: run.id,
    reportDefinitionId: run.reportDefinitionId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    error: run.error,
    createdAt: run.createdAt,
    resultJson: run.resultJson,
    deliveryConfigJson: run.deliveryConfigJson,
  };
}

function getCampaignWindowDays(configJson: Prisma.JsonValue): number {
  if (
    configJson &&
    typeof configJson === "object" &&
    !Array.isArray(configJson) &&
    "windowDays" in configJson
  ) {
    const value = (configJson as { windowDays?: unknown }).windowDays;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
  }

  return 30;
}

export async function listReportDefinitions(
  input: ListReportDefinitionsInput = {}
): Promise<ReportDefinitionsOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to view email reports.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);

    const whereClauses: ReportDefinitionWhereInput[] = [
      buildVisibilityWhere(user.id, isAdminUser, userVenueIds),
    ];

    if (input.search?.trim()) {
      const search = input.search.trim();
      whereClauses.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (input.folderId && input.folderId !== "none") {
      whereClauses.push({ folderId: input.folderId });
    }

    if (input.folderId === "none") {
      whereClauses.push({ folderId: null });
    }

    if (input.reportType?.trim()) {
      whereClauses.push({ reportType: input.reportType.trim() });
    }

    const where: ReportDefinitionWhereInput =
      whereClauses.length > 0
        ? {
            AND: whereClauses.filter(
              (clause): clause is ReportDefinitionWhereInput => Boolean(clause)
            ),
          }
        : {};
    const take = Math.max(1, Math.min(input.take ?? 100, 250));

    const definitions = await prisma.emailReportDefinition.findMany({
      where,
      include: {
        _count: {
          select: { runs: true },
        },
        runs: {
          select: {
            deliveryConfigJson: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 10,
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take,
    });

    return {
      success: true,
      definitions: definitions.map(toDefinitionSummary),
    };
  } catch (error) {
    console.error("Error listing report definitions:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to load report definitions.",
    };
  }
}

export async function createReportDefinition(
  input: CreateReportDefinitionInput
): Promise<ReportDefinitionMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to create report definitions.",
      };
    }

    if (!(await canMutateReportDefinitions(user.id, "create"))) {
      return {
        success: false,
        error: "You don't have permission to create report definitions.",
      };
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      return {
        success: false,
        error: "Report definition name is required.",
      };
    }

    const trimmedReportType = input.reportType.trim();
    if (!trimmedReportType) {
      return {
        success: false,
        error: "Report type is required.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);

    const scopeResolution = getResolvedScopeAndVenue({
      isAdminUser,
      userVenueIds,
      requestedScope: input.scope || "PRIVATE",
      requestedVenueId: input.venueId || null,
    });

    if (scopeResolution.error) {
      return {
        success: false,
        error: scopeResolution.error,
      };
    }

    let folderIdForCreate: string | null | undefined = undefined;
    if (input.folderId) {
      try {
        const folderValidation = await validateFolderAssignment({
          userId: user.id,
          isAdminUser,
          module: "reports",
          folderId: input.folderId,
        });

        if (!folderValidation.valid) {
          return {
            success: false,
            error: folderValidation.error || "Invalid folder selection.",
          };
        }

        folderIdForCreate = input.folderId;
      } catch (folderError) {
        if (!isFolderSchemaMissingError(folderError)) {
          throw folderError;
        }
      }
    }

    const createData: Record<string, unknown> = {
      name: trimmedName,
      description: input.description?.trim() || null,
      reportType: trimmedReportType,
      configJson: (input.configJson || {
        windowDays: 30,
      }) as Prisma.InputJsonValue,
      scope: scopeResolution.scope,
      venueId: scopeResolution.venueId,
      ownerId: user.id,
      isScheduled: input.isScheduled || false,
      recurrenceRuleJson: input.recurrenceRuleJson
        ? (input.recurrenceRuleJson as unknown as Prisma.InputJsonValue)
        : null,
      nextRunAt: input.nextRunAt || null,
    };

    if (createData.isScheduled) {
      const recurrence = parseRecurrenceRule(
        (createData.recurrenceRuleJson as Prisma.JsonValue | null) || null
      );
      if (!recurrence) {
        return {
          success: false,
          error: "A valid recurrence rule is required when scheduling reports.",
        };
      }

      const validation = validateRecurrenceRule(recurrence);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors[0] || "Invalid recurrence rule.",
        };
      }

      createData.nextRunAt =
        input.nextRunAt || getNextRunAt(recurrence, new Date());
      if (!createData.nextRunAt) {
        return {
          success: false,
          error:
            "Unable to calculate the next scheduled run from recurrence settings.",
        };
      }
    } else {
      createData.recurrenceRuleJson = null;
      createData.nextRunAt = null;
    }

    if (folderIdForCreate !== undefined) {
      createData.folderId = folderIdForCreate;
    }

    let definition;
    try {
      definition = await prisma.emailReportDefinition.create({
        data: createData as ReportDefinitionCreateData,
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });
    } catch (createError) {
      if (
        createData.folderId !== undefined &&
        isReportSchemaMissingError(createError)
      ) {
        delete createData.folderId;
        definition = await prisma.emailReportDefinition.create({
          data: createData as ReportDefinitionCreateData,
          include: {
            _count: {
              select: { runs: true },
            },
          },
        });
      } else {
        throw createError;
      }
    }

    revalidateReportPaths();

    return {
      success: true,
      definition: toDefinitionSummary(definition),
    };
  } catch (error) {
    console.error("Error creating report definition:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to create report definition.",
    };
  }
}

export async function updateReportDefinition(
  input: UpdateReportDefinitionInput
): Promise<ReportDefinitionMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to update report definitions.",
      };
    }

    if (!(await canMutateReportDefinitions(user.id, "update"))) {
      return {
        success: false,
        error: "You don't have permission to update report definitions.",
      };
    }

    const existing = await prisma.emailReportDefinition.findUnique({
      where: { id: input.id },
    });

    if (!existing) {
      return {
        success: false,
        error: "Report definition not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    if (!canReadDefinition(existing, user.id, isAdminUser, userVenueIds)) {
      return {
        success: false,
        error: "You don't have permission to update this report definition.",
      };
    }

    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        return {
          success: false,
          error: "Report definition name is required.",
        };
      }
      updateData.name = trimmedName;
    }

    if (input.description !== undefined) {
      updateData.description = input.description.trim() || null;
    }

    if (input.reportType !== undefined) {
      const trimmedType = input.reportType.trim();
      if (!trimmedType) {
        return {
          success: false,
          error: "Report type is required.",
        };
      }
      updateData.reportType = trimmedType;
    }

    if (input.configJson !== undefined) {
      updateData.configJson = (input.configJson as Prisma.InputJsonValue) || {};
    }

    if (input.scope !== undefined || input.venueId !== undefined) {
      const scopeResolution = getResolvedScopeAndVenue({
        isAdminUser,
        userVenueIds,
        requestedScope: input.scope || existing.scope,
        requestedVenueId:
          input.venueId !== undefined ? input.venueId : existing.venueId,
      });

      if (scopeResolution.error) {
        return {
          success: false,
          error: scopeResolution.error,
        };
      }

      updateData.scope = scopeResolution.scope;
      updateData.venueId = scopeResolution.venueId;
    }

    if (input.isScheduled !== undefined) {
      updateData.isScheduled = input.isScheduled;
    }

    if (input.recurrenceRuleJson !== undefined) {
      updateData.recurrenceRuleJson = input.recurrenceRuleJson
        ? (input.recurrenceRuleJson as unknown as Prisma.InputJsonValue)
        : null;
    }

    if (input.nextRunAt !== undefined) {
      updateData.nextRunAt = input.nextRunAt;
    }

    const resolvedIsScheduled =
      (updateData.isScheduled as boolean | undefined) ?? existing.isScheduled;
    const resolvedRecurrence = parseRecurrenceRule(
      (updateData.recurrenceRuleJson as Prisma.JsonValue | null | undefined) ??
        (existing.recurrenceRuleJson as Prisma.JsonValue | null)
    );

    if (resolvedIsScheduled) {
      if (!resolvedRecurrence) {
        return {
          success: false,
          error: "A valid recurrence rule is required when scheduling reports.",
        };
      }

      const validation = validateRecurrenceRule(resolvedRecurrence);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors[0] || "Invalid recurrence rule.",
        };
      }

      if (updateData.nextRunAt === undefined || updateData.nextRunAt === null) {
        updateData.nextRunAt = getNextRunAt(resolvedRecurrence, new Date());
      }
    } else {
      updateData.recurrenceRuleJson = null;
      updateData.nextRunAt = null;
    }

    if (input.folderId !== undefined) {
      if (input.folderId) {
        try {
          const folderValidation = await validateFolderAssignment({
            userId: user.id,
            isAdminUser,
            module: "reports",
            folderId: input.folderId,
          });

          if (!folderValidation.valid) {
            return {
              success: false,
              error: folderValidation.error || "Invalid folder selection.",
            };
          }

          updateData.folderId = input.folderId;
        } catch (folderError) {
          if (!isFolderSchemaMissingError(folderError)) {
            throw folderError;
          }
        }
      } else {
        updateData.folderId = null;
      }
    }

    let definition;
    try {
      definition = await prisma.emailReportDefinition.update({
        where: { id: input.id },
        data: updateData as ReportDefinitionUpdateData,
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });
    } catch (updateError) {
      if (
        updateData.folderId !== undefined &&
        isReportSchemaMissingError(updateError)
      ) {
        delete updateData.folderId;
        definition = await prisma.emailReportDefinition.update({
          where: { id: input.id },
          data: updateData as ReportDefinitionUpdateData,
          include: {
            _count: {
              select: { runs: true },
            },
          },
        });
      } else {
        throw updateError;
      }
    }

    revalidateReportPaths();

    return {
      success: true,
      definition: toDefinitionSummary(definition),
    };
  } catch (error) {
    console.error("Error updating report definition:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to update report definition.",
    };
  }
}

export async function deleteReportDefinition(
  input: DeleteReportDefinitionInput
): Promise<ReportDefinitionDeleteOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to delete report definitions.",
      };
    }

    if (!(await canMutateReportDefinitions(user.id, "delete"))) {
      return {
        success: false,
        error: "You don't have permission to delete report definitions.",
      };
    }

    const definition = await prisma.emailReportDefinition.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        ownerId: true,
        scope: true,
      },
    });

    if (!definition) {
      return {
        success: false,
        error: "Report definition not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    if (
      !isAdminUser &&
      definition.ownerId !== user.id &&
      definition.scope === "SYSTEM"
    ) {
      return {
        success: false,
        error: "Only admins can delete system-scoped report definitions.",
      };
    }

    await prisma.emailReportDefinition.delete({
      where: { id: input.id },
    });

    revalidateReportPaths();

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting report definition:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to delete report definition.",
    };
  }
}

export async function runReportDefinition(
  input: RunReportDefinitionInput
): Promise<RunReportDefinitionOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to run report definitions.",
      };
    }

    const definition = await prisma.emailReportDefinition.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        name: true,
        reportType: true,
        configJson: true,
        ownerId: true,
        scope: true,
        venueId: true,
      },
    });

    if (!definition) {
      return {
        success: false,
        error: "Report definition not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    if (!canReadDefinition(definition, user.id, isAdminUser, userVenueIds)) {
      return {
        success: false,
        error: "You don't have permission to run this report definition.",
      };
    }

    const startedAt = new Date();
    const windowDays = getCampaignWindowDays(definition.configJson);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - windowDays);

    const campaignWhere: Prisma.EmailCampaignWhereInput = {
      createdAt: {
        gte: dateFrom,
      },
    };

    if (definition.venueId) {
      campaignWhere.venueId = definition.venueId;
    } else if (!isAdminUser) {
      campaignWhere.venueId = { in: userVenueIds };
    }

    const [totalCampaigns, sentCampaigns, aggregates] = await Promise.all([
      prisma.emailCampaign.count({ where: campaignWhere }),
      prisma.emailCampaign.count({
        where: {
          ...campaignWhere,
          status: "SENT",
        },
      }),
      prisma.emailCampaign.aggregate({
        where: campaignWhere,
        _sum: {
          recipientCount: true,
          deliveredCount: true,
          openedCount: true,
          clickedCount: true,
          bouncedCount: true,
          unsubscribedCount: true,
        },
      }),
    ]);

    const resultJson: Prisma.InputJsonValue = {
      reportType: definition.reportType,
      generatedAt: new Date().toISOString(),
      windowDays,
      summary: {
        totalCampaigns,
        sentCampaigns,
        recipientCount: aggregates._sum.recipientCount || 0,
        deliveredCount: aggregates._sum.deliveredCount || 0,
        openedCount: aggregates._sum.openedCount || 0,
        clickedCount: aggregates._sum.clickedCount || 0,
        bouncedCount: aggregates._sum.bouncedCount || 0,
        unsubscribedCount: aggregates._sum.unsubscribedCount || 0,
      },
    };

    const deliveryConfig = extractDeliveryConfigFromConfigJson(
      definition.configJson
    );

    const run = await prisma.emailReportRun.create({
      data: {
        reportDefinitionId: input.id,
        status: "COMPLETED",
        startedAt,
        completedAt: new Date(),
        resultJson,
        deliveryConfigJson: deliveryConfig
          ? ({
              channel: deliveryConfig.channel,
              destination: deliveryConfig.destination,
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });

    if (deliveryConfig) {
      const deliveryOutcome = await dispatchReportDelivery(deliveryConfig, {
        reportDefinitionId: definition.id,
        reportDefinitionName: definition.name,
        reportType: definition.reportType,
        generatedAt: new Date().toISOString(),
        resultJson: resultJson as Prisma.JsonValue,
      });

      await prisma.emailReportRun.update({
        where: { id: run.id },
        data: {
          deliveryConfigJson: buildRunDeliveryMetadata(
            deliveryConfig,
            deliveryOutcome
          ),
        },
      });
    }

    revalidateReportPaths();

    return {
      success: true,
      run: toRunSummary(run),
    };
  } catch (error) {
    console.error("Error running report definition:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to run report definition.",
    };
  }
}

export async function listReportRuns(
  input: ListReportRunsInput
): Promise<ReportRunsOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to view report runs.",
      };
    }

    const definition = await prisma.emailReportDefinition.findUnique({
      where: { id: input.reportDefinitionId },
      select: {
        id: true,
        ownerId: true,
        scope: true,
        venueId: true,
      },
    });

    if (!definition) {
      return {
        success: false,
        error: "Report definition not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    if (!canReadDefinition(definition, user.id, isAdminUser, userVenueIds)) {
      return {
        success: false,
        error: "You don't have permission to view this report run history.",
      };
    }

    const take = Math.max(1, Math.min(input.take ?? 15, 50));
    const runs = await prisma.emailReportRun.findMany({
      where: {
        reportDefinitionId: input.reportDefinitionId,
      },
      orderBy: [{ createdAt: "desc" }],
      take,
      select: {
        id: true,
        reportDefinitionId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        error: true,
        createdAt: true,
        resultJson: true,
        deliveryConfigJson: true,
      },
    });

    return {
      success: true,
      runs: runs.map(toRunDetails),
    };
  } catch (error) {
    console.error("Error listing report runs:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to load report run history.",
    };
  }
}

export async function pauseReportDefinitionSchedule(
  input: PauseReportDefinitionScheduleInput
): Promise<ReportDefinitionMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to update report schedules.",
      };
    }

    if (!(await canMutateReportDefinitions(user.id, "update"))) {
      return {
        success: false,
        error: "You don't have permission to update report schedules.",
      };
    }

    const existing = await prisma.emailReportDefinition.findUnique({
      where: { id: input.id },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    if (!existing) {
      return {
        success: false,
        error: "Report definition not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    if (!canReadDefinition(existing, user.id, isAdminUser, userVenueIds)) {
      return {
        success: false,
        error: "You don't have permission to update this report schedule.",
      };
    }

    const definition = await prisma.emailReportDefinition.update({
      where: { id: input.id },
      data: {
        isScheduled: false,
        nextRunAt: null,
      },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    revalidateReportPaths();

    return {
      success: true,
      definition: toDefinitionSummary(definition),
    };
  } catch (error) {
    console.error("Error pausing report schedule:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to pause report schedule.",
    };
  }
}

export async function resumeReportDefinitionSchedule(
  input: ResumeReportDefinitionScheduleInput
): Promise<ReportDefinitionMutationOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "reports"))) {
      return {
        success: false,
        error: "You don't have permission to update report schedules.",
      };
    }

    if (!(await canMutateReportDefinitions(user.id, "update"))) {
      return {
        success: false,
        error: "You don't have permission to update report schedules.",
      };
    }

    const existing = await prisma.emailReportDefinition.findUnique({
      where: { id: input.id },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    if (!existing) {
      return {
        success: false,
        error: "Report definition not found.",
      };
    }

    const isAdminUser = await isAdmin(user.id);
    const userVenueIds = isAdminUser ? [] : await getUserVenueIds(user.id);
    if (!canReadDefinition(existing, user.id, isAdminUser, userVenueIds)) {
      return {
        success: false,
        error: "You don't have permission to update this report schedule.",
      };
    }

    const recurrence = parseRecurrenceRule(existing.recurrenceRuleJson);
    if (!recurrence) {
      return {
        success: false,
        error: "No saved recurrence rule found. Set a schedule first.",
      };
    }

    const validation = validateRecurrenceRule(recurrence);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors[0] || "Invalid recurrence rule.",
      };
    }

    const nextRunAt = getNextRunAt(recurrence, new Date());
    if (!nextRunAt) {
      return {
        success: false,
        error: "Unable to calculate next run from the saved recurrence rule.",
      };
    }

    const definition = await prisma.emailReportDefinition.update({
      where: { id: input.id },
      data: {
        isScheduled: true,
        nextRunAt,
      },
      include: {
        _count: {
          select: { runs: true },
        },
      },
    });

    revalidateReportPaths();

    return {
      success: true,
      definition: toDefinitionSummary(definition),
    };
  } catch (error) {
    console.error("Error resuming report schedule:", error);

    if (isReportSchemaMissingError(error)) {
      return {
        success: false,
        error: getSchemaMissingMessage(),
      };
    }

    return {
      success: false,
      error: "Failed to resume report schedule.",
    };
  }
}
