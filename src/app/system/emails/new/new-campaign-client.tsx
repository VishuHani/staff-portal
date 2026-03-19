"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  createEmailCampaign,
  getAvailableEmails,
  getEmailSegments,
  previewCampaignRecipients,
  scheduleEmailCampaign,
  sendTestEmail,
} from "@/lib/actions/email-campaigns";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import { getEmail } from "@/lib/actions/emails";
import { sanitizeEmailHtmlFragment } from "@/lib/services/email/sanitization";
import type { EmailType, RecipientPreview } from "@/types/email-campaign";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Eye,
  FileText,
  Loader2,
  Mail,
  Save,
  Send,
  Users,
} from "lucide-react";

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface AvailableEmail {
  id: string;
  name: string;
  subject: string;
  emailType: string;
  category: string | null;
  thumbnailUrl: string | null;
  lastUsedAt: Date | null;
  useCount: number;
}

interface SegmentOption {
  id: string;
  name: string;
  description: string | null;
  userCount: number;
}

interface SelectedEmailDetail {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  emailType: EmailType;
  category: string | null;
}

interface NewCampaignClientProps {
  isAdmin: boolean;
  venues: Venue[];
  roles: Role[];
}

type Step = "details" | "email" | "targeting" | "preview";
type DeliveryMode = "draft" | "scheduled";

const steps: { id: Step; label: string; description: string }[] = [
  { id: "details", label: "Details", description: "Campaign setup" },
  { id: "email", label: "Email", description: "Select saved email" },
  { id: "targeting", label: "Targeting", description: "Select recipients" },
  { id: "preview", label: "Preview", description: "Review and save" },
];

function flattenFolderOptions(
  nodes: EmailFolderNode[],
  depth: number = 0
): Array<{ id: string; label: string }> {
  const rows: Array<{ id: string; label: string }> = [];

  for (const node of nodes) {
    rows.push({
      id: node.id,
      label: `${"-- ".repeat(depth)}${node.name}`,
    });
    rows.push(...flattenFolderOptions(node.children, depth + 1));
  }

  return rows;
}

export function NewCampaignClient({ isAdmin, venues, roles }: NewCampaignClientProps) {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  // Core campaign state
  const [name, setName] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [venueId, setVenueId] = useState<string>(isAdmin ? "all" : venues[0]?.id || "");
  const [folderId, setFolderId] = useState<string>("none");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("draft");
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // Email selection state
  const [emailSearch, setEmailSearch] = useState("");
  const [availableEmails, setAvailableEmails] = useState<AvailableEmail[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string>("");
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<SelectedEmailDetail | null>(null);

  // Segment state
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("none");

  // Targeting state
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>(
    !isAdmin && venues[0]?.id ? [venues[0].id] : []
  );
  const [selectedStatus, setSelectedStatus] = useState<string[]>(["ACTIVE"]);
  const [selectedUserIds] = useState<string[]>([]);

  // Preview state
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  const resolvedSubject = useMemo(() => {
    const override = customSubject.trim();
    if (override.length > 0) return override;
    return selectedEmailDetail?.subject || "";
  }, [customSubject, selectedEmailDetail]);

  const saveButtonLabel = deliveryMode === "scheduled" ? "Save & Schedule" : "Save Draft";

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadAvailableEmails();
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailSearch]);

  useEffect(() => {
    void loadSegments();
  }, []);

  useEffect(() => {
    void loadFolders();
  }, []);

  useEffect(() => {
    if (!selectedEmailId) {
      setSelectedEmailDetail(null);
      return;
    }

    void loadSelectedEmail(selectedEmailId);
  }, [selectedEmailId]);

  useEffect(() => {
    if (currentStep === "preview") {
      void loadRecipientPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const loadAvailableEmails = async () => {
    setEmailsLoading(true);
    try {
      const result = await getAvailableEmails({
        search: emailSearch.trim() || undefined,
      });

      if (result.success && result.emails) {
        setAvailableEmails(result.emails as AvailableEmail[]);
      } else {
        toast.error(result.error || "Failed to load available emails");
      }
    } catch (error) {
      console.error("Error loading available emails:", error);
      toast.error("Failed to load available emails");
    } finally {
      setEmailsLoading(false);
    }
  };

  const loadSelectedEmail = async (emailId: string) => {
    try {
      const email = await getEmail(emailId);
      if (!email) {
        toast.error("Selected email not found");
        setSelectedEmailDetail(null);
        return;
      }

      setSelectedEmailDetail({
        id: email.id,
        name: email.name,
        subject: email.subject,
        htmlContent: email.htmlContent,
        emailType: email.emailType,
        category: email.category || null,
      });
    } catch (error) {
      console.error("Error loading selected email:", error);
      toast.error("Failed to load selected email");
      setSelectedEmailDetail(null);
    }
  };

  const loadSegments = async () => {
    setSegmentsLoading(true);
    try {
      const result = await getEmailSegments();
      if (result.success && result.segments) {
        setSegments(result.segments as SegmentOption[]);
      } else {
        toast.error(result.error || "Failed to load audience segments");
      }
    } catch (error) {
      console.error("Error loading segments:", error);
      toast.error("Failed to load audience segments");
    } finally {
      setSegmentsLoading(false);
    }
  };

  const loadFolders = async () => {
    setFoldersLoading(true);
    setFoldersError(null);
    try {
      const response = await listFolderTree({ module: "campaigns" });
      if (!response.success || !response.tree) {
        setFoldersError(response.error || "Failed to load campaign folders");
        setFolderOptions([]);
        return;
      }

      setFolderOptions(flattenFolderOptions(response.tree));
    } catch (error) {
      console.error("Error loading campaign folders:", error);
      setFoldersError("Failed to load campaign folders");
      setFolderOptions([]);
    } finally {
      setFoldersLoading(false);
    }
  };

  const loadRecipientPreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await previewCampaignRecipients({
        roles: selectedRoles,
        venueIds: selectedVenues,
        userStatus: selectedStatus,
        userIds: selectedUserIds,
      });
      setRecipientPreview(result);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Failed to preview recipients");
    } finally {
      setPreviewLoading(false);
    }
  };

  const getCampaignVenueId = () => {
    if (isAdmin) {
      return venueId === "all" ? undefined : venueId;
    }
    return venueId || venues[0]?.id || undefined;
  };

  const getScheduledAtDate = (): Date | null => {
    if (deliveryMode !== "scheduled") {
      return null;
    }

    if (!scheduledAtLocal) {
      return null;
    }

    const parsed = new Date(scheduledAtLocal);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  };

  const scheduledAtDate = getScheduledAtDate();

  const validateStep = (): boolean => {
    switch (currentStep) {
      case "details":
        if (!name.trim()) {
          toast.error("Campaign name is required");
          return false;
        }

        if (deliveryMode === "scheduled") {
          const scheduledAt = getScheduledAtDate();
          if (!scheduledAt) {
            toast.error("Please choose a valid schedule date and time");
            return false;
          }

          if (scheduledAt.getTime() <= Date.now()) {
            toast.error("Schedule time must be in the future");
            return false;
          }
        }

        return true;

      case "email":
        if (!selectedEmailId) {
          toast.error("Please select an email before continuing");
          return false;
        }
        return true;

      case "targeting":
        if (
          selectedRoles.length === 0 &&
          selectedVenues.length === 0 &&
          selectedUserIds.length === 0 &&
          selectedSegmentId === "none"
        ) {
          toast.error("Please select at least one targeting criteria");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    if (!selectedEmailId) {
      toast.error("Please select an email");
      return;
    }

    if (deliveryMode === "scheduled" && !scheduledAtDate) {
      toast.error("Please choose a valid schedule date and time");
      return;
    }

    setLoading(true);
    try {
      const result = await createEmailCampaign({
        name: name.trim(),
        emailId: selectedEmailId,
        folderId: folderId === "none" ? undefined : folderId,
        customSubject: customSubject.trim() || undefined,
        targetRoles: selectedRoles,
        targetVenueIds: selectedVenues,
        targetStatus: selectedStatus,
        targetUserIds: selectedUserIds,
        segmentId: selectedSegmentId === "none" ? undefined : selectedSegmentId,
        venueId: getCampaignVenueId(),
        scheduledAt: scheduledAtDate || undefined,
      });

      if (result.success && result.campaign) {
        if (deliveryMode === "scheduled" && scheduledAtDate) {
          const scheduleResult = await scheduleEmailCampaign(result.campaign.id, scheduledAtDate);

          if (!scheduleResult.success) {
            toast.error(
              scheduleResult.error || "Campaign was created but could not be scheduled automatically"
            );
            router.push(`/emails/campaigns/${result.campaign.id}`);
            return;
          }

          toast.success(`Campaign scheduled for ${scheduledAtDate.toLocaleString()}`);
        } else {
          toast.success("Campaign saved as draft");
        }

        router.push(`/emails/campaigns/${result.campaign.id}`);
      } else {
        toast.error(result.error || "Failed to save campaign");
      }
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Failed to save campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Please enter a test email address");
      return;
    }

    if (!selectedEmailId) {
      toast.error("Please select an email first");
      return;
    }

    const result = await createEmailCampaign({
      name: `${name.trim() || "Test Campaign"} (test)`,
      emailId: selectedEmailId,
      folderId: folderId === "none" ? undefined : folderId,
      customSubject: customSubject.trim() || undefined,
      targetRoles: selectedRoles,
      targetVenueIds: selectedVenues,
      targetStatus: selectedStatus,
      targetUserIds: selectedUserIds,
      segmentId: selectedSegmentId === "none" ? undefined : selectedSegmentId,
      venueId: getCampaignVenueId(),
    });

    if (!result.success || !result.campaign) {
      toast.error(result.error || "Failed to create campaign for test send");
      return;
    }

    setTestEmailLoading(true);
    try {
      const testResult = await sendTestEmail(result.campaign.id, testEmail.trim());
      if (testResult.success) {
        toast.success(`Test email sent to ${testEmail}`);
      } else {
        toast.error(testResult.error || "Failed to send test email");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email");
    } finally {
      setTestEmailLoading(false);
    }
  };

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="campaign-name">Campaign Name *</Label>
          <Input
            id="campaign-name"
            placeholder="e.g., March 2026 Newsletter"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Internal name for campaign management (not shown to recipients)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="custom-subject">Subject Override (Optional)</Label>
          <Input
            id="custom-subject"
            placeholder="Leave blank to use selected email subject"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Override the selected email subject without editing the base email.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="delivery-mode">Delivery Mode</Label>
          <Select value={deliveryMode} onValueChange={(value) => setDeliveryMode(value as DeliveryMode)}>
            <SelectTrigger id="delivery-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Save as draft</SelectItem>
              <SelectItem value="scheduled">Schedule one-off send</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {deliveryMode === "scheduled" && (
          <div className="space-y-2">
            <Label htmlFor="scheduled-at">Schedule Date & Time</Label>
            <Input
              id="scheduled-at"
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Campaign will be created as draft and moved to scheduled status automatically.
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="venue-scope">Campaign Scope</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger id="venue-scope">
                <SelectValue placeholder="Select campaign scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All venues (system-wide)</SelectItem>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="campaign-folder">Campaign Folder</Label>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger id="campaign-folder">
              <SelectValue placeholder="No folder (root)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No folder (root)</SelectItem>
              {folderOptions.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {foldersLoading && (
            <p className="text-sm text-muted-foreground">Loading campaign folders...</p>
          )}
          {foldersError && (
            <p className="text-sm text-muted-foreground">{foldersError}</p>
          )}
        </div>
      </div>

      {selectedEmailDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selected Email Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Email:</span> {selectedEmailDetail.name}
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>{" "}
                <Badge variant="outline">{selectedEmailDetail.emailType}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Subject:</span> {resolvedSubject || "(none)"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderEmailStep = () => (
    <div className="space-y-6">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="email-search">Search Saved Emails</Label>
          <Input
            id="email-search"
            placeholder="Search by name or subject"
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
          />
        </div>
        <Button asChild variant="outline">
          <Link href="/emails/create/new">Create New Email</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Email</CardTitle>
          <CardDescription>
            Campaigns now use saved emails/templates from Email Builder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails found for the current filter.</p>
          ) : (
            <ScrollArea className="h-[360px] pr-4">
              <div className="space-y-3">
                {availableEmails.map((email) => {
                  const isSelected = selectedEmailId === email.id;
                  return (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setSelectedEmailId(email.id)}
                      className={`w-full rounded-lg border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="font-medium">{email.name}</div>
                          <div className="text-sm text-muted-foreground">{email.subject}</div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Badge variant="outline">{email.emailType}</Badge>
                            {email.category && <Badge variant="secondary">{email.category}</Badge>}
                            <span className="text-xs text-muted-foreground">Used {email.useCount} times</span>
                          </div>
                        </div>
                        {isSelected && <Badge>Selected</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {selectedEmailDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email Preview Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4">
              <div className="font-medium">{selectedEmailDetail.name}</div>
              <div className="text-sm text-muted-foreground">{selectedEmailDetail.subject}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTargetingStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saved Segment</CardTitle>
          <CardDescription>
            Use a reusable audience segment, or combine role/venue/status filters below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No saved segment</SelectItem>
              {segmentsLoading ? (
                <SelectItem value="loading" disabled>
                  Loading segments...
                </SelectItem>
              ) : (
                segments.map((segment) => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name} ({segment.userCount} users)
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {roles.map((role) => (
              <div key={role.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selectedRoles.includes(role.name)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedRoles([...selectedRoles, role.name]);
                    } else {
                      setSelectedRoles(selectedRoles.filter((r) => r !== role.name));
                    }
                  }}
                />
                <Label htmlFor={`role-${role.id}`} className="cursor-pointer">
                  {role.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target by Venue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {venues.map((venue) => (
              <div key={venue.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`venue-${venue.id}`}
                  checked={selectedVenues.includes(venue.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedVenues([...selectedVenues, venue.id]);
                    } else {
                      setSelectedVenues(selectedVenues.filter((v) => v !== venue.id));
                    }
                  }}
                />
                <Label htmlFor={`venue-${venue.id}`} className="cursor-pointer">
                  {venue.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Target by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="status-active"
                checked={selectedStatus.includes("ACTIVE")}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedStatus([...selectedStatus, "ACTIVE"]);
                  } else {
                    setSelectedStatus(selectedStatus.filter((s) => s !== "ACTIVE"));
                  }
                }}
              />
              <Label htmlFor="status-active">Active</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="status-inactive"
                checked={selectedStatus.includes("INACTIVE")}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedStatus([...selectedStatus, "INACTIVE"]);
                  } else {
                    setSelectedStatus(selectedStatus.filter((s) => s !== "INACTIVE"));
                  }
                }}
              />
              <Label htmlFor="status-inactive">Inactive</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Name</dt>
              <dd className="text-lg">{name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Email</dt>
              <dd className="text-lg">{selectedEmailDetail?.name || "Not selected"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Subject</dt>
              <dd className="text-lg">{resolvedSubject || "No subject"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Segment</dt>
              <dd className="text-lg">
                {selectedSegmentId === "none"
                  ? "No saved segment"
                  : segments.find((segment) => segment.id === selectedSegmentId)?.name || "Selected"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Delivery</dt>
              <dd className="text-lg">
                {deliveryMode === "scheduled" ? "Scheduled (one-off)" : "Draft only"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Schedule Time</dt>
              <dd className="text-lg">
                {scheduledAtDate ? scheduledAtDate.toLocaleString() : "Not scheduled"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recipients
          </CardTitle>
        </CardHeader>
        <CardContent>
          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recipientPreview ? (
            <div className="space-y-4">
              <div className="text-3xl font-bold">{recipientPreview.totalCount} recipients</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-2 font-medium">By Role</h4>
                  <div className="space-y-1">
                    {Object.entries(recipientPreview.byRole).map(([role, count]) => (
                      <div key={role} className="flex justify-between text-sm">
                        <span>{role}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-medium">By Venue</h4>
                  <div className="space-y-1">
                    {recipientPreview.byVenue.map((venue) => (
                      <div key={venue.venueId} className="flex justify-between text-sm">
                        <span>{venue.venueName}</span>
                        <span className="font-medium">{venue.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No recipients match the selected targeting criteria.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b bg-muted p-3">
              <div className="text-sm font-medium">Subject: {resolvedSubject || "No subject"}</div>
            </div>
            <div
              className="min-h-[200px] bg-white p-4"
              dangerouslySetInnerHTML={{
                __html: sanitizeEmailHtmlFragment(selectedEmailDetail?.htmlContent || "<p>No email content available</p>"),
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Send Test Email</CardTitle>
          <CardDescription>Send a test email before scheduling or sending campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSendTest} disabled={testEmailLoading || !selectedEmailId}>
              {testEmailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Test
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "details":
        return renderDetailsStep();
      case "email":
        return renderEmailStep();
      case "targeting":
        return renderTargetingStep();
      case "preview":
        return renderPreviewStep();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/emails/campaigns">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">New Email Campaign</h1>
          <p className="text-muted-foreground">
            Build a campaign by selecting a saved email, target audience, and delivery scope.
          </p>
        </div>
        <Button variant="outline" onClick={handleSaveDraft} disabled={loading || !selectedEmailId}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              {deliveryMode === "scheduled" ? (
                <CalendarClock className="mr-2 h-4 w-4" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
            </>
          )}
          {saveButtonLabel}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`}>
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 ${
                currentStepIndex >= index ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  currentStepIndex > index
                    ? "bg-primary text-primary-foreground"
                    : currentStepIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStepIndex > index ? "✓" : index + 1}
              </div>
              <div className="hidden text-left md:block">
                <div className="font-medium">{step.label}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`mx-4 h-0.5 flex-1 ${currentStepIndex > index ? "bg-primary" : "bg-muted"}`}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">{renderCurrentStep()}</CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <div className="flex gap-2">
          {currentStep === "preview" ? (
            <Button onClick={handleSaveDraft} disabled={loading || !selectedEmailId}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {deliveryMode === "scheduled" ? "Save & Schedule" : "Save & Continue Later"}
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {selectedEmailDetail && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          Using <span className="font-medium text-foreground">{selectedEmailDetail.name}</span>
          <FileText className="ml-2 h-4 w-4" />
          Subject: {resolvedSubject || selectedEmailDetail.subject}
        </div>
      )}
    </div>
  );
}
