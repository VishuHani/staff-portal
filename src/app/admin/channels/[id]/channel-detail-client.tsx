"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Plus,
  Settings,
  BarChart3,
  List,
  Grid3x3,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MemberList,
  MemberGrid,
  UserPicker,
  ChannelAnalytics,
  type ChannelMember,
  type UserOption,
} from "@/components/channels";
import {
  addChannelMembers,
  removeChannelMembers,
  updateMemberRole,
  getChannelAnalytics,
} from "@/lib/actions/channel-members";
import { toast } from "sonner";
import { getFullName } from "@/lib/utils/profile";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  archived: boolean;
  _count: {
    members: number;
    posts: number;
  };
  creator: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  members: ChannelMember[];
}

interface ChannelDetailClientProps {
  channel: Channel;
  allUsers: UserOption[];
  currentUserId: string;
}

export function ChannelDetailClient({
  channel: initialChannel,
  allUsers,
  currentUserId,
}: ChannelDetailClientProps) {
  const router = useRouter();
  const [channel, setChannel] = useState(initialChannel);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const existingMemberIds = channel.members.map((m) => m.user.id);

  const handleAddMembers = async () => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setAddingMembers(true);
    try {
      const result = await addChannelMembers({
        channelId: channel.id,
        userIds: selectedUserIds,
        role: "MEMBER",
        addedVia: "manual",
      });

      if (result.success) {
        toast.success(`Added ${result.membersAdded} member(s) to channel`);

        if (result.existingMembers && result.existingMembers.length > 0) {
          toast.info(
            `${result.existingMembers.length} user(s) already in channel`
          );
        }

        setAddMembersOpen(false);
        setSelectedUserIds([]);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to add members");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const result = await removeChannelMembers({
      channelId: channel.id,
      userIds: [userId],
    });

    if (result.success) {
      router.refresh();
    } else {
      throw new Error(result.error || "Failed to remove member");
    }
  };

  const handleUpdateRole = async (
    userId: string,
    newRole: "CREATOR" | "MODERATOR" | "MEMBER"
  ) => {
    const result = await updateMemberRole({
      channelId: channel.id,
      userId,
      role: newRole,
    });

    if (result.success) {
      router.refresh();
    } else {
      throw new Error(result.error || "Failed to update role");
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const result = await getChannelAnalytics({
        channelId: channel.id,
      });

      if (result.success && result.analytics) {
        setAnalyticsData(result.analytics);
      } else {
        toast.error("Failed to load analytics");
      }
    } catch (error) {
      toast.error("Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/channels">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl">
              {channel.icon || "#"}
            </span>
            <div>
              <h1 className="text-3xl font-bold">{channel.name}</h1>
              <p className="text-muted-foreground capitalize">
                {channel.type.toLowerCase().replace("_", " ")} •{" "}
                {channel._count.members} members • {channel._count.posts} posts
              </p>
            </div>
          </div>
          {channel.description && (
            <p className="mt-2 text-muted-foreground">{channel.description}</p>
          )}
          {channel.creator && (
            <p className="mt-1 text-sm text-muted-foreground">
              Created by {getFullName(channel.creator)}
            </p>
          )}
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/channels/${channel.id}/settings`}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="analytics" onClick={loadAnalytics}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setAddMembersOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Members
            </Button>
          </div>

          {/* Members Display */}
          {viewMode === "list" ? (
            <MemberList
              members={channel.members}
              canManage={true}
              currentUserId={currentUserId}
              onRemoveMember={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
            />
          ) : (
            <MemberGrid
              members={channel.members}
              canManage={true}
              currentUserId={currentUserId}
              onRemoveMember={handleRemoveMember}
              onUpdateRole={handleUpdateRole}
            />
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {loadingAnalytics ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : analyticsData ? (
            <ChannelAnalytics data={analyticsData} />
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground">
                  Click the Analytics tab to load data
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Members Dialog */}
      <Dialog open={addMembersOpen} onOpenChange={setAddMembersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Members to {channel.name}</DialogTitle>
            <DialogDescription>
              Select users to add to this channel
            </DialogDescription>
          </DialogHeader>

          <UserPicker
            users={allUsers}
            selectedUserIds={selectedUserIds}
            onSelectionChange={setSelectedUserIds}
            excludeUserIds={existingMemberIds}
            maxHeight="400px"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAddMembersOpen(false)}
              disabled={addingMembers}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMembers}
              disabled={addingMembers || selectedUserIds.length === 0}
            >
              {addingMembers ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {selectedUserIds.length} Member
                  {selectedUserIds.length !== 1 && "s"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
