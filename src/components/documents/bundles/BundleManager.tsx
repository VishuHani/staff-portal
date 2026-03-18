"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Users,
  FileText,
  Clock,
  Bell,
  Filter,
  Loader2,
  Archive,
  RotateCcw,
  GripVertical,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface BundleItem {
  id: string;
  templateId: string;
  template?: {
    id: string;
    name: string;
    documentType: string;
    category: string;
  };
  order: number;
  isRequired: boolean;
}

export interface DocumentBundle {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  allowPartialComplete: boolean;
  dueWithinDays: number | null;
  reminderDays: number[];
  currentVersion: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  items: BundleItem[];
  _count?: {
    assignments: number;
    documentAssignments: number;
  };
}

export interface BundleAssignment {
  id: string;
  bundleId: string;
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  assignment: {
    id: string;
    status: string;
    dueDate: Date | null;
    completedAt: Date | null;
  };
  createdAt: Date;
}

interface BundleManagerProps {
  venueId: string;
  bundles: DocumentBundle[];
  templates: { id: string; name: string; documentType: string; category: string }[];
  onCreateBundle: (data: BundleFormData) => Promise<{ success: boolean; error?: string }>;
  onUpdateBundle: (id: string, data: Partial<BundleFormData>) => Promise<{ success: boolean; error?: string }>;
  onDuplicateBundle: (id: string) => Promise<{ success: boolean; error?: string }>;
  onArchiveBundle: (id: string) => Promise<{ success: boolean; error?: string }>;
  onRestoreBundle: (id: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteBundle: (id: string) => Promise<{ success: boolean; error?: string }>;
  onGetBundleAssignments: (bundleId: string) => Promise<BundleAssignment[]>;
}

export interface BundleFormData {
  name: string;
  description: string;
  category: string;
  isRequired: boolean;
  allowPartialComplete: boolean;
  dueWithinDays: number | null;
  reminderDays: number[];
  items: { templateId: string; order: number; isRequired: boolean }[];
}

const CATEGORIES = [
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "CERTIFICATION", label: "Certification" },
  { value: "HR", label: "HR Documents" },
  { value: "POLICY", label: "Policy" },
  { value: "GENERAL", label: "General" },
];

const REMINDER_OPTIONS = [
  { value: 7, label: "1 week before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
  { value: 0, label: "On due date" },
];

// ============================================================================
// Component
// ============================================================================

export function BundleManager({
  venueId,
  bundles: initialBundles,
  templates,
  onCreateBundle,
  onUpdateBundle,
  onDuplicateBundle,
  onArchiveBundle,
  onRestoreBundle,
  onDeleteBundle,
  onGetBundleAssignments,
}: BundleManagerProps) {
  const [bundles, setBundles] = useState<DocumentBundle[]>(initialBundles);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBundle, setSelectedBundle] = useState<DocumentBundle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [assignments, setAssignments] = useState<BundleAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignmentsDialog, setShowAssignmentsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<DocumentBundle | null>(null);

  // Edit form state
  const [editFormData, setEditFormData] = useState<BundleFormData>({
    name: "",
    description: "",
    category: "GENERAL",
    isRequired: true,
    allowPartialComplete: false,
    dueWithinDays: 14,
    reminderDays: [3, 1],
    items: [],
  });

  // Filter bundles
  const filteredBundles = bundles.filter((bundle) => {
    const matchesSearch =
      bundle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bundle.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === "all" || bundle.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && bundle.isActive) ||
      (statusFilter === "archived" && !bundle.isActive);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Update bundles when props change
  useEffect(() => {
    setBundles(initialBundles);
  }, [initialBundles]);

  const handleEditBundle = useCallback((bundle: DocumentBundle) => {
    setSelectedBundle(bundle);
    setEditFormData({
      name: bundle.name,
      description: bundle.description || "",
      category: bundle.category,
      isRequired: bundle.isRequired,
      allowPartialComplete: bundle.allowPartialComplete,
      dueWithinDays: bundle.dueWithinDays,
      reminderDays: bundle.reminderDays,
      items: bundle.items.map((item) => ({
        templateId: item.templateId,
        order: item.order,
        isRequired: item.isRequired,
      })),
    });
    setShowEditDialog(true);
  }, []);

  const handleViewAssignments = useCallback(async (bundle: DocumentBundle) => {
    setSelectedBundle(bundle);
    setShowAssignmentsDialog(true);
    setAssignmentsLoading(true);
    try {
      const result = await onGetBundleAssignments(bundle.id);
      setAssignments(result);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [onGetBundleAssignments]);

  const handleDuplicate = useCallback(async (bundle: DocumentBundle) => {
    setIsLoading(true);
    try {
      const result = await onDuplicateBundle(bundle.id);
      if (result.success) {
        // Refresh would happen via parent component
      }
    } catch (error) {
      console.error("Error duplicating bundle:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onDuplicateBundle]);

  const handleArchive = useCallback(async (bundle: DocumentBundle) => {
    setIsLoading(true);
    try {
      const result = await onArchiveBundle(bundle.id);
      if (result.success) {
        setBundles((prev) =>
          prev.map((b) => (b.id === bundle.id ? { ...b, isActive: false } : b))
        );
      }
    } catch (error) {
      console.error("Error archiving bundle:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onArchiveBundle]);

  const handleRestore = useCallback(async (bundle: DocumentBundle) => {
    setIsLoading(true);
    try {
      const result = await onRestoreBundle(bundle.id);
      if (result.success) {
        setBundles((prev) =>
          prev.map((b) => (b.id === bundle.id ? { ...b, isActive: true } : b))
        );
      }
    } catch (error) {
      console.error("Error restoring bundle:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onRestoreBundle]);

  const handleDelete = useCallback(async () => {
    if (!bundleToDelete) return;
    setIsLoading(true);
    try {
      const result = await onDeleteBundle(bundleToDelete.id);
      if (result.success) {
        setBundles((prev) => prev.filter((b) => b.id !== bundleToDelete.id));
        setShowDeleteDialog(false);
        setBundleToDelete(null);
      }
    } catch (error) {
      console.error("Error deleting bundle:", error);
    } finally {
      setIsLoading(false);
    }
  }, [bundleToDelete, onDeleteBundle]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedBundle) return;
    setIsLoading(true);
    try {
      const result = await onUpdateBundle(selectedBundle.id, editFormData);
      if (result.success) {
        // Parent component will handle the refresh
        setShowEditDialog(false);
        setSelectedBundle(null);
      }
    } catch (error) {
      console.error("Error updating bundle:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBundle, editFormData, onUpdateBundle]);

  const toggleReminder = useCallback((days: number) => {
    setEditFormData((prev) => {
      const hasReminder = prev.reminderDays.includes(days);
      const newReminders = hasReminder
        ? prev.reminderDays.filter((d) => d !== days)
        : [...prev.reminderDays, days].sort((a, b) => b - a);
      return { ...prev, reminderDays: newReminders };
    });
  }, []);

  const toggleTemplateInEdit = useCallback((templateId: string) => {
    setEditFormData((prev) => {
      const existingIndex = prev.items.findIndex((item) => item.templateId === templateId);
      
      if (existingIndex >= 0) {
        // Remove template
        const newItems = prev.items
          .filter((item) => item.templateId !== templateId)
          .map((item, index) => ({ ...item, order: index }));
        return { ...prev, items: newItems };
      } else {
        // Add template
        const newItem = {
          templateId,
          order: prev.items.length,
          isRequired: true,
        };
        return { ...prev, items: [...prev.items, newItem] };
      }
    });
  }, []);

  const toggleItemRequired = useCallback((templateId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.templateId === templateId ? { ...item, isRequired: !item.isRequired } : item
      ),
    }));
  }, []);

  const removeItem = useCallback((templateId: string) => {
    setEditFormData((prev) => ({
      ...prev,
      items: prev.items
        .filter((item) => item.templateId !== templateId)
        .map((item, index) => ({ ...item, order: index })),
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Bundles</h2>
          <p className="text-muted-foreground">
            Manage document bundles for assignments
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search bundles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bundles Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBundles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8 opacity-50" />
                      <p>No bundles found</p>
                      {(searchQuery || categoryFilter !== "all" || statusFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSearchQuery("");
                            setCategoryFilter("all");
                            setStatusFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBundles.map((bundle) => (
                  <TableRow key={bundle.id} className={!bundle.isActive ? "opacity-60" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{bundle.name}</p>
                        {bundle.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {bundle.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CATEGORIES.find((c) => c.value === bundle.category)?.label || bundle.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {bundle.items.length}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {bundle._count?.assignments || 0}
                      </div>
                    </TableCell>
                    <TableCell>
                      {bundle.dueWithinDays ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {bundle.dueWithinDays} days
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No due date</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {bundle.isActive ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Archived</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditBundle(bundle)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewAssignments(bundle)}>
                            <Users className="h-4 w-4 mr-2" />
                            View Assignments
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDuplicate(bundle)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {bundle.isActive ? (
                            <DropdownMenuItem onClick={() => handleArchive(bundle)}>
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleRestore(bundle)}>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setBundleToDelete(bundle);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Bundle</DialogTitle>
            <DialogDescription>
              Update bundle configuration
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="timing">Timing</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[400px] mt-4 pr-4">
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editFormData.description}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={editFormData.category}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-required"
                      checked={editFormData.isRequired}
                      onCheckedChange={(checked) =>
                        setEditFormData((prev) => ({ ...prev, isRequired: checked as boolean }))
                      }
                    />
                    <Label htmlFor="edit-required" className="font-normal">
                      Required bundle
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-partial"
                      checked={editFormData.allowPartialComplete}
                      onCheckedChange={(checked) =>
                        setEditFormData((prev) => ({
                          ...prev,
                          allowPartialComplete: checked as boolean,
                        }))
                      }
                    />
                    <Label htmlFor="edit-partial" className="font-normal">
                      Allow partial completion
                    </Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Selected Documents ({editFormData.items.length})</Label>
                  <div className="space-y-2">
                    {editFormData.items.map((item, index) => {
                      const template = templates.find((t) => t.id === item.templateId);
                      return (
                        <div
                          key={item.templateId}
                          className="flex items-center gap-3 p-3 rounded-lg border"
                        >
                          <GripVertical className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {template?.name || "Unknown"}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={item.isRequired}
                              onCheckedChange={() => toggleItemRequired(item.templateId)}
                            />
                            <Label className="text-sm font-normal">Required</Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.templateId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Add Documents</Label>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {templates
                        .filter((t) => !editFormData.items.some((i) => i.templateId === t.id))
                        .map((template) => (
                          <div
                            key={template.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleTemplateInEdit(template.id)}
                          >
                            <Plus className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="truncate">{template.name}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                        ))}
                      {templates.filter((t) => !editFormData.items.some((i) => i.templateId === t.id))
                        .length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          All templates selected
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="timing" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <Label className="text-base font-semibold">Due Date</Label>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="edit-hasDueDate"
                        checked={editFormData.dueWithinDays !== null}
                        onCheckedChange={(checked) =>
                          setEditFormData((prev) => ({
                            ...prev,
                            dueWithinDays: checked ? 14 : null,
                          }))
                        }
                      />
                      <Label htmlFor="edit-hasDueDate" className="font-normal">
                        Set due date
                      </Label>
                    </div>

                    {editFormData.dueWithinDays !== null && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={editFormData.dueWithinDays}
                          onChange={(e) =>
                            setEditFormData((prev) => ({
                              ...prev,
                              dueWithinDays: parseInt(e.target.value) || null,
                            }))
                          }
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">days after assignment</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <Label className="text-base font-semibold">Reminders</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {REMINDER_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={cn(
                          "flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-colors",
                          editFormData.reminderDays.includes(option.value)
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => toggleReminder(option.value)}
                      >
                        <Checkbox checked={editFormData.reminderDays.includes(option.value)} />
                        <Label className="font-normal cursor-pointer">{option.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignments Dialog */}
      <Dialog open={showAssignmentsDialog} onOpenChange={setShowAssignmentsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Bundle Assignments</DialogTitle>
            <DialogDescription>
              {selectedBundle?.name} - Users assigned to this bundle
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px]">
            {assignmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No assignments yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Assigned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {assignment.user.firstName} {assignment.user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {assignment.user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            assignment.assignment.status === "COMPLETED"
                              ? "default"
                              : assignment.assignment.status === "IN_PROGRESS"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {assignment.assignment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignment.assignment.dueDate
                          ? new Date(assignment.assignment.dueDate).toLocaleDateString()
                          : "No due date"}
                      </TableCell>
                      <TableCell>
                        {new Date(assignment.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignmentsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{bundleToDelete?.name}"? This action cannot be undone.
              {bundleToDelete?._count?.assignments ? (
                <span className="block mt-2 text-destructive font-medium">
                  Warning: This bundle has {bundleToDelete._count.assignments} active assignment(s).
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default BundleManager;