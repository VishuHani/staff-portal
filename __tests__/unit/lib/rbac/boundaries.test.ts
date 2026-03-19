import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd());
const readSource = (relativePath: string) =>
  readFileSync(resolve(repoRoot, relativePath), "utf8");

describe("rbac boundaries", () => {
  it("keeps shared types isolated from runtime helpers", () => {
    const permissions = readSource("src/lib/rbac/permissions.ts");
    const access = readSource("src/lib/rbac/access.ts");
    const emailWorkspace = readSource("src/lib/rbac/email-workspace.ts");
    const barrelImport = /from\s+["']@\/lib\/rbac["']/;

    expect(barrelImport.test(permissions)).toBe(false);
    expect(barrelImport.test(access)).toBe(false);
    expect(barrelImport.test(emailWorkspace)).toBe(false);
    expect(permissions).toContain("./types");
    expect(access).toContain("./types");
    expect(emailWorkspace).toContain("./types");
  });
});
