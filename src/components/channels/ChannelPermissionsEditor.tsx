"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Users,
  Lock,
  Eye,
  MessageSquare,
  Edit,
  Trash,
  Pin,
  UserPlus,
  UserMinus,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  type ChannelPermissions,
  type ChannelPermissionLevel,
  DEFAULT_CHANNEL_PERMISSIONS,
  PERMISSION_PRESETS,
} from "@/lib/types/channel-permissions";

interface ChannelPermissionsEditorProps {
  permissions: ChannelPermissions;
  onChange: (permissions: ChannelPermissions) => void;
  disabled?: boolean;
}

const PERMISSION_LEVEL_OPTIONS: {
  value: ChannelPermissionLevel;
  label: string;
  description: string;
}[] = [
  {
    value: "EVERYONE",
    label: "Everyone",
    description: "Anyone can perform this action",
  },
  {
    value: "MEMBERS",
    label: "Members",
    description: "Only channel members",
  },
  {
    value: "MODERATORS",
    label: "Moderators",
    description: "Moderators and creators only",
  },
  {
    value: "CREATORS",
    label: "Creators Only",
    description: "Only channel creators",
  },
];

export function ChannelPermissionsEditor({
  permissions,
  onChange,
  disabled = false,
}: ChannelPermissionsEditorProps) {
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handlePresetChange = (presetKey: string) => {
    setActivePreset(presetKey);
    onChange(PERMISSION_PRESETS[presetKey].permissions);
  };

  const handlePermissionChange = (
    key: keyof ChannelPermissions,
    value: ChannelPermissionLevel | boolean
  ) => {
    setActivePreset(null); // Clear preset when custom changes are made
    onChange({
      ...permissions,
      [key]: value,
    });
  };

  const handleReset = () => {
    setActivePreset(null);
    onChange(DEFAULT_CHANNEL_PERMISSIONS);
  };

  return (
    <div className="space-y-6">
      {/* Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Presets
          </CardTitle>
          <CardDescription>
            Quick apply common permission configurations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(PERMISSION_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetChange(key)}
                disabled={disabled}
                className={`p-4 rounded-lg border-2 text-left transition-all hover:border-primary ${
                  activePreset === key
                    ? "border-primary bg-primary/5"
                    : "border-border"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold">{preset.label}</p>
                  {activePreset === key && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>

          {activePreset && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Using {PERMISSION_PRESETS[activePreset].label} preset
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={disabled}
              >
                Reset to Default
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Post Permissions
          </CardTitle>
          <CardDescription>
            Control who can view, create, and manage posts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* View Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Label>View Posts</Label>
            </div>
            <Select
              value={permissions.canViewPosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canViewPosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Create Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <Label>Create Posts</Label>
            </div>
            <Select
              value={permissions.canCreatePosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canCreatePosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Comment */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <Label>Add Comments/Reactions</Label>
            </div>
            <Select
              value={permissions.canComment}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canComment", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Editing Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Editing Permissions
          </CardTitle>
          <CardDescription>
            Control who can edit and delete posts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Edit Own Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-muted-foreground" />
              <Label>Edit Own Posts</Label>
            </div>
            <Select
              value={permissions.canEditOwnPosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canEditOwnPosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Delete Own Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trash className="h-4 w-4 text-muted-foreground" />
              <Label>Delete Own Posts</Label>
            </div>
            <Select
              value={permissions.canDeleteOwnPosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canDeleteOwnPosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Edit Any Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-muted-foreground" />
              <Label>Edit Any Posts (Moderation)</Label>
            </div>
            <Select
              value={permissions.canEditAnyPosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canEditAnyPosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Delete Any Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trash className="h-4 w-4 text-muted-foreground" />
              <Label>Delete Any Posts (Moderation)</Label>
            </div>
            <Select
              value={permissions.canDeleteAnyPosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canDeleteAnyPosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Member Management Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Member Management
          </CardTitle>
          <CardDescription>
            Control who can manage channel members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite Members */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <Label>Invite Members</Label>
            </div>
            <Select
              value={permissions.canInviteMembers}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canInviteMembers", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Remove Members */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <UserMinus className="h-4 w-4 text-muted-foreground" />
              <Label>Remove Members</Label>
            </div>
            <Select
              value={permissions.canRemoveMembers}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canRemoveMembers", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Pin Posts */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-muted-foreground" />
              <Label>Pin Posts</Label>
            </div>
            <Select
              value={permissions.canPinPosts}
              onValueChange={(value: ChannelPermissionLevel) =>
                handlePermissionChange("canPinPosts", value)
              }
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERMISSION_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Special Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Special Settings
          </CardTitle>
          <CardDescription>
            Additional channel behavior settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Read-Only */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Read-Only Channel</Label>
              <p className="text-sm text-muted-foreground">
                Only creators can post (overrides other permissions)
              </p>
            </div>
            <Switch
              checked={permissions.isReadOnly}
              onCheckedChange={(checked) =>
                handlePermissionChange("isReadOnly", checked)
              }
              disabled={disabled}
            />
          </div>

          <Separator />

          {/* Requires Approval */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Posts Require Approval</Label>
              <p className="text-sm text-muted-foreground">
                Moderators must approve posts before they're published
              </p>
            </div>
            <Switch
              checked={permissions.requiresApproval}
              onCheckedChange={(checked) =>
                handlePermissionChange("requiresApproval", checked)
              }
              disabled={disabled}
            />
          </div>

          {permissions.requiresApproval && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Posts will be held in a queue and require approval from moderators
                or creators before being visible to members.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
