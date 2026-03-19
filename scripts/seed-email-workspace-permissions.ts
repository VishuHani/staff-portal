/**
 * Seed Email Workspace Permissions
 *
 * Adds permission resources for the unified Emails workspace:
 * - email_workspace
 * - email_create
 * - email_assets
 * - email_audience
 * - email_campaigns
 * - email_reports
 *
 * This script is additive only. It does not remove existing permissions.
 */

import { prisma } from "../src/lib/prisma";
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });

type PermissionSeed = {
  resource: string;
  action: string;
  description: string;
};

const EMAIL_WORKSPACE_PERMISSIONS: PermissionSeed[] = [
  { resource: "email_workspace", action: "view", description: "Access Emails workspace root" },
  { resource: "email_workspace", action: "manage", description: "Manage Emails workspace configuration" },

  { resource: "email_create", action: "view", description: "View email builder module" },
  { resource: "email_create", action: "create", description: "Create and draft emails" },
  { resource: "email_create", action: "update", description: "Edit saved emails" },
  { resource: "email_create", action: "delete", description: "Delete emails and templates" },
  { resource: "email_create", action: "manage", description: "Manage all email creation settings" },

  { resource: "email_assets", action: "view", description: "View email assets" },
  { resource: "email_assets", action: "create", description: "Upload and create assets" },
  { resource: "email_assets", action: "update", description: "Edit asset metadata and folder placement" },
  { resource: "email_assets", action: "delete", description: "Delete assets" },
  { resource: "email_assets", action: "manage", description: "Manage asset library settings" },

  { resource: "email_audience", action: "view", description: "View audience lists" },
  { resource: "email_audience", action: "read", description: "Run audience list previews" },
  { resource: "email_audience", action: "create", description: "Create audience segments and lists" },
  { resource: "email_audience", action: "update", description: "Edit audience lists" },
  { resource: "email_audience", action: "delete", description: "Delete audience lists" },
  { resource: "email_audience", action: "manage", description: "Manage audience SQL/filter capabilities" },

  { resource: "email_campaigns", action: "view", description: "View email campaigns" },
  { resource: "email_campaigns", action: "create", description: "Create campaign drafts" },
  { resource: "email_campaigns", action: "update", description: "Edit campaign drafts and settings" },
  { resource: "email_campaigns", action: "send", description: "Send campaigns immediately" },
  { resource: "email_campaigns", action: "schedule", description: "Schedule one-off and recurring campaigns" },
  { resource: "email_campaigns", action: "approve", description: "Approve campaigns for send" },
  { resource: "email_campaigns", action: "cancel", description: "Cancel scheduled campaigns" },
  { resource: "email_campaigns", action: "delete", description: "Delete campaigns" },
  { resource: "email_campaigns", action: "manage", description: "Manage campaign operations and policy" },

  { resource: "email_reports", action: "view", description: "View email report dashboards" },
  { resource: "email_reports", action: "create", description: "Create custom email report definitions" },
  { resource: "email_reports", action: "schedule", description: "Schedule recurring report runs" },
  { resource: "email_reports", action: "export", description: "Export email reports" },
  { resource: "email_reports", action: "manage", description: "Manage report templates and delivery settings" },
];

const MANAGER_PERMISSION_KEYS = new Set([
  "email_workspace:view",
  "email_create:view",
  "email_create:create",
  "email_create:update",
  "email_assets:view",
  "email_assets:create",
  "email_assets:update",
  "email_audience:view",
  "email_audience:read",
  "email_audience:create",
  "email_audience:update",
  "email_campaigns:view",
  "email_campaigns:create",
  "email_campaigns:update",
  "email_campaigns:send",
  "email_campaigns:schedule",
  "email_campaigns:cancel",
  "email_reports:view",
  "email_reports:create",
  "email_reports:schedule",
  "email_reports:export",
]);

async function seedPermissions() {
  const created = [];

  for (const permission of EMAIL_WORKSPACE_PERMISSIONS) {
    const saved = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: permission.resource,
          action: permission.action,
        },
      },
      update: {
        description: permission.description,
      },
      create: {
        resource: permission.resource,
        action: permission.action,
        description: permission.description,
      },
    });

    created.push(saved);
    console.log(`  upserted ${permission.resource}:${permission.action}`);
  }

  return created;
}

async function assignRolePermissions(
  roleName: "ADMIN" | "MANAGER",
  permissions: Array<{ id: string; resource: string; action: string }>
) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    throw new Error(`Role ${roleName} not found`);
  }

  const assignable =
    roleName === "ADMIN"
      ? permissions
      : permissions.filter((permission) =>
          MANAGER_PERMISSION_KEYS.has(`${permission.resource}:${permission.action}`)
        );

  for (const permission of assignable) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  console.log(`  assigned ${assignable.length} permissions to ${roleName}`);
}

async function main() {
  console.log("Seeding email workspace permissions...\n");

  const permissions = await seedPermissions();
  await assignRolePermissions("ADMIN", permissions);
  await assignRolePermissions("MANAGER", permissions);

  console.log("\nEmail workspace permissions seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Error seeding email workspace permissions:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
