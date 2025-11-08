"use client";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";

interface ReactionGroup {
  emoji: string;
  count: number;
  users: { id: string; email: string }[];
  hasReacted: boolean;
}

interface ReactionPickerProps {
  reactions: ReactionGroup[];
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

export function ReactionPicker({
  reactions,
  onReact,
  disabled = false,
}: ReactionPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Existing Reactions */}
      {reactions.map((reaction) => (
        <HoverCard key={reaction.emoji}>
          <HoverCardTrigger asChild>
            <Button
              variant={reaction.hasReacted ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 gap-1.5 px-2.5",
                reaction.hasReacted &&
                  "bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20 dark:hover:bg-primary/30"
              )}
              onClick={() => onReact(reaction.emoji)}
              disabled={disabled}
            >
              <span className="text-base leading-none">{reaction.emoji}</span>
              <span className="text-xs font-semibold">{reaction.count}</span>
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto p-2" side="top">
            <div className="space-y-1">
              {reaction.users.slice(0, 10).map((user) => (
                <div key={user.id} className="text-xs">
                  {user.email}
                </div>
              ))}
              {reaction.users.length > 10 && (
                <div className="text-xs text-muted-foreground">
                  +{reaction.users.length - 10} more
                </div>
              )}
            </div>
          </HoverCardContent>
        </HoverCard>
      ))}

      {/* Enhanced Emoji Picker */}
      <EmojiPicker onEmojiSelect={onReact} />
    </div>
  );
}
