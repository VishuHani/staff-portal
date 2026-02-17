"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, Smartphone, MessageSquare, Loader2, RotateCcw } from "lucide-react";
import { updateNotificationPreference, resetNotificationPreferences } from "@/lib/actions/notification-preferences";
import { toast } from "sonner";
import type { NotificationType, NotificationChannel } from "@prisma/client";

interface NotificationPreferencesClientProps {
  userId: string;
  initialPreferences: Array<{
    id: string;
    type: NotificationType;
    enabled: boolean;
    channels: NotificationChannel[];
  }>;
}

// Notification type categories with descriptions
const NOTIFICATION_TYPES = [
  {
    category: "Messages",
    icon: MessageSquare,
    types: [
      { type: "NEW_MESSAGE" as NotificationType, label: "New Message", description: "When someone sends you a direct message" },
      { type: "MESSAGE_REPLY" as NotificationType, label: "Message Reply", description: "When someone replies to your message" },
      { type: "MESSAGE_MENTION" as NotificationType, label: "Message Mention", description: "When someone mentions you in a message" },
      { type: "MESSAGE_REACTION" as NotificationType, label: "Message Reaction", description: "When someone reacts to your message" },
    ],
  },
  {
    category: "Posts",
    icon: Bell,
    types: [
      { type: "POST_MENTION" as NotificationType, label: "Post Mention", description: "When someone mentions you in a post" },
      { type: "POST_PINNED" as NotificationType, label: "Post Pinned", description: "When a post is pinned in a channel" },
      { type: "POST_DELETED" as NotificationType, label: "Post Deleted", description: "When your post is deleted" },
    ],
  },
  {
    category: "Time Off",
    icon: Bell,
    types: [
      { type: "TIME_OFF_REQUEST" as NotificationType, label: "Time Off Request", description: "When someone submits a time off request (managers)" },
      { type: "TIME_OFF_APPROVED" as NotificationType, label: "Time Off Approved", description: "When your time off request is approved" },
      { type: "TIME_OFF_REJECTED" as NotificationType, label: "Time Off Rejected", description: "When your time off request is rejected" },
      { type: "TIME_OFF_CANCELLED" as NotificationType, label: "Time Off Cancelled", description: "When a time off request is cancelled" },
    ],
  },
  {
    category: "Account & System",
    icon: Bell,
    types: [
      { type: "USER_CREATED" as NotificationType, label: "Welcome", description: "Welcome message when your account is created" },
      { type: "USER_UPDATED" as NotificationType, label: "Account Updated", description: "When your account is activated or deactivated" },
      { type: "ROLE_CHANGED" as NotificationType, label: "Role Changed", description: "When your role is changed" },
      { type: "SYSTEM_ANNOUNCEMENT" as NotificationType, label: "System Announcement", description: "Important system-wide announcements" },
      { type: "GROUP_REMOVED" as NotificationType, label: "Group Removed", description: "When you're removed from a group or channel" },
    ],
  },
];

// Channel options
const CHANNELS = [
  { value: "IN_APP" as NotificationChannel, label: "In-App", icon: Bell, description: "Show notifications in the app" },
  { value: "EMAIL" as NotificationChannel, label: "Email", icon: Mail, description: "Send email notifications" },
  { value: "PUSH" as NotificationChannel, label: "Push", icon: Smartphone, description: "Send push notifications to your device" },
];

export function NotificationPreferencesClient({
  userId,
  initialPreferences,
}: NotificationPreferencesClientProps) {
  const [preferences, setPreferences] = useState(
    () => new Map(initialPreferences.map(p => [p.type, { enabled: p.enabled, channels: p.channels }]))
  );
  const [savingTypes, setSavingTypes] = useState(new Set<string>());
  const [resetting, setResetting] = useState(false);

  // Get preference for a type (or default)
  const getPreference = (type: NotificationType) => {
    return preferences.get(type) || { enabled: true, channels: ["IN_APP" as NotificationChannel] };
  };

  // Update a single preference
  const handleToggleEnabled = async (type: NotificationType, enabled: boolean) => {
    const current = getPreference(type);

    setSavingTypes(prev => new Set(prev).add(type));
    setPreferences(prev => new Map(prev).set(type, { enabled, channels: current.channels }));

    const result = await updateNotificationPreference({
      userId,
      type,
      enabled,
      channels: current.channels,
    });

    if (result.error) {
      toast.error(result.error);
      setPreferences(prev => new Map(prev).set(type, current));
    } else {
      const typeLabel = type.split('_').join(' ').toLowerCase();
      toast.success(`${typeLabel} notifications ${enabled ? "enabled" : "disabled"}`);
    }

    setSavingTypes(prev => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  };

  // Update channels for a type
  const handleToggleChannel = async (type: NotificationType, channel: NotificationChannel) => {
    const current = getPreference(type);
    const newChannels = current.channels.includes(channel)
      ? current.channels.filter(c => c !== channel)
      : [...current.channels, channel];

    if (newChannels.length === 0 && current.enabled) {
      toast.error("At least one channel must be selected");
      return;
    }

    setSavingTypes(prev => new Set(prev).add(type));
    setPreferences(prev => new Map(prev).set(type, { ...current, channels: newChannels }));

    const result = await updateNotificationPreference({
      userId,
      type,
      enabled: current.enabled,
      channels: newChannels,
    });

    if (result.error) {
      toast.error(result.error);
      setPreferences(prev => new Map(prev).set(type, current));
    }

    setSavingTypes(prev => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  };

  // Reset all preferences to defaults
  const handleReset = async () => {
    setResetting(true);

    const result = await resetNotificationPreferences(userId);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("All preferences reset to defaults");
      setPreferences(new Map());
    }

    setResetting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notification Preferences</h2>
          <p className="text-muted-foreground mt-1">
            Manage how and when you receive notifications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to defaults
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>In-App:</strong> Notifications appear in the app and navigation bar (always available)
          </p>
          <p>
            <strong>Email:</strong> Receive notifications via email (coming soon)
          </p>
          <p>
            <strong>Push:</strong> Receive push notifications on your mobile device (coming soon)
          </p>
          <p className="pt-2 text-xs">
            You can enable or disable each notification type and choose which channels to receive it through.
          </p>
        </CardContent>
      </Card>

      {NOTIFICATION_TYPES.map(({ category, icon: Icon, types }) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {category}
            </CardTitle>
            <CardDescription>
              Choose which {category.toLowerCase()} notifications you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {types.map(({ type, label, description }) => {
              const pref = getPreference(type);
              const isSaving = savingTypes.has(type);

              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor={type} className="text-base font-medium cursor-pointer">
                        {label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      id={type}
                      checked={pref.enabled}
                      onCheckedChange={(checked) => handleToggleEnabled(type, checked)}
                      disabled={isSaving}
                    />
                  </div>

                  {pref.enabled && (
                    <div className="ml-4 pl-4 border-l-2 border-muted space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Receive via:</p>
                      <div className="flex flex-col gap-3">
                        {CHANNELS.map(({ value, label, icon: ChannelIcon }) => (
                          <div key={value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${type}-${value}`}
                              checked={pref.channels.includes(value)}
                              onCheckedChange={() => handleToggleChannel(type, value)}
                              disabled={isSaving}
                            />
                            <label
                              htmlFor={`${type}-${value}`}
                              className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              <ChannelIcon className="h-4 w-4" />
                              {label}
                              {value !== "IN_APP" && (
                                <span className="text-xs text-muted-foreground">(Coming soon)</span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {type !== types[types.length - 1].type && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
