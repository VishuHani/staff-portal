"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  createEmailCampaign,
  previewCampaignRecipients,
  sendTestEmail,
} from "@/lib/actions/email-campaigns";
import type { EmailType, RecipientPreview } from "@/types/email-campaign";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Eye,
  Users,
  Sparkles,
  Loader2,
  Save,
  Code,
  FileText,
  Image as ImageIcon,
  Link2,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Mail,
} from "lucide-react";
import Link from "next/link";

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

interface NewCampaignClientProps {
  isAdmin: boolean;
  venues: Venue[];
  roles: Role[];
}

type Step = "details" | "content" | "targeting" | "preview";

const steps: { id: Step; label: string; description: string }[] = [
  { id: "details", label: "Details", description: "Campaign name and subject" },
  { id: "content", label: "Content", description: "Email content and design" },
  { id: "targeting", label: "Targeting", description: "Select recipients" },
  { id: "preview", label: "Preview", description: "Review and send" },
];

// Mock templates for demonstration
const emailTemplates = [
  { id: "1", name: "Newsletter Template", category: "Marketing", description: "Monthly newsletter format" },
  { id: "2", name: "Announcement Template", category: "Transactional", description: "Important announcements" },
  { id: "3", name: "Event Invitation", category: "Marketing", description: "Event invitations" },
];

// Mock previous campaigns for demonstration
const previousCampaigns = [
  { id: "1", name: "March 2024 Newsletter", subject: "Monthly Update", recipients: 150, sentAt: "2024-03-01", openRate: "45%" },
  { id: "2", name: "System Maintenance Notice", subject: "Scheduled Maintenance", recipients: 200, sentAt: "2024-02-15", openRate: "62%" },
];

export function NewCampaignClient({ isAdmin, venues, roles }: NewCampaignClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [emailType, setEmailType] = useState<EmailType>("TRANSACTIONAL");
  const [htmlContent, setHtmlContent] = useState("");
  const [textContent, setTextContent] = useState("");
  const [venueId, setVenueId] = useState<string>("all");
  
  // Targeting state
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(["ACTIVE"]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Preview state
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [testEmail, setTestEmail] = useState("");
  
  // Editor mode
  const [editorMode, setEditorMode] = useState<"visual" | "html">("visual");

  // Calculate step index
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  // Load recipient preview when step changes to preview
  useEffect(() => {
    if (currentStep === "preview") {
      loadRecipientPreview();
    }
  }, [currentStep]);

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
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleNext = () => {
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

  const validateStep = (): boolean => {
    switch (currentStep) {
      case "details":
        if (!name.trim()) {
          toast.error("Campaign name is required");
          return false;
        }
        if (!subject.trim()) {
          toast.error("Subject is required");
          return false;
        }
        return true;
      case "content":
        if (!htmlContent.trim()) {
          toast.error("Email content is required");
          return false;
        }
        return true;
      case "targeting":
        // At least one targeting criteria should be set
        if (selectedRoles.length === 0 && selectedVenues.length === 0 && selectedUserIds.length === 0) {
          toast.error("Please select at least one targeting criteria");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleSaveDraft = async () => {
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and subject are required to save");
      return;
    }

    setLoading(true);
    try {
      const result = await createEmailCampaign({
        name,
        subject,
        previewText,
        htmlContent: htmlContent || "<p>Draft content</p>",
        textContent,
        emailType,
        targetRoles: selectedRoles,
        targetVenueIds: selectedVenues,
        targetStatus: selectedStatus,
        targetUserIds: selectedUserIds,
        venueId: isAdmin ? venueId : undefined,
      });

      if (result.success && result.campaign) {
        toast.success("Campaign saved as draft");
        router.push(`/system/emails/${result.campaign.id}`);
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

    // First save the campaign
    const result = await createEmailCampaign({
      name,
      subject,
      previewText,
      htmlContent: htmlContent || "<p>Test content</p>",
      textContent,
      emailType,
      targetRoles: selectedRoles,
      targetVenueIds: selectedVenues,
      targetStatus: selectedStatus,
      targetUserIds: selectedUserIds,
      venueId: isAdmin ? venueId : undefined,
    });

    if (!result.success || !result.campaign) {
      toast.error(result.error || "Failed to create campaign for testing");
      return;
    }

    setTestEmailLoading(true);
    try {
      const testResult = await sendTestEmail(result.campaign.id, testEmail);
      if (testResult.success) {
        toast.success(`Test email sent to ${testEmail}`);
      } else {
        toast.error(testResult.error || "Failed to send test email");
      }
    } catch (error) {
      console.error("Error sending test:", error);
      toast.error("Failed to send test email");
    } finally {
      setTestEmailLoading(false);
    }
  };

  const insertHtmlTag = (tag: string, attr: string = "") => {
    const template = `<${tag}${attr ? " " + attr : ""}>Selected text here</${tag}>`;
    setHtmlContent(prev => prev + template);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "details":
        return (
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., March 2024 Newsletter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Internal name for reference (not shown to recipients)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Email Subject *</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Important Update from Staff Portal"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="previewText">Preview Text</Label>
                <Input
                  id="previewText"
                  placeholder="Short preview text shown in email client"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  This text appears next to the subject in some email clients
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emailType">Email Type</Label>
                <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Transactional emails are for operational updates. Marketing emails are for promotions and newsletters.
                </p>
              </div>

              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="venueScope">Venue Scope</Label>
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a venue scope" />
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
                  <p className="text-sm text-muted-foreground">
                    Limit this campaign to a specific venue (admin only)
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case "content":
        return (
          <div className="space-y-6">
            <Tabs value={editorMode} onValueChange={(v) => setEditorMode(v as "visual" | "html")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="visual">Visual Editor</TabsTrigger>
                <TabsTrigger value="html">HTML Code</TabsTrigger>
              </TabsList>

              <TabsContent value="visual" className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap gap-1 p-2 border rounded-t-lg bg-muted/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("strong")}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("em")}
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("u")}
                    title="Underline"
                  >
                    <Underline className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("h1", 'style="font-size: 24px; font-weight: bold;"')}
                    title="Heading 1"
                  >
                    H1
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("h2", 'style="font-size: 20px; font-weight: bold;"')}
                    title="Heading 2"
                  >
                    H2
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("ul")}
                    title="Bullet List"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("ol")}
                    title="Numbered List"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="mx-1 h-6" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("a", 'href="https://example.com"')}
                    title="Link"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("img", 'src="https://example.com/image.jpg" alt="Image" style="max-width: 100%;"')}
                    title="Image"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => insertHtmlTag("div", 'style="text-align: center;"')}
                    title="Center"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content area */}
                <Textarea
                  placeholder="Start typing your email content here..."
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="min-h-[400px] font-mono"
                />
              </TabsContent>

              <TabsContent value="html" className="space-y-4">
                <Textarea
                  placeholder="Enter your HTML code here..."
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              </TabsContent>
            </Tabs>

            {/* Plain text version */}
            <div className="space-y-2">
              <Label htmlFor="textContent">Plain Text Version (Optional)</Label>
              <Textarea
                id="textContent"
                placeholder="Plain text version for email clients that don't support HTML..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[150px]"
              />
              <p className="text-sm text-muted-foreground">
                A plain text fallback for email clients that don't support HTML
              </p>
            </div>

            {/* Test email */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Send Test Email</CardTitle>
                <CardDescription>
                  Send a test email to preview how it will look
                </CardDescription>
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

      case "targeting":
        return (
          <div className="space-y-6">
            {/* Target by Role */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Target by Role</CardTitle>
                <CardDescription>
                  Select which user roles should receive this email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                        {role.description && (
                          <span className="text-muted-foreground text-xs block">
                            {role.description}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Target by Venue */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Target by Venue</CardTitle>
                <CardDescription>
                  Select which venues should receive this email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                        <span className="text-muted-foreground text-xs block">
                          {venue.code}
                        </span>
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Target by Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Target by Status</CardTitle>
                <CardDescription>
                  Select user status to include
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
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
                    <Label htmlFor="status-active">Active Users</Label>
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
                    <Label htmlFor="status-inactive">Inactive Users</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-6">
            {/* Campaign Summary */}
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
                    <dt className="text-sm font-medium text-muted-foreground">Subject</dt>
                    <dd className="text-lg">{subject}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                    <dd>
                      <Badge variant={emailType === "MARKETING" ? "default" : "secondary"}>
                        {emailType}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Roles</dt>
                    <dd className="flex flex-wrap gap-1">
                      {selectedRoles.length > 0 ? (
                        selectedRoles.map((role) => (
                          <Badge key={role} variant="outline">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">All roles</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Recipient Preview */}
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
                    <div className="text-3xl font-bold">
                      {recipientPreview.totalCount} recipients
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">By Role</h4>
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
                        <h4 className="font-medium mb-2">By Venue</h4>
                        <div className="space-y-1">
                          {recipientPreview.byVenue.map((v) => (
                            <div key={v.venueId} className="flex justify-between text-sm">
                              <span>{v.venueName}</span>
                              <span className="font-medium">{v.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No recipients match your criteria</p>
                )}
              </CardContent>
            </Card>

            {/* Email Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Email Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted p-3 border-b">
                    <div className="text-sm font-medium">Subject: {subject}</div>
                    {previewText && (
                      <div className="text-sm text-muted-foreground">{previewText}</div>
                    )}
                  </div>
                  <div 
                    className="p-4 min-h-[200px] bg-white"
                    dangerouslySetInnerHTML={{ __html: htmlContent || "<p>No content</p>" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/system/emails">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">New Email Campaign</h1>
          <p className="text-muted-foreground">
            Create and send email campaigns to your staff
          </p>
        </div>
        <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Draft
        </Button>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center ${
              index < steps.length - 1 ? "flex-1" : ""
            }`}
          >
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 ${
                currentStepIndex >= index
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStepIndex > index
                    ? "bg-primary text-primary-foreground"
                    : currentStepIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStepIndex > index ? "✓" : index + 1}
              </div>
              <div className="hidden md:block text-left">
                <div className="font-medium">{step.label}</div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-4 ${
                  currentStepIndex > index
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStepIndex === 0}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <div className="flex gap-2">
          {currentStep === "preview" ? (
            <Button onClick={handleSaveDraft} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save & Continue Later
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (validateStep()) {
                  handleNext();
                }
              }}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
