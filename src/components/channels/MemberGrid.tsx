"use client";

import { useState } from "react";
import { MoreVertical, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "./RoleBadge";
import { Badge } from "@/components/ui/badge";
import { getFullName } from "@/lib/utils/profile";
import { cn } from "@/lib/utils";
import type { ChannelMember } from "./MemberList";

interface MemberGridProps {
  members: ChannelMember[];
  canManage?: boolean;
  currentUserId?: string;
  onRemoveMember?: (userId: string) => void;
  onUpdateRole?: (userId: string, newRole: "CREATOR" | "MODERATOR" | "MEMBER") => void;
  loading?: boolean;
  emptyMessage?: string;
  columns?: 2 | 3 | 4;
}

export function MemberGrid({
  members,
  canManage = false,
  currentUserId,
  onRemoveMember,
  onUpdateRole,
  loading = false,
  emptyMessage = "No members found",
  columns = 3,
}: MemberGridProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter members by search
  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const userName = getFullName(member.user).toLowerCase();
    const email = member.user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return userName.includes(query) || email.includes(query);
  });

  const gridClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  }[columns];

  return (
    <div className="space-y-4">
      {/* Search */}
      {members.length > 6 && (
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

      {/* Grid */}
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className={cn("grid gap-4", gridClass)}>
          {filteredMembers.map((member) => {
            const isCurrentUser = member.user.id === currentUserId;

            return (
              <Card
                key={member.id}
                className={cn(
                  "transition-shadow hover:shadow-md",
                  isCurrentUser && "border-primary/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Avatar & Name */}
                      <div className="flex flex-col items-center text-center mb-3">
                        <UserAvatar
                          imageUrl={member.user.profileImage}
                          firstName={member.user.firstName}
                          lastName={member.user.lastName}
                          email={member.user.email}
                          size="lg"
                          className="mb-2"
                        />
                        <div className="w-full">
                          <div className="flex items-center justify-center gap-1.5 mb-1">
                            <p className="text-sm font-medium truncate">
                              {getFullName(member.user)}
                            </p>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.user.email}
                          </p>
                        </div>
                      </div>

                      {/* Role Badge */}
                      <div className="flex justify-center mb-2">
                        <RoleBadge role={member.role} size="sm" />
                      </div>

                      {/* User Role */}
                      {member.user.role && (
                        <p className="text-center text-xs text-muted-foreground">
                          {member.user.role.name}
                        </p>
                      )}

                      {/* Venues */}
                      {member.user.venues && member.user.venues.length > 0 && (
                        <p className="text-center text-xs text-muted-foreground truncate mt-1">
                          {member.user.venues.map((v) => v.venue.name).join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Actions Menu */}
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Manage Member</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          {/* Role change options */}
                          {member.role !== "CREATOR" && onUpdateRole && (
                            <DropdownMenuItem
                              onClick={() =>
                                onUpdateRole(member.user.id, "CREATOR")
                              }
                            >
                              Make Creator
                            </DropdownMenuItem>
                          )}
                          {member.role !== "MODERATOR" && onUpdateRole && (
                            <DropdownMenuItem
                              onClick={() =>
                                onUpdateRole(member.user.id, "MODERATOR")
                              }
                            >
                              Make Moderator
                            </DropdownMenuItem>
                          )}
                          {member.role !== "MEMBER" && onUpdateRole && (
                            <DropdownMenuItem
                              onClick={() =>
                                onUpdateRole(member.user.id, "MEMBER")
                              }
                            >
                              Make Member
                            </DropdownMenuItem>
                          )}

                          {onRemoveMember && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onRemoveMember(member.user.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                Remove from Channel
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact 2-column grid for small spaces
 */
export function MemberGridCompact({
  members,
  ...props
}: Omit<MemberGridProps, "columns">) {
  return <MemberGrid members={members} columns={2} {...props} />;
}

/**
 * Wide 4-column grid for large screens
 */
export function MemberGridWide({
  members,
  ...props
}: Omit<MemberGridProps, "columns">) {
  return <MemberGrid members={members} columns={4} {...props} />;
}
