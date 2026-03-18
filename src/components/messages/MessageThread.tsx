"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Loader2, Users, Settings, ArrowLeft, Search, X, MessageSquare, Bell, BellOff, Trash2, LogOut, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFullName } from "@/lib/utils/profile";
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
import { 
  getConversationById, 
  deleteConversation, 
  leaveConversation, 
  muteConversation 
} from "@/lib/actions/conversations";
import { useMessageRealtime } from "@/hooks/useMessageRealtime";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Message {
  id: string;
  content: string;
  mediaUrls: string | null;
  reactions: string | null;
  readBy: string[];
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    role: {
      name: string;
    } | null;
  };
  replyTo?: {
    id: string;
    content: string;
    sender: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
    };
  } | null;
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
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
}

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  currentUserEmail: string;
  onBack?: () => void;
}

// Group messages by sender for avatar display optimization - memoized
const useGroupedMessages = (messages: Message[]) => {
  return useMemo(() => {
    const groups: { message: Message; showAvatar: boolean; isLastInGroup: boolean }[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const prevMessage = messages[i - 1];
      const nextMessage = messages[i + 1];
      
      // Show avatar if:
      // - It's the first message
      // - Different sender from previous
      // - More than 5 minutes gap from previous
      const showAvatar = !prevMessage || 
        prevMessage.sender.id !== message.sender.id ||
        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 5 * 60 * 1000;
      
      // Is last in group if:
      // - It's the last message
      // - Different sender from next
      // - More than 5 minutes gap from next
      const isLastInGroup = !nextMessage ||
        nextMessage.sender.id !== message.sender.id ||
        new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime() > 5 * 60 * 1000;
      
      groups.push({ message, showAvatar, isLastInGroup });
    }
    
    return groups;
  }, [messages]);
};

// Get date separator label
const getDateLabel = (date: Date) => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d, yyyy");
};

export function MessageThread({
  conversationId,
  currentUserId,
  currentUserEmail,
  onBack,
}: MessageThreadProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // Conversation options state
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMuteDialog, setShowMuteDialog] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<Date | null>(null);

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
    if (scrollRef.current && !loading && !loadingMore) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, loadingMore]);

  const loadConversation = async () => {
    const result = await getConversationById(conversationId);
    if (result.success && result.conversation) {
      const conv = result.conversation as any;
      setConversation(conv);
      
      // Check if current user has muted the conversation
      const currentParticipant = conv.participants.find(
        (p: any) => p.user.id === currentUserId
      );
      if (currentParticipant && currentParticipant.mutedUntil) {
        const mutedUntilDate = new Date(currentParticipant.mutedUntil);
        if (mutedUntilDate > new Date()) {
          setIsMuted(true);
          setMutedUntil(mutedUntilDate);
        }
      }
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

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
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

  // Conversation options handlers
  const handleViewParticipants = () => {
    setShowParticipants(true);
  };

  const handleMuteConversation = async (duration: number | undefined) => {
    const result = await muteConversation({ 
      conversationId, 
      duration 
    });
    
    if (result.success) {
      if (duration) {
        setIsMuted(true);
        const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);
        setMutedUntil(endTime);
        toast.success(`Conversation muted for ${duration} hour${duration > 1 ? 's' : ''}`);
      } else {
        setIsMuted(false);
        setMutedUntil(null);
        toast.success("Conversation unmuted");
      }
    } else {
      toast.error(result.error || "Failed to update mute status");
    }
    
    setShowMuteDialog(false);
  };

  const handleDeleteConversation = async () => {
    const result = await deleteConversation(conversationId);
    
    if (result.success) {
      toast.success("Conversation deleted");
      router.push("/messages");
    } else {
      toast.error(result.error || "Failed to delete conversation");
    }
    
    setShowDeleteDialog(false);
  };

  const handleLeaveConversation = async () => {
    const result = await leaveConversation(conversationId);
    
    if (result.success) {
      toast.success("You left the conversation");
      router.push("/messages");
    } else {
      toast.error(result.error || "Failed to leave conversation");
    }
    
    setShowLeaveDialog(false);
  };

  const getConversationTitle = () => {
    if (!conversation) return "Messages";

    if (conversation.type === "GROUP" && conversation.name) {
      return conversation.name;
    }

    // For 1-on-1, show the other user's name
    const otherParticipant = conversation.participants.find(
      (p) => p.user.id !== currentUserId
    );
    return otherParticipant ? getFullName(otherParticipant.user) : "Unknown";
  };

  const getParticipantsList = () => {
    if (!conversation) return "";
    return conversation.participants.map((p) => getFullName(p.user)).join(", ");
  };

  const isGroupChat = conversation?.type === "GROUP";

  // Group messages for optimized avatar display - memoized for performance
  const groupedMessages = useGroupedMessages(messages);

  // Get unique dates for separators
  const getMessageDate = (date: Date) => new Date(date).toDateString();
  const uniqueDates = [...new Set(messages.map(m => getMessageDate(m.createdAt)))];

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">Conversation not found</h3>
        <p className="text-sm text-muted-foreground">
          The conversation you're looking for doesn't exist or you don't have access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-9 w-9 rounded-xl lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40">
            {isGroupChat ? (
              <Users className="h-5 w-5 text-primary" />
            ) : (
              <span className="text-sm font-bold text-primary">
                {getConversationTitle().charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Title and participants */}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{getConversationTitle()}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {isGroupChat
                ? `${conversation.participants.length} participants`
                : "Direct message"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className={cn(
              "h-9 w-9 rounded-xl",
              showSearch && "bg-primary/10 text-primary"
            )}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Settings menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewParticipants}>
                <Users className="mr-2 h-4 w-4" />
                View participants
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowMuteDialog(true)}>
                {isMuted ? (
                  <BellOff className="mr-2 h-4 w-4" />
                ) : (
                  <Bell className="mr-2 h-4 w-4" />
                )}
                {isMuted ? "Unmute conversation" : "Mute conversation"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={isGroupChat ? () => setShowLeaveDialog(true) : () => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                {isGroupChat ? (
                  <LogOut className="mr-2 h-4 w-4" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
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
              className="h-10 rounded-xl border-muted bg-background pl-9 pr-9"
              autoFocus
            />
            {(searchQuery || searching) && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="py-4">
          {/* Load more button */}
          {hasMore && (
            <div className="mb-6 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadMessages(true)}
                disabled={loadingMore}
                className="rounded-full"
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
              <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto">
                    <Search className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No messages found for "{searchQuery}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentUserId={currentUserId}
                    isGroupChat={isGroupChat}
                    participantCount={conversation.participants.length}
                    onDelete={handleMessageDeleted}
                    showReplyButton={false}
                  />
                ))}
              </div>
            )
          ) : messages.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/20 mx-auto">
                  <MessageSquare className="h-8 w-8 text-primary/60" />
                </div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  No messages yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Send a message to start the conversation
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {groupedMessages.map(({ message, showAvatar, isLastInGroup }, index) => {
                const currentDate = getMessageDate(message.createdAt);
                const showDateSeparator = index === 0 || 
                  getMessageDate(messages[index - 1].createdAt) !== currentDate;

                return (
                  <div key={message.id}>
                    {/* Date separator */}
                    {showDateSeparator && (
                      <div className="sticky top-0 z-10 my-4 flex items-center justify-center">
                        <div className="rounded-full bg-muted px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                          {getDateLabel(message.createdAt)}
                        </div>
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      currentUserId={currentUserId}
                      isGroupChat={isGroupChat}
                      participantCount={conversation.participants.length}
                      onDelete={handleMessageDeleted}
                      onReply={() => handleReply(message)}
                      showAvatar={showAvatar}
                      isLastInGroup={isLastInGroup}
                      onReaction={handleMessageSent}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
                ? `${getFullName(typingUsers[0])} is typing...`
                : typingUsers.length === 2
                ? `${getFullName(typingUsers[0])} and ${getFullName(typingUsers[1])} are typing...`
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
        replyingTo={
          replyingTo
            ? {
                id: replyingTo.id,
                content: replyingTo.content,
                senderName: getFullName(replyingTo.sender),
              }
            : null
        }
        onCancelReply={handleCancelReply}
      />

      {/* View Participants Dialog */}
      <Dialog open={showParticipants} onOpenChange={setShowParticipants}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Participants</DialogTitle>
            <DialogDescription>
              {conversation.participants.length} participant{conversation.participants.length !== 1 ? 's' : ''} in this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {conversation.participants.map((participant) => (
              <div key={participant.user.id} className="flex items-center gap-3">
                <UserAvatar
                  imageUrl={participant.user.profileImage}
                  firstName={participant.user.firstName}
                  lastName={participant.user.lastName}
                  email={participant.user.email}
                  size="sm"
                />
                <div className="flex-1">
                  <p className="font-medium">{getFullName(participant.user)}</p>
                  <p className="text-sm text-muted-foreground">{participant.user.email}</p>
                  {participant.user.role && (
                    <p className="text-xs text-muted-foreground">{participant.user.role.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mute Conversation Dialog */}
      <Dialog open={showMuteDialog} onOpenChange={setShowMuteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isMuted ? "Unmute Conversation" : "Mute Conversation"}</DialogTitle>
            <DialogDescription>
              {isMuted 
                ? "Unmute to start receiving notifications again."
                : "Choose how long you want to mute notifications for this conversation."}
            </DialogDescription>
          </DialogHeader>
          
          {!isMuted ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Mute duration:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleMuteConversation(1)}
                >
                  1 hour
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleMuteConversation(24)}
                >
                  24 hours
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleMuteConversation(168)}
                >
                  1 week
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleMuteConversation(720)}
                >
                  1 month
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <BellOff className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm">
                This conversation is muted until{" "}
                <span className="font-medium">
                  {mutedUntil ? format(mutedUntil, "MMM d, h:mm a") : "unknown"}
                </span>
              </p>
            </div>
          )}
          
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowMuteDialog(false)}>
              Cancel
            </Button>
            {isMuted ? (
              <Button onClick={() => handleMuteConversation(undefined)}>
                Unmute
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={() => handleMuteConversation(undefined)}
              >
                Mute forever
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Conversation Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave "{getConversationTitle()}"?
              You won't be able to rejoin unless someone invites you again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowLeaveDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLeaveConversation}>
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Conversation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation?
              This action cannot be undone and all messages will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConversation}>
              Delete Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
