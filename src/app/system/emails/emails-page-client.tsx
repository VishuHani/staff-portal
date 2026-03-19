"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getEmailCampaigns,
  deleteEmailCampaign,
  cancelEmailCampaign,
  requestCampaignApproval,
  reviewCampaignApproval,
  sendEmailCampaign,
  scheduleEmailCampaign,
  getEmailApprovalPolicy,
  upsertEmailApprovalPolicy,
  type EmailCampaignListItem,
} from "@/lib/actions/email-campaigns";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import type {
  CampaignStatus,
  CampaignApprovalStatus,
  EmailType,
} from "@/types/email-campaign";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Send,
  Clock,
  XCircle,
  BarChart3,
  Mail,
  Users,
  FileText,
  Loader2,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

const CAMPAIGN_PAGE_SIZE = 25;

interface EmailsPageClientProps {
  isAdmin: boolean;
  venues: Array<{ id: string; name: string; code: string }>;
}

const statusColors: Record<CampaignStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  QUEUED: "bg-yellow-100 text-yellow-800",
  SENDING: "bg-orange-100 text-orange-800",
  SENT: "bg-green-100 text-green-800",
  PARTIALLY_SENT: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const emailTypeColors: Record<EmailType, string> = {
  TRANSACTIONAL: "bg-purple-100 text-purple-800",
  MARKETING: "bg-pink-100 text-pink-800",
};

const approvalStatusColors: Record<CampaignApprovalStatus, string> = {
  NOT_REQUIRED: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

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

export function EmailsPageClient({ isAdmin, venues }: EmailsPageClientProps) {
  const [campaigns, setCampaigns] = useState<EmailCampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaignListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedPolicyVenueId, setSelectedPolicyVenueId] = useState<string>("");
  const [policyEnabled, setPolicyEnabled] = useState(false);
  const [policyRequireForNonAdmin, setPolicyRequireForNonAdmin] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: CAMPAIGN_PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [summary, setSummary] = useState({
    drafts: 0,
    scheduled: 0,
    sent: 0,
    totalRecipients: 0,
  });

  useEffect(() => {
    if (!isAdmin || venues.length === 0) {
      return;
    }

    if (!selectedPolicyVenueId) {
      setSelectedPolicyVenueId(venues[0].id);
    }
  }, [isAdmin, venues, selectedPolicyVenueId]);

  useEffect(() => {
    if (!isAdmin || !selectedPolicyVenueId) {
      return;
    }

    const loadPolicy = async () => {
      setPolicyLoading(true);
      try {
        const response = await getEmailApprovalPolicy(selectedPolicyVenueId);
        if (!response.success || !response.policy) {
          toast.error(response.error || "Failed to load approval policy");
          return;
        }

        setPolicyEnabled(response.policy.enabled);
        setPolicyRequireForNonAdmin(response.policy.requireForNonAdmin);
      } catch (error) {
        console.error("Error loading approval policy:", error);
        toast.error("Failed to load approval policy");
      } finally {
        setPolicyLoading(false);
      }
    };

    void loadPolicy();
  }, [isAdmin, selectedPolicyVenueId]);

  const loadFolders = async () => {
    try {
      const response = await listFolderTree({ module: "campaigns" });
      if (!response.success || !response.tree) {
        return;
      }

      setFolderOptions(flattenFolderOptions(response.tree));
    } catch (error) {
      console.error("Error loading campaign folders:", error);
    }
  };

  const loadCampaigns = useCallback(
    async (requestedPage = page) => {
      setLoading(true);
      try {
        const filters: Record<string, unknown> = {
          page: requestedPage,
          limit: CAMPAIGN_PAGE_SIZE,
        };
        if (statusFilter !== "all") {
          filters.status = statusFilter as CampaignStatus;
        }
        if (typeFilter !== "all") {
          filters.emailType = typeFilter as EmailType;
        }
        if (folderFilter !== "all") {
          filters.folderId = folderFilter;
        }
        if (appliedSearch) {
          filters.search = appliedSearch;
        }

        const result = await getEmailCampaigns(filters);
        if (result.success && result.campaigns) {
          setCampaigns(result.campaigns);
          setSummary(
            result.summary || {
              drafts: 0,
              scheduled: 0,
              sent: 0,
              totalRecipients: 0,
            }
          );
          setPagination(
            result.pagination || {
              page: requestedPage,
              limit: CAMPAIGN_PAGE_SIZE,
              total: result.total || 0,
              totalPages: 1,
              hasMore: false,
            }
          );
        } else {
          toast.error(result.error || "Failed to load campaigns");
        }
      } catch (error) {
        console.error("Error loading campaigns:", error);
        toast.error("Failed to load campaigns");
      } finally {
        setLoading(false);
      }
    },
    [appliedSearch, folderFilter, page, statusFilter, typeFilter]
  );

  useEffect(() => {
    void loadFolders();
  }, []);

  useEffect(() => {
    void loadCampaigns(page);
  }, [loadCampaigns, page]);

  const handleDelete = async () => {
    if (!selectedCampaign) return;
    
    setActionLoading(selectedCampaign.id);
    try {
      const result = await deleteEmailCampaign(selectedCampaign.id);
      if (result.success) {
        toast.success("Campaign deleted");
        setCampaigns(campaigns.filter(c => c.id !== selectedCampaign.id));
      } else {
        toast.error(result.error || "Failed to delete campaign");
      }
    } catch (error) {
      toast.error("Failed to delete campaign");
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setSelectedCampaign(null);
    }
  };

  const handleCancel = async (campaign: EmailCampaignListItem) => {
    setActionLoading(campaign.id);
    try {
      const result = await cancelEmailCampaign(campaign.id);
      if (result.success) {
        toast.success("Campaign cancelled");
        loadCampaigns();
      } else {
        toast.error(result.error || "Failed to cancel campaign");
      }
    } catch (error) {
      toast.error("Failed to cancel campaign");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendNow = async (campaign: EmailCampaignListItem) => {
    if (!confirm("Are you sure you want to send this campaign now? This action cannot be undone.")) {
      return;
    }
    
    setActionLoading(campaign.id);
    try {
      const result = await sendEmailCampaign(campaign.id);
      if (result.success) {
        toast.success(`Campaign sent to ${result.recipientCount} recipients`);
        loadCampaigns();
      } else {
        toast.error(result.error || "Failed to send campaign");
      }
    } catch (error) {
      toast.error("Failed to send campaign");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestApproval = async (campaign: EmailCampaignListItem) => {
    setActionLoading(campaign.id);
    try {
      const result = await requestCampaignApproval(campaign.id);
      if (result.success) {
        toast.success("Campaign submitted for approval");
        await loadCampaigns();
      } else {
        toast.error(result.error || "Failed to request approval");
      }
    } catch (error) {
      toast.error("Failed to request approval");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewApproval = async (
    campaign: EmailCampaignListItem,
    decision: "APPROVE" | "REJECT"
  ) => {
    setActionLoading(campaign.id);
    try {
      const result = await reviewCampaignApproval({
        campaignId: campaign.id,
        decision,
      });
      if (result.success) {
        toast.success(decision === "APPROVE" ? "Campaign approved" : "Campaign rejected");
        await loadCampaigns();
      } else {
        toast.error(result.error || "Failed to review approval");
      }
    } catch (error) {
      toast.error("Failed to review approval");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveApprovalPolicy = async () => {
    if (!selectedPolicyVenueId) {
      toast.error("Select a venue to update approval policy");
      return;
    }

    setPolicySaving(true);
    try {
      const response = await upsertEmailApprovalPolicy({
        venueId: selectedPolicyVenueId,
        enabled: policyEnabled,
        requireForNonAdmin: policyRequireForNonAdmin,
      });

      if (!response.success) {
        toast.error(response.error || "Failed to save approval policy");
        return;
      }

      toast.success("Approval policy updated");
      await loadCampaigns();
    } catch (error) {
      console.error("Error saving approval policy:", error);
      toast.error("Failed to save approval policy");
    } finally {
      setPolicySaving(false);
    }
  };

  const getStatusBadge = (status: CampaignStatus) => (
    <Badge className={statusColors[status]} variant="outline">
      {status.replace("_", " ")}
    </Badge>
  );

  const getTypeBadge = (type: EmailType) => (
    <Badge className={emailTypeColors[type]} variant="outline">
      {type}
    </Badge>
  );

  const getApprovalBadge = (status: CampaignApprovalStatus) => (
    <Badge className={approvalStatusColors[status]} variant="outline">
      {status === "NOT_REQUIRED" ? "Not Required" : status}
    </Badge>
  );

  const stats = {
    total: pagination.total,
    drafts: summary.drafts,
    scheduled: summary.scheduled,
    sent: summary.sent,
    totalRecipients: summary.totalRecipients,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">
            Create, manage, and send email campaigns to your staff
          </p>
        </div>
        <Link href="/emails/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      {isAdmin && venues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approval Policy</CardTitle>
            <CardDescription>
              Control whether non-admin users must request approval before sending campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="approval-policy-venue">Venue</Label>
                <Select
                  value={selectedPolicyVenueId}
                  onValueChange={setSelectedPolicyVenueId}
                >
                  <SelectTrigger id="approval-policy-venue">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Policy Toggles</p>
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Enable Policy</p>
                      <p className="text-xs text-muted-foreground">
                        Turns campaign approval checks on for this venue.
                      </p>
                    </div>
                    <Switch
                      checked={policyEnabled}
                      onCheckedChange={setPolicyEnabled}
                      disabled={policyLoading || policySaving}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Require For Non-Admin</p>
                      <p className="text-xs text-muted-foreground">
                        Non-admin users must request approval before send.
                      </p>
                    </div>
                    <Switch
                      checked={policyRequireForNonAdmin}
                      onCheckedChange={setPolicyRequireForNonAdmin}
                      disabled={policyLoading || policySaving || !policyEnabled}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleSaveApprovalPolicy}
                disabled={policyLoading || policySaving || !selectedPolicyVenueId}
              >
                {policyLoading ? "Loading..." : policySaving ? "Saving..." : "Save Approval Policy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.drafts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecipients}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setAppliedSearch(search);
                      setPage(1);
                    }
                  }}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setPage(1);
                  setStatusFilter(value);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  setPage(1);
                  setTypeFilter(value);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={folderFilter}
                onValueChange={(value) => {
                  setPage(1);
                  setFolderFilter(value);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Folders</SelectItem>
                  <SelectItem value="none">No Folder</SelectItem>
                  {folderOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setAppliedSearch(search);
                  setPage(1);
                }}
              >
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No campaigns found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first email campaign
              </p>
              <Link href="/emails/campaigns/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {campaign.subject}
                    </TableCell>
                    <TableCell>{getTypeBadge(campaign.emailType)}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>{getApprovalBadge(campaign.approvalStatus)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {campaign.recipientCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(campaign.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {actionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/emails/campaigns/${campaign.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {campaign.status === "DRAFT" && (
                            <>
                              <DropdownMenuItem asChild>
                                <Link href={`/emails/campaigns/${campaign.id}`}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {(campaign.approvalStatus === "NOT_REQUIRED" ||
                                campaign.approvalStatus === "APPROVED") && (
                                <DropdownMenuItem onClick={() => handleSendNow(campaign)}>
                                  <Send className="mr-2 h-4 w-4" />
                                  Send Now
                                </DropdownMenuItem>
                              )}
                              {campaign.approvalStatus === "REJECTED" && (
                                <DropdownMenuItem onClick={() => handleRequestApproval(campaign)}>
                                  <Clock className="mr-2 h-4 w-4" />
                                  Request Approval
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedCampaign(campaign);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {campaign.status === "SCHEDULED" && (
                            <>
                              <DropdownMenuItem onClick={() => handleSendNow(campaign)}>
                                <Send className="mr-2 h-4 w-4" />
                                Send Now
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCancel(campaign)}>
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                          {campaign.approvalStatus === "PENDING" && isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => handleReviewApproval(campaign, "APPROVE")}>
                                <Send className="mr-2 h-4 w-4" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReviewApproval(campaign, "REJECT")}>
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                          {campaign.status === "SENT" && (
                            <DropdownMenuItem asChild>
                              <Link href={`/emails/campaigns/${campaign.id}`}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                View Analytics
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} campaigns
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
              disabled={!pagination.hasMore || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedCampaign?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
