"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ChannelForm } from "@/components/posts/ChannelForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Hash,
  Edit,
  Archive,
  ArchiveRestore,
  Trash2,
  Loader2,
  Building2,
} from "lucide-react";
import {
  getChannels,
  archiveChannel,
  deleteChannel,
} from "@/lib/actions/channels";
import { getActiveVenues } from "@/lib/actions/admin/venues";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  permissions: string | null;
  archived: boolean;
  archivedAt: Date | null;
  _count: {
    posts: number;
  };
  venues?: Array<{
    venueId: string;
    venue: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export default function ChannelsAdminPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<Channel | null>(null);
  const [includeArchived, setIncludeArchived] = useState(true);
  const [filterVenueId, setFilterVenueId] = useState<string>("all");

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const result = await getChannels({ includeArchived });

      if (result.channels) {
        setChannels(result.channels);
      }
    } catch (err) {
      console.error("Failed to load channels:", err);
      toast.error("Failed to load channels");
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const result = await getActiveVenues();
      if (result.venues) {
        setVenues(result.venues);
      }
    } catch (err) {
      console.error("Failed to load venues:", err);
      toast.error("Failed to load venues");
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchVenues();
  }, [includeArchived]);

  const handleArchive = async (channel: Channel) => {
    const result = await archiveChannel({
      id: channel.id,
      archived: !channel.archived,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        channel.archived
          ? `Channel "${channel.name}" restored`
          : `Channel "${channel.name}" archived`
      );
      fetchChannels();
    }
  };

  const handleDelete = async () => {
    if (!channelToDelete) return;

    const result = await deleteChannel({ id: channelToDelete.id });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Channel "${channelToDelete.name}" deleted`);
      setDeleteDialogOpen(false);
      setChannelToDelete(null);
      fetchChannels();
    }
  };

  // Apply venue filter
  const filteredChannels = filterVenueId === "all"
    ? channels
    : channels.filter((channel) =>
        channel.venues?.some((v) => v.venueId === filterVenueId)
      );

  const activeChannels = filteredChannels.filter((c) => !c.archived);
  const archivedChannels = filteredChannels.filter((c) => c.archived);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Channel Management</h1>
        <p className="text-muted-foreground">
          Create and manage channels for team posts and announcements
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterVenueId} onValueChange={setFilterVenueId}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={includeArchived ? "outline" : "default"}
            size="sm"
            onClick={() => setIncludeArchived(!includeArchived)}
          >
            {includeArchived ? "Hide Archived" : "Show Archived"}
          </Button>

          <span className="text-sm text-muted-foreground">
            {activeChannels.length} active, {archivedChannels.length} archived
          </span>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Channel
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Channels */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Active Channels</h2>
            {activeChannels.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No active channels. Create one to get started!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeChannels.map((channel) => (
                  <Card key={channel.id}>
                    <CardHeader
                      className="pb-3"
                      style={
                        channel.color
                          ? {
                              background: `linear-gradient(135deg, ${channel.color}15 0%, ${channel.color}05 100%)`,
                              borderBottom: `2px solid ${channel.color}30`,
                            }
                          : {}
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">
                            {channel.icon || <Hash className="h-5 w-5" />}
                          </span>
                          <div>
                            <CardTitle className="text-base">
                              {channel.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {channel.type.replace("_", " ")}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary">{channel._count.posts}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-2 text-sm text-muted-foreground">
                        {channel.description || "No description"}
                      </p>
                      {channel.venues && channel.venues.length > 0 && (
                        <div className="mb-4">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Venues:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {channel.venues.map((cv) => (
                              <Badge
                                key={cv.venueId}
                                variant="outline"
                                className="text-xs"
                              >
                                {cv.venue.code}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingChannel(channel)}
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleArchive(channel)}
                        >
                          <Archive className="mr-1 h-3 w-3" />
                          Archive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setChannelToDelete(channel);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={channel._count.posts > 0}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Archived Channels */}
          {includeArchived && archivedChannels.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">
                Archived Channels
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedChannels.map((channel) => (
                  <Card key={channel.id} className="opacity-60">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">
                            {channel.icon || <Hash className="h-5 w-5" />}
                          </span>
                          <div>
                            <CardTitle className="text-base">
                              {channel.name}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Archived
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary">{channel._count.posts}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 text-sm text-muted-foreground">
                        {channel.description || "No description"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleArchive(channel)}
                        >
                          <ArchiveRestore className="mr-1 h-3 w-3" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setChannelToDelete(channel);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={channel._count.posts > 0}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Channel Dialog */}
      <ChannelForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        venues={venues}
        onSuccess={fetchChannels}
      />

      {/* Edit Channel Dialog */}
      {editingChannel && (
        <ChannelForm
          open={!!editingChannel}
          onOpenChange={(open) => !open && setEditingChannel(null)}
          channel={editingChannel}
          venues={venues}
          onSuccess={() => {
            fetchChannels();
            setEditingChannel(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Channel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the channel &quot;
              {channelToDelete?.name}&quot;? This action cannot be undone.
              {channelToDelete && channelToDelete._count.posts > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  This channel has {channelToDelete._count.posts} posts and
                  cannot be deleted. Archive it instead.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                channelToDelete ? channelToDelete._count.posts > 0 : true
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
