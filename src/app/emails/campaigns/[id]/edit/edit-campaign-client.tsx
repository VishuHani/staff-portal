"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail, RefreshCw, Save, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getAvailableEmails,
  getEmailSegments,
  previewCampaignRecipients,
  sendTestEmail,
  updateEmailCampaign,
} from "@/lib/actions/email-campaigns";
import { getEmail } from "@/lib/actions/emails";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import type { EmailType, RecipientPreview } from "@/types/email-campaign";

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

interface CampaignEditData {
  id: string;
  name: string;
  status: string;
  emailId: string;
  customSubject: string | null;
  folderId: string | null;
  targetRoles: string[];
  targetVenueIds: string[];
  targetStatus: string[];
  targetUserIds: string[];
  segmentId: string | null;
  venueId: string | null;
  email: {
    id: string;
    name: string;
    subject: string;
    htmlContent: string;
    emailType: EmailType;
    category: string | null;
  } | null;
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

interface EditCampaignClientProps {
  campaign: CampaignEditData;
  isAdmin: boolean;
  venues: Venue[];
  roles: Role[];
}

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

function toggleStringValue(values: string[], value: string): string[] {
  if (values.includes(value)) {
    return values.filter((entry) => entry !== value);
  }
  return [...values, value];
}

export function EditCampaignClient({ campaign, isAdmin, venues, roles }: EditCampaignClientProps) {
  const router = useRouter();

  const [name, setName] = useState(campaign.name);
  const [customSubject, setCustomSubject] = useState(campaign.customSubject || "");
  const [folderId, setFolderId] = useState<string>(campaign.folderId || "none");
  const [selectedEmailId, setSelectedEmailId] = useState<string>(campaign.emailId);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(campaign.targetRoles || []);
  const [selectedVenues, setSelectedVenues] = useState<string[]>(
    campaign.targetVenueIds.length > 0
      ? campaign.targetVenueIds
      : !isAdmin && venues.length > 0
      ? [venues[0].id]
      : []
  );
  const [selectedStatus, setSelectedStatus] = useState<string[]>(
    campaign.targetStatus.length > 0 ? campaign.targetStatus : ["ACTIVE"]
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(campaign.segmentId || "none");

  const [availableEmails, setAvailableEmails] = useState<AvailableEmail[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedEmailDetail, setSelectedEmailDetail] = useState<SelectedEmailDetail | null>(
    campaign.email
      ? {
          id: campaign.email.id,
          name: campaign.email.name,
          subject: campaign.email.subject,
          htmlContent: campaign.email.htmlContent,
          emailType: campaign.email.emailType,
          category: campaign.email.category,
        }
      : null
  );

  const [emailSearch, setEmailSearch] = useState("");
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const [emailsLoading, setEmailsLoading] = useState(false);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  const resolvedSubject = useMemo(() => {
    const override = customSubject.trim();
    if (override.length > 0) {
      return override;
    }
    return selectedEmailDetail?.subject || "";
  }, [customSubject, selectedEmailDetail]);

  const loadAvailableEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const result = await getAvailableEmails({
        search: emailSearch.trim() || undefined,
      });

      if (!result.success || !result.emails) {
        toast.error(result.error || "Failed to load available emails");
        setAvailableEmails([]);
        return;
      }

      setAvailableEmails(result.emails as AvailableEmail[]);
    } catch (error) {
      console.error("Error loading available emails:", error);
      toast.error("Failed to load available emails");
      setAvailableEmails([]);
    } finally {
      setEmailsLoading(false);
    }
  }, [emailSearch]);

  const loadSegments = useCallback(async () => {
    setSegmentsLoading(true);
    try {
      const result = await getEmailSegments();
      if (!result.success || !result.segments) {
        toast.error(result.error || "Failed to load audience segments");
        setSegments([]);
        return;
      }

      setSegments(result.segments as SegmentOption[]);
    } catch (error) {
      console.error("Error loading audience segments:", error);
      toast.error("Failed to load audience segments");
      setSegments([]);
    } finally {
      setSegmentsLoading(false);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const response = await listFolderTree({ module: "campaigns" });
      if (!response.success || !response.tree) {
        setFolderOptions([]);
        return;
      }

      setFolderOptions(flattenFolderOptions(response.tree));
    } catch (error) {
      console.error("Error loading campaign folders:", error);
      setFolderOptions([]);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const loadSelectedEmail = useCallback(async (emailId: string) => {
    try {
      const email = await getEmail(emailId);
      if (!email) {
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
      setSelectedEmailDetail(null);
    }
  }, []);

  const loadRecipientPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const result = await previewCampaignRecipients({
        roles: selectedRoles,
        venueIds: selectedVenues,
        userStatus: selectedStatus,
        userIds: campaign.targetUserIds,
      });

      setRecipientPreview(result);
    } catch (error) {
      console.error("Error loading recipient preview:", error);
      toast.error("Failed to preview recipients");
      setRecipientPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [campaign.targetUserIds, selectedRoles, selectedStatus, selectedVenues]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadAvailableEmails();
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadAvailableEmails]);

  useEffect(() => {
    void loadSegments();
    void loadFolders();
  }, [loadFolders, loadSegments]);

  useEffect(() => {
    if (!selectedEmailId) {
      setSelectedEmailDetail(null);
      return;
    }

    void loadSelectedEmail(selectedEmailId);
  }, [loadSelectedEmail, selectedEmailId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadRecipientPreview();
    }, 200);

    return () => clearTimeout(timeout);
  }, [loadRecipientPreview]);

  async function handleSaveCampaign() {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    if (!selectedEmailId) {
      toast.error("Select an email for this campaign");
      return;
    }

    if (
      selectedRoles.length === 0 &&
      selectedVenues.length === 0 &&
      campaign.targetUserIds.length === 0 &&
      selectedSegmentId === "none"
    ) {
      toast.error("Select at least one targeting criteria");
      return;
    }

    setSaveLoading(true);
    try {
      const response = await updateEmailCampaign(campaign.id, {
        name: name.trim(),
        emailId: selectedEmailId,
        folderId: folderId === "none" ? null : folderId,
        customSubject: customSubject.trim(),
        targetRoles: selectedRoles,
        targetVenueIds: selectedVenues,
        targetStatus: selectedStatus,
        targetUserIds: campaign.targetUserIds,
        segmentId: selectedSegmentId === "none" ? null : selectedSegmentId,
      });

      if (!response.success) {
        toast.error(response.error || "Failed to save campaign");
        return;
      }

      toast.success("Campaign updated");
      router.push(`/emails/campaigns/${campaign.id}`);
      router.refresh();
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Failed to save campaign");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail.trim()) {
      toast.error("Enter a test email address");
      return;
    }

    setTestEmailLoading(true);
    try {
      const result = await sendTestEmail(campaign.id, testEmail.trim());
      if (!result.success) {
        toast.error(result.error || "Failed to send test email");
        return;
      }

      toast.success(`Test email sent to ${testEmail.trim()}`);
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email");
    } finally {
      setTestEmailLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/emails/campaigns/${campaign.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
          <p className="text-muted-foreground">
            Update email selection, targeting, and folder assignment for this draft campaign.
          </p>
        </div>
        <Button onClick={handleSaveCampaign} disabled={saveLoading}>
          {saveLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Campaign name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-subject">Subject Override (Optional)</Label>
            <Input
              id="custom-subject"
              value={customSubject}
              onChange={(event) => setCustomSubject(event.target.value)}
              placeholder="Uses selected email subject when blank"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
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
              <p className="text-xs text-muted-foreground">Loading folders...</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Select Email</CardTitle>
          <CardDescription>Pick a saved email from the builder library.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={emailSearch}
            onChange={(event) => setEmailSearch(event.target.value)}
            placeholder="Search saved emails..."
          />
          {emailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails found.</p>
          ) : (
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-2">
                {availableEmails.map((email) => {
                  const isSelected = selectedEmailId === email.id;
                  return (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setSelectedEmailId(email.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{email.name}</p>
                          <p className="text-sm text-muted-foreground">{email.subject}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="outline">{email.emailType}</Badge>
                            {email.category && <Badge variant="secondary">{email.category}</Badge>}
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

      <Card>
        <CardHeader>
          <CardTitle>Targeting</CardTitle>
          <CardDescription>Choose segment, roles, venues, and user status filters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Saved Segment</Label>
            <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder="No saved segment" />
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
          </div>

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedRoles.includes(role.name)}
                    onCheckedChange={() => setSelectedRoles((prev) => toggleStringValue(prev, role.name))}
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Venues</Label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {venues.map((venue) => (
                <label key={venue.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedVenues.includes(venue.id)}
                    onCheckedChange={() => setSelectedVenues((prev) => toggleStringValue(prev, venue.id))}
                  />
                  <span>{venue.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>User Status</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedStatus.includes("ACTIVE")}
                  onCheckedChange={() => setSelectedStatus((prev) => toggleStringValue(prev, "ACTIVE"))}
                />
                <span>Active</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedStatus.includes("INACTIVE")}
                  onCheckedChange={() => setSelectedStatus((prev) => toggleStringValue(prev, "INACTIVE"))}
                />
                <span>Inactive</span>
              </label>
            </div>
          </div>

          {!isAdmin && (
            <p className="text-xs text-muted-foreground">
              Non-admin targeting remains constrained to your venue access.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recipient Preview
              </CardTitle>
              <CardDescription>Estimated recipients based on current targeting.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadRecipientPreview()}
              disabled={previewLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {previewLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recipientPreview ? (
            <div className="space-y-4">
              <div className="text-3xl font-bold">{recipientPreview.totalCount}</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">By Role</p>
                  {Object.entries(recipientPreview.byRole).map(([role, count]) => (
                    <div key={role} className="flex justify-between text-sm">
                      <span>{role}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">By Venue</p>
                  {recipientPreview.byVenue.map((venue) => (
                    <div key={venue.venueId} className="flex justify-between text-sm">
                      <span>{venue.venueName}</span>
                      <span className="font-medium">{venue.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recipients match the current targeting.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border">
            <div className="border-b bg-muted px-3 py-2 text-sm">
              Subject: {resolvedSubject || "(No subject)"}
            </div>
            <div
              className="min-h-[200px] bg-white p-4"
              dangerouslySetInnerHTML={{
                __html: selectedEmailDetail?.htmlContent || "<p>No email content available.</p>",
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
          <CardDescription>Send a test before saving and sending the campaign.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="test@example.com"
            />
            <Button onClick={handleSendTest} disabled={testEmailLoading}>
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
}
