"use client";

import { useState, memo, useMemo, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  MoreVertical,
  Edit,
  Trash2,
  Check,
  CheckCheck,
  FileText,
  X,
  Download,
  Loader2,
  Smile,
  Reply,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getFullName } from "@/lib/utils/profile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { deleteMessage, toggleReaction } from "@/lib/actions/messages";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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

interface Reaction {
  emoji: string;
  userId: string;
}

interface MessageBubbleProps {
  message: Message;
  currentUserId: string;
  isGroupChat: boolean;
  participantCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  showReplyButton?: boolean;
  showAvatar?: boolean;
  isLastInGroup?: boolean;
  onReaction?: () => void;
}

// Memoized component for performance
export const MessageBubble = memo(function MessageBubble({
  message,
  currentUserId,
  isGroupChat,
  participantCount = 2,
  onEdit,
  onDelete,
  onReply,
  showReplyButton = true,
  showAvatar = true,
  isLastInGroup = true,
  onReaction,
}: MessageBubbleProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});
  const [errorMedia, setErrorMedia] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactingEmoji, setReactingEmoji] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isOwn = message.sender.id === currentUserId;
  const mediaUrls = message.mediaUrls ? JSON.parse(message.mediaUrls) : [];
  const senderName = getFullName(message.sender);

  // Check if message is edited
  const isEdited =
    new Date(message.updatedAt).getTime() !==
    new Date(message.createdAt).getTime();

  // Calculate read status
  const readByCount = message.readBy.length;
  const isRead = readByCount > 0;
  const allRead = readByCount >= participantCount - 1;

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteMessage({ id: message.id });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Message deleted");
      setDeleteDialogOpen(false);
      if (onDelete) onDelete();
    }
    setDeleting(false);
  };

  const openLightbox = (url: string) => {
    setSelectedMedia(url);
    setLightboxOpen(true);
  };

  const handleImageLoad = (url: string) => {
    setLoadingMedia((prev) => ({ ...prev, [url]: false }));
  };

  const handleImageError = (url: string) => {
    setLoadingMedia((prev) => ({ ...prev, [url]: false }));
    setErrorMedia((prev) => ({ ...prev, [url]: true }));
  };

  const getMediaType = (url: string) => {
    const extension = url.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(extension || "")) {
      return "image";
    }
    if (["mp4", "webm", "mov", "quicktime"].includes(extension || "")) {
      return "video";
    }
    if (["pdf"].includes(extension || "")) {
      return "pdf";
    }
    return "other";
  };

  // Parse reactions
  const reactions: Reaction[] = message.reactions
    ? JSON.parse(message.reactions)
    : [];

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction.userId);
    return acc;
  }, {} as Record<string, string[]>);

  // Check if current user reacted with specific emoji
  const hasUserReacted = (emoji: string) => {
    return groupedReactions[emoji]?.includes(currentUserId) || false;
  };

  // Handle reaction toggle
  const handleReaction = async (emoji: string) => {
    setReactingEmoji(emoji);
    const result = await toggleReaction({
      messageId: message.id,
      emoji,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      setShowEmojiPicker(false);
      if (onReaction) onReaction();
    }
    setReactingEmoji(null);
  };

  // Common emoji reactions
  const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏"];

  // Format full timestamp for tooltip
  const fullTimestamp = format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a");

  return (
    <>
      <div
        className={cn(
          "group relative flex gap-3 px-4 py-1 transition-colors hover:bg-muted/30",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Avatar - only show for first message in group or if explicitly requested */}
        {showAvatar ? (
          <div className="flex-shrink-0 pt-1">
            {!isOwn ? (
              <UserAvatar
                imageUrl={message.sender.profileImage}
                firstName={message.sender.firstName}
                lastName={message.sender.lastName}
                email={message.sender.email}
                size="md"
              />
            ) : (
              <div className="h-10 w-10" /> // Spacer for own messages
            )}
          </div>
        ) : (
          <div className="w-10 flex-shrink-0" /> // Spacer when avatar is hidden
        )}

        <div className={cn("flex max-w-[75%] flex-col", isOwn && "items-end")}>
          {/* Sender name (only show for other users in group chats and when avatar is shown) */}
          {showAvatar && !isOwn && isGroupChat && (
            <span className="mb-0.5 px-1 text-xs font-semibold text-muted-foreground">
              {senderName}
            </span>
          )}

          {/* Reply context */}
          {message.replyTo && (
            <div
              className={cn(
                "mb-1 flex items-center gap-1.5 rounded-lg border-l-2 bg-muted/50 px-2 py-1.5 text-xs",
                isOwn
                  ? "border-primary/50 bg-primary/5"
                  : "border-muted-foreground/50"
              )}
            >
              <CornerDownRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">
                {message.replyTo.sender.firstName || message.replyTo.sender.lastName
                  ? `${message.replyTo.sender.firstName || ""} ${message.replyTo.sender.lastName || ""}`.trim()
                  : "User"}
              </span>
              <span className="truncate max-w-[200px] text-muted-foreground/80">
                {message.replyTo.content}
              </span>
            </div>
          )}

          {/* Message bubble container */}
          <div className="relative">
            {/* Actions menu - floating on hover */}
            <div
              className={cn(
                "absolute -top-8 z-10 flex items-center gap-0.5 rounded-full border bg-background p-0.5 shadow-sm transition-all",
                isOwn ? "right-0" : "left-0",
                isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              {/* Quick reaction button */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align={isOwn ? "end" : "start"}>
                  <div className="flex flex-wrap gap-1">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        disabled={reactingEmoji === emoji}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-all hover:scale-110 hover:bg-muted",
                          hasUserReacted(emoji) && "bg-primary/10",
                          reactingEmoji === emoji && "opacity-50"
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Reply button */}
              {onReply && showReplyButton && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReply();
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Reply className="h-4 w-4" />
                </button>
              )}

              {/* More actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isOwn ? "end" : "start"}>
                  {isOwn && onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {isOwn && (
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Message bubble */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "relative rounded-2xl px-4 py-2.5 shadow-sm transition-all",
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md",
                      isEdited && "pb-4"
                    )}
                  >
                    {/* Message content */}
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.content}
                    </p>

                    {/* Media attachments */}
                    {mediaUrls.length > 0 && (
                      <div
                        className={cn(
                          "mt-2 gap-1.5",
                          mediaUrls.length > 1
                            ? "grid grid-cols-2"
                            : "space-y-1.5"
                        )}
                      >
                        {mediaUrls.map((url: string, index: number) => {
                          const mediaType = getMediaType(url);
                          const isLoading = loadingMedia[url] !== false;
                          const hasError = errorMedia[url];

                          return (
                            <div
                              key={index}
                              className={cn(
                                "relative overflow-hidden rounded-lg",
                                mediaType === "image" ? "bg-black" : "bg-muted/50"
                              )}
                            >
                              {mediaType === "image" && (
                                <>
                                  {isLoading && !hasError && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                  )}
                                  {hasError ? (
                                    <div className="flex h-32 items-center justify-center bg-muted p-4 text-center">
                                      <p className="text-xs text-muted-foreground">
                                        Failed to load image
                                      </p>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openLightbox(url)}
                                      className="group relative block w-full cursor-zoom-in"
                                    >
                                      <img
                                        src={url}
                                        alt={`Attachment ${index + 1}`}
                                        className="max-h-64 w-full object-cover transition-all duration-300 group-hover:brightness-110"
                                        onLoad={() => handleImageLoad(url)}
                                        onError={() => handleImageError(url)}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
                                        <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-black shadow-lg">
                                          View
                                        </span>
                                      </div>
                                    </button>
                                  )}
                                </>
                              )}

                              {mediaType === "video" && (
                                <video
                                  src={url}
                                  controls
                                  className="max-h-80 w-full bg-black"
                                  preload="metadata"
                                  controlsList="nodownload"
                                />
                              )}

                              {(mediaType === "pdf" || mediaType === "other") && (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted",
                                    isOwn
                                      ? "text-primary-foreground/90 hover:bg-primary/90"
                                      : "text-foreground"
                                  )}
                                >
                                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/80">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-medium">
                                      {mediaType === "pdf"
                                        ? "PDF Document"
                                        : `Attachment ${index + 1}`}
                                    </p>
                                    <p className="text-xs opacity-70">Click to open</p>
                                  </div>
                                  <Download className="h-4 w-4 flex-shrink-0 opacity-70" />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Edited indicator */}
                    {isEdited && (
                      <span className="absolute bottom-1 right-3 text-[10px] opacity-60">
                        edited
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side={isOwn ? "left" : "right"}>
                  <p className="text-xs">{fullTimestamp}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Reactions - floating badges */}
            {Object.keys(groupedReactions).length > 0 && (
              <div
                className={cn(
                  "mt-1 flex flex-wrap items-center gap-1",
                  isOwn && "justify-end"
                )}
              >
                {Object.entries(groupedReactions).map(([emoji, userIds]) => (
                  <TooltipProvider key={emoji}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleReaction(emoji)}
                          disabled={reactingEmoji === emoji}
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-all hover:scale-105",
                            hasUserReacted(emoji)
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border bg-background shadow-sm hover:bg-muted",
                            reactingEmoji === emoji && "opacity-50"
                          )}
                        >
                          <span>{emoji}</span>
                          <span className="text-xs font-medium">{userIds.length}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{userIds.length} reaction{userIds.length !== 1 ? "s" : ""}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            )}

            {/* Timestamp and read status */}
            {isLastInGroup && (
              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 px-1",
                  isOwn ? "justify-end" : "justify-start"
                )}
              >
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: false,
                  })}
                </span>
                {isOwn && (
                  <>
                    <span className="text-[11px] text-muted-foreground">•</span>
                    {allRead ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCheck className="h-3 w-3 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Read by everyone</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : isRead ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCheck className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Delivered</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Check className="h-3 w-3 text-muted-foreground/50" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Sent</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl overflow-hidden border-0 bg-black/95 p-0">
          <DialogClose className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
            <X className="h-5 w-5" />
          </DialogClose>
          {selectedMedia && (
            <div className="flex items-center justify-center">
              <img
                src={selectedMedia}
                alt="Full size"
                className="max-h-[90vh] w-full object-contain"
              />
            </div>
          )}
          <div className="absolute bottom-6 right-6">
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
              asChild
            >
              <a
                href={selectedMedia || "#"}
                download
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
