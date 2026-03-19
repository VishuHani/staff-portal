# Email Workspace Redesign Plan (Nav + Create Email + Assets + Audience + Campaigns + Reports)

## Summary
Create a single **Emails workspace** with five modules: **Create Email**, **Assets**, **Audience**, **Campaigns**, and **Reports**.
This replaces the current split/partial flow with a permission-driven, folder-based, production-safe system that supports:
- Role-based access for admin, manager, and any user explicitly granted module permissions.
- Separate folder/subfolder trees per module.
- Guarded raw SQL audience creation (SELECT-only via validated gateway).
- One-off and recurring scheduling via custom recurrence builder.
- Optional approval workflow for non-admin sends.
- Custom report definitions with recurring scheduled runs.

## Implementation Progress Snapshot (March 19, 2026)
Implemented:
- Emails workspace routes and sidebar entrypoint under `/emails/*`.
- RBAC module gating for `email_workspace` and module resources.
- Compatibility redirects from legacy `/system/emails/*` and `/manage/emails/*` routes.
- Campaign flow now links to saved emails (`emailId`) instead of HTML-only inline content.
- Audience SQL guard utility + server action + workbench UI (`/emails/audience`) with validation results.
- One-off campaign scheduling path in the new campaign wizard (`Save & Schedule`).
- Recurrence utility + unit tests for timezone-aware daily/weekly/monthly next-run calculation.
- Shared folder API actions for workspace modules (`list/create/rename/move/delete`) with RBAC checks.
- Audience module folder UI now supports viewing nested folders and create/rename/move/delete operations.
- Assets module now has top search/filter controls and folder CRUD UI wired to shared folder APIs.
- Create, Campaigns, and Reports module pages now include folder CRUD UI via shared folder manager.
- Folder CRUD UX is now standardized through a shared reusable folder manager component.
- Email and campaign action layers now support `folderId` with folder access validation and schema-safe fallback behavior.
- New Email and New Campaign flows now include folder selectors wired to folder assignment on save.
- Email Builder, System Campaigns, and Manager Campaigns list screens now support folder filtering.
- Campaign listing action now supports `folderId` and `venueId` filters (with non-admin venue scope enforcement).
- Audience list server actions now support create/list/update/delete/run with SQL validation, folder assignment, and module RBAC checks.
- Audience workbench now supports saving reusable lists, folder/type/search filtering, manual runs, and deletions.
- Report definition server actions now support create/list/update/delete/run with folder assignment, scope controls, and baseline metrics output.
- Reports workspace now supports creating definitions, folder/type/search filtering, manual runs, and deletions.
- Asset server actions now support create/list/update/delete with folder assignment, visibility scope controls, and module RBAC checks.
- Assets workspace now supports folder-aware search/filter plus metadata-based asset registration and deletion.
- Audience SQL runs now execute validated queries with timeout + row cap and persist results into `audience_member_snapshots`.
- Cron job endpoint now processes due scheduled/recurring email campaigns and due scheduled report definitions.
- Campaign approvals now support venue policy reads/updates, manual approval requests, and approve/reject review actions.
- Campaign creation and send now enforce approval status (`NOT_REQUIRED|PENDING|APPROVED|REJECTED`).
- Reports workbench now supports recurring schedule configuration (daily/weekly/monthly with timezone/time), next-run preview, and persisted recurrence on create.
- Report run history can now be viewed per definition, including run status/error details and CSV/JSON export of run payloads.
- Report schedule lifecycle controls are now available (edit recurrence, pause schedule, resume schedule).
- System campaign UI now includes admin controls for per-venue approval policy (enable policy + require for non-admin).
- Unified `/emails/campaigns` routes now render native list, detail, and new-campaign experiences instead of redirecting to legacy paths.
- Campaign detail actions now point to unified campaign routes, with legacy edit URLs redirecting into `/emails/campaigns/*`.
- Unified `/emails/campaigns/[id]/edit` now provides draft campaign editing (email selection, folder assignment, targeting, preview, and test-send), and both legacy edit routes redirect there.
- Reports now capture optional delivery metadata (email/webhook destination) on definitions and persist it onto manual/scheduled run records.
- Report runs now actively dispatch to configured email/webhook destinations and persist dispatch outcome metadata on each run.
- Report delivery now includes retry/backoff behavior, signed webhook dispatch headers, and per-definition delivery health scoring in the reports UI.
- Scheduled report processing now uses atomic due-run claiming and failure retry requeue to reduce duplicate runs under concurrent cron workers.
- Assets module now supports direct file upload to Supabase storage with folder/scope/tag assignment and automatic asset registration.
- Asset search now supports multi-term tag matching (`hasSome`) in addition to name and MIME search.
- Asset enrichment now auto-extracts image dimensions, MP4/MOV duration, generates thumbnails (resized image or placeholder), and persists metadata/index tags for richer search.
- Campaign scheduling now records dedicated run history (`EmailCampaignRun`) with idempotency keys, run outcome stats, and retry metadata.
- Recurring campaign execution now uses idempotency-key run creation to prevent duplicate concurrent sends for the same scheduled slot.
- Manual campaign sends now also record `EmailCampaignRun` entries (`MANUAL` trigger), including sent/failed counts and partial-send outcomes.
- Campaign detail now includes a Runs tab showing per-run status, counts, timings, and errors.

In progress / pending:
- Apply and deploy Prisma migration for `EmailCampaignRun`, `EmailAsset.thumbnailUrl`, and `EmailAsset.metadataJson` in all environments.

## 1. Information Architecture and Navigation
1. Add sidebar item: `Emails`.
2. Add module entries under Emails:
- `Create Email`
- `Assets`
- `Audience`
- `Campaigns`
- `Reports`
3. Add unified workspace routes:
- `/emails`
- `/emails/create`
- `/emails/assets`
- `/emails/audience`
- `/emails/campaigns`
- `/emails/reports`
4. Keep compatibility redirects:
- `/system/emails/*` -> `/emails/*`
- `/manage/emails/*` -> `/emails/*`
5. Gate module visibility by permissions; do not gate only by role name.

## 2. RBAC and Permission Stack Changes
Add explicit permission resources:
- `email_workspace`
- `email_create`
- `email_assets`
- `email_audience`
- `email_campaigns`
- `email_reports`

Use existing action vocabulary with these assignments:
- View modules: `view`, `view_team`, `view_all`
- Create/update/delete content: `create`, `update`, `delete`, `archive`
- Campaign execution: `send`, `approve`, `cancel`, `publish`
- Audience SQL: `read` + `create` + `manage` (for SQL list authoring)
- Reporting: `create`, `view`, `export`, `schedule` (via `manage` if no `schedule` action exists)

Policy defaults:
- Admin: full access.
- Manager: team-scoped create/assets/audience/campaigns/reports.
- Assigned users: only explicitly granted modules/actions.

## 3. Data Model (Prisma) Additions
Add folder system with separate trees per module using one shared table keyed by module:
- `EmailFolder`
- Fields: `id`, `module` (`CREATE_EMAIL|ASSETS|AUDIENCE|CAMPAIGNS|REPORTS`), `name`, `parentId`, `path`, `scope` (`PRIVATE|TEAM|SYSTEM`), `venueId`, `ownerId`, timestamps.
- Constraint: parent and child must share same `module`.

Add assets:
- `EmailAsset`
- Fields: `id`, `folderId`, `name`, `mimeType`, `kind` (`IMAGE|GIF|VIDEO|FILE`), `storageUrl`, `storagePath`, `sizeBytes`, `width`, `height`, `durationSec`, `tags[]`, `scope`, `venueId`, `ownerId`, timestamps.

Add audience:
- `AudienceList`
- Fields: `id`, `folderId`, `name`, `description`, `queryType` (`SQL|FILTER|AI_FILTER`), `sqlText`, `filterJson`, `lastRunAt`, `lastCount`, `scope`, `venueId`, `ownerId`, timestamps.
- `AudienceRun`
- Fields: `id`, `audienceListId`, `startedAt`, `completedAt`, `status`, `rowCount`, `sqlNormalized`, `validationLog`, `error`.
- `AudienceMemberSnapshot`
- Fields: `id`, `audienceRunId`, `userId`, `email`, `metadataJson`.

Add campaigns enhancements:
- Extend existing `EmailCampaign` with `folderId`, `approvalStatus`, `recurrenceRuleJson`, `nextRunAt`, `lastRunAt`, `isRecurring`.
- `CampaignAudienceLink` join table (`campaignId`, `audienceListId`, `filterOverrideJson`).
- `EmailApprovalPolicy` (per venue): `enabled`, `requireForNonAdmin`.
- `EmailCampaignApproval`: `campaignId`, `requestedBy`, `approvedBy`, `status`, `notes`, timestamps.

Add report builder:
- `EmailReportDefinition`
- Fields: `id`, `folderId`, `name`, `description`, `reportType`, `configJson`, `scope`, `venueId`, `ownerId`, `isScheduled`, `recurrenceRuleJson`, `nextRunAt`, timestamps.
- `EmailReportRun`
- Fields: `id`, `reportDefinitionId`, `status`, `startedAt`, `completedAt`, `resultJson`, `error`, `deliveryConfigJson`.

## 4. API / Server Action Interfaces (Public Contract Changes)
Create or refactor actions under `src/lib/actions/email-workspace/*`:

Folders:
- `createFolder(input)`
- `renameFolder(input)`
- `moveFolder(input)`
- `deleteFolder(input)`
- `listFolderTree(input)`

Create Email:
- Reuse `emails.ts`; add `folderId` support and folder-aware search/list.

Assets:
- `uploadEmailAsset(formData)`
- `listAssets(filters)`
- `moveAsset(input)`
- `deleteAsset(input)`
- `searchAssets(query, filters)`

Audience:
- `validateAudienceSql(input)`; returns normalized SQL + policy errors.
- `createAudienceList(input)`
- `runAudienceList(input)`
- `previewAudienceList(input)`
- `listAudienceLists(filters)`

Campaigns:
- `createCampaignDraft(input)` must require `emailId` + audience linkage.
- `updateCampaign(input)`
- `requestCampaignApproval(input)`
- `approveCampaign(input)`
- `scheduleCampaign(input)` one-off and recurring via custom builder payload.
- `sendCampaignNow(input)`

Reports:
- `createReportDefinition(input)`
- `runReportDefinition(input)`
- `scheduleReportDefinition(input)`
- `listReportDefinitions(filters)`

## 5. Module-by-Module UX Scope
Create Email:
- Visual block editor + code editor + preview + test email.
- Save draft/template.
- Folder/subfolder organization.
- Fix current mismatch so campaign creation uses `emailId` instead of inline HTML-only flow.

Assets:
- Folder/subfolder tree.
- Search bar fixed at top.
- Upload/manage images, gifs, videos.
- Tagging and filtering by type, size, date.

Audience:
- Folder/subfolder tree.
- Three creation modes: SQL, AI-assisted filter generation, default filter builder.
- SQL mode via guarded gateway only; list preview before save; run history retained.

Campaigns:
- Folder/subfolder tree.
- Combine one or more emails with one or more audience lists.
- Apply additional filters per campaign.
- Send now, schedule once, or recurring (custom recurrence builder).
- Optional approval policy for non-admin users.

Reports:
- Folder/subfolder tree.
- Custom report builder for send/delivery/open/click/bounce/unsubscribe metrics and audience performance.
- Save definitions; run on-demand or recurring schedule.
- Export existing formats via current report export infrastructure.

## 6. Audience SQL Security Specification
Enforce all of the following:
- AST validation; single statement only.
- `SELECT`/`WITH` only; block DML/DDL and unsafe functions.
- Query only against whitelisted read views; no raw table access.
- Tenant and venue scope policy injection based on caller permissions.
- Read-only DB role; statement timeout and row limit.
- Full execution audit log with actor, SQL hash, duration, row count, and denial reasons.
- No data mutation path from audience SQL execution.

## 7. Jobs and Scheduling
Use scheduled worker for campaigns and reports:
- Scan due jobs each minute by `nextRunAt`.
- Compute next occurrence from recurrence JSON.
- Idempotency key per run.
- Retry policy with capped attempts and failure state.
- Timezone-aware schedule evaluation.

## 8. Migration and Backward Compatibility
1. Add new models and indexes via Prisma migration.
2. Backfill root folders per module per scope.
3. Backfill existing emails/campaigns into default folders.
4. Wire `/emails/*` routes and add redirects from legacy paths.
5. Keep existing action contracts temporarily; deprecate legacy endpoints after module migration.
6. Update sidebar and permission seeding scripts.

## 9. Test Plan and Acceptance Criteria
Unit tests:
- SQL validator allow/deny matrix.
- Recurrence calculator across timezone boundaries.
- Permission checks for each module/action.

Integration tests:
- Folder CRUD and move semantics by module.
- Audience list creation, preview, run, snapshot persistence.
- Campaign approval flow with policy on/off.
- Scheduled and recurring campaign dispatch.
- Report definition save, scheduled run, export compatibility.

E2E tests:
- Create Email end-to-end with preview/test.
- Assets search + folder navigation + upload.
- Audience SQL list -> campaign targeting.
- Campaign recurring schedule creation and execution.
- Reports creation, scheduled run, and retrieval.

Acceptance:
- Users with granted permissions can access only authorized modules.
- Raw SQL cannot mutate core DB and respects tenant/venue boundaries.
- All five modules support folders/subfolders.
- Campaign and report recurring runs execute correctly with audit trails.

## 10. Assumptions and Defaults (Locked)
- Access model: admin, manager, and any explicitly permission-assigned user.
- Folder strategy: separate trees per module.
- Visibility model: `PRIVATE|TEAM|SYSTEM`.
- SQL model: guarded SQL gateway with AST validation and whitelisted read views.
- Recurrence model: custom recurrence builder (not raw cron).
- Approval model: optional per-venue policy; enabled for non-admins when configured.
- Storage: continue Supabase storage pattern, with email-specific asset namespace and metadata indexing.
