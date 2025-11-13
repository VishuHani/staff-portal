"use client";

import { useState, useEffect } from "react";
import { Search, X, Users, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFullName } from "@/lib/utils/profile";
import { cn } from "@/lib/utils";

export interface UserOption {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  active: boolean;
  role: {
    name: string;
  } | null;
  venues?: Array<{
    venue: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

interface UserPickerProps {
  users: UserOption[];
  selectedUserIds: string[];
  onSelectionChange: (userIds: string[]) => void;
  loading?: boolean;
  maxHeight?: string;
  showVenues?: boolean;
  allowMultiple?: boolean;
  excludeUserIds?: string[];
}

export function UserPicker({
  users,
  selectedUserIds,
  onSelectionChange,
  loading = false,
  maxHeight = "400px",
  showVenues = true,
  allowMultiple = true,
  excludeUserIds = [],
}: UserPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");

  // Filter out excluded users
  const availableUsers = users.filter((u) => !excludeUserIds.includes(u.id));

  // Get unique roles and venues for filters
  const roles = Array.from(new Set(availableUsers.map((u) => u.role?.name).filter(Boolean)));
  const venues = Array.from(
    new Set(
      availableUsers.flatMap((u) => u.venues?.map((v) => JSON.stringify(v.venue)) || [])
    )
  ).map((v) => JSON.parse(v));

  // Apply filters
  const filteredUsers = availableUsers.filter((user) => {
    // Search filter
    if (searchQuery) {
      const userName = getFullName(user).toLowerCase();
      const email = user.email.toLowerCase();
      const query = searchQuery.toLowerCase();
      if (!userName.includes(query) && !email.includes(query)) {
        return false;
      }
    }

    // Role filter
    if (roleFilter !== "all" && user.role?.name !== roleFilter) {
      return false;
    }

    // Venue filter
    if (venueFilter !== "all") {
      const hasVenue = user.venues?.some((v) => v.venue.id === venueFilter);
      if (!hasVenue) {
        return false;
      }
    }

    return true;
  });

  const toggleUserSelection = (userId: string) => {
    if (allowMultiple) {
      if (selectedUserIds.includes(userId)) {
        onSelectionChange(selectedUserIds.filter((id) => id !== userId));
      } else {
        onSelectionChange([...selectedUserIds, userId]);
      }
    } else {
      onSelectionChange([userId]);
    }
  };

  const selectAll = () => {
    onSelectionChange(filteredUsers.map((u) => u.id));
  };

  const deselectAll = () => {
    onSelectionChange([]);
  };

  const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role!}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showVenues && venues.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Venue</Label>
              <Select value={venueFilter} onValueChange={setVenueFilter} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
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
            </div>
          )}
        </div>
      </div>

      {/* Selection Actions */}
      {allowMultiple && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {selectedUserIds.length} of {filteredUsers.length} selected
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              disabled={loading || filteredUsers.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={deselectAll}
              disabled={loading || selectedUserIds.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Selected Users Pills */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <Badge
              key={user.id}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => toggleUserSelection(user.id)}
            >
              {getFullName(user)}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      {/* User List */}
      <ScrollArea className="rounded-md border" style={{ height: maxHeight }}>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center p-4 text-center">
            <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || roleFilter !== "all" || venueFilter !== "all"
                ? "No users match your filters"
                : "No users available"}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredUsers.map((user) => {
              const isSelected = selectedUserIds.includes(user.id);
              const userName = getFullName(user);

              return (
                <label
                  key={user.id}
                  htmlFor={`user-${user.id}`}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                >
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleUserSelection(user.id)}
                    disabled={loading}
                  />

                  <UserAvatar
                    imageUrl={user.profileImage}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    email={user.email}
                    size="sm"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{userName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {user.role && (
                        <span className="truncate">{user.role.name}</span>
                      )}
                      {showVenues && user.venues && user.venues.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="truncate">
                            {user.venues.map((v) => v.venue.name).join(", ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/**
 * Compact user picker for small spaces
 */
export function UserPickerCompact({
  users,
  selectedUserIds,
  onSelectionChange,
  loading,
}: Pick<UserPickerProps, "users" | "selectedUserIds" | "onSelectionChange" | "loading">) {
  return (
    <UserPicker
      users={users}
      selectedUserIds={selectedUserIds}
      onSelectionChange={onSelectionChange}
      loading={loading}
      maxHeight="300px"
      showVenues={false}
    />
  );
}
