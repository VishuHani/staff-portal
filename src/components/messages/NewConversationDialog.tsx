"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Users, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  findOrCreateConversation,
  createGroupConversation,
} from "@/lib/actions/conversations";
import { cn } from "@/lib/utils";

interface UserOption {
  id: string;
  email: string;
  role: {
    name: string;
  } | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserOption[];
  currentUserId: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  users,
  currentUserId,
}: NewConversationDialogProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [conversationType, setConversationType] = useState<"direct" | "group">(
    "direct"
  );

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedUsers([]);
      setGroupName("");
      setConversationType("direct");
    }
  }, [open]);

  // Filter users excluding current user
  const availableUsers = users.filter((u) => u.id !== currentUserId);

  // Filter users by search query
  const filteredUsers = availableUsers.filter((user) => {
    if (!searchQuery) return true;
    return user.email.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateDirect = async () => {
    if (selectedUsers.length !== 1) {
      toast.error("Please select exactly one user for direct messages");
      return;
    }

    setCreating(true);

    const result = await findOrCreateConversation(selectedUsers[0]);

    if (result.error) {
      toast.error(result.error);
    } else if (result.conversation) {
      toast.success("Conversation ready");
      router.push(`/messages?conversationId=${result.conversation.id}`);
      onOpenChange(false);
    }

    setCreating(false);
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 1) {
      toast.error("Please select at least one user for the group");
      return;
    }

    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setCreating(true);

    const result = await createGroupConversation({
      participantIds: selectedUsers,
      type: "GROUP",
      name: groupName.trim(),
    });

    if (result.error) {
      toast.error(result.error);
    } else if (result.conversation) {
      toast.success("Group created");
      router.push(`/messages?conversationId=${result.conversation.id}`);
      onOpenChange(false);
    }

    setCreating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conversationType === "direct") {
      handleCreateDirect();
    } else {
      handleCreateGroup();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[600px] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a direct message or create a group conversation
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={conversationType}
          onValueChange={(v) => setConversationType(v as "direct" | "group")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">
              <User className="mr-2 h-4 w-4" />
              Direct
            </TabsTrigger>
            <TabsTrigger value="group">
              <Users className="mr-2 h-4 w-4" />
              Group
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Group name input (only for groups) */}
            {conversationType === "group" && (
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="Enter group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  disabled={creating}
                />
              </div>
            )}

            {/* User search */}
            <div className="space-y-2">
              <Label htmlFor="search">
                {conversationType === "direct"
                  ? "Select user"
                  : "Select participants"}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  disabled={creating}
                />
              </div>
            </div>

            {/* Selected users badges */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((userId) => {
                  const user = availableUsers.find((u) => u.id === userId);
                  if (!user) return null;
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => toggleUserSelection(userId)}
                    >
                      {user.email}
                      <button
                        type="button"
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* User list */}
            <ScrollArea className="h-[250px] rounded-md border">
              {filteredUsers.length === 0 ? (
                <div className="flex h-full items-center justify-center p-4">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "No users found" : "No users available"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUsers.includes(user.id);
                    const isDisabled =
                      conversationType === "direct" &&
                      selectedUsers.length === 1 &&
                      !isSelected;

                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleUserSelection(user.id)}
                        disabled={isDisabled || creating}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent",
                          isSelected && "bg-accent",
                          isDisabled && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          disabled={isDisabled || creating}
                          className="pointer-events-none"
                        />

                        {/* Avatar */}
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {user.email.charAt(0).toUpperCase()}
                        </div>

                        {/* User info */}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.email}</p>
                          {user.role && (
                            <p className="text-xs text-muted-foreground">
                              {user.role.name}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  creating ||
                  selectedUsers.length === 0 ||
                  (conversationType === "direct" && selectedUsers.length !== 1) ||
                  (conversationType === "group" && !groupName.trim())
                }
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : conversationType === "direct" ? (
                  "Start Chat"
                ) : (
                  "Create Group"
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
