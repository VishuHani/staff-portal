/**
 * RBAC Access Control Tests
 * Comprehensive tests for access control functions in src/lib/rbac/access.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testUsers, testRoles } from "../../../helpers/fixtures";
import { createMockPrisma } from "../../../helpers/db";

// Mock dependencies - redirect throws an error in Next.js
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT: ${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}));

// Mock getCurrentUser
const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

// Mock Prisma - create inline to avoid hoisting issues
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn((callback: any) => callback(mockPrisma)),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import {
  requireAuth,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  requireAdmin,
  requireManager,
  canAccess,
  canAccessAdmin,
  canAccessManager,
} from "@/lib/rbac/access";

import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdmin,
  isManager,
} from "@/lib/rbac/permissions";

describe("RBAC Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("requireAuth()", () => {
    it("should allow authenticated active users", async () => {
      const user = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      const result = await requireAuth();

      expect(result).toEqual(user);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should redirect unauthenticated users to login", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT: /login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("should redirect inactive users to login with error", async () => {
      const inactiveUser = {
        ...testUsers.user1,
        active: false,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(inactiveUser);

      await expect(requireAuth()).rejects.toThrow("NEXT_REDIRECT: /login?error=inactive");
      expect(mockRedirect).toHaveBeenCalledWith("/login?error=inactive");
    });

    it("should return user object with role", async () => {
      const user = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      const result = await requireAuth();

      expect(result).toEqual(user);
      expect(result.role).toBeDefined();
      expect(result.role.name).toBe("ADMIN");
    });
  });

  describe("requireAdmin()", () => {
    it("should allow ADMIN role users", async () => {
      const adminUser = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(adminUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...adminUser,
        active: true,
        role: testRoles.admin,
      });

      const result = await requireAdmin();

      expect(result).toEqual(adminUser);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should reject MANAGER role users", async () => {
      const managerUser = {
        ...testUsers.user3,
        role: testRoles.manager,
      };
      mockGetCurrentUser.mockResolvedValue(managerUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...managerUser,
        active: true,
        role: testRoles.manager,
      });

      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT: /dashboard?error=forbidden");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard?error=forbidden");
    });

    it("should reject STAFF role users", async () => {
      const staffUser = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(staffUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...staffUser,
        active: true,
        role: testRoles.staff,
      });

      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT: /dashboard?error=forbidden");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard?error=forbidden");
    });

    it("should reject unauthenticated users", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT: /login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("should return admin user object", async () => {
      const adminUser = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(adminUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...adminUser,
        active: true,
        role: testRoles.admin,
      });

      const result = await requireAdmin();

      expect(result).toEqual(adminUser);
      expect(result.role.name).toBe("ADMIN");
    });

    it("should reject inactive admin users", async () => {
      const inactiveAdmin = {
        ...testUsers.admin,
        active: false,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(inactiveAdmin);

      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT: /login?error=inactive");
      expect(mockRedirect).toHaveBeenCalledWith("/login?error=inactive");
    });
  });

  describe("requireManager()", () => {
    it("should allow ADMIN role users", async () => {
      const adminUser = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(adminUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...adminUser,
        active: true,
        role: testRoles.admin,
      });

      const result = await requireManager();

      expect(result).toEqual(adminUser);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should allow MANAGER role users", async () => {
      const managerUser = {
        ...testUsers.user3,
        role: testRoles.manager,
      };
      mockGetCurrentUser.mockResolvedValue(managerUser);

      // Mock isManager to return true
      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...managerUser,
        active: true,
        role: {
          ...testRoles.manager,
          rolePermissions: [
            {
              permission: {
                resource: "timeoff",
                action: "manage",
              },
            },
          ],
        },
      });

      const result = await requireManager();

      expect(result).toEqual(managerUser);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should reject STAFF role users", async () => {
      const staffUser = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(staffUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...staffUser,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
          ],
        },
      });

      await expect(requireManager()).rejects.toThrow("NEXT_REDIRECT: /dashboard?error=forbidden");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard?error=forbidden");
    });

    it("should reject unauthenticated users", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      await expect(requireManager()).rejects.toThrow("NEXT_REDIRECT: /login");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("requirePermission()", () => {
    it("should allow users with required permission", async () => {
      const user = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.admin,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "create",
              },
            },
          ],
        },
      });

      const result = await requirePermission("posts", "create");

      expect(result).toEqual(user);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should reject users without required permission", async () => {
      const user = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
          ],
        },
      });

      await expect(requirePermission("posts", "delete")).rejects.toThrow("NEXT_REDIRECT: /dashboard?error=forbidden");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard?error=forbidden");
    });
  });

  describe("requireAllPermissions()", () => {
    it("should allow users with all required permissions", async () => {
      const user = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.admin,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
            {
              permission: {
                resource: "posts",
                action: "create",
              },
            },
            {
              permission: {
                resource: "posts",
                action: "delete",
              },
            },
          ],
        },
      });

      const permissions = [
        { resource: "posts" as const, action: "read" as const },
        { resource: "posts" as const, action: "create" as const },
        { resource: "posts" as const, action: "delete" as const },
      ];

      const result = await requireAllPermissions(permissions);

      expect(result).toEqual(user);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should reject users missing any required permission", async () => {
      const user = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
            {
              permission: {
                resource: "posts",
                action: "create",
              },
            },
          ],
        },
      });

      const permissions = [
        { resource: "posts" as const, action: "read" as const },
        { resource: "posts" as const, action: "create" as const },
        { resource: "posts" as const, action: "delete" as const },
      ];

      await expect(requireAllPermissions(permissions)).rejects.toThrow("NEXT_REDIRECT: /dashboard?error=forbidden");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard?error=forbidden");
    });
  });

  describe("requireAnyPermission()", () => {
    it("should allow users with at least one required permission", async () => {
      const user = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
          ],
        },
      });

      const permissions = [
        { resource: "posts" as const, action: "read" as const },
        { resource: "posts" as const, action: "delete" as const },
      ];

      const result = await requireAnyPermission(permissions);

      expect(result).toEqual(user);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("should reject users with none of the required permissions", async () => {
      const user = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
          ],
        },
      });

      const permissions = [
        { resource: "posts" as const, action: "delete" as const },
        { resource: "posts" as const, action: "manage" as const },
      ];

      await expect(requireAnyPermission(permissions)).rejects.toThrow("NEXT_REDIRECT: /dashboard?error=forbidden");
      expect(mockRedirect).toHaveBeenCalledWith("/dashboard?error=forbidden");
    });
  });

  describe("canAccess()", () => {
    it("should return true when user has permission", async () => {
      const user = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.admin,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "create",
              },
            },
          ],
        },
      });

      const result = await canAccess("posts", "create");

      expect(result).toBe(true);
    });

    it("should return false when user lacks permission", async () => {
      const user = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(user);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...user,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
          ],
        },
      });

      const result = await canAccess("posts", "delete");

      expect(result).toBe(false);
    });

    it("should return false for unauthenticated users", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await canAccess("posts", "read");

      expect(result).toBe(false);
    });

    it("should return false and log error on exception", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetCurrentUser.mockRejectedValue(new Error("Database error"));

      const result = await canAccess("posts", "read");

      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Error checking access:",
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe("canAccessAdmin()", () => {
    it("should return true for admin users", async () => {
      const adminUser = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(adminUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...adminUser,
        active: true,
        role: testRoles.admin,
      });

      const result = await canAccessAdmin();

      expect(result).toBe(true);
    });

    it("should return false for non-admin users", async () => {
      const staffUser = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(staffUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...staffUser,
        active: true,
        role: testRoles.staff,
      });

      const result = await canAccessAdmin();

      expect(result).toBe(false);
    });

    it("should return false for unauthenticated users", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await canAccessAdmin();

      expect(result).toBe(false);
    });

    it("should return false and log error on exception", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetCurrentUser.mockRejectedValue(new Error("Database error"));

      const result = await canAccessAdmin();

      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Error checking admin access:",
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe("canAccessManager()", () => {
    it("should return true for admin users", async () => {
      const adminUser = {
        ...testUsers.admin,
        role: testRoles.admin,
      };
      mockGetCurrentUser.mockResolvedValue(adminUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...adminUser,
        active: true,
        role: testRoles.admin,
      });

      const result = await canAccessManager();

      expect(result).toBe(true);
    });

    it("should return true for manager users", async () => {
      const managerUser = {
        ...testUsers.user3,
        role: testRoles.manager,
      };
      mockGetCurrentUser.mockResolvedValue(managerUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...managerUser,
        active: true,
        role: {
          ...testRoles.manager,
          rolePermissions: [
            {
              permission: {
                resource: "timeoff",
                action: "manage",
              },
            },
          ],
        },
      });

      const result = await canAccessManager();

      expect(result).toBe(true);
    });

    it("should return false for staff users", async () => {
      const staffUser = {
        ...testUsers.user1,
        role: testRoles.staff,
      };
      mockGetCurrentUser.mockResolvedValue(staffUser);

      mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
        ...staffUser,
        active: true,
        role: {
          ...testRoles.staff,
          rolePermissions: [
            {
              permission: {
                resource: "posts",
                action: "read",
              },
            },
          ],
        },
      });

      const result = await canAccessManager();

      expect(result).toBe(false);
    });

    it("should return false for unauthenticated users", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const result = await canAccessManager();

      expect(result).toBe(false);
    });

    it("should return false and log error on exception", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetCurrentUser.mockRejectedValue(new Error("Database error"));

      const result = await canAccessManager();

      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Error checking manager access:",
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe("Permission checking for specific resources", () => {
    describe("posts permissions", () => {
      it("should check posts:read permission", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "posts",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("posts", "read");
        expect(result).toBe(true);
      });

      it("should check posts:create permission", async () => {
        const user = {
          ...testUsers.admin,
          role: testRoles.admin,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.admin,
            rolePermissions: [
              {
                permission: {
                  resource: "posts",
                  action: "create",
                },
              },
            ],
          },
        });

        const result = await canAccess("posts", "create");
        expect(result).toBe(true);
      });

      it("should check posts:delete permission", async () => {
        const user = {
          ...testUsers.admin,
          role: testRoles.admin,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.admin,
            rolePermissions: [
              {
                permission: {
                  resource: "posts",
                  action: "delete",
                },
              },
            ],
          },
        });

        const result = await canAccess("posts", "delete");
        expect(result).toBe(true);
      });
    });

    describe("messages permissions", () => {
      it("should check messages:read permission", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "messages",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("messages", "read");
        expect(result).toBe(true);
      });

      it("should check messages:create permission", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "messages",
                  action: "create",
                },
              },
            ],
          },
        });

        const result = await canAccess("messages", "create");
        expect(result).toBe(true);
      });
    });

    describe("timeoff permissions", () => {
      it("should check timeoff:read permission", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "timeoff",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("timeoff", "read");
        expect(result).toBe(true);
      });

      it("should check timeoff:manage permission for managers", async () => {
        const user = {
          ...testUsers.user3,
          role: testRoles.manager,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.manager,
            rolePermissions: [
              {
                permission: {
                  resource: "timeoff",
                  action: "manage",
                },
              },
            ],
          },
        });

        const result = await canAccess("timeoff", "manage");
        expect(result).toBe(true);
      });

      it("should deny timeoff:manage permission for staff", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "timeoff",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("timeoff", "manage");
        expect(result).toBe(false);
      });
    });

    describe("availability permissions", () => {
      it("should check availability:read permission", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "availability",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("availability", "read");
        expect(result).toBe(true);
      });

      it("should check availability:manage permission for managers", async () => {
        const user = {
          ...testUsers.user3,
          role: testRoles.manager,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.manager,
            rolePermissions: [
              {
                permission: {
                  resource: "availability",
                  action: "manage",
                },
              },
            ],
          },
        });

        const result = await canAccess("availability", "manage");
        expect(result).toBe(true);
      });
    });

    describe("users permissions (admin only)", () => {
      it("should allow admin users:read permission", async () => {
        const user = {
          ...testUsers.admin,
          role: testRoles.admin,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.admin,
            rolePermissions: [
              {
                permission: {
                  resource: "users",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("users", "read");
        expect(result).toBe(true);
      });

      it("should allow admin users:create permission", async () => {
        const user = {
          ...testUsers.admin,
          role: testRoles.admin,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.admin,
            rolePermissions: [
              {
                permission: {
                  resource: "users",
                  action: "create",
                },
              },
            ],
          },
        });

        const result = await canAccess("users", "create");
        expect(result).toBe(true);
      });

      it("should allow admin users:delete permission", async () => {
        const user = {
          ...testUsers.admin,
          role: testRoles.admin,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.admin,
            rolePermissions: [
              {
                permission: {
                  resource: "users",
                  action: "delete",
                },
              },
            ],
          },
        });

        const result = await canAccess("users", "delete");
        expect(result).toBe(true);
      });

      it("should deny staff users:delete permission", async () => {
        const user = {
          ...testUsers.user1,
          role: testRoles.staff,
        };
        mockGetCurrentUser.mockResolvedValue(user);

        mockPrisma.user.findUnique = vi.fn().mockResolvedValue({
          ...user,
          active: true,
          role: {
            ...testRoles.staff,
            rolePermissions: [
              {
                permission: {
                  resource: "posts",
                  action: "read",
                },
              },
            ],
          },
        });

        const result = await canAccess("users", "delete");
        expect(result).toBe(false);
      });
    });
  });
});
