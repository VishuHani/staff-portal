"use client";

import { useState } from "react";
import { MoreVertical, Trash2, Shield, User as UserIcon, Crown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "./RoleBadge";
import { ConfirmDestructiveDialog } from "./ConfirmDialog";
import { getFullName } from "@/lib/utils/profile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ChannelMember {
  id: string;
  role: "CREATOR" | "MODERATOR" | "MEMBER";
  addedAt: Date;
  addedVia: string | null;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    profileImage?: string | null;
    role: {
      name: string;
    } | null;
    venues?: Array<{
      venue: {
        id: string;
        name: string;
      };
    }>;
  };
  addedByUser: {
    firstName?: string | null;
    lastName?: string | null;
  };
}

interface MemberListProps {
  members: ChannelMember[];
  canManage?: boolean;
  currentUserId?: string;
  onRemoveMember?: (userId: string) => Promise<void>;
  onUpdateRole?: (userId: string, newRole: "CREATOR" | "MODERATOR" | "MEMBER") => Promise<void>;
  loading?: boolean;
  emptyMessage?: string;
}

export function MemberList({
  members,
  canManage = false,
  currentUserId,
  onRemoveMember,
  onUpdateRole,
  loading = false,
  emptyMessage = "No members found",
}: MemberListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ChannelMember | null>(null);

  // Filter members by search
  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const userName = getFullName(member.user).toLowerCase();
    const email = member.user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return userName.includes(query) || email.includes(query);
  });

  const handleRemoveClick = (member: ChannelMember) => {
    setMemberToRemove(member);
    setConfirmRemoveOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove || !onRemoveMember) return;

    setRemovingUserId(memberToRemove.user.id);
    try {
      await onRemoveMember(memberToRemove.user.id);
      toast.success(`Removed ${getFullName(memberToRemove.user)} from channel`);
      setConfirmRemoveOpen(false);
      setMemberToRemove(null);
    } catch (error) {
      toast.error("Failed to remove member");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleRoleChange = async (
    userId: string,
    newRole: "CREATOR" | "MODERATOR" | "MEMBER"
  ) => {
    if (!onUpdateRole) return;

    setUpdatingUserId(userId);
    try {
      await onUpdateRole(userId, newRole);
      toast.success("Role updated successfully");
    } catch (error) {
      toast.error("Failed to update role");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getRoleActions = (member: ChannelMember) => {
    const actions = [];

    if (member.role !== "CREATOR") {
      actions.push({
        label: "Make Creator",
        icon: Crown,
        onClick: () => handleRoleChange(member.user.id, "CREATOR"),
      });
    }

    if (member.role !== "MODERATOR") {
      actions.push({
        label: "Make Moderator",
        icon: Shield,
        onClick: () => handleRoleChange(member.user.id, "MODERATOR"),
      });
    }

    if (member.role !== "MEMBER") {
      actions.push({
        label: "Make Member",
        icon: UserIcon,
        onClick: () => handleRoleChange(member.user.id, "MEMBER"),
      });
    }

    return actions;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      {members.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={loading}
          />
        </div>
      )}

      {/* Members List */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => {
            const isCurrentUser = member.user.id === currentUserId;
            const isProcessing =
              removingUserId === member.user.id || updatingUserId === member.user.id;
            const roleActions = getRoleActions(member);

            return (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  isCurrentUser && "bg-accent/50"
                )}
              >
                {/* Avatar */}
                <UserAvatar
                  imageUrl={member.user.profileImage}
                  firstName={member.user.firstName}
                  lastName={member.user.lastName}
                  email={member.user.email}
                  size="md"
                />

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {getFullName(member.user)}
                    </p>
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{member.user.email}</span>
                    {member.user.role && (
                      <>
                        <span>•</span>
                        <span>{member.user.role.name}</span>
                      </>
                    )}
                  </div>
                  {member.user.venues && member.user.venues.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {member.user.venues.map((v) => v.venue.name).join(", ")}
                    </p>
                  )}
                </div>

                {/* Role Badge */}
                <RoleBadge role={member.role} />

                {/* Actions */}
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Manage Member</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {/* Role Change Actions */}
                      {roleActions.length > 0 && (
                        <>
                          {roleActions.map((action, idx) => (
                            <DropdownMenuItem
                              key={idx}
                              onClick={action.onClick}
                            >
                              <action.icon className="mr-2 h-4 w-4" />
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                        </>
                      )}

                      {/* Remove Action */}
                      <DropdownMenuItem
                        onClick={() => handleRemoveClick(member)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove from Channel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Remove Dialog */}
      {memberToRemove && (
        <ConfirmDestructiveDialog
          open={confirmRemoveOpen}
          onOpenChange={setConfirmRemoveOpen}
          title="Remove Member"
          description={`Are you sure you want to remove ${getFullName(
            memberToRemove.user
          )} from this channel? They will lose access to all channel posts and discussions.`}
          onConfirm={handleRemoveConfirm}
          loading={removingUserId !== null}
        />
      )}
    </div>
  );
}
