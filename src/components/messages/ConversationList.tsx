"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getFullName } from "@/lib/utils/profile";
import { getConversations } from "@/lib/actions/conversations";
import { useConversationListRealtime } from "@/hooks/useConversationListRealtime";

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

  const getConversationIcon = (conversation: Conversation) => {
    if (conversation.type === "GROUP") {
      return <Users className="h-5 w-5" />;
    }
    return <User className="h-5 w-5" />;
  };

  const handleConversationClick = (conversationId: string) => {
    router.push(`/messages?conversationId=${conversationId}`);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Button size="sm" onClick={onNewConversation}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg bg-muted"
              />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Users className="mb-2 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? "No conversations found"
                : "No conversations yet"}
            </p>
            {!searchQuery && (
              <Button
                variant="link"
                size="sm"
                onClick={onNewConversation}
                className="mt-2"
              >
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => {
              const isSelected = selectedConversationId === conversation.id;
              const lastMessage = conversation.messages[0];

              return (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className={cn(
                    "w-full rounded-lg p-3 text-left transition-colors hover:bg-accent",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {getConversationIcon(conversation)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            conversation.unreadCount > 0 && "font-bold"
                          )}
                        >
                          {getConversationTitle(conversation)}
                        </span>
                        {conversation.lastMessageAt && (
                          <span className="flex-shrink-0 text-xs text-muted-foreground">
                            {formatDistanceToNow(
                              new Date(conversation.lastMessageAt),
                              { addSuffix: false }
                            )}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-xs text-muted-foreground",
                            conversation.unreadCount > 0 && "font-medium"
                          )}
                        >
                          {lastMessage
                            ? `${lastMessage.sender.id === currentUserId ? "You: " : ""}${conversation.lastMessage || lastMessage.content}`
                            : "No messages yet"}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <Badge
                            variant="default"
                            className="h-5 min-w-5 flex-shrink-0 rounded-full px-1.5 text-xs"
                          >
                            {conversation.unreadCount}
                          </Badge>
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
