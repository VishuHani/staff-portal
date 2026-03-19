"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Link2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderManagerClient } from "@/components/email-workspace/folder-manager-client";
import {
  createEmailAsset,
  deleteEmailAsset,
  listEmailAssets,
  uploadEmailAsset,
  type EmailAssetSummary,
} from "@/lib/actions/email-workspace/assets";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";

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

export function AssetsLibraryClient() {
  const [isCreating, startCreate] = useTransition();
  const [search, setSearch] = useState("");
  const [assetKindFilter, setAssetKindFilter] = useState<"ALL" | "IMAGE" | "GIF" | "VIDEO" | "FILE">("ALL");
  const [folderFilter, setFolderFilter] = useState("all");
  const [assets, setAssets] = useState<EmailAssetSummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newMimeType, setNewMimeType] = useState("image/png");
  const [newKind, setNewKind] = useState<"IMAGE" | "GIF" | "VIDEO" | "FILE">("IMAGE");
  const [newTags, setNewTags] = useState("");
  const [newScope, setNewScope] = useState<"PRIVATE" | "TEAM" | "SYSTEM">("PRIVATE");
  const [newFolderId, setNewFolderId] = useState("none");

  useEffect(() => {
    void loadFolders();
  }, []);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);
    try {
      const response = await listEmailAssets({
        search: search.trim() || undefined,
        folderId: folderFilter === "all" ? undefined : folderFilter,
        kind: assetKindFilter,
      });

      if (!response.success || !response.assets) {
        const message = response.error || "Failed to load assets.";
        setAssetsError(message);
        setAssets([]);
        return;
      }

      setAssets(response.assets);
    } catch (error) {
      console.error("Error loading assets:", error);
      setAssetsError("Failed to load assets.");
      setAssets([]);
    } finally {
      setAssetsLoading(false);
    }
  }, [assetKindFilter, folderFilter, search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadAssets();
    }, 200);
    return () => clearTimeout(timeout);
  }, [loadAssets]);

  async function loadFolders() {
    try {
      const response = await listFolderTree({ module: "assets" });
      if (!response.success || !response.tree) {
        return;
      }
      setFolderOptions(flattenFolderOptions(response.tree));
    } catch (error) {
      console.error("Error loading asset folders:", error);
    }
  }

  function handleCreateAsset() {
    const trimmedName = newName.trim();
    const trimmedUrl = newUrl.trim();
    const trimmedMimeType = newMimeType.trim();

    if (!newFile && (!trimmedName || !trimmedUrl || !trimmedMimeType)) {
      toast.error("Provide a file upload, or enter asset name, MIME type, and URL.");
      return;
    }

    startCreate(async () => {
      const response = newFile
        ? await (async () => {
            const formData = new FormData();
            formData.set("file", newFile);
            if (trimmedName) {
              formData.set("name", trimmedName);
            }
            formData.set("kind", newKind);
            formData.set("scope", newScope);
            formData.set("tags", newTags);
            formData.set("folderId", newFolderId === "none" ? "" : newFolderId);
            return uploadEmailAsset(formData);
          })()
        : await createEmailAsset({
            name: trimmedName,
            storageUrl: trimmedUrl,
            mimeType: trimmedMimeType,
            kind: newKind,
            tags: newTags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0),
            folderId: newFolderId === "none" ? undefined : newFolderId,
            scope: newScope,
          });

      if (!response.success || !response.asset) {
        toast.error(response.error || "Failed to save asset.");
        return;
      }

      toast.success(newFile ? "Asset uploaded." : "Asset registered.");
      setNewFile(null);
      setFileInputKey((current) => current + 1);
      setNewName("");
      setNewUrl("");
      setNewTags("");
      setNewFolderId("none");
      await loadAssets();
    });
  }

  async function handleDeleteAsset(id: string) {
    setDeletingId(id);
    try {
      const response = await deleteEmailAsset({ id });
      if (!response.success) {
        toast.error(response.error || "Failed to delete asset.");
        return;
      }

      toast.success("Asset deleted.");
      await loadAssets();
    } catch (error) {
      console.error("Error deleting asset:", error);
      toast.error("Failed to delete asset.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Asset Search</CardTitle>
          <CardDescription>
            Search and filter images, GIFs, videos, and files. Supports metadata tokens like
            <span className="ml-1 font-mono text-xs">w:1200 h:600 d:30 tag:ext:png</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assets by name, tag, or type"
              className="pl-9"
            />
          </div>
          <Select
            value={assetKindFilter}
            onValueChange={(value) =>
              setAssetKindFilter(value as "ALL" | "IMAGE" | "GIF" | "VIDEO" | "FILE")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Asset Types</SelectItem>
              <SelectItem value="IMAGE">Images</SelectItem>
              <SelectItem value="GIF">GIFs</SelectItem>
              <SelectItem value="VIDEO">Videos</SelectItem>
              <SelectItem value="FILE">Files</SelectItem>
            </SelectContent>
          </Select>
          <Select value={folderFilter} onValueChange={setFolderFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              <SelectItem value="none">No Folder</SelectItem>
              {folderOptions.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <FolderManagerClient
        module="assets"
        title="Asset Folders"
        description="Organize assets into root folders and nested subfolders."
        createPlaceholder="New asset folder"
        emptyMessage="No asset folders yet. Create your first asset folder."
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload or Register Asset</CardTitle>
          <CardDescription>
            Upload new files directly to asset storage, or register existing external URLs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <div className="lg:col-span-3">
            <Input
              key={fileInputKey}
              type="file"
              accept="image/*,video/*,application/pdf,text/plain,text/csv,application/json,application/zip"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setNewFile(file);
                if (file?.type) {
                  setNewMimeType(file.type);
                }
                if (!newName.trim() && file?.name) {
                  setNewName(file.name);
                }
              }}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {newFile
                ? `Selected: ${newFile.name} (${Math.ceil(newFile.size / 1024)} KB)`
                : "Optional: choose a file to upload. Leave empty to register an external URL."}
            </p>
          </div>
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Asset name"
          />
          <Input
            value={newMimeType}
            onChange={(event) => setNewMimeType(event.target.value)}
            placeholder="MIME type (e.g. image/png)"
          />
          <Select value={newKind} onValueChange={(value: "IMAGE" | "GIF" | "VIDEO" | "FILE") => setNewKind(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IMAGE">Image</SelectItem>
              <SelectItem value="GIF">GIF</SelectItem>
              <SelectItem value="VIDEO">Video</SelectItem>
              <SelectItem value="FILE">File</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={newUrl}
            onChange={(event) => setNewUrl(event.target.value)}
            placeholder="External asset URL (optional when uploading file)"
            className="lg:col-span-2"
          />
          <Input
            value={newTags}
            onChange={(event) => setNewTags(event.target.value)}
            placeholder="Tags (comma separated)"
          />
          <Select value={newScope} onValueChange={(value: "PRIVATE" | "TEAM" | "SYSTEM") => setNewScope(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRIVATE">Private</SelectItem>
              <SelectItem value="TEAM">Team</SelectItem>
              <SelectItem value="SYSTEM">System</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newFolderId} onValueChange={setNewFolderId}>
            <SelectTrigger className="lg:col-span-2">
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
            <Button onClick={handleCreateAsset} disabled={isCreating}>
              {isCreating ? "Saving..." : newFile ? "Upload Asset" : "Register Asset"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Asset Results</CardTitle>
          <CardDescription>Folder-aware search results for saved asset records.</CardDescription>
        </CardHeader>
        <CardContent>
          {assetsError && (
            <p className="mb-3 text-sm text-red-600">{assetsError}</p>
          )}

          {assetsLoading ? (
            <p className="text-sm text-muted-foreground">Loading assets...</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assets found.</p>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <div key={asset.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      {(asset.thumbnailUrl || asset.kind === "IMAGE" || asset.kind === "GIF") && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.thumbnailUrl || asset.storageUrl}
                          alt={asset.altText || asset.name}
                          className="h-20 w-32 rounded border object-cover"
                        />
                      )}
                      <div className="space-y-1">
                        <p className="font-medium">{asset.name}</p>
                        <a
                          href={asset.storageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Open asset URL
                        </a>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{asset.kind}</Badge>
                          <Badge variant="outline">{asset.mimeType}</Badge>
                          <Badge variant="outline">{asset.scope}</Badge>
                          {asset.width && asset.height && (
                            <Badge variant="outline">
                              {asset.width}x{asset.height}
                            </Badge>
                          )}
                          {asset.durationSec && (
                            <Badge variant="outline">{asset.durationSec}s</Badge>
                          )}
                          {asset.tags.map((tag) => (
                            <Badge key={`${asset.id}-${tag}`} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-muted-foreground">
                        {asset.sizeBytes > 0 ? `${Math.ceil(asset.sizeBytes / 1024)} KB` : "Unknown size"}
                      </p>
                      {asset.thumbnailUrl && (
                        <a
                          href={asset.thumbnailUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Link2 className="h-3 w-3" />
                          Open thumbnail
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDeleteAsset(asset.id)}
                        disabled={deletingId === asset.id}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deletingId === asset.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
