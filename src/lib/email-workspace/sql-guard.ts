export interface SqlValidationResult {
  valid: boolean;
  normalizedSql: string;
  errors: string[];
  warnings: string[];
  referencedSources: string[];
}

const BANNED_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "truncate",
  "alter",
  "create",
  "grant",
  "revoke",
  "comment",
  "vacuum",
  "analyze",
  "copy",
  "merge",
  "call",
  "execute",
];

const DISALLOWED_SOURCES = [
  "information_schema",
  "pg_catalog",
  "pg_toast",
  "pg_temp",
  "pg_internal",
];

export const DEFAULT_ALLOWED_AUDIENCE_SOURCES = [
  "audience_users_view",
  "audience_user_venues_view",
  "audience_user_roles_view",
  "audience_user_preferences_view",
];

function stripComments(sql: string): string {
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlockComments.replace(/--.*$/gm, " ");
}

function collapseWhitespace(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

function extractReferencedSources(sql: string): string[] {
  const matches = [...sql.matchAll(/\b(?:from|join)\s+([a-zA-Z0-9_.]+)/gi)];
  const sources = matches.map((match) => match[1].toLowerCase());
  return [...new Set(sources)];
}

function hasOnlySingleStatement(sql: string): boolean {
  const cleaned = sql.trim();
  const semicolons = cleaned.split(";").length - 1;
  if (semicolons === 0) return true;
  if (semicolons === 1 && cleaned.endsWith(";")) return true;
  return false;
}

export function validateAudienceSql(
  sql: string,
  allowedSources: string[] = DEFAULT_ALLOWED_AUDIENCE_SOURCES
): SqlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!sql || !sql.trim()) {
    return {
      valid: false,
      normalizedSql: "",
      errors: ["SQL query is required."],
      warnings,
      referencedSources: [],
    };
  }

  const stripped = stripComments(sql);
  const normalizedSql = collapseWhitespace(stripped);
  const lowered = normalizedSql.toLowerCase();

  if (!hasOnlySingleStatement(normalizedSql)) {
    errors.push("Only a single SQL statement is allowed.");
  }

  if (!(lowered.startsWith("select ") || lowered.startsWith("with "))) {
    errors.push("Only SELECT/CTE queries are allowed.");
  }

  for (const keyword of BANNED_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(lowered)) {
      errors.push(`Keyword '${keyword.toUpperCase()}' is not allowed in audience SQL.`);
    }
  }

  const referencedSources = extractReferencedSources(lowered);

  for (const source of referencedSources) {
    if (DISALLOWED_SOURCES.some((blocked) => source.startsWith(blocked))) {
      errors.push(`Source '${source}' is not allowed.`);
    }
  }

  const allowed = new Set(allowedSources.map((source) => source.toLowerCase()));
  const unauthorizedSources = referencedSources.filter((source) => {
    const base = source.includes(".") ? source.split(".").pop() || source : source;
    return !allowed.has(source) && !allowed.has(base);
  });

  if (unauthorizedSources.length > 0) {
    errors.push(
      `Query references non-whitelisted sources: ${unauthorizedSources.join(", ")}.`
    );
  }

  if (!/\blimit\s+\d+/i.test(lowered)) {
    warnings.push("No LIMIT clause found. Consider adding LIMIT for safer previews.");
  }

  return {
    valid: errors.length === 0,
    normalizedSql,
    errors,
    warnings,
    referencedSources,
  };
}
