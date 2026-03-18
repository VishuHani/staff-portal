"use client";

import { useState } from "react";
import { Search, Smile, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EMOJI_CATEGORIES,
  getFrequentlyUsedEmojis,
  trackEmojiUsage,
  searchEmojis,
} from "@/lib/emojis";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  trigger?: React.ReactNode;
  showTrigger?: boolean;
  open?: boolean;
  align?: "start" | "center" | "end";
}

export function EmojiPicker({
  onEmojiSelect,
  onClose,
  trigger,
  showTrigger = true,
  open,
  align = "center",
}: EmojiPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Smileys & People");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const frequentEmojis = getFrequentlyUsedEmojis();

  const handleEmojiSelect = (emoji: string) => {
    trackEmojiUsage(emoji);
    onEmojiSelect(emoji);
    if (open === undefined) {
      setShowPicker(false);
    }
    onClose();
  };

  const isOpen = open ?? showPicker;

  const filteredCategories = searchQuery
    ? [
        {
          name: "Search Results",
          icon: "🔍",
          emojis: searchEmojis(searchQuery),
        },
      ]
    : [
        {
          name: "Frequently Used",
          icon: "📊",
          emojis: frequentEmojis,
        },
        ...EMOJI_CATEGORIES,
      ];

  const selectedCategoryData = filteredCategories.find(
    (cat) => cat.name === selectedCategory
  ) || filteredCategories[0];

  return (
    <div className="relative">
      {/* Trigger button */}
      {showTrigger &&
        (trigger ? (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-lg p-2 transition-colors hover:bg-muted"
          >
            {trigger}
          </button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPicker(!showPicker)}
            className="p-2"
          >
            <Smile className="h-4 w-4" />
          </Button>
        ))}

      {/* Emoji picker */}
      {isOpen && (
        <div
          className={`absolute bottom-full mb-2 w-80 rounded-lg border border-border bg-background p-3 shadow-lg z-[100] ${
            align === "start"
              ? "left-0"
              : align === "end"
                ? "right-0"
                : "left-1/2 -translate-x-1/2"
          }`}
        >
          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search emojis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {/* Category sidebar */}
            <div className="w-10 space-y-2 overflow-y-auto max-h-64">
              {filteredCategories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => setSelectedCategory(category.name)}
                  className={`flex flex-col items-center justify-center p-1 rounded hover:bg-muted transition-colors ${
                    selectedCategory === category.name ? "bg-primary/10 text-primary" : ""
                  }`}
                  title={category.name}
                >
                  <span className="text-lg">{category.icon}</span>
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="flex-1 overflow-y-auto max-h-64">
              {selectedCategoryData.emojis.length > 0 ? (
                <div className="grid grid-cols-8 gap-1">
                  {selectedCategoryData.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <p className="text-sm">No emojis found</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
