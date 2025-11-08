"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Hash, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getChannels } from "@/lib/actions/channels";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  archived: boolean;
  _count: {
    posts: number;
  };
}

interface ChannelSelectorProps {
  value?: string;
  onChange: (channelId: string) => void;
  includeArchived?: boolean;
  className?: string;
}

export function ChannelSelector({
  value,
  onChange,
  includeArchived = false,
  className,
}: ChannelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChannels() {
      try {
        setLoading(true);
        const result = await getChannels({ includeArchived });

        if (result.channels) {
          setChannels(result.channels);
        }
      } catch (err) {
        console.error("Failed to load channels:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchChannels();
  }, [includeArchived]);

  const selectedChannel = channels.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[250px] justify-between", className)}
        >
          <div className="flex items-center gap-2">
            {selectedChannel ? (
              <>
                <span className="text-base">
                  {selectedChannel.icon || <Hash className="h-4 w-4" />}
                </span>
                <span className="truncate">{selectedChannel.name}</span>
              </>
            ) : (
              <>
                <Hash className="h-4 w-4" />
                <span>All Channels</span>
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search channels..." />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No channels found.</CommandEmpty>
                <CommandGroup>
                  {/* All Channels Option */}
                  <CommandItem
                    value="all-channels"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <Hash className="mr-2 h-4 w-4" />
                    <span>All Channels</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {channels.reduce((acc, c) => acc + c._count.posts, 0)}
                    </span>
                  </CommandItem>

                  {/* Individual Channels */}
                  {channels
                    .filter((c) => !c.archived)
                    .map((channel) => (
                      <CommandItem
                        key={channel.id}
                        value={channel.name}
                        onSelect={() => {
                          onChange(channel.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === channel.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="mr-2 text-base">
                          {channel.icon || <Hash className="h-4 w-4" />}
                        </span>
                        <div className="flex-1">
                          <div className="font-medium">{channel.name}</div>
                          {channel.description && (
                            <div className="text-xs text-muted-foreground">
                              {channel.description}
                            </div>
                          )}
                        </div>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {channel._count.posts}
                        </span>
                      </CommandItem>
                    ))}

                  {/* Archived Channels */}
                  {includeArchived &&
                    channels.filter((c) => c.archived).length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          Archived
                        </div>
                        {channels
                          .filter((c) => c.archived)
                          .map((channel) => (
                            <CommandItem
                              key={channel.id}
                              value={channel.name}
                              onSelect={() => {
                                onChange(channel.id);
                                setOpen(false);
                              }}
                              className="opacity-60"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  value === channel.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <span className="mr-2 text-base">
                                {channel.icon || <Hash className="h-4 w-4" />}
                              </span>
                              <span>{channel.name}</span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {channel._count.posts}
                              </span>
                            </CommandItem>
                          ))}
                      </>
                    )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
