"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { 
  FileText, 
  Users, 
  Mail, 
  Loader2, 
  Calendar,
  Building2,
  User,
  Send,
  AlertCircle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDocumentAssignment,
  createProspectiveUserAssignment,
} from "@/lib/actions/documents/assignments";
import { getUsersByVenue } from "@/lib/actions/users";

interface AssignDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  venues: Array<{
    id: string;
    name: string;
    code: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    documentType: string;
    category: string;
  }>;
  bundles: Array<{
    id: string;
    name: string;
    category: string;
  }>;
  users: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }>;
  onSuccess?: () => void;
}

type AssignmentMode = "existing" | "prospective";
type DocumentType = "template" | "bundle";

export function AssignDocumentDialog({
  open,
  onOpenChange,
  venueId,
  venues,
  templates,
  bundles,
  users: initialUsers,
  onSuccess,
}: AssignDocumentDialogProps) {
  const [activeTab, setActiveTab] = useState<AssignmentMode>("existing");
  const [documentType, setDocumentType] = useState<DocumentType>("template");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [selectedVenueId, setSelectedVenueId] = useState<string>(venueId);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [prospectiveEmail, setProspectiveEmail] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState<string>("");
  const [sendInvitation, setSendInvitation] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [userSearch, setUserSearch] = useState<string>("");
  const [users, setUsers] = useState(initialUsers);
  const [usersLoading, setUsersLoading] = useState(false);

  // Fetch users when venue changes
  const fetchUsersForVenue = useCallback(async (venueId: string) => {
    setUsersLoading(true);
    try {
      const result = await getUsersByVenue(venueId);
      if (result.success && result.users) {
        setUsers(result.users);
      } else {
        console.error("Failed to fetch users:", result.error);
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setActiveTab("existing");
      setDocumentType("template");
      setSelectedDocumentId("");
      setSelectedVenueId(venueId);
      setSelectedUserId("");
      setProspectiveEmail("");
      setDueDate(undefined);
      setNotes("");
      setSendInvitation(true);
      setUserSearch("");
      // Fetch users for the initial venue
      fetchUsersForVenue(venueId);
    }
  }, [open, venueId, fetchUsersForVenue]);

  // Fetch users when selected venue changes
  useEffect(() => {
    if (open && selectedVenueId) {
      fetchUsersForVenue(selectedVenueId);
      setSelectedUserId(""); // Reset selected user when venue changes
    }
  }, [selectedVenueId, open, fetchUsersForVenue]);

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    return (
      user.email.toLowerCase().includes(search) ||
      user.firstName?.toLowerCase().includes(search) ||
      user.lastName?.toLowerCase().includes(search) ||
      `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase().includes(search)
    );
  });

  // Get selected document info
  const selectedDocument = documentType === "template"
    ? templates.find((t) => t.id === selectedDocumentId)
    : bundles.find((b) => b.id === selectedDocumentId);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);
  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleSubmit = async () => {
    // Validation
    if (!selectedDocumentId) {
      toast.error("Please select a document to assign");
      return;
    }

    if (!selectedVenueId) {
      toast.error("Please select a venue");
      return;
    }

    if (activeTab === "existing" && !selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    if (activeTab === "prospective") {
      if (!prospectiveEmail) {
        toast.error("Please enter an email address");
        return;
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(prospectiveEmail)) {
        toast.error("Please enter a valid email address");
        return;
      }
    }

    setLoading(true);

    try {
      if (activeTab === "existing") {
        // Use existing user assignment flow
        const result = await createDocumentAssignment({
          templateId: documentType === "template" ? selectedDocumentId : undefined,
          bundleId: documentType === "bundle" ? selectedDocumentId : undefined,
          userId: selectedUserId!,
          venueId: selectedVenueId,
          dueDate,
          notes: notes || undefined,
        });

        if (result.success) {
          toast.success(`Document assigned to ${selectedUser?.email}`);
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to create assignment");
        }
      } else {
        // Use prospective user assignment flow
        const result = await createProspectiveUserAssignment({
          templateId: documentType === "template" ? selectedDocumentId : undefined,
          bundleId: documentType === "bundle" ? selectedDocumentId : undefined,
          email: prospectiveEmail.toLowerCase(),
          venueId: selectedVenueId,
          dueDate,
          notes: notes || undefined,
          sendInvitation,
        });

        if (result.success) {
          toast.success(
            `Document assigned to ${prospectiveEmail}${result.invitationCreated ? " (invitation sent)" : ""}`
          );
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to create assignment");
        }
      }
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error("Failed to create assignment");
    } finally {
      setLoading(false);
    }
  };

  const isValid = () => {
    if (!selectedDocumentId || !selectedVenueId) return false;
    if (activeTab === "existing" && !selectedUserId) return false;
    if (activeTab === "prospective" && !prospectiveEmail) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Assign Document
          </DialogTitle>
          <DialogDescription>
            Assign a document or bundle to a user or prospective user
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Document Selection */}
          <div className="space-y-3">
            <Label>Document Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={documentType === "template" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDocumentType("template");
                  setSelectedDocumentId("");
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Single Document
              </Button>
              <Button
                type="button"
                variant={documentType === "bundle" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDocumentType("bundle");
                  setSelectedDocumentId("");
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Bundle
              </Button>
            </div>

            <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
              <SelectTrigger>
                <SelectValue placeholder={`Select a ${documentType}`} />
              </SelectTrigger>
              <SelectContent>
                {(documentType === "template" ? templates : bundles).map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    <div className="flex items-center gap-2">
                      <span>{doc.name}</span>
                      {'category' in doc && (
                        <Badge variant="secondary" className="text-xs">
                          {doc.category}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Venue Selection */}
          <div className="space-y-3">
            <Label>Venue</Label>
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{venue.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {venue.code}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Assignment Tabs */}
          <div className="space-y-3">
            <Label>Assign To</Label>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssignmentMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Existing User
                </TabsTrigger>
                <TabsTrigger value="prospective" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Prospective User
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label>Search Users</Label>
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-48 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {usersLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Loading users...</span>
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="text-center text-muted-foreground py-4">
                        No users found
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={cn(
                            "w-full text-left p-2 rounded-lg hover:bg-muted transition-colors",
                            selectedUserId === user.id && "bg-primary/10 border border-primary"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">
                                {user.firstName && user.lastName
                                  ? `${user.firstName} ${user.lastName}`
                                  : user.email}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                            {selectedUserId === user.id && (
                              <Badge variant="default">Selected</Badge>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="prospective" className="space-y-3 mt-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    The document will be assigned to this email address. When the user signs up,
                    the assignment will be automatically linked to their account.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={prospectiveEmail}
                    onChange={(e) => setProspectiveEmail(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sendInvitation"
                    checked={sendInvitation}
                    onChange={(e) => setSendInvitation(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="sendInvitation" className="text-sm font-normal">
                    Send invitation email to this address
                  </Label>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Due Date */}
          <div className="space-y-3">
            <Label>Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select a due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes for the assignee..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Summary */}
          {isValid() && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="text-sm font-medium">Assignment Summary</div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Document:</span>
                  <span>{selectedDocument?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Venue:</span>
                  <span>{selectedVenue?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned to:</span>
                  <span>
                    {activeTab === "existing"
                      ? selectedUser?.email
                      : prospectiveEmail}
                  </span>
                </div>
                {dueDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due:</span>
                    <span>{format(dueDate, "PPP")}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid() || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {activeTab === "prospective" && sendInvitation ? (
              <>
                <Send className="mr-2 h-4 w-4" />
                Assign & Send Invitation
              </>
            ) : (
              "Assign Document"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
