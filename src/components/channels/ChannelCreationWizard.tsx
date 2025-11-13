"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Hash,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { UserPicker, type UserOption } from "./UserPicker";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getFullName } from "@/lib/utils/profile";

interface ChannelCreationWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUsers: UserOption[];
  allRoles?: Array<{ id: string; name: string }>;
  allVenues?: Array<{ id: string; name: string; code: string }>;
  onCreateChannel: (data: ChannelCreationData) => Promise<{
    success?: boolean;
    error?: string;
    channel?: { id: string; name: string };
  }>;
}

export interface ChannelCreationData {
  // Step 1: Basic Info
  name: string;
  description: string;
  type: string;
  icon?: string;
  color?: string;

  // Step 2: Member Selection
  selectionType: "all" | "by_role" | "by_venue" | "by_user";
  roleIds?: string[];
  venueIds?: string[];
  userIds: string[];

  // Step 3: Permissions
  memberRole: "CREATOR" | "MODERATOR" | "MEMBER";
}

const STEPS = [
  { id: 1, name: "Basic Info", description: "Channel name and details" },
  { id: 2, name: "Select Members", description: "Choose who can access" },
  { id: 3, name: "Review & Create", description: "Confirm and create" },
];

export function ChannelCreationWizard({
  open,
  onOpenChange,
  allUsers,
  allRoles = [],
  allVenues = [],
  onCreateChannel,
}: ChannelCreationWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [creating, setCreating] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("GENERAL");
  const [icon, setIcon] = useState("hash");
  const [color, setColor] = useState("#6366f1");

  // Step 2: Member Selection
  const [selectionType, setSelectionType] = useState<
    "all" | "by_role" | "by_venue" | "by_user"
  >("all");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Step 3: Permissions
  const [memberRole, setMemberRole] = useState<"CREATOR" | "MODERATOR" | "MEMBER">(
    "MEMBER"
  );

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setName("");
      setDescription("");
      setType("GENERAL");
      setIcon("hash");
      setColor("#6366f1");
      setSelectionType("all");
      setSelectedRoleIds([]);
      setSelectedVenueIds([]);
      setSelectedUserIds([]);
      setMemberRole("MEMBER");
    }
  }, [open]);

  // Calculate selected users based on criteria
  const getSelectedUsers = (): UserOption[] => {
    switch (selectionType) {
      case "all":
        return allUsers.filter((u) => u.active);

      case "by_role":
        return allUsers.filter(
          (u) => u.active && u.role && selectedRoleIds.includes(u.role.name)
        );

      case "by_venue":
        return allUsers.filter(
          (u) =>
            u.active &&
            u.venues?.some((v) => selectedVenueIds.includes(v.venue.id))
        );

      case "by_user":
        return allUsers.filter((u) => selectedUserIds.includes(u.id));

      default:
        return [];
    }
  };

  const selectedUsers = getSelectedUsers();

  // Validation
  const canProceedFromStep1 = name.trim().length >= 3 && description.trim().length > 0;
  const canProceedFromStep2 =
    selectionType === "all" ||
    (selectionType === "by_role" && selectedRoleIds.length > 0) ||
    (selectionType === "by_venue" && selectedVenueIds.length > 0) ||
    (selectionType === "by_user" && selectedUserIds.length > 0);

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreate = async () => {
    setCreating(true);

    try {
      const data: ChannelCreationData = {
        name,
        description,
        type,
        icon,
        color,
        selectionType,
        ...(selectionType === "by_role" && { roleIds: selectedRoleIds }),
        ...(selectionType === "by_venue" && { venueIds: selectedVenueIds }),
        userIds: selectedUsers.map((u) => u.id),
        memberRole,
      };

      const result = await onCreateChannel(data);

      if (result.success && result.channel) {
        toast.success(`Channel "${result.channel.name}" created successfully!`);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create channel");
      }
    } catch (error) {
      console.error("Error creating channel:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setCreating(false);
    }
  };

  const progress = (currentStep / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Channel</DialogTitle>
          <DialogDescription>
            Follow the steps to create a channel and add members
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex flex-col items-center",
                  currentStep === step.id && "text-primary font-medium",
                  currentStep > step.id && "text-primary"
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex h-8 w-8 items-center justify-center rounded-full border-2",
                    currentStep === step.id && "border-primary bg-primary text-primary-foreground",
                    currentStep > step.id && "border-primary bg-primary text-primary-foreground",
                    currentStep < step.id && "border-muted"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span className="text-center">{step.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">
                  Channel Name <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="general-announcements"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                    disabled={creating}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Must be at least 3 characters
                </p>
              </div>

              <div>
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="What's this channel for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  disabled={creating}
                />
              </div>

              <div>
                <Label htmlFor="type">Channel Type</Label>
                <Select value={type} onValueChange={setType} disabled={creating}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                    <SelectItem value="DISCUSSION">Discussion</SelectItem>
                    <SelectItem value="TEAM">Team</SelectItem>
                    <SelectItem value="PROJECT">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={creating}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Member Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <Label>Who can access this channel?</Label>
                <RadioGroup
                  value={selectionType}
                  onValueChange={(v) => setSelectionType(v as any)}
                  className="mt-2 space-y-3"
                  disabled={creating}
                >
                  <Card
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectionType === "all" && "border-primary"
                    )}
                    onClick={() => setSelectionType("all")}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <RadioGroupItem value="all" id="all" />
                      <div className="flex-1">
                        <Label htmlFor="all" className="cursor-pointer font-medium">
                          All Users
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Everyone on the platform ({allUsers.filter((u) => u.active).length}{" "}
                          users)
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {allRoles.length > 0 && (
                    <Card
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectionType === "by_role" && "border-primary"
                      )}
                      onClick={() => setSelectionType("by_role")}
                    >
                      <CardContent className="flex items-start gap-3 p-4">
                        <RadioGroupItem value="by_role" id="by_role" />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="by_role" className="cursor-pointer font-medium">
                            By Role
                          </Label>
                          {selectionType === "by_role" && (
                            <div className="flex flex-wrap gap-2">
                              {allRoles.map((role) => (
                                <label
                                  key={role.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                                    selectedRoleIds.includes(role.name)
                                      ? "border-primary bg-primary/10"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRoleIds.includes(role.name)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRoleIds([...selectedRoleIds, role.name]);
                                      } else {
                                        setSelectedRoleIds(
                                          selectedRoleIds.filter((id) => id !== role.name)
                                        );
                                      }
                                    }}
                                    className="h-4 w-4"
                                  />
                                  {role.name}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {allVenues.length > 0 && (
                    <Card
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectionType === "by_venue" && "border-primary"
                      )}
                      onClick={() => setSelectionType("by_venue")}
                    >
                      <CardContent className="flex items-start gap-3 p-4">
                        <RadioGroupItem value="by_venue" id="by_venue" />
                        <div className="flex-1 space-y-2">
                          <Label htmlFor="by_venue" className="cursor-pointer font-medium">
                            By Venue
                          </Label>
                          {selectionType === "by_venue" && (
                            <div className="flex flex-wrap gap-2">
                              {allVenues.map((venue) => (
                                <label
                                  key={venue.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                                    selectedVenueIds.includes(venue.id)
                                      ? "border-primary bg-primary/10"
                                      : "hover:bg-accent"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedVenueIds.includes(venue.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedVenueIds([...selectedVenueIds, venue.id]);
                                      } else {
                                        setSelectedVenueIds(
                                          selectedVenueIds.filter((id) => id !== venue.id)
                                        );
                                      }
                                    }}
                                    className="h-4 w-4"
                                  />
                                  {venue.name}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectionType === "by_user" && "border-primary"
                    )}
                    onClick={() => setSelectionType("by_user")}
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      <RadioGroupItem value="by_user" id="by_user" />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="by_user" className="cursor-pointer font-medium">
                          Select Individuals
                        </Label>
                        {selectionType === "by_user" && (
                          <UserPicker
                            users={allUsers}
                            selectedUserIds={selectedUserIds}
                            onSelectionChange={setSelectedUserIds}
                            maxHeight="250px"
                            showVenues={false}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </RadioGroup>
              </div>

              {/* Selected Users Preview */}
              {selectedUsers.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {selectedUsers.length} member{selectedUsers.length !== 1 && "s"}{" "}
                          selected
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Review & Create */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Channel Name</Label>
                    <p className="text-sm font-medium">{name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{description}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <p className="text-sm capitalize">{type.toLowerCase()}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Members</Label>
                    <p className="text-sm">
                      {selectedUsers.length} user{selectedUsers.length !== 1 && "s"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Member Role</Label>
                    <Select
                      value={memberRole}
                      onValueChange={(v) => setMemberRole(v as any)}
                      disabled={creating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="MODERATOR">Moderator</SelectItem>
                        <SelectItem value="CREATOR">Creator</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Default role for all added members
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  You'll be added as a Creator of this channel with full management permissions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {currentStep > 1 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={creating}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>

            {currentStep < 3 ? (
              <Button
                onClick={handleNext}
                disabled={
                  creating ||
                  (currentStep === 1 && !canProceedFromStep1) ||
                  (currentStep === 2 && !canProceedFromStep2)
                }
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={creating || selectedUsers.length === 0}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Create Channel
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
