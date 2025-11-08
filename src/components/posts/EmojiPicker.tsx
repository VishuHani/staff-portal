"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Smile } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EMOJI_CATEGORIES,
  getFrequentlyUsedEmojis,
  trackEmojiUsage,
  searchEmojis,
} from "@/lib/emojis";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  trigger?: React.ReactNode;
}

export function EmojiPicker({ onEmojiSelect, trigger }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [frequentEmojis, setFrequentEmojis] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("frequent");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFrequentEmojis(getFrequentlyUsedEmojis());
      // Focus search input when popover opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleEmojiClick = (emoji: string) => {
    trackEmojiUsage(emoji);
    onEmojiSelect(emoji);
    setOpen(false);
    setSearchQuery("");
  };

  const searchResults = searchQuery.trim() ? searchEmojis(searchQuery) : [];
  const showSearchResults = searchQuery.trim().length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            type="button"
          >
            <Smile className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-[350px] p-0"
        align="start"
        side="top"
        sideOffset={8}
      >
        <div className="flex flex-col h-[400px]">
          {/* Search Input */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search emojis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Search Results or Category Tabs */}
          {showSearchResults ? (
            <ScrollArea className="flex-1 p-3">
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-8 gap-1">
                  {searchResults.map((emoji, index) => (
                    <button
                      key={`${emoji}-${index}`}
                      onClick={() => handleEmojiClick(emoji)}
                      className="aspect-square flex items-center justify-center text-2xl hover:bg-accent rounded transition-colors"
                      type="button"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Smile className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No emojis found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching for common terms like "happy", "love", or
                    "food"
                  </p>
                </div>
              )}
            </ScrollArea>
          ) : (
            <Tabs
              value={selectedCategory}
              onValueChange={setSelectedCategory}
              className="flex-1 flex flex-col"
            >
              <TabsList className="w-full h-auto grid grid-cols-9 gap-0 rounded-none border-b bg-transparent p-0">
                <TabsTrigger
                  value="frequent"
                  className={cn(
                    "rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-12 text-lg",
                    "hover:bg-accent"
                  )}
                  title="Frequently Used"
                >
                  🕐
                </TabsTrigger>
                {EMOJI_CATEGORIES.map((category) => (
                  <TabsTrigger
                    key={category.name}
                    value={category.name}
                    className={cn(
                      "rounded-none border-b-2 border-transparent data-[state=active]:border-primary h-12 text-lg",
                      "hover:bg-accent"
                    )}
                    title={category.name}
                  >
                    {category.icon}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Frequently Used */}
              <TabsContent value="frequent" className="flex-1 m-0">
                <ScrollArea className="h-[280px] p-3">
                  {frequentEmojis.length > 0 ? (
                    <>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                        Frequently Used
                      </h3>
                      <div className="grid grid-cols-8 gap-1">
                        {frequentEmojis.map((emoji, index) => (
                          <button
                            key={`${emoji}-${index}`}
                            onClick={() => handleEmojiClick(emoji)}
                            className="aspect-square flex items-center justify-center text-2xl hover:bg-accent rounded transition-colors"
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Smile className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No frequently used emojis yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start reacting to build your favorites!
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Category Tabs */}
              {EMOJI_CATEGORIES.map((category) => (
                <TabsContent
                  key={category.name}
                  value={category.name}
                  className="flex-1 m-0"
                >
                  <ScrollArea className="h-[280px] p-3">
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-8 gap-1">
                      {category.emojis.map((emoji, index) => (
                        <button
                          key={`${emoji}-${index}`}
                          onClick={() => handleEmojiClick(emoji)}
                          className="aspect-square flex items-center justify-center text-2xl hover:bg-accent rounded transition-colors"
                          type="button"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
