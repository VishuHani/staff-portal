# Testing Documentation

This document provides comprehensive guidance on running, writing, and maintaining tests for the Staff Portal application.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Patterns](#test-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Staff Portal uses **Vitest** as its testing framework, chosen for its speed, modern API, and excellent TypeScript support. Our test suite covers:

- **576 passing tests** (585 total with 9 skipped)
- **Unit tests** for utilities, RBAC, and server actions
- **Integration tests** for venue isolation, multi-venue scenarios, admin access, and edge cases
- **Security-critical testing** for venue-based data isolation
- **Fast execution**: 196ms for all tests

### Test Statistics

```
Test Files: 12 passed (12)
Tests: 576 passed | 9 skipped (585)
Duration: 196ms (test execution)
Total: 1.51s (includes setup, collection, environment)
```

## Quick Start

### Installation

Testing dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### First Test Run

```bash
npm run test:run
```

You should see output like:

```
✓ __tests__/unit/lib/utils/venue.test.ts (69 tests)
✓ __tests__/unit/lib/rbac/access.test.ts (47 tests)
✓ __tests__/integration/venue-isolation.test.ts (32 tests)
...

Test Files  12 passed (12)
Tests       576 passed | 9 skipped (585)
Duration    196ms
```

## Test Structure

```
__tests__/
├── setup.ts                          # Global test configuration
├── helpers/                          # Test utilities
│   ├── fixtures.ts                   # Test data generators
│   ├── db.ts                         # Prisma mock utilities
│   └── auth.ts                       # Auth/RBAC mocks
├── unit/                             # Unit tests
│   ├── lib/
│   │   ├── utils/
│   │   │   └── venue.test.ts         # Venue utility tests (69 tests)
│   │   └── rbac/
│   │       └── access.test.ts        # RBAC tests (47 tests)
│   └── actions/                      # Server action tests
│       ├── posts.test.ts             # Posts actions (49 tests)
│       ├── comments.test.ts          # Comments actions (47 tests)
│       ├── messages.test.ts          # Messages actions (62 tests)
│       ├── conversations.test.ts     # Conversations (38 tests)
│       ├── time-off.test.ts          # Time-off (51 tests)
│       └── availability.test.ts      # Availability (50 tests)
└── integration/                      # Integration tests
    ├── venue-isolation.test.ts       # Venue isolation (32 tests)
    ├── multi-venue-users.test.ts     # Multi-venue (42 tests)
    ├── admin-access.test.ts          # Admin access (52 tests)
    └── edge-cases.test.ts            # Edge cases (46 tests)
```

## Running Tests

### All Tests

```bash
npm test                # Watch mode (reruns on file changes)
npm run test:run        # Run once (CI mode)
```

### Specific Test Files

```bash
npm test venue          # Run tests matching "venue"
npm test posts          # Run tests matching "posts"
npm test integration    # Run all integration tests
```

### With UI

```bash
npm run test:ui
```

Opens a browser-based UI at `http://localhost:51204` with:
- Visual test results
- File explorer
- Test filtering
- Code coverage visualization

### With Coverage

```bash
npm run test:coverage
```

Generates coverage report in `coverage/` directory. Coverage thresholds:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

### Watch Mode Shortcuts

When running `npm test`:
- `a` - Run all tests
- `f` - Run only failed tests
- `t` - Filter by test name
- `p` - Filter by file name
- `q` - Quit watch mode

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { functionToTest } from "@/path/to/function";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it("should do something specific", async () => {
    // Arrange
    const input = "test data";

    // Act
    const result = await functionToTest(input);

    // Assert
    expect(result).toBe("expected output");
  });
});
```

### Using Test Fixtures

```typescript
import { testUsers, testVenues, createPostFixture } from "@/__tests__/helpers/fixtures";

it("should work with test data", () => {
  // Use predefined test users
  const user = testUsers.user1; // User with Venues A & B
  const admin = testUsers.admin; // Admin user

  // Create custom test data
  const post = createPostFixture({
    authorId: user.id,
    content: "Test post",
  });

  // Your test logic here
});
```

### Mocking Prisma

```typescript
import { createMockPrisma } from "@/__tests__/helpers/db";

const mockPrisma = createMockPrisma();

// Mock a specific method
mockPrisma.user.findUnique.mockResolvedValue(testUsers.user1);

// Mock with custom logic
mockPrisma.post.findMany.mockImplementation((args) => {
  // Your custom logic
  return Promise.resolve([]);
});
```

### Mocking Authentication

```typescript
import { mockRequireAuth, mockCanAccess } from "@/__tests__/helpers/auth";

// Mock authenticated user
const getCurrentUser = mockRequireAuth(testUsers.user1.id);

// Mock permission check
const canAccess = mockCanAccess("posts", "create", true);

// Use in test
it("should require authentication", async () => {
  const user = await getCurrentUser();
  expect(user.id).toBe(testUsers.user1.id);
});
```

## Test Patterns

### Testing Server Actions

```typescript
import { getPosts } from "@/lib/actions/posts";
import { createMockPrisma } from "@/__tests__/helpers/db";

vi.mock("@/lib/db", () => ({
  db: createMockPrisma(),
}));

describe("getPosts", () => {
  it("should return posts from shared venue users", async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.post.findMany.mockResolvedValue([
      createPostFixture({ id: "post1" }),
    ]);

    const result = await getPosts({ userId: testUsers.user1.id });

    expect(result.success).toBe(true);
    expect(result.posts).toHaveLength(1);
  });

  it("should filter by venue", async () => {
    // Verify that Prisma query includes venue filtering
    await getPosts({ userId: testUsers.user1.id });

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          author: expect.objectContaining({
            venues: expect.any(Object),
          }),
        }),
      })
    );
  });
});
```

### Testing Venue Isolation

```typescript
it("should not show posts from other venues", async () => {
  // User 3 is in Venue A
  // User 2 is in Venue B
  // They should not see each other's posts

  const result = await getPosts({ userId: testUsers.user3.id });

  const authorIds = result.posts.map((p) => p.authorId);
  expect(authorIds).not.toContain(testUsers.user2.id);
});
```

### Testing RBAC Permissions

```typescript
it("should allow managers to delete comments", async () => {
  const manager = testUsers.user3; // Manager role

  const result = await deleteComment({
    id: "comment-id",
    userId: manager.id,
  });

  expect(result.success).toBe(true);
});

it("should prevent staff from deleting others' comments", async () => {
  const staff = testUsers.user1; // Staff role

  const result = await deleteComment({
    id: "other-user-comment-id",
    userId: staff.id,
  });

  expect(result.error).toBeTruthy();
});
```

### Testing Multi-Venue Scenarios

```typescript
it("should show data from all user's venues", async () => {
  // User 1 has Venues A and B
  const result = await getPosts({ userId: testUsers.user1.id });

  // Should see posts from users in both Venue A and Venue B
  const venueAUserIds = testUserVenues
    .filter((uv) => uv.venueId === testVenues.venueA.id)
    .map((uv) => uv.userId);

  const venueBUserIds = testUserVenues
    .filter((uv) => uv.venueId === testVenues.venueB.id)
    .map((uv) => uv.userId);

  const authorIds = result.posts.map((p) => p.authorId);

  // Should contain users from both venues
  expect(authorIds.some((id) => venueAUserIds.includes(id))).toBe(true);
  expect(authorIds.some((id) => venueBUserIds.includes(id))).toBe(true);
});
```

### Testing Edge Cases

```typescript
describe("Edge Cases", () => {
  it("should handle empty results", async () => {
    mockPrisma.post.findMany.mockResolvedValue([]);

    const result = await getPosts({ userId: testUsers.user1.id });

    expect(result.success).toBe(true);
    expect(result.posts).toEqual([]);
  });

  it("should handle null values", async () => {
    const postWithNulls = createPostFixture({
      mediaUrls: null,
      editedAt: null,
    });

    expect(postWithNulls.mediaUrls).toBeNull();
    expect(postWithNulls.editedAt).toBeNull();
  });

  it("should handle database errors", async () => {
    mockPrisma.post.findMany.mockRejectedValue(new Error("DB Error"));

    const result = await getPosts({ userId: testUsers.user1.id });

    expect(result.error).toBeTruthy();
  });
});
```

## Best Practices

### 1. Test Organization

```typescript
describe("Feature", () => {
  describe("functionName", () => {
    it("should handle happy path", () => {});
    it("should handle edge case", () => {});
    it("should handle error case", () => {});
  });
});
```

### 2. Test Naming

Use descriptive test names that explain the expected behavior:

✅ **Good:**
```typescript
it("should return posts from shared venue users only", () => {});
it("should prevent staff from deleting other users' comments", () => {});
```

❌ **Bad:**
```typescript
it("works", () => {});
it("test getPosts", () => {});
```

### 3. Arrange-Act-Assert Pattern

```typescript
it("should do something", () => {
  // Arrange - Set up test data and mocks
  const user = testUsers.user1;
  mockPrisma.user.findUnique.mockResolvedValue(user);

  // Act - Execute the function being tested
  const result = await functionToTest(user.id);

  // Assert - Verify the results
  expect(result).toBe(expected);
});
```

### 4. Mock Cleanup

```typescript
import { beforeEach, afterEach, vi } from "vitest";

describe("Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clear mock call history
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore original implementations
  });
});
```

### 5. Avoid Test Interdependence

Each test should be independent and not rely on state from other tests.

✅ **Good:**
```typescript
it("test 1", () => {
  const user = createUserFixture();
  // Test logic
});

it("test 2", () => {
  const user = createUserFixture();
  // Test logic
});
```

❌ **Bad:**
```typescript
let sharedUser; // Avoid shared mutable state

it("test 1", () => {
  sharedUser = createUserFixture();
});

it("test 2", () => {
  // Depends on test 1 running first
  expect(sharedUser).toBeDefined();
});
```

### 6. Test Security-Critical Code

Always test venue isolation and permission checks:

```typescript
describe("Security Tests", () => {
  it("should enforce venue boundaries", async () => {
    // User from Venue A should not see Venue B data
  });

  it("should check permissions before action", async () => {
    // Should return error if user lacks permission
  });

  it("should validate ownership", async () => {
    // Should prevent modifying other users' content
  });
});
```

### 7. Use Test Fixtures

Prefer test fixtures over creating data inline:

✅ **Good:**
```typescript
const user = testUsers.user1;
const venue = testVenues.venueA;
```

❌ **Bad:**
```typescript
const user = {
  id: "some-random-id",
  email: "test@example.com",
  // ... many more fields
};
```

## Troubleshooting

### Tests Failing Locally

1. **Clear test cache:**
   ```bash
   rm -rf node_modules/.vitest
   npm run test:run
   ```

2. **Check environment variables:**
   ```bash
   cat .env.test
   ```
   Should contain:
   ```
   DATABASE_URL="file:./test.db"
   NODE_ENV="test"
   ```

3. **Verify dependencies:**
   ```bash
   npm install
   ```

### Slow Test Execution

- Use `it.only()` to run a single test during development
- Check for unnecessary async operations
- Verify mocks are properly configured
- Use `--reporter=verbose` to see which tests are slow

### Mock Not Working

```typescript
// Make sure to import before the code being tested
vi.mock("@/lib/db", () => ({
  db: createMockPrisma(),
}));

// Import after mock setup
import { functionToTest } from "@/lib/actions/posts";
```

### Coverage Not Meeting Thresholds

```bash
# Run coverage report
npm run test:coverage

# Check coverage/index.html in browser
open coverage/index.html
```

Focus on testing:
- All branches (if/else statements)
- Error handling paths
- Edge cases

### Type Errors in Tests

Make sure `tsconfig.test.json` includes test files:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["__tests__/**/*", "vitest.config.ts"]
}
```

## Test Fixtures Reference

### Test Users

```typescript
testUsers.user1    // Venues A & B (Staff)
testUsers.user2    // Venue B (Staff)
testUsers.user3    // Venues A & C (Manager)
testUsers.user4    // Venue C only (Staff, inactive venue)
testUsers.user5    // No venues (Staff)
testUsers.admin    // All venues (Admin)
```

### Test Venues

```typescript
testVenues.venueA  // Active venue
testVenues.venueB  // Active venue
testVenues.venueC  // Inactive venue
```

### Test Roles

```typescript
testRoles.admin    // ADMIN role
testRoles.manager  // MANAGER role
testRoles.staff    // STAFF role
```

### Fixture Creators

```typescript
// Create custom test data
createUserFixture({ email: "custom@test.com" })
createVenueFixture({ name: "Custom Venue" })
createPostFixture({ content: "Test post" })
createCommentFixture({ content: "Test comment" })
createMessageFixture({ content: "Test message" })
createTimeOffRequestFixture({ status: "PENDING" })
createAvailabilityFixture({ dayOfWeek: 1 })
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run test:run
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Multi-Venue Architecture](./MultiVenueProgress.md)

## Support

For questions or issues with tests:
1. Check this documentation
2. Review existing test files for patterns
3. Ask the team in #engineering channel
4. Create a ticket with test reproduction steps

---

**Last Updated:** Phase 7 - Testing & Refinement Complete
**Test Count:** 576 passing | 9 skipped (585 total)
**Coverage:** 70%+ across all critical paths
