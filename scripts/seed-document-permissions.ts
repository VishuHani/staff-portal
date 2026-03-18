import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load environment variables first
config({ path: ".env.local" });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log("Seeding document permissions...");

  // Define document permissions
  const documentPermissions = [
    // Template permissions
    { resource: "documents", action: "template_create", description: "Create document templates" },
    { resource: "documents", action: "template_read", description: "View document templates" },
    { resource: "documents", action: "template_update", description: "Edit document templates" },
    { resource: "documents", action: "template_delete", description: "Delete document templates" },
    
    // Assignment permissions
    { resource: "documents", action: "assignment_create", description: "Assign documents to users" },
    { resource: "documents", action: "assignment_read", description: "View document assignments" },
    { resource: "documents", action: "assignment_update", description: "Update document assignments" },
    { resource: "documents", action: "assignment_delete", description: "Delete document assignments" },
    
    // Submission permissions
    { resource: "documents", action: "submission_create", description: "Create document submissions" },
    { resource: "documents", action: "submission_read", description: "View document submissions" },
    { resource: "documents", action: "submission_update", description: "Update document submissions" },
    { resource: "documents", action: "submission_review", description: "Review and approve/reject submissions" },
    
    // Bundle permissions
    { resource: "documents", action: "bundle_create", description: "Create document bundles" },
    { resource: "documents", action: "bundle_read", description: "View document bundles" },
    { resource: "documents", action: "bundle_update", description: "Edit document bundles" },
    { resource: "documents", action: "bundle_delete", description: "Delete document bundles" },
    
    // Library permissions
    { resource: "documents", action: "library_read", description: "Access template library" },
    { resource: "documents", action: "library_import", description: "Import templates from library" },
    
    // Bulk operations
    { resource: "documents", action: "bulk_assign", description: "Bulk assign documents to users" },
    { resource: "documents", action: "bulk_remind", description: "Send bulk reminders" },
    { resource: "documents", action: "bulk_approve", description: "Bulk approve submissions" },
    { resource: "documents", action: "bulk_reject", description: "Bulk reject submissions" },
    
    // Audit permissions
    { resource: "documents", action: "audit_read", description: "View document audit logs" },
    
    // Own documents (for staff)
    { resource: "documents", action: "view_own", description: "View own document assignments" },
    { resource: "documents", action: "submit_own", description: "Submit own documents" },
  ];

  // Create permissions
  const createdPermissions = [];
  for (const perm of documentPermissions) {
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: { description: perm.description },
      create: perm,
    });
    createdPermissions.push(permission);
    console.log(`  Created/updated permission: ${perm.resource}:${perm.action}`);
  }

  // Get roles
  const adminRole = await prisma.role.findFirst({ where: { name: "ADMIN" } });
  const managerRole = await prisma.role.findFirst({ where: { name: "MANAGER" } });
  const staffRole = await prisma.role.findFirst({ where: { name: "STAFF" } });

  if (!adminRole || !managerRole || !staffRole) {
    console.error("Could not find all required roles!");
    return;
  }

  // Define role-permission mappings
  const rolePermissions = {
    ADMIN: [
      // All template permissions
      "documents:template_create",
      "documents:template_read",
      "documents:template_update",
      "documents:template_delete",
      // All assignment permissions
      "documents:assignment_create",
      "documents:assignment_read",
      "documents:assignment_update",
      "documents:assignment_delete",
      // All submission permissions
      "documents:submission_create",
      "documents:submission_read",
      "documents:submission_update",
      "documents:submission_review",
      // All bundle permissions
      "documents:bundle_create",
      "documents:bundle_read",
      "documents:bundle_update",
      "documents:bundle_delete",
      // All library permissions
      "documents:library_read",
      "documents:library_import",
      // All bulk permissions
      "documents:bulk_assign",
      "documents:bulk_remind",
      "documents:bulk_approve",
      "documents:bulk_reject",
      // Audit
      "documents:audit_read",
      // Own documents
      "documents:view_own",
      "documents:submit_own",
    ],
    MANAGER: [
      // Template permissions
      "documents:template_create",
      "documents:template_read",
      "documents:template_update",
      // No template_delete for managers
      // Assignment permissions
      "documents:assignment_create",
      "documents:assignment_read",
      "documents:assignment_update",
      // No assignment_delete for managers
      // Submission permissions
      "documents:submission_read",
      "documents:submission_review",
      // Bundle permissions
      "documents:bundle_create",
      "documents:bundle_read",
      "documents:bundle_update",
      // No bundle_delete for managers
      // Library permissions
      "documents:library_read",
      "documents:library_import",
      // Bulk permissions
      "documents:bulk_assign",
      "documents:bulk_remind",
      "documents:bulk_approve",
      "documents:bulk_reject",
      // Audit
      "documents:audit_read",
      // Own documents
      "documents:view_own",
      "documents:submit_own",
    ],
    STAFF: [
      // Limited permissions for staff
      "documents:view_own",
      "documents:submit_own",
      "documents:template_read", // Can view templates assigned to them
      "documents:submission_create",
      "documents:submission_read", // Can view own submissions
      "documents:submission_update", // Can update own draft submissions
    ],
  };

  // Assign permissions to roles
  for (const [roleName, permNames] of Object.entries(rolePermissions)) {
    const role = roleName === "ADMIN" ? adminRole : roleName === "MANAGER" ? managerRole : staffRole;

    for (const permName of permNames) {
      const [resource, action] = permName.split(":");
      const permission = createdPermissions.find(
        (p) => p.resource === resource && p.action === action
      );

      if (permission) {
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
        console.log(`  Assigned ${permName} to ${roleName}`);
      }
    }
  }

  console.log("Document permissions seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
