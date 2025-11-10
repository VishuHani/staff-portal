"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
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
  Plus,
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
}

export function MessageBubble({
  message,
  currentUserId,
  isGroupChat,
  participantCount = 2,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [loadingMedia, setLoadingMedia] = useState<Record<string, boolean>>({});
  const [errorMedia, setErrorMedia] = useState<Record<string, boolean>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactingEmoji, setReactingEmoji] = useState<string | null>(null);

  const isOwn = message.sender.id === currentUserId;
  const mediaUrls = message.mediaUrls ? JSON.parse(message.mediaUrls) : [];
  const senderName = getFullName(message.sender);

  // Check if message is edited (updatedAt is different from createdAt)
  const isEdited =
    new Date(message.updatedAt).getTime() !==
    new Date(message.createdAt).getTime();

  // Calculate read status
  const readByCount = message.readBy.length;
  const isRead = readByCount > 0;
  const allRead = readByCount >= participantCount - 1; // Exclude sender

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
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension || "")) {
      return "image";
    }
    if (["mp4", "webm", "mov"].includes(extension || "")) {
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
      // Trigger refresh if callback exists
      if (onDelete) onDelete();
    }
    setReactingEmoji(null);
  };

  // Common emoji reactions
  const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  return (
    <>
      <div
        className={cn(
          "mb-4 flex gap-3",
          isOwn ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar (only show for other users in group chats or 1-on-1) */}
        {!isOwn && (
          <UserAvatar
            imageUrl={message.sender.profileImage}
            firstName={message.sender.firstName}
            lastName={message.sender.lastName}
            email={message.sender.email}
            size="sm"
          />
        )}

        <div className={cn("flex max-w-[70%] flex-col", isOwn && "items-end")}>
          {/* Sender name (only show for other users in group chats) */}
          {!isOwn && isGroupChat && (
            <span className="mb-1 px-3 text-xs font-medium text-muted-foreground">
              {senderName}
            </span>
          )}

          {/* Message bubble */}
          <div
            className={cn(
              "group relative rounded-2xl px-4 py-2",
              isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {/* Actions menu (only for own messages) */}
            {isOwn && (
              <div className="absolute -right-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 w-7 rounded-full p-0"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Message content */}
            <p className="whitespace-pre-wrap break-words text-sm">
              {message.content}
            </p>

            {/* Media attachments */}
            {mediaUrls.length > 0 && (
              <div
                className={cn(
                  "mt-2",
                  mediaUrls.length > 1
                    ? "grid grid-cols-2 gap-2"
                    : "space-y-2"
                )}
              >
                {mediaUrls.map((url: string, index: number) => {
                  const mediaType = getMediaType(url);
                  const isLoading = loadingMedia[url] !== false;
                  const hasError = errorMedia[url];

                  return (
                    <div
                      key={index}
                      className="relative overflow-hidden rounded-lg border"
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
                              className="group relative w-full cursor-zoom-in"
                            >
                              <img
                                src={url}
                                alt={`Attachment ${index + 1}`}
                                className="max-h-64 w-full object-cover transition-opacity group-hover:opacity-90"
                                onLoad={() => handleImageLoad(url)}
                                onError={() => handleImageError(url)}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                                <span className="rounded-full bg-background/90 px-3 py-1 text-xs font-medium">
                                  Click to enlarge
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
                          className="max-h-96 w-full bg-black"
                          preload="metadata"
                        />
                      )}

                      {(mediaType === "pdf" || mediaType === "other") && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "flex items-center justify-between gap-2 p-3 text-xs hover:bg-accent",
                            isOwn
                              ? "text-primary-foreground hover:bg-primary/90"
                              : "text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">
                              {mediaType === "pdf"
                                ? "PDF Document"
                                : `Attachment ${index + 1}`}
                            </span>
                          </div>
                          <Download className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timestamp and read status */}
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-xs",
                isOwn
                  ? "text-primary-foreground/70"
                  : "text-muted-foreground"
              )}
            >
              <span>
                {formatDistanceToNow(new Date(message.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {isEdited && <span>(edited)</span>}
              {isOwn && (
                <>
                  <span>•</span>
                  {allRead ? (
                    <CheckCheck className="h-3 w-3" />
                  ) : isRead ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Check className="h-3 w-3 opacity-50" />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Reactions */}
          {(Object.keys(groupedReactions).length > 0 || !isOwn) && (
            <div className={cn("mt-1 flex flex-wrap items-center gap-1", isOwn && "justify-end")}>
              {/* Display existing reactions */}
              {Object.entries(groupedReactions).map(([emoji, userIds]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  disabled={reactingEmoji === emoji}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    hasUserReacted(emoji)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-muted",
                    reactingEmoji === emoji && "opacity-50"
                  )}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{userIds.length}</span>
                </button>
              ))}

              {/* Add reaction button */}
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted",
                      isOwn ? "opacity-0 group-hover:opacity-100" : ""
                    )}
                  >
                    <Smile className="h-3 w-3" />
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
                          "flex h-8 w-8 items-center justify-center rounded hover:bg-muted transition-colors",
                          hasUserReacted(emoji) && "bg-primary/10",
                          reactingEmoji === emoji && "opacity-50"
                        )}
                      >
                        <span className="text-lg">{emoji}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
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
        <DialogContent className="max-w-4xl p-0">
          <DialogClose className="absolute right-4 top-4 z-10 rounded-full bg-background/80 p-2 hover:bg-background">
            <X className="h-4 w-4" />
          </DialogClose>
          {selectedMedia && (
            <div className="flex items-center justify-center bg-black">
              <img
                src={selectedMedia}
                alt="Full size"
                className="max-h-[90vh] w-full object-contain"
              />
            </div>
          )}
          <div className="absolute bottom-4 right-4">
            <Button
              variant="secondary"
              size="sm"
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
}
