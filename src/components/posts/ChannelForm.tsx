"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { createChannel, updateChannel } from "@/lib/actions/channels";
import {
  CHANNEL_TYPES,
  CHANNEL_COLORS,
  type CreateChannelInput,
  type UpdateChannelInput,
} from "@/lib/schemas/channels";
import { toast } from "sonner";

interface ChannelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    icon: string | null;
    color: string | null;
    permissions: string | null;
  };
  onSuccess?: () => void;
}

const COMMON_EMOJIS = [
  "📢",
  "💼",
  "🎉",
  "🚀",
  "💡",
  "📝",
  "🔔",
  "👥",
  "🎯",
  "⭐",
  "🏆",
  "📊",
  "🛠️",
  "🎨",
  "📱",
];

export function ChannelForm({
  open,
  onOpenChange,
  channel,
  onSuccess,
}: ChannelFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState(channel?.name || "");
  const [description, setDescription] = useState(channel?.description || "");
  const [type, setType] = useState(channel?.type || "ALL_STAFF");
  const [icon, setIcon] = useState(channel?.icon || "📢");
  const [color, setColor] = useState(channel?.color || CHANNEL_COLORS[0]);

  const isEditing = !!channel;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isEditing) {
        // Update existing channel
        const data: UpdateChannelInput = {
          id: channel.id,
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          icon,
          color,
        };

        const result = await updateChannel(data);

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
        } else {
          toast.success("Channel updated successfully");
          onOpenChange(false);
          if (onSuccess) onSuccess();
          router.refresh();
        }
      } else {
        // Create new channel
        const data: CreateChannelInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          type,
          icon,
          color,
        };

        const result = await createChannel(data);

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
        } else {
          toast.success("Channel created successfully");
          onOpenChange(false);
          if (onSuccess) onSuccess();
          router.refresh();

          // Reset form
          setName("");
          setDescription("");
          setType("ALL_STAFF");
          setIcon("📢");
          setColor(CHANNEL_COLORS[0]);
        }
      }
    } catch (err) {
      const message = "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Channel" : "Create Channel"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update channel settings and appearance."
                : "Create a new channel for posts and announcements."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Channel Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Channel Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., General Announcements"
                maxLength={50}
                required
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/50 characters
              </p>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this channel's purpose"
                maxLength={200}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/200 characters
              </p>
            </div>

            {/* Channel Type */}
            <div className="grid gap-2">
              <Label htmlFor="type">
                Channel Type <span className="text-destructive">*</span>
              </Label>
              <Select value={type} onValueChange={setType}>
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
              <p className="text-xs text-muted-foreground">
                {type === "ALL_STAFF" && "Visible to all staff members"}
                {type === "MANAGERS" && "Only visible to managers and admins"}
                {type === "CUSTOM" && "Custom permission-based access"}
              </p>
            </div>

            {/* Icon Selection */}
            <div className="grid gap-2">
              <Label>Channel Icon</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className={`flex h-10 w-10 items-center justify-center rounded-md border text-xl transition-colors ${
                      icon === emoji
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Or enter custom emoji"
                maxLength={10}
                className="mt-2"
              />
            </div>

            {/* Color Selection */}
            <div className="grid gap-2">
              <Label>Channel Color</Label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-10 w-10 rounded-md border-2 transition-all ${
                      color === c
                        ? "scale-110 border-foreground"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Or enter hex color (e.g., #3b82f6)"
                maxLength={7}
                pattern="^#[0-9A-Fa-f]{6}$"
                className="mt-2"
              />
            </div>

            {/* Preview */}
            <div className="grid gap-2">
              <Label>Preview</Label>
              <div
                className="flex items-center gap-3 rounded-lg p-3 text-sm font-medium text-white"
                style={{ backgroundColor: color }}
              >
                <span className="text-xl">{icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{name || "Channel Name"}</div>
                  {description && (
                    <div className="text-xs opacity-90">{description}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Channel" : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
