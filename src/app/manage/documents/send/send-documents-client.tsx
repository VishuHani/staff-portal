"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  FileText,
  Users,
  Building2,
  Calendar,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileStack,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// Types
interface Venue {
  id: string;
  name: string;
  code: string;
}

interface Template {
  id: string;
  name: string;
  category: string | null;
  documentType: string;
  description: string | null;
}

interface Bundle {
  id: string;
  name: string;
  description: string | null;
  _count: {
    items: number;
  };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  venueId?: string;
  venueName?: string;
}

interface SendDocumentsClientProps {
  venues: Venue[];
  templates: Template[];
  bundles: Bundle[];
  isAdmin: boolean;
}

type AssignmentMode = "single" | "bulk";
type SelectionMode = "template" | "bundle";

export function SendDocumentsClient({
  venues,
  templates,
  bundles,
  isAdmin,
}: SendDocumentsClientProps) {
  const router = useRouter();

  // State
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("single");
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("template");
  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    venues[0]?.id || ""
  );
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Fetch users when venue changes
  const fetchUsers = useCallback(async (venueId: string) => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch(
        `/api/venues/${venueId}/users?includeInactive=false`
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Handle venue change
  const handleVenueChange = useCallback(
    (venueId: string) => {
      setSelectedVenueId(venueId);
      setSelectedUserIds([]);
      fetchUsers(venueId);
    },
    [fetchUsers]
  );

  // Load users on initial mount
  useEffect(() => {
    if (selectedVenueId) {
      fetchUsers(selectedVenueId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Filtered bundles
  const filteredBundles = useMemo(() => {
    if (!searchQuery) return bundles;
    const query = searchQuery.toLowerCase();
    return bundles.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query)
    );
  }, [bundles, searchQuery]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return users;
    const query = userSearchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }, [users, userSearchQuery]);

  // Toggle template selection
  const toggleTemplate = useCallback((templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  }, []);

  // Toggle bundle selection
  const toggleBundle = useCallback((bundleId: string) => {
    setSelectedBundleIds((prev) =>
      prev.includes(bundleId)
        ? prev.filter((id) => id !== bundleId)
        : [...prev, bundleId]
    );
  }, []);

  // Toggle user selection
  const toggleUser = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }, []);

  // Select all users
  const selectAllUsers = useCallback(() => {
    setSelectedUserIds(filteredUsers.map((u) => u.id));
  }, [filteredUsers]);

  // Clear user selection
  const clearUserSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  // Get selected items count
  const selectedItemsCount =
    selectionMode === "template"
      ? selectedTemplateIds.length
      : selectedBundleIds.length;

  // Validate form
  const isValid = useMemo(() => {
    return (
      selectedVenueId &&
      selectedItemsCount > 0 &&
      selectedUserIds.length > 0 &&
      (assignmentMode === "single" || selectedUserIds.length >= 2)
    );
  }, [selectedVenueId, selectedItemsCount, selectedUserIds, assignmentMode]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      toast.error("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        venueId: selectedVenueId,
        templateIds: selectionMode === "template" ? selectedTemplateIds : [],
        bundleIds: selectionMode === "bundle" ? selectedBundleIds : [],
        userIds: selectedUserIds,
        dueDate: dueDate || null,
        notes: notes || null,
      };

      const response = await fetch("/api/documents/assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          `Successfully sent ${data.assignments?.length || selectedUserIds.length * selectedItemsCount} document assignments`
        );
        router.push("/manage/documents");
      } else {
        toast.error(data.error || "Failed to send documents");
      }
    } catch (error) {
      console.error("Error sending documents:", error);
      toast.error("Failed to send documents");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid,
    selectedVenueId,
    selectionMode,
    selectedTemplateIds,
    selectedBundleIds,
    selectedUserIds,
    dueDate,
    notes,
    router,
    selectedItemsCount,
  ]);

  // Get selected templates/bundles for preview
  const selectedItems = useMemo(() => {
    if (selectionMode === "template") {
      return templates.filter((t) => selectedTemplateIds.includes(t.id));
    }
    return bundles.filter((b) => selectedBundleIds.includes(b.id));
  }, [selectionMode, templates, bundles, selectedTemplateIds, selectedBundleIds]);

  // Get selected users for preview
  const selectedUsers = useMemo(() => {
    return users.filter((u) => selectedUserIds.includes(u.id));
  }, [users, selectedUserIds]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Send Documents</h1>
          <p className="text-muted-foreground">
            Send documents to staff members for completion
          </p>
        </div>
        <Button
          onClick={() => setShowPreview(true)}
          disabled={!isValid}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          Review & Send
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Document Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assignment Mode */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment Mode</CardTitle>
              <CardDescription>
                Choose how you want to assign documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={assignmentMode}
                onValueChange={(v) => setAssignmentMode(v as AssignmentMode)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single" className="gap-2">
                    <Users className="h-4 w-4" />
                    Individual
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="gap-2">
                    <Users className="h-4 w-4" />
                    Bulk Assignment
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Select individual staff members to receive documents. Each
                    person will get their own copy.
                  </p>
                </TabsContent>
                <TabsContent value="bulk" className="mt-4">
                  <p className="text-sm text-muted-foreground">
                    Send documents to multiple staff members at once. Great for
                    team-wide document requirements.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Venue Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Select Venue
              </CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Select a venue to see its staff and documents"
                  : "Documents will be sent to staff at your venue"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {venues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No venues available
                </p>
              ) : venues.length === 1 ? (
                <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{venues[0].name}</span>
                  <Badge variant="outline" className="text-xs">
                    {venues[0].code}
                  </Badge>
                </div>
              ) : (
                <Select
                  value={selectedVenueId}
                  onValueChange={handleVenueChange}
                >
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
              )}
            </CardContent>
          </Card>

          {/* Document Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Select Documents
              </CardTitle>
              <CardDescription>
                Choose templates or bundles to send
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selection Mode Toggle */}
              <Tabs
                value={selectionMode}
                onValueChange={(v) => setSelectionMode(v as SelectionMode)}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="template" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Templates ({selectedTemplateIds.length})
                  </TabsTrigger>
                  <TabsTrigger value="bundle" className="gap-2">
                    <FileStack className="h-4 w-4" />
                    Bundles ({selectedBundleIds.length})
                  </TabsTrigger>
                </TabsList>

                {/* Search */}
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={
                      selectionMode === "template"
                        ? "Search templates..."
                        : "Search bundles..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Templates List */}
                <TabsContent value="template" className="mt-4">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No templates available</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {filteredTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedTemplateIds.includes(template.id)
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => toggleTemplate(template.id)}
                          >
                            <Checkbox
                              checked={selectedTemplateIds.includes(template.id)}
                              onCheckedChange={() => toggleTemplate(template.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {template.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {template.documentType}
                                </Badge>
                              </div>
                              {template.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {template.description}
                                </p>
                              )}
                              {template.category && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {template.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* Bundles List */}
                <TabsContent value="bundle" className="mt-4">
                  {filteredBundles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileStack className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No bundles available</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-2">
                        {filteredBundles.map((bundle) => (
                          <div
                            key={bundle.id}
                            className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedBundleIds.includes(bundle.id)
                                ? "border-primary bg-primary/5"
                                : "hover:border-primary/50"
                            }`}
                            onClick={() => toggleBundle(bundle.id)}
                          >
                            <Checkbox
                              checked={selectedBundleIds.includes(bundle.id)}
                              onCheckedChange={() => toggleBundle(bundle.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {bundle.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {bundle._count.items} documents
                                </Badge>
                              </div>
                              {bundle.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {bundle.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* User Selection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Select Recipients
                  </CardTitle>
                  <CardDescription>
                    {assignmentMode === "single"
                      ? "Select individual staff members"
                      : "Select multiple staff members for bulk assignment"}
                  </CardDescription>
                </div>
                {assignmentMode === "bulk" && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllUsers}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearUserSelection}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* User Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Selected Users Count */}
              {selectedUserIds.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">
                    {selectedUserIds.length} selected
                  </Badge>
                </div>
              )}

              {/* Users List */}
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>
                    {userSearchQuery
                      ? "No users match your search"
                      : "No users available at this venue"}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedUserIds.includes(user.id)
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => toggleUser(user.id)}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {user.firstName} {user.lastName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Options */}
        <div className="space-y-6">
          {/* Due Date & Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options</CardTitle>
              <CardDescription>Additional settings for this assignment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Due Date (Optional)
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any instructions or notes for recipients..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Documents:</span>
                <span className="font-medium">{selectedItemsCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recipients:</span>
                <span className="font-medium">{selectedUserIds.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Assignments:</span>
                <span className="font-bold text-lg">
                  {selectedItemsCount * selectedUserIds.length}
                </span>
              </div>

              <Button
                onClick={() => setShowPreview(true)}
                disabled={!isValid}
                className="w-full gap-2"
              >
                <Send className="h-4 w-4" />
                Review & Send
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Review Document Assignment</DialogTitle>
            <DialogDescription>
              Please review the details before sending
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Documents */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documents ({selectedItems.length})
                </h4>
                <div className="space-y-2">
                  {selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 border rounded-lg"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-medium">{item.name}</span>
                      {"_count" in item && (
                        <Badge variant="outline" className="text-xs">
                          {item._count.items} docs
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipients */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Recipients ({selectedUsers.length})
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 border rounded-lg"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({user.email})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div>
                <h4 className="font-medium mb-2">Options</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span className="font-medium">
                      {dueDate
                        ? format(new Date(dueDate), "PPP")
                        : "No due date"}
                    </span>
                  </div>
                  {notes && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notes:</span>
                      <span className="font-medium">{notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Assignments:</span>
                  <span className="text-2xl font-bold">
                    {selectedItemsCount * selectedUserIds.length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedItems.length} document(s) × {selectedUserIds.length}{" "}
                  recipient(s)
                </p>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSubmitting ? "Sending..." : "Send Documents"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}