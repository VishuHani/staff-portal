import { describe, expect, it } from "vitest";
import {
  DEFAULT_ALLOWED_AUDIENCE_SOURCES,
  validateAudienceSql,
} from "@/lib/email-workspace/sql-guard";

describe("Audience SQL Guard", () => {
  it("accepts a single SELECT query against allowed sources", () => {
    const result = validateAudienceSql(
      "SELECT id, email FROM audience_users_view LIMIT 100",
      DEFAULT_ALLOWED_AUDIENCE_SOURCES
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.referencedSources).toContain("audience_users_view");
  });

  it("rejects non-SELECT statements", () => {
    const result = validateAudienceSql(
      "UPDATE users SET active = false",
      DEFAULT_ALLOWED_AUDIENCE_SOURCES
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("SELECT/CTE"))).toBe(true);
  });

  it("rejects multiple statements", () => {
    const result = validateAudienceSql(
      "SELECT * FROM audience_users_view; SELECT * FROM audience_user_roles_view;",
      DEFAULT_ALLOWED_AUDIENCE_SOURCES
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Only a single SQL statement is allowed.");
  });

  it("rejects disallowed sources", () => {
    const result = validateAudienceSql(
      "SELECT * FROM users LIMIT 10",
      DEFAULT_ALLOWED_AUDIENCE_SOURCES
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("non-whitelisted sources"))).toBe(true);
  });

  it("warns when query has no LIMIT clause", () => {
    const result = validateAudienceSql(
      "SELECT id, email FROM audience_users_view",
      DEFAULT_ALLOWED_AUDIENCE_SOURCES
    );

    expect(result.valid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("No LIMIT clause"))).toBe(true);
  });

  it("strips comments before validation", () => {
    const result = validateAudienceSql(
      `
      -- fetch records
      SELECT id, email
      FROM audience_users_view
      /* enforce row cap */
      LIMIT 25
      `,
      DEFAULT_ALLOWED_AUDIENCE_SOURCES
    );

    expect(result.valid).toBe(true);
    expect(result.normalizedSql.startsWith("SELECT id, email FROM audience_users_view")).toBe(true);
  });
});
