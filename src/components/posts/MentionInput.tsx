"use client";

import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  users: User[];
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  maxLength,
  rows = 2,
  disabled = false,
  autoFocus = false,
  users,
  className,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 300 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Handle @ detection and user filtering
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // Check if there's a space after @, if yes, don't show suggestions
      if (textAfterAt.includes(" ")) {
        setShowSuggestions(false);
        return;
      }

      const search = textAfterAt.toLowerCase();
      setMentionSearch(search);

      const filtered = users.filter((user) =>
        user.email.toLowerCase().includes(search)
      );

      if (filtered.length > 0) {
        setFilteredUsers(filtered);
        setShowSuggestions(true);
        setSelectedIndex(0);

        // Calculate dropdown position
        if (textarea) {
          const rect = textarea.getBoundingClientRect();
          setDropdownPosition({
            top: rect.bottom,
            left: rect.left,
            width: rect.width,
          });
        }
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [value, users, cursorPosition]);

  const insertMention = (user: User) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const textAfterCursor = value.substring(cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    const newValue =
      textBeforeCursor.substring(0, lastAtIndex) +
      `@${user.email} ` +
      textAfterCursor;

    onChange(newValue);
    setShowSuggestions(false);

    // Set cursor position after mention
    setTimeout(() => {
      const newCursorPos = lastAtIndex + user.email.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredUsers[selectedIndex]) {
          insertMention(filteredUsers[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
      }
    } else if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart);
  };

  const handleSelect = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    setCursorPosition(e.currentTarget.selectionStart);
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={handleSelect}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={cn("resize-none", className)}
        disabled={disabled}
        autoFocus={autoFocus}
      />

      {/* Mention Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="fixed z-[100]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
        >
          <Command className="rounded-lg border shadow-lg bg-popover mt-1">
            <CommandList className="max-h-[200px]">
              <CommandEmpty>No users found</CommandEmpty>
              <CommandGroup heading="Mention user">
                {filteredUsers.map((user, index) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => insertMention(user)}
                    className={cn(
                      "cursor-pointer",
                      index === selectedIndex && "bg-accent"
                    )}
                  >
                    <span className="font-medium">@{user.email}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}
