"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Database, Play, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FolderManagerClient } from "@/components/email-workspace/folder-manager-client";
import { validateAudienceSqlInput } from "@/lib/actions/email-workspace/audience-sql";
import {
  createAudienceList,
  deleteAudienceList,
  listAudienceLists,
  runAudienceList,
  type AudienceListSummary,
} from "@/lib/actions/email-workspace/audience-lists";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import {
  DEFAULT_ALLOWED_AUDIENCE_SOURCES,
  type SqlValidationResult,
} from "@/lib/email-workspace/sql-guard";

const SQL_PRESETS = [
  {
    label: "Active Users",
    sql: "SELECT id, email FROM audience_users_view WHERE status = 'ACTIVE' LIMIT 200",
  },
  {
    label: "Venue Members",
    sql: "SELECT user_id, venue_id FROM audience_user_venues_view WHERE active = true LIMIT 200",
  },
  {
    label: "Managers",
    sql: "SELECT user_id, role_name FROM audience_user_roles_view WHERE role_name = 'MANAGER' LIMIT 100",
  },
];

function flattenFolderOptions(
  nodes: EmailFolderNode[],
  depth: number = 0
): Array<{ id: string; label: string }> {
  const rows: Array<{ id: string; label: string }> = [];

  for (const node of nodes) {
    rows.push({
      id: node.id,
      label: `${"-- ".repeat(depth)}${node.name}`,
    });
    rows.push(...flattenFolderOptions(node.children, depth + 1));
  }

  return rows;
}

export function AudienceWorkbenchClient() {
  const [sql, setSql] = useState(SQL_PRESETS[0].sql);
  const [result, setResult] = useState<SqlValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, startValidation] = useTransition();
  const [isSavingList, startSaveList] = useTransition();
  const [audienceLists, setAudienceLists] = useState<AudienceListSummary[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [runningListId, setRunningListId] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  const [listName, setListName] = useState("");
  const [listDescription, setListDescription] = useState("");
  const [listQueryType, setListQueryType] = useState<"SQL" | "FILTER" | "AI_FILTER">("SQL");
  const [listScope, setListScope] = useState<"PRIVATE" | "TEAM" | "SYSTEM">("PRIVATE");
  const [listFolderId, setListFolderId] = useState<string>("none");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [listSearch, setListSearch] = useState("");
  const [listFolderFilter, setListFolderFilter] = useState<string>("all");
  const [listTypeFilter, setListTypeFilter] = useState<"ALL" | "SQL" | "FILTER" | "AI_FILTER">("ALL");
  const [listError, setListError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<"ALL" | "ADMIN" | "MANAGER" | "STAFF">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ANY" | "ACTIVE" | "INACTIVE">("ANY");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterLimit, setFilterLimit] = useState("500");
  const [aiPrompt, setAiPrompt] = useState("");

  const hasBlockingErrors = useMemo(() => (result ? result.errors.length > 0 : false), [result]);

  useEffect(() => {
    void loadFolders();
  }, []);

  const loadAudienceLists = useCallback(async () => {
    setListsLoading(true);
    setListError(null);
    try {
      const response = await listAudienceLists({
        search: listSearch.trim() || undefined,
        folderId: listFolderFilter === "all" ? undefined : listFolderFilter,
        queryType: listTypeFilter,
      });

      if (!response.success || !response.lists) {
        const message = response.error || "Failed to load audience lists.";
        setListError(message);
        setAudienceLists([]);
        return;
      }

      setAudienceLists(response.lists);
    } catch (listLoadError) {
      console.error("Error loading audience lists:", listLoadError);
      setListError("Failed to load audience lists.");
      setAudienceLists([]);
    } finally {
      setListsLoading(false);
    }
  }, [listFolderFilter, listSearch, listTypeFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadAudienceLists();
    }, 200);
    return () => clearTimeout(timeout);
  }, [loadAudienceLists]);

  function handleUsePreset(value: string) {
    setSql(value);
    setError(null);
    setResult(null);
  }

  function handleValidate() {
    startValidation(async () => {
      setError(null);

      const response = await validateAudienceSqlInput({ sql });

      if (!response.success || !response.validation) {
        const message = response.error || "SQL validation failed.";
        setResult(null);
        setError(message);
        toast.error(message);
        return;
      }

      setResult(response.validation);

      if (response.validation.valid) {
        toast.success("SQL query passed validation.");
      } else {
        toast.warning("SQL query has validation issues.");
      }
    });
  }

  async function loadFolders() {
    try {
      const response = await listFolderTree({ module: "audience" });
      if (!response.success || !response.tree) {
        return;
      }

      setFolderOptions(flattenFolderOptions(response.tree));
    } catch (folderError) {
      console.error("Error loading audience folders:", folderError);
    }
  }

  function handleCreateAudienceList() {
    const trimmedName = listName.trim();
    if (!trimmedName) {
      toast.error("Audience list name is required.");
      return;
    }

    if (listQueryType === "SQL" && !sql.trim()) {
      toast.error("SQL text is required for SQL list mode.");
      return;
    }

    if (listQueryType === "SQL" && result && !result.valid) {
      toast.error("Fix SQL validation errors before saving this list.");
      return;
    }

    if (listQueryType === "AI_FILTER" && !aiPrompt.trim()) {
      toast.error("AI prompt is required for AI Filter mode.");
      return;
    }

    startSaveList(async () => {
      const parsedLimit = Number.parseInt(filterLimit, 10);
      const normalizedLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 2000)) : 500;

      const baseFilter = {
        roleNames: filterRole === "ALL" ? [] : [filterRole],
        activeStatus: filterStatus,
        search: filterSearch.trim() || null,
        limit: normalizedLimit,
      };

      const response = await createAudienceList({
        name: trimmedName,
        description: listDescription.trim() || undefined,
        queryType: listQueryType,
        sqlText: listQueryType === "SQL" ? sql : undefined,
        filterJson:
          listQueryType === "SQL"
            ? undefined
            : listQueryType === "AI_FILTER"
              ? {
                  mode: "AI_FILTER",
                  aiPrompt: aiPrompt.trim(),
                  filters: baseFilter,
                }
            : {
                mode: "FILTER",
                filters: baseFilter,
              },
        folderId: listFolderId === "none" ? undefined : listFolderId,
        scope: listScope,
      });

      if (!response.success || !response.list) {
        toast.error(response.error || "Failed to create audience list.");
        return;
      }

      toast.success("Audience list created.");
      setListName("");
      setListDescription("");
      setListFolderId("none");
      setFilterRole("ALL");
      setFilterStatus("ANY");
      setFilterSearch("");
      setFilterLimit("500");
      setAiPrompt("");
      await loadAudienceLists();
    });
  }

  async function handleRunAudienceList(id: string) {
    setRunningListId(id);
    try {
      const response = await runAudienceList({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to run audience list.");
        return;
      }

      toast.success("Audience list run completed.");
      await loadAudienceLists();
    } catch (runError) {
      console.error("Error running audience list:", runError);
      toast.error("Failed to run audience list.");
    } finally {
      setRunningListId(null);
    }
  }

  async function handleDeleteAudienceList(id: string) {
    setDeletingListId(id);
    try {
      const response = await deleteAudienceList({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to delete audience list.");
        return;
      }

      toast.success("Audience list deleted.");
      await loadAudienceLists();
    } catch (deleteError) {
      console.error("Error deleting audience list:", deleteError);
      toast.error("Failed to delete audience list.");
    } finally {
      setDeletingListId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              SQL Mode
            </CardTitle>
            <CardDescription>Validate SELECT-only audience queries before saving lists.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              AI Mode
            </CardTitle>
            <CardDescription>Natural language prompts are converted into executable audience filters.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              Filter Mode
            </CardTitle>
            <CardDescription>Use role, status, search, and limit filters without writing SQL.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <FolderManagerClient
        module="audience"
        title="Audience Folders"
        description="Organize audience lists into nested folders."
        createPlaceholder="New audience folder"
        emptyMessage="No audience folders yet. Create your first audience folder."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Audience SQL Workbench</CardTitle>
            <CardDescription>
              Queries are validated against single-statement, SELECT-only, and source whitelist rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SQL_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleUsePreset(preset.sql)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <Textarea
              value={sql}
              onChange={(event) => setSql(event.target.value)}
              className="min-h-[200px] font-mono text-xs"
              placeholder="SELECT id, email FROM audience_users_view LIMIT 100"
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Validation runs server-side with permission checks and source policy.
              </p>
              <Button onClick={handleValidate} disabled={isValidating}>
                <Play className="mr-2 h-4 w-4" />
                {isValidating ? "Validating..." : "Validate SQL"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Whitelisted Sources</CardTitle>
            <CardDescription>Audience SQL can only reference these read views.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEFAULT_ALLOWED_AUDIENCE_SOURCES.map((source) => (
              <Badge key={source} variant="outline" className="block w-fit font-mono text-xs">
                {source}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Audience List</CardTitle>
          <CardDescription>
            Save SQL, filter, or AI-derived list definitions into folders for campaign reuse.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-3 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {listQueryType === "SQL"
              ? "SQL mode: write query in Audience SQL Workbench above, click Validate SQL, then save."
              : listQueryType === "FILTER"
                ? "Filter mode: define role/status/search rules below. Running the list uses these rules directly."
                : "AI Filter mode: enter a prompt plus optional hard filters. Prompt keywords are converted to executable filters."}
          </div>
          <Input
            placeholder="List name"
            value={listName}
            onChange={(event) => setListName(event.target.value)}
          />
          <Select value={listQueryType} onValueChange={(value: "SQL" | "FILTER" | "AI_FILTER") => setListQueryType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SQL">SQL</SelectItem>
              <SelectItem value="FILTER">Filter</SelectItem>
              <SelectItem value="AI_FILTER">AI Filter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={listScope} onValueChange={(value: "PRIVATE" | "TEAM" | "SYSTEM") => setListScope(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRIVATE">Private</SelectItem>
              <SelectItem value="TEAM">Team</SelectItem>
              <SelectItem value="SYSTEM">System</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            value={listDescription}
            onChange={(event) => setListDescription(event.target.value)}
            placeholder="Description (optional)"
            className="lg:col-span-2"
          />
          {listQueryType === "AI_FILTER" && (
            <Textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Describe audience, e.g. Active managers in my venues"
              className="lg:col-span-3"
            />
          )}
          {listQueryType !== "SQL" && (
            <>
              <Select
                value={filterRole}
                onValueChange={(value: "ALL" | "ADMIN" | "MANAGER" | "STAFF") => setFilterRole(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Role filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  <SelectItem value="ADMIN">Admins</SelectItem>
                  <SelectItem value="MANAGER">Managers</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filterStatus}
                onValueChange={(value: "ANY" | "ACTIVE" | "INACTIVE") => setFilterStatus(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ANY">Any status</SelectItem>
                  <SelectItem value="ACTIVE">Active users</SelectItem>
                  <SelectItem value="INACTIVE">Inactive users</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={filterLimit}
                onChange={(event) => setFilterLimit(event.target.value)}
                placeholder="Result limit (max 2000)"
              />
              <Input
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
                placeholder="Search by name or email (optional)"
                className="lg:col-span-3"
              />
            </>
          )}
          <Select value={listFolderId} onValueChange={setListFolderId}>
            <SelectTrigger>
              <SelectValue placeholder="Folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No folder (root)</SelectItem>
              {folderOptions.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="lg:col-span-3 flex justify-end">
            <Button onClick={handleCreateAudienceList} disabled={isSavingList}>
              {isSavingList ? "Saving..." : "Save Audience List"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved Audience Lists</CardTitle>
          <CardDescription>
            Run, review, and clean up reusable audience definitions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              value={listSearch}
              onChange={(event) => setListSearch(event.target.value)}
              placeholder="Search lists"
              className="md:col-span-2"
            />
            <Select value={listFolderFilter} onValueChange={setListFolderFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Folder filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All folders</SelectItem>
                <SelectItem value="none">No folder</SelectItem>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={listTypeFilter}
              onValueChange={(value: "ALL" | "SQL" | "FILTER" | "AI_FILTER") =>
                setListTypeFilter(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="SQL">SQL</SelectItem>
                <SelectItem value="FILTER">Filter</SelectItem>
                <SelectItem value="AI_FILTER">AI Filter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {listError && (
            <p className="text-sm text-red-600">{listError}</p>
          )}

          {listsLoading ? (
            <p className="text-sm text-muted-foreground">Loading audience lists...</p>
          ) : audienceLists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audience lists found.</p>
          ) : (
            <div className="space-y-3">
              {audienceLists.map((list) => (
                <div key={list.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{list.name}</p>
                      {list.description && (
                        <p className="text-sm text-muted-foreground">{list.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{list.queryType}</Badge>
                        <Badge variant="outline">{list.scope}</Badge>
                        <Badge variant="outline">Runs: {list.runCount}</Badge>
                        <Badge variant="outline">Last Count: {list.lastCount}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {list.queryType === "SQL"
                          ? "Execution source: validated SQL query"
                          : list.queryType === "FILTER"
                            ? "Execution source: saved filter rules"
                            : "Execution source: AI prompt + derived filters"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRunAudienceList(list.id)}
                        disabled={runningListId === list.id}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {runningListId === list.id ? "Running..." : "Run"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeleteAudienceList(list.id)}
                        disabled={deletingListId === list.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingListId === list.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(error || result) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {error || hasBlockingErrors ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              Validation Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            {result && (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={result.valid ? "default" : "destructive"}>
                    {result.valid ? "Valid Query" : "Validation Failed"}
                  </Badge>
                  {!result.valid && (
                    <span className="text-xs text-muted-foreground">
                      Fix the issues below before saving this as an audience list.
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Referenced Sources
                  </p>
                  <p className="font-mono text-xs">
                    {result.referencedSources.length > 0
                      ? result.referencedSources.join(", ")
                      : "No sources detected"}
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Normalized SQL
                  </p>
                  <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">
                    {result.normalizedSql || "--"}
                  </pre>
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-red-600">Errors</p>
                    <div className="space-y-1">
                      {result.errors.map((issue) => (
                        <p key={issue} className="text-sm text-red-600">
                          {issue}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-amber-600">Warnings</p>
                    <div className="space-y-1">
                      {result.warnings.map((warning) => (
                        <p key={warning} className="text-sm text-amber-700">
                          {warning}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
