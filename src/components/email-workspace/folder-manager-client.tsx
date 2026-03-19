"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { FolderPlus, FolderTree, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createFolder,
  deleteFolder,
  listFolderTree,
  moveFolder,
  renameFolder,
  type EmailFolderNode,
} from "@/lib/actions/email-workspace/folders";
import type { EmailWorkspaceModule } from "@/lib/rbac/email-workspace";

interface FolderManagerClientProps {
  module: EmailWorkspaceModule;
  title: string;
  description: string;
  createPlaceholder?: string;
  emptyMessage?: string;
}

function flattenFolders(nodes: EmailFolderNode[], depth: number = 0): Array<{ id: string; label: string }> {
  const rows: Array<{ id: string; label: string }> = [];

  for (const node of nodes) {
    rows.push({
      id: node.id,
      label: `${"-- ".repeat(depth)}${node.name}`,
    });

    rows.push(...flattenFolders(node.children, depth + 1));
  }

  return rows;
}

export function FolderManagerClient({
  module,
  title,
  description,
  createPlaceholder = "New folder name",
  emptyMessage = "No folders yet. Create your first folder.",
}: FolderManagerClientProps) {
  const [folders, setFolders] = useState<EmailFolderNode[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderMutationPending, startFolderMutation] = useTransition();

  const [newFolderName, setNewFolderName] = useState("");
  const [selectedParentFolderId, setSelectedParentFolderId] = useState("root");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [moveTargetParentId, setMoveTargetParentId] = useState("root");

  const availableParents = useMemo(() => flattenFolders(folders), [folders]);
  const selectedFolder = useMemo(
    () => availableParents.find((folder) => folder.id === selectedFolderId) || null,
    [availableParents, selectedFolderId]
  );

  function clearSelection() {
    setSelectedFolderId(null);
    setRenameFolderName("");
    setMoveTargetParentId("root");
  }

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    setFolderError(null);

    try {
      const response = await listFolderTree({ module });

      if (!response.success || !response.tree) {
        const message = response.error || "Failed to load folder tree.";
        setFolderError(message);
        return;
      }

      setFolders(response.tree);

      if (selectedFolderId) {
        const stillExists = flattenFolders(response.tree).some((folder) => folder.id === selectedFolderId);
        if (!stillExists) {
          setSelectedFolderId(null);
          setRenameFolderName("");
          setMoveTargetParentId("root");
        }
      }
    } catch (folderLoadError) {
      console.error("Error loading email workspace folders:", folderLoadError);
      setFolderError("Failed to load folder tree.");
    } finally {
      setFoldersLoading(false);
    }
  }, [module, selectedFolderId]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  function handleSelectFolder(folder: EmailFolderNode) {
    if (selectedFolderId === folder.id) {
      clearSelection();
      return;
    }

    setSelectedFolderId(folder.id);
    setRenameFolderName(folder.name);
    setMoveTargetParentId(folder.parentId || "root");
  }

  function handleCreateFolder() {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      toast.error("Folder name is required.");
      return;
    }

    startFolderMutation(async () => {
      const response = await createFolder({
        module,
        name: trimmed,
        parentId: selectedParentFolderId === "root" ? undefined : selectedParentFolderId,
      });

      if (!response.success) {
        const message = response.error || "Failed to create folder.";
        setFolderError(message);
        toast.error(message);
        return;
      }

      setNewFolderName("");
      setSelectedParentFolderId("root");
      toast.success("Folder created.");
      await loadFolders();
    });
  }

  function handleRenameFolder() {
    if (!selectedFolderId) {
      toast.error("Select a folder first.");
      return;
    }

    const trimmed = renameFolderName.trim();
    if (!trimmed) {
      toast.error("Folder name is required.");
      return;
    }

    startFolderMutation(async () => {
      const response = await renameFolder({
        id: selectedFolderId,
        name: trimmed,
      });

      if (!response.success) {
        const message = response.error || "Failed to rename folder.";
        setFolderError(message);
        toast.error(message);
        return;
      }

      toast.success("Folder renamed.");
      await loadFolders();
    });
  }

  function handleMoveFolder() {
    if (!selectedFolderId) {
      toast.error("Select a folder first.");
      return;
    }

    startFolderMutation(async () => {
      const response = await moveFolder({
        id: selectedFolderId,
        parentId: moveTargetParentId === "root" ? undefined : moveTargetParentId,
      });

      if (!response.success) {
        const message = response.error || "Failed to move folder.";
        setFolderError(message);
        toast.error(message);
        return;
      }

      toast.success("Folder moved.");
      await loadFolders();
    });
  }

  function handleDeleteFolder() {
    if (!selectedFolderId) {
      toast.error("Select a folder first.");
      return;
    }

    startFolderMutation(async () => {
      const response = await deleteFolder({
        id: selectedFolderId,
      });

      if (!response.success) {
        const message = response.error || "Failed to delete folder.";
        setFolderError(message);
        toast.error(message);
        return;
      }

      clearSelection();
      toast.success("Folder deleted.");
      await loadFolders();
    });
  }

  function renderFolderRows(nodes: EmailFolderNode[], depth: number = 0) {
    return nodes.map((node) => (
      <div key={node.id} className="space-y-1">
        <button
          type="button"
          className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-sm ${
            selectedFolderId === node.id ? "border-primary bg-primary/5" : ""
          }`}
          style={{ marginLeft: `${depth * 12}px` }}
          onClick={() => handleSelectFolder(node)}
        >
          <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{node.name}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {node.scope}
          </Badge>
        </button>
        {node.children.length > 0 ? renderFolderRows(node.children, depth + 1) : null}
      </div>
    ));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderTree className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <Input
            placeholder={createPlaceholder}
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <Select value={selectedParentFolderId} onValueChange={setSelectedParentFolderId}>
            <SelectTrigger>
              <SelectValue placeholder="Parent folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Root</SelectItem>
              {availableParents.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreateFolder} disabled={folderMutationPending || foldersLoading}>
            <FolderPlus className="mr-2 h-4 w-4" />
            {folderMutationPending ? "Creating..." : "Create"}
          </Button>
        </div>

        {folderError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {folderError}
          </div>
        )}

        {foldersLoading ? (
          <p className="text-sm text-muted-foreground">Loading folders...</p>
        ) : folders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">{renderFolderRows(folders)}</div>
        )}

        {selectedFolder && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Selected: {selectedFolder.label.replace(/^(--\s)*/, "")}</p>
              <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                <X className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Input
                value={renameFolderName}
                onChange={(event) => setRenameFolderName(event.target.value)}
                placeholder="Rename folder"
              />
              <Button
                variant="outline"
                onClick={handleRenameFolder}
                disabled={folderMutationPending}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Select value={moveTargetParentId} onValueChange={setMoveTargetParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Move to parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root</SelectItem>
                  {availableParents
                    .filter((folder) => folder.id !== selectedFolderId)
                    .map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={handleMoveFolder}
                disabled={folderMutationPending}
              >
                Move
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                variant="destructive"
                onClick={handleDeleteFolder}
                disabled={folderMutationPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Folder
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
