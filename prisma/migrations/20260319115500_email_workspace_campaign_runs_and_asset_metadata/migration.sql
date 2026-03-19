-- CreateEnum
CREATE TYPE "EmailWorkspaceModule" AS ENUM ('CREATE_EMAIL', 'ASSETS', 'AUDIENCE', 'CAMPAIGNS', 'REPORTS');

-- CreateEnum
CREATE TYPE "EmailContentScope" AS ENUM ('PRIVATE', 'TEAM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailAssetKind" AS ENUM ('IMAGE', 'GIF', 'VIDEO', 'FILE');

-- CreateEnum
CREATE TYPE "AudienceQueryType" AS ENUM ('SQL', 'FILTER', 'AI_FILTER');

-- CreateEnum
CREATE TYPE "EmailJobRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignRunTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- AlterTable
ALTER TABLE "email_campaigns" ADD COLUMN     "approvalStatus" "CampaignApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastRunAt" TIMESTAMP(3),
ADD COLUMN     "nextRunAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceRuleJson" JSONB;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "email_folders" (
    "id" TEXT NOT NULL,
    "module" "EmailWorkspaceModule" NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '/',
    "scope" "EmailContentScope" NOT NULL DEFAULT 'PRIVATE',
    "venueId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_assets" (
    "id" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "EmailAssetKind" NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" INTEGER,
    "thumbnailUrl" TEXT,
    "altText" TEXT,
    "metadataJson" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scope" "EmailContentScope" NOT NULL DEFAULT 'PRIVATE',
    "venueId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_lists" (
    "id" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queryType" "AudienceQueryType" NOT NULL DEFAULT 'FILTER',
    "sqlText" TEXT,
    "filterJson" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "lastCount" INTEGER NOT NULL DEFAULT 0,
    "scope" "EmailContentScope" NOT NULL DEFAULT 'PRIVATE',
    "venueId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_runs" (
    "id" TEXT NOT NULL,
    "audienceListId" TEXT NOT NULL,
    "status" "EmailJobRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "sqlNormalized" TEXT,
    "validationLog" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audience_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_member_snapshots" (
    "id" TEXT NOT NULL,
    "audienceRunId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audience_member_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaign_runs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "triggerSource" "CampaignRunTrigger" NOT NULL DEFAULT 'SCHEDULED',
    "status" "EmailJobRunStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_audience_links" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "audienceListId" TEXT NOT NULL,
    "filterOverrideJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_audience_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_approval_policies" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "requireForNonAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaign_approvals" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "status" "CampaignApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaign_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_report_definitions" (
    "id" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reportType" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "scope" "EmailContentScope" NOT NULL DEFAULT 'PRIVATE',
    "venueId" TEXT,
    "ownerId" TEXT NOT NULL,
    "isScheduled" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRuleJson" JSONB,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_report_runs" (
    "id" TEXT NOT NULL,
    "reportDefinitionId" TEXT NOT NULL,
    "status" "EmailJobRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultJson" JSONB,
    "error" TEXT,
    "deliveryConfigJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_folders_module_idx" ON "email_folders"("module");

-- CreateIndex
CREATE INDEX "email_folders_parentId_idx" ON "email_folders"("parentId");

-- CreateIndex
CREATE INDEX "email_folders_scope_idx" ON "email_folders"("scope");

-- CreateIndex
CREATE INDEX "email_folders_venueId_idx" ON "email_folders"("venueId");

-- CreateIndex
CREATE INDEX "email_folders_ownerId_idx" ON "email_folders"("ownerId");

-- CreateIndex
CREATE INDEX "email_assets_folderId_idx" ON "email_assets"("folderId");

-- CreateIndex
CREATE INDEX "email_assets_kind_idx" ON "email_assets"("kind");

-- CreateIndex
CREATE INDEX "email_assets_scope_idx" ON "email_assets"("scope");

-- CreateIndex
CREATE INDEX "email_assets_venueId_idx" ON "email_assets"("venueId");

-- CreateIndex
CREATE INDEX "email_assets_ownerId_idx" ON "email_assets"("ownerId");

-- CreateIndex
CREATE INDEX "audience_lists_folderId_idx" ON "audience_lists"("folderId");

-- CreateIndex
CREATE INDEX "audience_lists_queryType_idx" ON "audience_lists"("queryType");

-- CreateIndex
CREATE INDEX "audience_lists_scope_idx" ON "audience_lists"("scope");

-- CreateIndex
CREATE INDEX "audience_lists_venueId_idx" ON "audience_lists"("venueId");

-- CreateIndex
CREATE INDEX "audience_lists_ownerId_idx" ON "audience_lists"("ownerId");

-- CreateIndex
CREATE INDEX "audience_runs_audienceListId_idx" ON "audience_runs"("audienceListId");

-- CreateIndex
CREATE INDEX "audience_runs_status_idx" ON "audience_runs"("status");

-- CreateIndex
CREATE INDEX "audience_runs_createdAt_idx" ON "audience_runs"("createdAt");

-- CreateIndex
CREATE INDEX "audience_member_snapshots_audienceRunId_idx" ON "audience_member_snapshots"("audienceRunId");

-- CreateIndex
CREATE INDEX "audience_member_snapshots_userId_idx" ON "audience_member_snapshots"("userId");

-- CreateIndex
CREATE INDEX "audience_member_snapshots_email_idx" ON "audience_member_snapshots"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_campaign_runs_idempotencyKey_key" ON "email_campaign_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "email_campaign_runs_campaignId_idx" ON "email_campaign_runs"("campaignId");

-- CreateIndex
CREATE INDEX "email_campaign_runs_status_idx" ON "email_campaign_runs"("status");

-- CreateIndex
CREATE INDEX "email_campaign_runs_scheduledFor_idx" ON "email_campaign_runs"("scheduledFor");

-- CreateIndex
CREATE INDEX "email_campaign_runs_createdAt_idx" ON "email_campaign_runs"("createdAt");

-- CreateIndex
CREATE INDEX "campaign_audience_links_campaignId_idx" ON "campaign_audience_links"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_audience_links_audienceListId_idx" ON "campaign_audience_links"("audienceListId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_audience_links_campaignId_audienceListId_key" ON "campaign_audience_links"("campaignId", "audienceListId");

-- CreateIndex
CREATE UNIQUE INDEX "email_approval_policies_venueId_key" ON "email_approval_policies"("venueId");

-- CreateIndex
CREATE INDEX "email_approval_policies_enabled_idx" ON "email_approval_policies"("enabled");

-- CreateIndex
CREATE INDEX "email_campaign_approvals_campaignId_idx" ON "email_campaign_approvals"("campaignId");

-- CreateIndex
CREATE INDEX "email_campaign_approvals_requestedBy_idx" ON "email_campaign_approvals"("requestedBy");

-- CreateIndex
CREATE INDEX "email_campaign_approvals_approvedBy_idx" ON "email_campaign_approvals"("approvedBy");

-- CreateIndex
CREATE INDEX "email_campaign_approvals_status_idx" ON "email_campaign_approvals"("status");

-- CreateIndex
CREATE INDEX "email_report_definitions_folderId_idx" ON "email_report_definitions"("folderId");

-- CreateIndex
CREATE INDEX "email_report_definitions_scope_idx" ON "email_report_definitions"("scope");

-- CreateIndex
CREATE INDEX "email_report_definitions_venueId_idx" ON "email_report_definitions"("venueId");

-- CreateIndex
CREATE INDEX "email_report_definitions_ownerId_idx" ON "email_report_definitions"("ownerId");

-- CreateIndex
CREATE INDEX "email_report_definitions_nextRunAt_idx" ON "email_report_definitions"("nextRunAt");

-- CreateIndex
CREATE INDEX "email_report_runs_reportDefinitionId_idx" ON "email_report_runs"("reportDefinitionId");

-- CreateIndex
CREATE INDEX "email_report_runs_status_idx" ON "email_report_runs"("status");

-- CreateIndex
CREATE INDEX "email_report_runs_createdAt_idx" ON "email_report_runs"("createdAt");

-- CreateIndex
CREATE INDEX "email_campaigns_approvalStatus_idx" ON "email_campaigns"("approvalStatus");

-- CreateIndex
CREATE INDEX "email_campaigns_folderId_idx" ON "email_campaigns"("folderId");

-- CreateIndex
CREATE INDEX "email_campaigns_nextRunAt_idx" ON "email_campaigns"("nextRunAt");

-- CreateIndex
CREATE INDEX "emails_folderId_idx" ON "emails"("folderId");

-- AddForeignKey
ALTER TABLE "email_folders" ADD CONSTRAINT "email_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "email_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_folders" ADD CONSTRAINT "email_folders_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_folders" ADD CONSTRAINT "email_folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_assets" ADD CONSTRAINT "email_assets_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "email_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_assets" ADD CONSTRAINT "email_assets_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_assets" ADD CONSTRAINT "email_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_lists" ADD CONSTRAINT "audience_lists_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "email_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_lists" ADD CONSTRAINT "audience_lists_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_lists" ADD CONSTRAINT "audience_lists_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_runs" ADD CONSTRAINT "audience_runs_audienceListId_fkey" FOREIGN KEY ("audienceListId") REFERENCES "audience_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_member_snapshots" ADD CONSTRAINT "audience_member_snapshots_audienceRunId_fkey" FOREIGN KEY ("audienceRunId") REFERENCES "audience_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_member_snapshots" ADD CONSTRAINT "audience_member_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "email_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "email_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_runs" ADD CONSTRAINT "email_campaign_runs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audience_links" ADD CONSTRAINT "campaign_audience_links_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audience_links" ADD CONSTRAINT "campaign_audience_links_audienceListId_fkey" FOREIGN KEY ("audienceListId") REFERENCES "audience_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_approval_policies" ADD CONSTRAINT "email_approval_policies_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_approvals" ADD CONSTRAINT "email_campaign_approvals_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_approvals" ADD CONSTRAINT "email_campaign_approvals_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_approvals" ADD CONSTRAINT "email_campaign_approvals_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_report_definitions" ADD CONSTRAINT "email_report_definitions_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "email_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_report_definitions" ADD CONSTRAINT "email_report_definitions_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_report_definitions" ADD CONSTRAINT "email_report_definitions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_report_runs" ADD CONSTRAINT "email_report_runs_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "email_report_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

