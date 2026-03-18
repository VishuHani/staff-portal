"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { Plus, Search, Users, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getFullName } from "@/lib/utils/profile";
import { getConversations } from "@/lib/actions/conversations";
import { useConversationListRealtime } from "@/hooks/useConversationListRealtime";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  lastMessageAt: Date | null;
  lastMessage: string | null;
  unreadCount: number;
  participants: Array<{
    user: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      profileImage?: string | null;
      role: {
        name: string;
      } | null;
    };
  }>;
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date;
    sender: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
    };
  }>;
}

interface ConversationListProps {
  currentUserId: string;
  onNewConversation: () => void;
}

export function ConversationList({
  currentUserId,
  onNewConversation,
}: ConversationListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get("conversationId");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const result = await getConversations(50);
    if (result.success && result.conversations) {
      setConversations(result.conversations as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Real-time conversation list updates
  useConversationListRealtime({
    userId: currentUserId,
    onConversationChange: loadConversations,
  });

  const filteredConversations = conversations.filter((conversation) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    // Search by conversation name
    if (conversation.name?.toLowerCase().includes(query)) return true;

    // Search by participant name or email
    const participantMatch = conversation.participants.some((p) => {
      const userName = getFullName(p.user);
      return userName.toLowerCase().includes(query) ||
             p.user.email.toLowerCase().includes(query);
    });
    if (participantMatch) return true;

    // Search by last message
    if (conversation.lastMessage?.toLowerCase().includes(query)) return true;

    return false;
  });

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === "GROUP" && conversation.name) {
      return conversation.name;
    }

    // For 1-on-1, show the other user's name
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== currentUserId
    );
    return otherParticipant ? getFullName(otherParticipant.user) : "Unknown";
  };

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(
      (p) => p.user.id !== currentUserId
    )?.user;
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isToday(d)) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (isYesterday(d)) {
      return "Yesterday";
    }
    return formatDistanceToNow(d, { addSuffix: false });
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/messages?conversationId=${conversationId}`);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Messages</h2>
          <Button
            size="sm"
            onClick={onNewConversation}
            className="h-9 w-9 rounded-xl p-0"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-xl border-muted bg-muted/50 pl-9 focus-visible:bg-background"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-1 p-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl p-3"
              >
                <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              {searchQuery
                ? "No conversations found"
                : "No conversations yet"}
            </p>
            {!searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={onNewConversation}
                className="mt-1"
              >
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {filteredConversations.map((conversation) => {
              const isSelected = selectedConversationId === conversation.id;
              const lastMessage = conversation.messages[0];
              const otherParticipant = getOtherParticipant(conversation);
              const isGroup = conversation.type === "GROUP";
              const hasUnread = conversation.unreadCount > 0;

              return (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className={cn(
                    "group relative w-full rounded-xl p-3 text-left transition-all",
                    isSelected
                      ? "bg-primary/10"
                      : "hover:bg-muted/60",
                    hasUnread && !isSelected && "bg-muted/30"
                  )}
                >
                  {/* Unread indicator */}
                  {hasUnread && (
                    <div className="absolute left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-primary" />
                  )}

                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {isGroup ? (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                      ) : otherParticipant ? (
                        <UserAvatar
                          imageUrl={otherParticipant.profileImage}
                          firstName={otherParticipant.firstName}
                          lastName={otherParticipant.lastName}
                          email={otherParticipant.email}
                          size="lg"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                          <User className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Online indicator (placeholder - would need actual online status) */}
                      {!isGroup && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm",
                            hasUnread ? "font-bold text-foreground" : "font-medium text-foreground"
                          )}
                        >
                          {getConversationTitle(conversation)}
                        </span>
                        {conversation.lastMessageAt && (
                          <span
                            className={cn(
                              "flex-shrink-0 text-xs",
                              hasUnread ? "font-medium text-primary" : "text-muted-foreground"
                            )}
                          >
                            {formatTime(conversation.lastMessageAt)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            hasUnread
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          )}
                        >
                          {lastMessage ? (
                            <>
                              <span className="text-muted-foreground">
                                {lastMessage.sender.id === currentUserId ? "You: " : ""}
                              </span>
                              {conversation.lastMessage || lastMessage.content}
                            </>
                          ) : (
                            <span className="italic text-muted-foreground">No messages yet</span>
                          )}
                        </p>
                        {hasUnread && (
                          <div className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                            {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
