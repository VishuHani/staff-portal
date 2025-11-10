/**
 * Authentication Test Helpers
 * Utilities for mocking authentication and authorization
 */

import { vi } from "vitest";
import { testUsers, testRoles } from "./fixtures";

// ============================================================================
// MOCK AUTHENTICATION
// ============================================================================

/**
 * Mock the getCurrentUser function to return a specific test user
 */
export const mockGetCurrentUser = (userId: string | null) => {
  const authModule = vi.hoisted(() => ({
    getCurrentUser: vi.fn(),
  }));

  if (userId === null) {
    authModule.getCurrentUser.mockResolvedValue(null);
  } else {
    const user = Object.values(testUsers).find((u) => u.id === userId);
    if (!user) {
      throw new Error(`Test user not found: ${userId}`);
    }

    const role = testRoles[Object.keys(testRoles).find(
      (key) => testRoles[key as keyof typeof testRoles].id === user.roleId
    ) as keyof typeof testRoles];

    authModule.getCurrentUser.mockResolvedValue({
      ...user,
      role,
    });
  }

  return authModule;
};

/**
 * Mock Supabase auth client
 */
export const mockSupabaseAuth = (userId: string | null = null) => {
  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: userId
              ? {
                  id: userId,
                  email: testUsers[Object.keys(testUsers).find(
                    (key) => testUsers[key as keyof typeof testUsers].id === userId
                  ) as keyof typeof testUsers]?.email,
                }
              : null,
          },
          error: null,
        })
      ),
      signIn: vi.fn(() =>
        Promise.resolve({
          data: { user: null, session: null },
          error: null,
        })
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  };
};

// ============================================================================
// RBAC MOCKS
// ============================================================================

/**
 * Mock requireAuth to allow/deny access
 */
export const mockRequireAuth = (shouldPass: boolean = true) => {
  const rbacModule = vi.hoisted(() => ({
    requireAuth: vi.fn(),
  }));

  if (shouldPass) {
    rbacModule.requireAuth.mockResolvedValue(undefined);
  } else {
    rbacModule.requireAuth.mockRejectedValue(new Error("Unauthorized"));
  }

  return rbacModule;
};

/**
 * Mock requireAdmin to allow/deny admin access
 */
export const mockRequireAdmin = (shouldPass: boolean = true) => {
  const rbacModule = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
  }));

  if (shouldPass) {
    const adminUser = testUsers.admin;
    const adminRole = testRoles.admin;
    rbacModule.requireAdmin.mockResolvedValue({
      ...adminUser,
      role: adminRole,
    });
  } else {
    rbacModule.requireAdmin.mockRejectedValue(new Error("Forbidden"));
  }

  return rbacModule;
};

/**
 * Mock canAccess permission check
 */
export const mockCanAccess = (resource: string, action: string, shouldPass: boolean = true) => {
  const rbacModule = vi.hoisted(() => ({
    canAccess: vi.fn(),
  }));

  rbacModule.canAccess.mockResolvedValue(shouldPass);

  return rbacModule;
};

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

/**
 * Create a test context with authenticated user
 */
export const createAuthContext = (userId: string) => {
  const user = Object.values(testUsers).find((u) => u.id === userId);
  if (!user) {
    throw new Error(`Test user not found: ${userId}`);
  }

  const role = testRoles[Object.keys(testRoles).find(
    (key) => testRoles[key as keyof typeof testRoles].id === user.roleId
  ) as keyof typeof testRoles];

  return {
    user: {
      ...user,
      role,
    },
    isAuthenticated: true,
    isAdmin: role.name === "ADMIN",
    isManager: role.name === "MANAGER",
    isStaff: role.name === "STAFF",
  };
};

/**
 * Create an unauthenticated test context
 */
export const createUnauthenticatedContext = () => {
  return {
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isManager: false,
    isStaff: false,
  };
};
