"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileStack, 
  FolderOpen, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Plus,
  Library,
  BarChart3,
  Mail,
  Send,
  UserPlus,
  Trash2,
  RefreshCw,
  Eye,
  Play,
  Edit,
  History
} from "lucide-react";
import Link from "next/link";
import { VenueSelector } from "@/components/documents/VenueSelector";
import { AssignDocumentDialog } from "@/components/documents/AssignDocumentDialog";
import { 
  listDocumentTemplates,
  deleteDocumentTemplate,
  type DocumentTemplateWithRelations 
} from "@/lib/actions/documents/templates";
import {
  listDocumentBundles,
  type DocumentBundleWithRelations 
} from "@/lib/actions/documents/bundles";
import {
  getProspectiveUsers,
  resendProspectiveUserInvitation,
  cancelProspectiveUserAssignment,
  type ProspectiveUser,
} from "@/lib/actions/documents/assignments";
import { getUsersByVenue } from "@/lib/actions/users";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

interface Venue {
  id: string;
  name: string;
}

interface DocumentsManageClientProps {
  venues: Venue[];
  initialVenueId: string | "all" | null;
  canAssignDocuments: boolean;
  isAdmin?: boolean;
}

export function DocumentsManageClient({ 
  venues, 
  initialVenueId,
  canAssignDocuments,
  isAdmin = false
}: DocumentsManageClientProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string | "all">(
    initialVenueId || "all"
  );
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalAssignments: 0,
    pendingAssignments: 0,
    completedAssignments: 0,
  });
  
  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  
  // Data for the dialog
  const [templates, setTemplates] = useState<DocumentTemplateWithRelations[]>([]);
  const [bundles, setBundles] = useState<DocumentBundleWithRelations[]>([]);
  const [users, setUsers] = useState<Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }>>([]);
  
  // Prospective users
  const [prospectiveUsers, setProspectiveUsers] = useState<ProspectiveUser[]>([]);
  const [prospectiveLoading, setProspectiveLoading] = useState(false);

  // Fetch stats based on selected venue
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch templates for the selected venue (or all venues)
      const templatesResult = await listDocumentTemplates({
        venueId: selectedVenueId === "all" ? undefined : selectedVenueId,
      });
      
      if (templatesResult.success && templatesResult.data) {
        const templateList = templatesResult.data;
        setTemplates(templateList);
        
        // Calculate stats from templates
        const totalAssignments = templateList.reduce((sum, t) => sum + (t._count?.assignments || 0), 0);
        
        setStats({
          totalTemplates: templateList.length,
          totalAssignments: totalAssignments,
          pendingAssignments: 0, // Would need to fetch assignments to calculate
          completedAssignments: 0, // Would need to fetch assignments to calculate
        });
      } else {
        // No templates or error
        setTemplates([]);
        setStats({
          totalTemplates: 0,
          totalAssignments: 0,
          pendingAssignments: 0,
          completedAssignments: 0,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedVenueId]);

  // Fetch data for the assign dialog
  const fetchDialogData = useCallback(async () => {
    if (selectedVenueId === "all") return;
    
    try {
      // Fetch templates
      const templatesResult = await listDocumentTemplates({
        venueId: selectedVenueId,
        isActive: true,
      });
      if (templatesResult.success && templatesResult.data) {
        setTemplates(templatesResult.data);
      }
      
      // Fetch bundles
      const bundlesResult = await listDocumentBundles(selectedVenueId, { isActive: true });
      if (bundlesResult.success && bundlesResult.data) {
        setBundles(bundlesResult.data);
      }
      
      // Fetch users for this venue
      const usersResult = await getUsersByVenue(selectedVenueId);
      if (usersResult.success && usersResult.users) {
        setUsers(usersResult.users);
      } else {
        console.error("Failed to fetch users:", usersResult.error);
        setUsers([]);
      }
    } catch (error) {
      console.error("Failed to fetch dialog data:", error);
    }
  }, [selectedVenueId]);

  // Fetch prospective users
  const fetchProspectiveUsers = useCallback(async () => {
    setProspectiveLoading(true);
    try {
      const venueId = selectedVenueId === "all" ? undefined : selectedVenueId;
      const result = await getProspectiveUsers(venueId);
      if (result.success && result.data) {
        setProspectiveUsers(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch prospective users:", error);
    } finally {
      setProspectiveLoading(false);
    }
  }, [selectedVenueId]);

  useEffect(() => {
    fetchStats();
    fetchProspectiveUsers();
  }, [fetchStats, fetchProspectiveUsers]);

  useEffect(() => {
    if (assignDialogOpen) {
      fetchDialogData();
    }
  }, [assignDialogOpen, fetchDialogData]);

  // Handle venue change
  const handleVenueChange = (venueId: string | "all") => {
    setSelectedVenueId(venueId);
  };

  // Get the selected venue name for display
  const getSelectedVenueName = () => {
    if (selectedVenueId === "all") {
      return "All My Venues";
    }
    const venue = venues.find(v => v.id === selectedVenueId);
    return venue?.name || "Unknown Venue";
  };

  // Handle successful assignment
  const handleAssignmentSuccess = () => {
    setAssignDialogOpen(false);
    fetchStats();
    fetchProspectiveUsers();
    toast.success("Document assigned successfully");
  };

  // Handle resend invitation
  const handleResendInvitation = async (email: string, venueId: string) => {
    const result = await resendProspectiveUserInvitation(email, venueId);
    if (result.success) {
      toast.success("Invitation resent successfully");
      fetchProspectiveUsers();
    } else {
      toast.error(result.error || "Failed to resend invitation");
    }
  };

  // Handle cancel assignment
  const handleCancelAssignment = async () => {
    if (!selectedAssignmentId) return;
    
    const result = await cancelProspectiveUserAssignment(selectedAssignmentId);
    if (result.success) {
      toast.success("Assignment cancelled");
      setCancelDialogOpen(false);
      setSelectedAssignmentId(null);
      fetchProspectiveUsers();
    } else {
      toast.error(result.error || "Failed to cancel assignment");
    }
  };

  // Handle delete template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    
    setDeleting(true);
    const result = await deleteDocumentTemplate(selectedTemplateId);
    if (result.success) {
      toast.success("Template archived successfully");
      setDeleteDialogOpen(false);
      setSelectedTemplateId(null);
      setSelectedTemplateName("");
      fetchStats();
    } else {
      toast.error(result.error || "Failed to archive template");
    }
    setDeleting(false);
  };

  // Get invitation status badge
  const getInvitationStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-blue-500">Sent</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "expired":
        return <Badge variant="destructive">Expired</Badge>;
      case "accepted":
        return <Badge variant="default" className="bg-green-500">Accepted</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage document templates and assignments for {getSelectedVenueName()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Venue Selector - only show if user has multiple venues */}
          {venues.length > 1 && (
            <VenueSelector
              venues={venues}
              selectedVenueId={selectedVenueId}
              onVenueChange={handleVenueChange}
              showAllOption={true}
            />
          )}
          <div className="flex gap-2">
            <Link href="/manage/documents/library">
              <Button variant="outline">
                <Library className="h-4 w-4 mr-2" />
                Template Library
              </Button>
            </Link>
            {canAssignDocuments && selectedVenueId !== "all" && (
              <Button onClick={() => setAssignDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Document
              </Button>
            )}
            {canAssignDocuments && selectedVenueId === "all" && (
              <Link href="/manage/documents/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Document
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Show single venue selector if only one venue */}
      {venues.length === 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileStack className="h-4 w-4" />
          <span>Managing documents for: <strong>{venues[0].name}</strong></span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTemplates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingAssignments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedAssignments}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
           <TabsTrigger value="templates">Templates</TabsTrigger>
           <TabsTrigger value="assignments">Assignments</TabsTrigger>
           <TabsTrigger value="prospective">Prospective Users</TabsTrigger>
           <TabsTrigger value="analytics">Analytics</TabsTrigger>
           <TabsTrigger value="history" className="flex items-center gap-2">
             <History className="h-4 w-4" />
             History
           </TabsTrigger>
         </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Document Templates</CardTitle>
                <CardDescription>
                  Create and manage document templates for {getSelectedVenueName()}
                </CardDescription>
              </div>
              {canAssignDocuments && (
                <Link href="/manage/documents/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    No document templates yet. Create your first template or import from the library.
                  </p>
                  <div className="flex justify-center gap-2">
                    {canAssignDocuments && (
                      <Link href="/manage/documents/new">
                        <Button>Create Template</Button>
                      </Link>
                    )}
                    <Link href="/manage/documents/library">
                      <Button variant="outline">Browse Library</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Assignments</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileStack className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{template.name}</p>
                              {template.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {template.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.documentType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {template.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {template._count?.assignments || 0}
                        </TableCell>
                        <TableCell>
                          {template.isActive ? (
                            <Badge variant="default" className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Archived</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(template.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                               <DropdownMenuItem asChild>
                                 <Link href={`/manage/documents/${template.id}/preview`}>
                                   <Eye className="h-4 w-4 mr-2" />
                                   Preview
                                 </Link>
                               </DropdownMenuItem>
                               <DropdownMenuItem asChild>
                                 <Link href={`/manage/documents/${template.id}/preview?mode=test`}>
                                   <Play className="h-4 w-4 mr-2" />
                                   Preview with Test
                                 </Link>
                               </DropdownMenuItem>
                               <DropdownMenuItem asChild>
                                 <Link href={`/manage/documents/${template.id}`}>
                                   <Edit className="h-4 w-4 mr-2" />
                                   Edit
                                 </Link>
                               </DropdownMenuItem>
                               <DropdownMenuItem
                                 className="text-destructive"
                                 onClick={() => {
                                   setSelectedTemplateId(template.id);
                                   setSelectedTemplateName(template.name);
                                   setDeleteDialogOpen(true);
                                 }}
                               >
                                 <Trash2 className="h-4 w-4 mr-2" />
                                 Archive
                               </DropdownMenuItem>
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
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Assignments</CardTitle>
              <CardDescription>
                View and manage document assignments for your team
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                No document assignments yet. Create templates first, then assign them to team members.
              </p>
              <Link href="/manage/documents/templates">
                <Button>View Templates</Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prospective" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Prospective Users
                </CardTitle>
                <CardDescription>
                  Users who have been assigned documents but haven't signed up yet
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchProspectiveUsers()}
                disabled={prospectiveLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${prospectiveLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {prospectiveLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : prospectiveUsers.length === 0 ? (
                <div className="text-center py-12">
                  <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    No prospective users at the moment.
                  </p>
                  {canAssignDocuments && selectedVenueId !== "all" && (
                    <Button onClick={() => setAssignDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Assign to New User
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {prospectiveUsers.map((prospectiveUser) => (
                    <Card key={prospectiveUser.email}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{prospectiveUser.email}</span>
                            <Badge variant="secondary">
                              {prospectiveUser.totalAssignments} assignment{prospectiveUser.totalAssignments !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              Since {format(new Date(prospectiveUser.oldestAssignment), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Document</TableHead>
                              <TableHead>Venue</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Invitation</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {prospectiveUser.assignments.map((assignment) => (
                              <TableRow key={assignment.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {assignment.templateName && (
                                      <>
                                        <FileStack className="h-4 w-4 text-muted-foreground" />
                                        <span>{assignment.templateName}</span>
                                      </>
                                    )}
                                    {assignment.bundleName && (
                                      <>
                                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                        <span>{assignment.bundleName}</span>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{assignment.venueName}</TableCell>
                                <TableCell>
                                  {assignment.dueDate
                                    ? format(new Date(assignment.dueDate), "MMM d, yyyy")
                                    : <span className="text-muted-foreground">No due date</span>
                                  }
                                </TableCell>
                                <TableCell>
                                  {getInvitationStatusBadge(assignment.invitationStatus)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {(assignment.invitationStatus === "expired" || assignment.invitationStatus === "none") && (
                                        <DropdownMenuItem
                                          onClick={() => handleResendInvitation(prospectiveUser.email, assignment.venueId)}
                                        >
                                          <Send className="h-4 w-4 mr-2" />
                                          Resend Invitation
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                          setSelectedAssignmentId(assignment.id);
                                          setCancelDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Cancel Assignment
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Document Analytics</CardTitle>
               <CardDescription>
                 Track completion rates and compliance metrics for {getSelectedVenueName()}
               </CardDescription>
             </CardHeader>
             <CardContent className="text-center py-12">
               <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
               <p className="text-muted-foreground mb-4">
                 Analytics will be available once you have document assignments.
               </p>
               <Link href="/system/documents">
                 <Button variant="outline">View Full Analytics</Button>
               </Link>
             </CardContent>
           </Card>
         </TabsContent>

         <TabsContent value="history" className="space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
               <div>
                 <CardTitle className="flex items-center gap-2">
                   <History className="h-5 w-5" />
                   Document History
                 </CardTitle>
                 <CardDescription>
                   View all document-related activities and changes for {getSelectedVenueName()}
                 </CardDescription>
               </div>
               <Link href="/system/documents">
                 <Button variant="outline" size="sm">
                   View Full Audit Logs
                 </Button>
               </Link>
             </CardHeader>
             <CardContent className="text-center py-12">
               <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
               <p className="text-muted-foreground mb-4">
                 Document history and audit logs are available in the System Documents section.
               </p>
               <Link href="/system/documents">
                 <Button>
                   <History className="h-4 w-4 mr-2" />
                   View Document Audit Logs
                 </Button>
               </Link>
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>

      {/* Assign Document Dialog */}
      {selectedVenueId !== "all" && (
        <AssignDocumentDialog
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          venueId={selectedVenueId}
          venues={venues.map(v => ({ ...v, code: v.name.substring(0, 3).toUpperCase() }))}
          templates={templates.map(t => ({
            id: t.id,
            name: t.name,
            documentType: t.documentType,
            category: t.category,
          }))}
          bundles={bundles.map(b => ({
            id: b.id,
            name: b.name,
            category: b.category,
          }))}
          users={users}
          onSuccess={handleAssignmentSuccess}
        />
      )}

      {/* Cancel Assignment Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this assignment? This action cannot be undone.
              The prospective user will no longer receive this document assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedAssignmentId(null)}>
              Keep Assignment
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelAssignment} className="bg-destructive text-destructive-foreground">
              Cancel Assignment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{selectedTemplateName}"? 
              The template will be marked as inactive and won't appear in active templates list.
              Any existing assignments will still be accessible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSelectedTemplateId(null);
              setSelectedTemplateName("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTemplate} 
              className="bg-destructive text-destructive-foreground"
              disabled={deleting}
            >
              {deleting ? "Archiving..." : "Archive Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
