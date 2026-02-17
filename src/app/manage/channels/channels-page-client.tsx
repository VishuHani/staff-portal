"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Hash,
  Users,
  MessageSquare,
  Settings,
  Archive,
  ArchiveRestore,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChannelCreationWizard,
  type ChannelCreationData,
  type UserOption,
  ChannelAnalyticsSummary,
} from "@/components/channels";
import { createChannel, archiveChannel } from "@/lib/actions/channels";
import { bulkAddMembers } from "@/lib/actions/channel-members";
import { toast } from "sonner";
import { getFullName } from "@/lib/utils/profile";
import { cn } from "@/lib/utils";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  archived: boolean;
  archivedAt: Date | null;
  _count: {
    members: number;
    posts: number;
  };
  createdByUser: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  members: Array<{
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      profileImage: string | null;
    };
  }>;
}

interface Role {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface ChannelsPageClientProps {
  initialChannels: Channel[];
  allUsers: UserOption[];
  allRoles: Role[];
  allVenues: Venue[];
  currentUserId: string;
}

export function ChannelsPageClient({
  initialChannels,
  allUsers,
  allRoles,
  allVenues,
  currentUserId,
}: ChannelsPageClientProps) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleCreateChannel = async (data: ChannelCreationData) => {
    try {
      // Ensure venueIds are always provided - default to all venues if not specified
      const venueIds = data.venueIds && data.venueIds.length > 0
        ? data.venueIds
        : allVenues.map(v => v.id);

      console.log('[ChannelCreate] Creating channel:', { name: data.name, venueIds });

      // Step 1: Create the channel
      const channelResult = await createChannel({
        name: data.name,
        description: data.description,
        type: data.type,
        icon: data.icon,
        color: data.color,
        permissions: undefined,
        venueIds,
      });

      console.log('[ChannelCreate] Result:', channelResult);

      if (!channelResult.success || !channelResult.channel) {
        console.error('[ChannelCreate] Failed:', channelResult.error);
        return { error: channelResult.error || "Failed to create channel" };
      }

      const newChannel = channelResult.channel;

      // Step 2: Add members with bulk operation
      if (data.userIds.length > 0) {
        const membersResult = await bulkAddMembers({
          channelId: newChannel.id,
          selectionCriteria: {
            selectionType: data.selectionType,
            roleIds: data.roleIds,
            venueIds: data.venueIds,
            userIds: data.userIds,
            activeOnly: true,
          },
          role: data.memberRole,
        });

        if ('error' in membersResult && membersResult.error) {
          // Channel created but members failed - notify but don't fail
          toast.warning(
            `Channel created but some members couldn't be added: ${membersResult.error}`
          );
        }
      }

      // Success!
      router.refresh();
      return { success: true, channel: newChannel };
    } catch (error) {
      console.error("Error in handleCreateChannel:", error);
      return { error: "An unexpected error occurred" };
    }
  };

  const handleArchive = async (channelId: string, archived: boolean) => {
    setArchivingId(channelId);
    try {
      console.log('[ChannelArchive] Archiving channel:', { channelId, newState: !archived });

      const result = await archiveChannel({
        id: channelId,
        archived: !archived,
      });

      console.log('[ChannelArchive] Result:', result);

      if (result.success) {
        toast.success(archived ? "Channel restored" : "Channel archived");
        router.refresh();
      } else {
        console.error('[ChannelArchive] Failed:', result.error);
        toast.error(result.error || "Failed to archive channel");
      }
    } catch (error) {
      console.error('[ChannelArchive] Error:', error);
      toast.error("An unexpected error occurred");
    } finally {
      setArchivingId(null);
    }
  };

  const activeChannels = channels.filter((c) => !c.archived);
  const archivedChannels = channels.filter((c) => c.archived);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Channel Management</h1>
          <p className="text-muted-foreground">
            Create and manage channels with flexible member selection
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Create Channel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channels.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeChannels.length} active, {archivedChannels.length} archived
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {channels.reduce((sum, c) => sum + c._count.members, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all channels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {channels.reduce((sum, c) => sum + c._count.posts, 0)}
            </div>
            <p className="text-xs text-muted-foreground">All channel posts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {channels.length > 0
                ? Math.round(
                    channels.reduce((sum, c) => sum + c._count.members, 0) /
                      channels.length
                  )
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Per channel</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Channels */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Active Channels</h2>
        {activeChannels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Hash className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="mb-2 text-lg font-medium">No active channels</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Create your first channel to get started
              </p>
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Channel
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeChannels.map((channel) => (
              <Card
                key={channel.id}
                className="transition-shadow hover:shadow-md"
              >
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
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-2xl">
                        {channel.icon || <Hash className="h-5 w-5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {channel.name}
                        </CardTitle>
                        <CardDescription className="text-xs capitalize">
                          {channel.type.toLowerCase().replace("_", " ")}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {channel.description || "No description"}
                  </p>

                  {/* Stats */}
                  <ChannelAnalyticsSummary
                    memberCount={channel._count.members}
                    postCount={channel._count.posts}
                    recentActivity={0}
                  />

                  {/* Creator */}
                  {channel.createdByUser && (
                    <p className="text-xs text-muted-foreground">
                      Created by {getFullName(channel.createdByUser)}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <Link href={`/admin/channels/${channel.id}`}>
                        <Settings className="mr-1 h-3 w-3" />
                        Manage
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(channel.id, channel.archived)}
                      disabled={archivingId === channel.id}
                    >
                      {archivingId === channel.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Archive className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Archived Channels */}
      {archivedChannels.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold text-muted-foreground">
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
                        <CardTitle className="text-base">{channel.name}</CardTitle>
                        <CardDescription className="text-xs">
                          Archived
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ChannelAnalyticsSummary
                    memberCount={channel._count.members}
                    postCount={channel._count.posts}
                    recentActivity={0}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleArchive(channel.id, channel.archived)}
                      disabled={archivingId === channel.id}
                    >
                      {archivingId === channel.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <ArchiveRestore className="mr-1 h-3 w-3" />
                      )}
                      Restore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Creation Wizard */}
      <ChannelCreationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        allUsers={allUsers}
        allRoles={allRoles}
        allVenues={allVenues}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  );
}
