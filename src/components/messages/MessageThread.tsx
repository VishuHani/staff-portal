"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, Settings, ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import {
  getMessages,
  markConversationAsRead,
  searchMessages,
} from "@/lib/actions/messages";
import { getConversationById } from "@/lib/actions/conversations";
import { useMessageRealtime } from "@/hooks/useMessageRealtime";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  mediaUrls: string | null;
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    email: string;
    role: {
      name: string;
    } | null;
  };
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  participants: Array<{
    user: {
      id: string;
      email: string;
      role: {
        name: string;
      } | null;
    };
  }>;
}

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  currentUserEmail: string;
  onBack?: () => void;
}

export function MessageThread({
  conversationId,
  currentUserId,
  currentUserEmail,
  onBack,
}: MessageThreadProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadConversation();
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    // Mark conversation as read when viewing
    markConversationAsRead({ conversationId });
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom on new messages
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversation = async () => {
    const result = await getConversationById(conversationId);
    if (result.success && result.conversation) {
      setConversation(result.conversation as any);
    } else {
      toast.error(result.error || "Failed to load conversation");
    }
  };

  const loadMessages = useCallback(
    async (loadMore = false) => {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const result = await getMessages(
        conversationId,
        50,
        loadMore ? cursor : undefined
      );

      if (result.success && result.messages) {
        if (loadMore) {
          setMessages((prev) => [...(result.messages as any), ...prev]);
        } else {
          setMessages(result.messages as any);
        }
        setHasMore(result.hasMore || false);
        setCursor(result.nextCursor);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [conversationId, cursor]
  );

  // Real-time message updates
  useMessageRealtime({
    conversationId,
    onNewMessage: loadMessages,
    onMessageUpdate: loadMessages,
    onMessageDelete: loadMessages,
  });

  // Typing indicators
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator({
    conversationId,
    currentUserId,
    currentUserEmail,
  });

  const handleMessageSent = async () => {
    // Reload messages
    await loadMessages();
  };

  const handleMessageDeleted = async () => {
    // Reload messages
    await loadMessages();
  };

  const handleSearch = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const result = await searchMessages(query);

    if (result.error) {
      toast.error(result.error);
      setSearchResults([]);
    } else if (result.messages) {
      // Filter results to only show messages from this conversation
      const filteredResults = result.messages.filter(
        (msg: any) => msg.conversation.id === conversationId
      );
      setSearchResults(filteredResults as any);
    }

    setSearching(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  const getConversationTitle = () => {
    if (!conversation) return "Messages";

    if (conversation.type === "GROUP" && conversation.name) {
      return conversation.name;
    }

    // For 1-on-1, show the other user's email
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== currentUserId
    );
    return otherParticipant?.user.email || "Unknown";
  };

  const getParticipantsList = () => {
    if (!conversation) return "";
    return conversation.participants.map((p) => p.user.email).join(", ");
  };

  const isGroupChat = conversation?.type === "GROUP";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Conversation not found
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Avatar */}
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isGroupChat ? (
              <Users className="h-5 w-5" />
            ) : (
              <span className="text-sm font-semibold">
                {getConversationTitle().charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Title and participants */}
          <div>
            <h2 className="font-semibold">{getConversationTitle()}</h2>
            <p className="text-xs text-muted-foreground">
              {isGroupChat
                ? `${conversation.participants.length} participants`
                : "Direct message"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Settings menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <Users className="mr-2 h-4 w-4" />
                View participants
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                Mute conversation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-destructive">
                {isGroupChat ? "Leave group" : "Delete conversation"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="border-b bg-muted/30 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {(searchQuery || searching) && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          {searchResults.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Found {searchResults.length} message{searchResults.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {/* Load more button */}
        {hasMore && (
          <div className="mb-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMessages(true)}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load older messages"
              )}
            </Button>
          </div>
        )}

        {/* Messages list */}
        {showSearch && searchQuery.length >= 2 ? (
          // Show search results
          searchResults.length === 0 && !searching ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Search className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No messages found for &quot;{searchQuery}&quot;
                </p>
              </div>
            </div>
          ) : (
            <div>
              {searchResults.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  currentUserId={currentUserId}
                  isGroupChat={isGroupChat}
                  participantCount={conversation.participants.length}
                  onDelete={handleMessageDeleted}
                />
              ))}
            </div>
          )
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Users className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          <div>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                currentUserId={currentUserId}
                isGroupChat={isGroupChat}
                participantCount={conversation.participants.length}
                onDelete={handleMessageDeleted}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="border-t bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              {typingUsers.length === 1
                ? `${typingUsers[0].email.split("@")[0]} is typing...`
                : typingUsers.length === 2
                ? `${typingUsers[0].email.split("@")[0]} and ${typingUsers[1].email.split("@")[0]} are typing...`
                : `${typingUsers.length} people are typing...`}
            </p>
          </div>
        </div>
      )}

      {/* Input */}
      <MessageInput
        conversationId={conversationId}
        onMessageSent={handleMessageSent}
        onStartTyping={startTyping}
        onStopTyping={stopTyping}
      />
    </div>
  );
}
