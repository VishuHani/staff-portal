/**
 * Shared RBAC contract types.
 *
 * Keep these types isolated from auth/runtime helpers so permission utilities
 * can be imported without dragging in higher-level access helpers.
 */

export type PermissionResource =
  // Core Resources
  | "users"
  | "roles"
  | "stores"
  | "venues"
  | "positions"
  // Scheduling Resources
  | "availability"
  | "timeoff"
  | "rosters"
  | "schedules"
  // Communication Resources
  | "posts"
  | "comments"
  | "reactions"
  | "messages"
  | "conversations"
  | "channels"
  // Intelligence Resources
  | "ai"
  | "reports"
  // Email Workspace Resources
  | "email_workspace"
  | "email_create"
  | "email_assets"
  | "email_audience"
  | "email_campaigns"
  | "email_reports"
  // System Resources
  | "audit"
  | "notifications"
  | "announcements"
  | "settings"
  | "media"
  | "dashboard"
  | "profile"
  | "admin"
  // Invitation Resources
  | "invites"
  | "onboarding"
  // Document Management Resources
  | "documents";

export type PermissionAction =
  // Basic CRUD
  | "create"
  | "read"
  | "update"
  | "delete"
  | "edit"
  | "manage"
  // View Scopes
  | "view"
  | "view_own"
  | "view_team"
  | "view_all"
  | "view_sensitive"
  // Edit Scopes
  | "edit_own"
  | "edit_team"
  | "edit_all"
  // Delete Scopes
  | "delete_own"
  | "delete_all"
  // Workflow Actions
  | "approve"
  | "reject"
  | "cancel"
  | "publish"
  | "submit"
  | "recall"
  | "finalize"
  | "schedule"
  // Data Operations
  | "export"
  | "export_team"
  | "export_all"
  | "export_anonymized"
  | "import"
  | "import_own"
  | "import_team"
  | "import_all"
  // Content Moderation
  | "moderate"
  | "pin"
  | "unpin"
  | "archive"
  | "restore"
  // Assignment
  | "assign"
  | "unassign"
  // Communication
  | "send"
  // Bulk Operations
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete"
  | "bulk_assign"
  // Admin Actions
  | "manage_users"
  | "manage_roles"
  | "manage_stores"
  | "manage_permissions"
  | "manage_settings"
  | "manage_positions"
  | "manage_hours"
  | "view_audit_logs"
  | "impersonate"
  | "deactivate"
  | "reactivate"
  // AI Actions
  | "view_ai"
  | "use_ai"
  | "manage_ai"
  // Copy/Duplicate
  | "copy"
  | "duplicate"
  // Invitation Actions
  | "resend";

export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
}
