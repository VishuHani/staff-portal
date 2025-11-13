"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Archive,
  ArchiveRestore,
  Loader2,
  AlertCircle,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateChannel, archiveChannel } from "@/lib/actions/channels";
import { toast } from "sonner";
import { getFullName } from "@/lib/utils/profile";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: string;
  icon: string | null;
  color: string | null;
  archived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  creator: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  venues: Array<{
    venue: {
      id: string;
      name: string;
      code: string;
    };
  }>;
  _count: {
    members: number;
    posts: number;
  };
}

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface ChannelSettingsClientProps {
  channel: Channel;
  venues: Venue[];
  currentUserId: string;
  isManager: boolean;
}

const CHANNEL_TYPES = [
  { value: "GENERAL", label: "General" },
  { value: "ANNOUNCEMENTS", label: "Announcements" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "PROJECT", label: "Project" },
  { value: "SOCIAL", label: "Social" },
];

const CHANNEL_COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f97316", label: "Orange" },
  { value: "#10b981", label: "Green" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
];

const CHANNEL_ICONS = [
  { value: "#️⃣", label: "# Hash" },
  { value: "📢", label: "📢 Megaphone" },
  { value: "💼", label: "💼 Briefcase" },
  { value: "🎯", label: "🎯 Target" },
  { value: "🎉", label: "🎉 Party" },
  { value: "💡", label: "💡 Lightbulb" },
  { value: "🔧", label: "🔧 Wrench" },
  { value: "📊", label: "📊 Chart" },
];

export function ChannelSettingsClient({
  channel: initialChannel,
  venues,
  currentUserId,
  isManager,
}: ChannelSettingsClientProps) {
  const router = useRouter();
  const [channel, setChannel] = useState(initialChannel);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Form state
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || "");
  const [type, setType] = useState(channel.type);
  const [icon, setIcon] = useState(channel.icon || "#️⃣");
  const [color, setColor] = useState(channel.color || "#3b82f6");
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>(
    channel.venues.map((cv) => cv.venue.id)
  );

  const handleVenueToggle = (venueId: string) => {
    setSelectedVenueIds((prev) =>
      prev.includes(venueId)
        ? prev.filter((id) => id !== venueId)
        : [...prev, venueId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }

    if (selectedVenueIds.length === 0) {
      toast.error("Please select at least one venue");
      return;
    }

    setSaving(true);
    try {
      const result = await updateChannel({
        id: channel.id,
        name: name.trim(),
        description: description.trim() || null,
        type,
        icon,
        color,
        venueIds: selectedVenueIds,
      });

      if (result.success) {
        toast.success("Channel settings updated successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update channel settings");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const result = await archiveChannel({
        id: channel.id,
        archived: !channel.archived,
      });

      if (result.success) {
        toast.success(channel.archived ? "Channel restored" : "Channel archived");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to archive channel");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setArchiving(false);
    }
  };

  const hasChanges =
    name !== channel.name ||
    description !== (channel.description || "") ||
    type !== channel.type ||
    icon !== (channel.icon || "#️⃣") ||
    color !== (channel.color || "#3b82f6") ||
    JSON.stringify(selectedVenueIds.sort()) !==
      JSON.stringify(channel.venues.map((cv) => cv.venue.id).sort());

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/admin/channels/${channel.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Channel Settings</h1>
          <p className="text-muted-foreground">
            Configure channel properties and permissions
          </p>
        </div>
      </div>

      {/* Archived Warning */}
      {channel.archived && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This channel is archived. It can be restored by clicking the "Restore
            Channel" button below.
          </AlertDescription>
        </Alert>
      )}

      {/* Manager Info */}
      {isManager && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            As a manager, you can only assign this channel to your assigned venue(s).
          </AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Update channel name, description, and visual properties
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Channel Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter channel name"
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter channel description"
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Channel Type</Label>
            <Select value={type} onValueChange={setType} disabled={saving}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon and Color */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Icon */}
            <div className="space-y-2">
              <Label htmlFor="icon">Channel Icon</Label>
              <Select value={icon} onValueChange={setIcon} disabled={saving}>
                <SelectTrigger id="icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_ICONS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color">Channel Color</Label>
              <Select value={color} onValueChange={setColor} disabled={saving}>
                <SelectTrigger id="color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: c.value }}
                        />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="p-4 rounded-lg border"
              style={{
                background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                borderColor: `${color}30`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="font-semibold">{name || "Channel Name"}</p>
                  <p className="text-sm text-muted-foreground">
                    {description || "Channel description"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Venue Assignment</CardTitle>
          <CardDescription>
            Select which venue(s) this channel is assigned to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {venues.map((venue) => (
              <div key={venue.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`venue-${venue.id}`}
                  checked={selectedVenueIds.includes(venue.id)}
                  onCheckedChange={() => handleVenueToggle(venue.id)}
                  disabled={saving}
                />
                <label
                  htmlFor={`venue-${venue.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {venue.name} ({venue.code})
                </label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Channel Info */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Information</CardTitle>
          <CardDescription>
            Read-only channel statistics and metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Created By</Label>
              <p className="text-sm font-medium">
                {channel.creator ? getFullName(channel.creator) : "Unknown"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Created At</Label>
              <p className="text-sm font-medium">
                {new Date(channel.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Members</Label>
              <p className="text-sm font-medium">{channel._count.members}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Total Posts</Label>
              <p className="text-sm font-medium">{channel._count.posts}</p>
            </div>
          </div>

          {channel.archived && channel.archivedAt && (
            <div>
              <Label className="text-muted-foreground">Archived At</Label>
              <p className="text-sm font-medium">
                {new Date(channel.archivedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleArchive}
          disabled={archiving || saving}
        >
          {archiving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {channel.archived ? "Restoring..." : "Archiving..."}
            </>
          ) : (
            <>
              {channel.archived ? (
                <>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Restore Channel
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Channel
                </>
              )}
            </>
          )}
        </Button>

        <div className="flex gap-2">
          <Button asChild variant="outline" disabled={saving || archiving}>
            <Link href={`/admin/channels/${channel.id}`}>Cancel</Link>
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || archiving || !hasChanges}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
