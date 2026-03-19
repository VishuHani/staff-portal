"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getEmailCampaigns,
  deleteEmailCampaign,
  cancelEmailCampaign,
  requestCampaignApproval,
  sendEmailCampaign,
} from "@/lib/actions/email-campaigns";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import type {
  EmailCampaign,
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
  Mail,
  Users,
  FileText,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface ManagerEmailsClientProps {
  venues: Venue[];
  roles: Role[];
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

export function ManagerEmailsClient({ venues, roles }: ManagerEmailsClientProps) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [statusFilter, typeFilter, venueFilter, folderFilter]);

  useEffect(() => {
    void loadFolders();
  }, []);

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

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = {};
      if (statusFilter !== "all") {
        filters.status = statusFilter as CampaignStatus;
      }
      if (typeFilter !== "all") {
        filters.emailType = typeFilter as EmailType;
      }
      if (venueFilter !== "all") {
        filters.venueId = venueFilter;
      }
      if (folderFilter !== "all" && folderFilter !== "none") {
        filters.folderId = folderFilter;
      }
      if (search) {
        filters.search = search;
      }

      const result = await getEmailCampaigns(filters);
      if (result.success && result.campaigns) {
        const mappedCampaigns =
          folderFilter === "none"
            ? result.campaigns.filter((campaign) => !campaign.folderId)
            : result.campaigns;
        setCampaigns(mappedCampaigns);
      } else {
        toast.error(result.error || "Failed to load campaigns");
      }
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCampaign) return;
    
    setActionLoading(selectedCampaign.id);
    try {
      const result = await deleteEmailCampaign(selectedCampaign.id);
      if (result.success) {
        toast.success("Campaign deleted");
        setDeleteDialogOpen(false);
        loadCampaigns();
      } else {
        toast.error(result.error || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Failed to delete campaign");
    } finally {
      setActionLoading(null);
      setSelectedCampaign(null);
    }
  };

  const handleCancel = async (campaign: EmailCampaign) => {
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
      console.error("Error cancelling campaign:", error);
      toast.error("Failed to cancel campaign");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendNow = async (campaign: EmailCampaign) => {
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
      console.error("Error sending campaign:", error);
      toast.error("Failed to send campaign");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestApproval = async (campaign: EmailCampaign) => {
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
      console.error("Error requesting campaign approval:", error);
      toast.error("Failed to request approval");
    } finally {
      setActionLoading(null);
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

  const getStats = () => {
    const total = campaigns.length;
    const drafts = campaigns.filter(c => c.status === "DRAFT").length;
    const scheduled = campaigns.filter(c => c.status === "SCHEDULED").length;
    const sent = campaigns.filter(c => c.status === "SENT").length;
    const totalRecipients = campaigns.reduce((sum, c) => sum + c.recipientCount, 0);
    
    return { total, drafts, scheduled, sent, totalRecipients };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground">
            Create and send email campaigns to your venue staff
          </p>
        </div>
        <Link href="/emails/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

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
                  onKeyDown={(e) => e.key === "Enter" && loadCampaigns()}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
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
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={folderFilter} onValueChange={setFolderFilter}>
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
              <Button variant="outline" onClick={loadCampaigns}>
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
                            <DropdownMenuItem onClick={() => handleCancel(campaign)}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
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

      {/* Delete Dialog */}
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
