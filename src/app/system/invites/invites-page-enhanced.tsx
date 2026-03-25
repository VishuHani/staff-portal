"use client";

import { useState, useEffect } from "react";
import { format, isValid } from "date-fns";
import Link from "next/link";
import { 
  Plus, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Send, 
  MoreHorizontal, 
  RefreshCw, 
  Trash2, 
  Building, 
  Search,
  Filter,
  Calendar,
  User,
  Users,
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  createInvitation,
  cancelInvitation,
  resendInvitation,
  getInvitations,
  getInvitationStats,
  getInvitationAnalytics,
  getInviters
} from "@/lib/actions/invites";
import { listDocumentTemplates } from "@/lib/actions/documents/templates";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from "recharts";
import { cn } from "@/lib/utils";

type Invitation = {
  id: string;
  email: string;
  token: string;
  scope: string;
  venueId: string | null;
  venue: { id: string; name: string } | null;
  roleId: string;
  role: { id: string; name: string };
  documentIds: string[];
  status: string;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  inviter: { id: string; firstName: string | null; lastName: string | null; email: string };
};

type Venue = {
  id: string;
  name: string;
  code: string;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type Inviter = {
  id: string;
  name: string;
  email: string;
};

type AnalyticsData = {
  byMonth: Array<{ month: string; sent: number; accepted: number; expired: number; cancelled: number }>;
  byVenue: Array<{ venueId: string; venueName: string; count: number }>;
  byRole: Array<{ roleId: string; roleName: string; count: number }>;
  byInviter: Array<{ inviterId: string; inviterName: string; count: number }>;
  acceptanceRate: number;
  avgTimeToAccept: number | null;
};

interface EnhancedInvitesPageClientProps {
  invitations: Invitation[];
  stats: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    cancelled: number;
  };
  venues: Venue[];
  roles: Role[];
  isAdmin: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function EnhancedInvitesPageClient({
  invitations: initialInvitations,
  stats: initialStats,
  venues,
  roles,
  isAdmin,
}: EnhancedInvitesPageClientProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [stats, setStats] = useState(initialStats);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [inviters, setInviters] = useState<Inviter[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<"50" | "100" | "200">("50");
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [filters, setFilters] = useState<{
    status: "ALL" | "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
    venueId: string;
    scope: "ALL" | "VENUE" | "SYSTEM";
    search: string;
    inviterId: string;
    dateFrom: string;
    dateTo: string;
  }>({
    status: "ALL",
    venueId: "ALL",
    scope: "ALL",
    search: "",
    inviterId: "ALL",
    dateFrom: "",
    dateTo: "",
  });

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    scope: "VENUE",
    venueId: "",
    roleId: "",
    documentIds: [] as string[],
  });

  // Available documents for selection
  const [availableDocuments, setAvailableDocuments] = useState<Array<{ id: string; name: string; category: string }>>([]);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const [analyticsResult, invitersResult] = await Promise.all([
          getInvitationAnalytics(),
          getInviters()
        ]);
        
        if (analyticsResult.success && analyticsResult.analytics) {
          setAnalytics(analyticsResult.analytics);
        }
        
        if (invitersResult.success && invitersResult.inviters) {
          setInviters(invitersResult.inviters);
        }
      } catch (error) {
        console.error("Error loading analytics:", error);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    
    loadAnalytics();
  }, []);

  // Load invitations with filters and pagination
  useEffect(() => {
    const loadInvitations = async () => {
      try {
        const result = await getInvitations({
          status: filters.status === "ALL" ? undefined : filters.status,
          venueId: filters.venueId === "ALL" ? undefined : filters.venueId,
          scope: filters.scope === "ALL" ? undefined : filters.scope,
          search: filters.search || undefined,
          inviterId: filters.inviterId === "ALL" ? undefined : filters.inviterId,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          page: currentPage,
          pageSize: pageSize,
        });
        
        if (result.success && result.invitations) {
          setInvitations(result.invitations);
          setTotalRecords(result.total || 0);
          setTotalPages(result.totalPages || 1);
          
          // Update stats
          const newStats = await getInvitationStats();
          if (newStats.success && newStats.stats) {
            setStats(newStats.stats);
          }
        }
      } catch (error) {
        console.error("Error loading invitations:", error);
      }
    };
    
    loadInvitations();
  }, [filters, currentPage, pageSize]);

  // Load documents when venue changes in the create dialog
  useEffect(() => {
    const loadDocuments = async () => {
      if (formData.venueId) {
        try {
          const result = await listDocumentTemplates({ venueId: formData.venueId, isActive: true });
          if (result.success && result.data) {
            setAvailableDocuments(result.data.map((t: { id: string; name: string; category: string }) => ({
              id: t.id,
              name: t.name,
              category: t.category,
            })));
          }
        } catch (error) {
          console.error("Error loading documents:", error);
          setAvailableDocuments([]);
        }
      } else {
        setAvailableDocuments([]);
      }
    };
    
    loadDocuments();
  }, [formData.venueId]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleCreateInvitation = async () => {
    if (!formData.email || !formData.roleId) {
      toast.error("Validation Error", { description: "Please fill in all required fields" });
      return;
    }

    if (formData.scope === "VENUE" && !formData.venueId) {
      toast.error("Validation Error", { description: "Please select a venue for venue-scoped invitations" });
      return;
    }

    setLoading(true);
    try {
      const result = await createInvitation({
        email: formData.email,
        scope: formData.scope as "SYSTEM" | "VENUE",
        venueId: formData.scope === "VENUE" ? formData.venueId : undefined,
        roleId: formData.roleId,
        documentIds: formData.documentIds.length > 0 ? formData.documentIds : undefined,
      });

      if (result.success && result.invitation) {
        // Reload invitations to show the new one
        const reloadResult = await getInvitations({
          status: filters.status === "ALL" ? undefined : filters.status,
          venueId: filters.venueId === "ALL" ? undefined : filters.venueId,
          scope: filters.scope === "ALL" ? undefined : filters.scope,
          search: filters.search || undefined,
          inviterId: filters.inviterId === "ALL" ? undefined : filters.inviterId,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          page: currentPage,
          pageSize: pageSize,
        });
        
        if (reloadResult.success && reloadResult.invitations) {
          setInvitations(reloadResult.invitations);
          setTotalRecords(reloadResult.total || 0);
          setTotalPages(reloadResult.totalPages || 1);
          
          // Update stats
          const newStats = await getInvitationStats();
          if (newStats.success && newStats.stats) {
            setStats(newStats.stats);
          }
        }
        
        setCreateDialogOpen(false);
        setFormData({ email: "", scope: "VENUE", venueId: "", roleId: "", documentIds: [] });
        toast.success("Invitation Sent", { description: `Invitation sent to ${formData.email}` });
      } else {
        toast.error("Error", { description: result.error || "Failed to create invitation" });
      }
    } catch (error) {
      toast.error("Error", { description: "An unexpected error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const result = await cancelInvitation(invitationId);
      if (result.success) {
        // Reload invitations
        const reloadResult = await getInvitations({
          status: filters.status === "ALL" ? undefined : filters.status,
          venueId: filters.venueId === "ALL" ? undefined : filters.venueId,
          scope: filters.scope === "ALL" ? undefined : filters.scope,
          search: filters.search || undefined,
          inviterId: filters.inviterId === "ALL" ? undefined : filters.inviterId,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          page: currentPage,
          pageSize: pageSize,
        });
        
        if (reloadResult.success && reloadResult.invitations) {
          setInvitations(reloadResult.invitations);
          
          // Update stats
          const newStats = await getInvitationStats();
          if (newStats.success && newStats.stats) {
            setStats(newStats.stats);
          }
        }
        
        toast.success("Invitation Cancelled", { description: "The invitation has been cancelled" });
      } else {
        toast.error("Error", { description: result.error || "Failed to cancel invitation" });
      }
    } catch (error) {
      toast.error("Error", { description: "An unexpected error occurred" });
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const result = await resendInvitation(invitationId);
      if (result.success) {
        toast.success("Invitation Resent", { description: "A new invitation email has been sent" });
      } else {
        toast.error("Error", { description: result.error || "Failed to resend invitation" });
      }
    } catch (error) {
      toast.error("Error", { description: "An unexpected error occurred" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case "ACCEPTED":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="mr-1 h-3 w-3" /> Accepted</Badge>;
      case "EXPIRED":
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Expired</Badge>;
      case "CANCELLED":
        return <Badge variant="outline"><XCircle className="mr-1 h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getScopeBadge = (scope: string) => {
    return scope === "SYSTEM" 
      ? <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">System</Badge>
      : <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Venue</Badge>;
  };

  const formatDate = (value: Date | string | null | undefined) => {
    if (!value) {
      return "N/A";
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (!isValid(parsed)) {
      return "N/A";
    }

    return format(parsed, "MMM d, yyyy HH:mm");
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (size: string) => {
    setPageSize(size as "50" | "100" | "200");
    setCurrentPage(1);
  };

  const renderPagination = () => (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex items-center space-x-2">
        <p className="text-sm text-muted-foreground">
          Showing {Math.min((currentPage - 1) * parseInt(pageSize) + 1, totalRecords)} to {Math.min(currentPage * parseInt(pageSize), totalRecords)} of {totalRecords} results
        </p>
        <Select value={pageSize} onValueChange={handlePageSizeChange}>
          <SelectTrigger className="w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
            <SelectItem value="200">200</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {currentPage} of {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Invitations</h2>
          <p className="mt-2 text-muted-foreground">
            Manage and track user invitations with detailed analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/system/invites/settings">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          )}
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Invitation List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="ACCEPTED">Accepted</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="scope-filter">Scope</Label>
                  <Select value={filters.scope} onValueChange={(value) => handleFilterChange("scope", value)}>
                    <SelectTrigger id="scope-filter">
                      <SelectValue placeholder="All Scopes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Scopes</SelectItem>
                      <SelectItem value="VENUE">Venue</SelectItem>
                      <SelectItem value="SYSTEM">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="venue-filter">Venue</Label>
                  <Select value={filters.venueId} onValueChange={(value) => handleFilterChange("venueId", value)}>
                    <SelectTrigger id="venue-filter">
                      <SelectValue placeholder="All Venues" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Venues</SelectItem>
                      {venues.map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="inviter-filter">Inviter</Label>
                  <Select value={filters.inviterId} onValueChange={(value) => handleFilterChange("inviterId", value)}>
                    <SelectTrigger id="inviter-filter">
                      <SelectValue placeholder="All Inviters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Inviters</SelectItem>
                      {inviters.map((inviter) => (
                        <SelectItem key={inviter.id} value={inviter.id}>
                          {inviter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="search-filter">Search Email</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search-filter"
                      placeholder="Search by email..."
                      className="pl-8"
                      value={filters.search}
                      onChange={(e) => handleFilterChange("search", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="date-from">From Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="date-from"
                      type="date"
                      className="pl-8"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="date-to">To Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="date-to"
                      type="date"
                      className="pl-8"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setFilters({
                      status: "ALL",
                      venueId: "ALL",
                      scope: "ALL",
                      search: "",
                      inviterId: "ALL",
                      dateFrom: "",
                      dateTo: "",
                    })}
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invitations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invitation Records</CardTitle>
              <CardDescription>
                Detailed list of all user invitations with status tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Inviter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Accepted Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center">
                          No invitations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>{invitation.role.name}</TableCell>
                          <TableCell>
                            {invitation.venue ? (
                              <div className="flex items-center">
                                <Building className="mr-1 h-3 w-3" />
                                {invitation.venue.name}
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell>{getScopeBadge(invitation.scope)}</TableCell>
                          <TableCell>{invitation.inviter.firstName || invitation.inviter.email}</TableCell>
                          <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                          <TableCell>{formatDate(invitation.createdAt)}</TableCell>
                          <TableCell>
                            {invitation.acceptedAt ? formatDate(invitation.acceptedAt) : "N/A"}
                          </TableCell>
                          <TableCell>
                            {invitation.status === "PENDING" && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleResendInvitation(invitation.id)}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Resend
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleCancelInvitation(invitation.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Cancel
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && renderPagination()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-muted-foreground">Loading analytics...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analytics?.acceptanceRate || 0}%</div>
                    <p className="text-xs text-muted-foreground">Percentage of accepted invitations</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Time to Accept</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analytics?.avgTimeToAccept ? `${analytics.avgTimeToAccept} hrs` : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground">Average time to accept invitation</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Top Inviter</CardTitle>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold truncate">
                      {analytics?.byInviter[0]?.inviterName || "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {analytics?.byInviter[0]?.count || 0} invitations sent
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Invitations Over Time */}
                <Card className="col-span-1 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Invitations Over Time
                    </CardTitle>
                    <CardDescription>
                      Monthly trend of invitations sent, accepted, expired, and cancelled
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics?.byMonth || []}
                          margin={{ top: 20, right: 30, left: 20, bottom: 50 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" angle={-45} textAnchor="end" height={60} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="sent" name="Sent" fill="#3b82f6" />
                          <Bar dataKey="accepted" name="Accepted" fill="#10b981" />
                          <Bar dataKey="expired" name="Expired" fill="#f59e0b" />
                          <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Invitations by Venue */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building className="mr-2 h-4 w-4" />
                      Top Venues
                    </CardTitle>
                    <CardDescription>
                      Most active venues by invitation count
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={analytics?.byVenue || []}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            nameKey="venueName"
                            label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                          >
                            {analytics?.byVenue.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [value, "Invitations"]} />
                          <Legend />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Invitations by Role */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-4 w-4" />
                      Invitations by Role
                    </CardTitle>
                    <CardDescription>
                      Distribution of invitations by user role
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics?.byRole || []}
                          layout="vertical"
                          margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="roleName" type="category" width={90} />
                          <Tooltip />
                          <Bar dataKey="count" name="Invitations" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Invitation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send New Invitation</DialogTitle>
            <DialogDescription>
              Invite a new user to join the platform. They will receive an email with instructions to complete their registration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="scope">Invitation Scope *</Label>
                <Select
                  value={formData.scope}
                  onValueChange={(value) => setFormData({ ...formData, scope: value, venueId: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VENUE">Venue (Specific venue access)</SelectItem>
                    <SelectItem value="SYSTEM">System (Full platform access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.scope === "VENUE" && (
              <div className="space-y-2">
                <Label htmlFor="venue">Venue *</Label>
                <Select
                  value={formData.venueId}
                  onValueChange={(value) => setFormData({ ...formData, venueId: value })}
                >
                  <SelectTrigger>
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
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.roleId}
                onValueChange={(value) => setFormData({ ...formData, roleId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                      {role.description && ` - ${role.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.venueId && availableDocuments.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Documents (Optional)</Label>
                <p className="text-sm text-muted-foreground">
                  Select documents to assign to the new user upon registration.
                </p>
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-2">
                  {availableDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={formData.documentIds.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, documentIds: [...formData.documentIds, doc.id] });
                          } else {
                            setFormData({ ...formData, documentIds: formData.documentIds.filter(id => id !== doc.id) });
                          }
                        }}
                      />
                      <span className="text-sm">{doc.name}</span>
                      <span className="text-xs text-muted-foreground">({doc.category})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvitation} disabled={loading}>
              {loading ? (
                "Sending..."
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
