import type { Permission } from "./types";

export const SYSTEM_PERMISSIONS = {
  rolesRead: [
    { resource: "roles", action: "view_all" },
    { resource: "roles", action: "manage" },
    { resource: "admin", action: "manage_roles" },
  ],
  rolesManage: [
    { resource: "roles", action: "manage" },
    { resource: "admin", action: "manage_roles" },
  ],
  permissionsManage: [
    { resource: "admin", action: "manage_permissions" },
    { resource: "roles", action: "manage" },
  ],
  venuesRead: [
    { resource: "stores", action: "view_all" },
    { resource: "stores", action: "manage" },
    { resource: "venues", action: "view_all" },
    { resource: "venues", action: "manage" },
    { resource: "admin", action: "manage_stores" },
  ],
  venuesManage: [
    { resource: "stores", action: "manage" },
    { resource: "venues", action: "manage" },
    { resource: "admin", action: "manage_stores" },
  ],
  auditRead: [
    { resource: "audit", action: "view_audit_logs" },
    { resource: "audit", action: "read" },
    { resource: "audit", action: "view_all" },
    { resource: "admin", action: "view_audit_logs" },
  ],
  documentsManage: [{ resource: "documents", action: "manage" }],
  invitesManage: [
    { resource: "invites", action: "view" },
    { resource: "invites", action: "create" },
  ],
  usersRead: [
    { resource: "users", action: "view_team" },
    { resource: "users", action: "view_all" },
  ],
  usersManage: [
    { resource: "users", action: "manage_users" },
    { resource: "users", action: "edit_all" },
    { resource: "users", action: "create" },
    { resource: "users", action: "deactivate" },
    { resource: "users", action: "reactivate" },
    { resource: "users", action: "view_all" },
  ],
  dashboardAdmin: [
    { resource: "reports", action: "view_all" },
    { resource: "dashboard", action: "view_all" },
  ],
} as const satisfies Record<string, Permission[]>;

