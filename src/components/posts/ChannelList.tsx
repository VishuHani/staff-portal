"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hash, Archive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getChannels } from "@/lib/actions/channels";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  archived: boolean;
  _count: {
    posts: number;
  };
  unreadCount: number;
}

interface ChannelListProps {
  includeArchived?: boolean;
  onChannelSelect?: (channelId: string) => void;
}

export function ChannelList({
  includeArchived = false,
  onChannelSelect,
}: ChannelListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedChannelId = searchParams.get("channelId");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChannels() {
      try {
        setLoading(true);
        const result = await getChannels({ includeArchived });

        if (result.error) {
          setError(result.error);
        } else if (result.channels) {
          setChannels(result.channels);
        }
      } catch (err) {
        setError("Failed to load channels");
      } finally {
        setLoading(false);
      }
    }

    fetchChannels();
  }, [includeArchived]);

  const handleChannelClick = (channelId: string) => {
    if (onChannelSelect) {
      onChannelSelect(channelId);
    } else {
      router.push(`/posts?channelId=${channelId}`);
    }
  };

  const handleAllChannelsClick = () => {
    if (onChannelSelect) {
      onChannelSelect("");
    } else {
      router.push("/posts");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 px-4 text-sm text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  const activeChannels = channels.filter((c) => !c.archived);
  const archivedChannels = channels.filter((c) => c.archived);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {/* All Channels Option */}
        <button
          onClick={handleAllChannelsClick}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            !selectedChannelId
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
        >
          <Hash className="h-4 w-4" />
          <span className="flex-1 text-left">All Channels</span>
          {(() => {
            const totalUnread = channels.reduce(
              (acc, c) => acc + c.unreadCount,
              0
            );
            return totalUnread > 0 ? (
              <Badge variant="destructive" className="ml-auto">
                {totalUnread}
              </Badge>
            ) : null;
          })()}
        </button>

        {/* Active Channels */}
        <div className="pt-4">
          <div className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
            CHANNELS
          </div>
          {activeChannels.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No channels available
            </p>
          ) : (
            activeChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  selectedChannelId === channel.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
                style={
                  selectedChannelId === channel.id && channel.color
                    ? { backgroundColor: channel.color, color: "white" }
                    : {}
                }
              >
                <span className="text-base">
                  {channel.icon || <Hash className="h-4 w-4" />}
                </span>
                <div className="flex-1 text-left">
                  <div className="font-medium">{channel.name}</div>
                  {channel.description && (
                    <div
                      className={cn(
                        "text-xs",
                        selectedChannelId === channel.id
                          ? "text-primary-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {channel.description}
                    </div>
                  )}
                </div>
                {channel.unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-auto"
                  >
                    {channel.unreadCount}
                  </Badge>
                )}
              </button>
            ))
          )}
        </div>

        {/* Archived Channels */}
        {archivedChannels.length > 0 && includeArchived && (
          <div className="pt-4">
            <div className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold text-muted-foreground">
              <Archive className="h-3 w-3" />
              ARCHIVED
            </div>
            {archivedChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => handleChannelClick(channel.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-60 transition-colors",
                  selectedChannelId === channel.id
                    ? "bg-muted"
                    : "hover:bg-muted"
                )}
              >
                <span className="text-base">
                  {channel.icon || <Hash className="h-4 w-4" />}
                </span>
                <div className="flex-1 text-left">
                  <div className="font-medium">{channel.name}</div>
                </div>
                {channel.unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {channel.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
