"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus, 
  Search, 
  MoreVertical, 
  FileText, 
  Layout, 
  Copy, 
  Trash2, 
  Star,
  Filter,
  Code,
  Eye,
  Edit,
  Wand2,
  Mail,
  Clock,
  Building
} from "lucide-react";
import { deleteEmail, duplicateEmail, saveEmailAsTemplate } from "@/lib/actions/emails";
import { listFolderTree, type EmailFolderNode } from "@/lib/actions/email-workspace/folders";
import { sanitizeEmailHtmlFragment } from "@/lib/services/email/sanitization";
import { toast } from "sonner";
import type { EmailWithRelations } from "@/types/email-campaign";

interface EmailBuilderClientProps {
  emails: EmailWithRelations[];
  venues: Array<{ id: string; name: string; code: string }>;
  isAdmin: boolean;
  userVenueId: string | null;
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

export function EmailBuilderClient({ 
  emails: initialEmails, 
  venues, 
  isAdmin, 
  userVenueId 
}: EmailBuilderClientProps) {
  const router = useRouter();
  const [emails, setEmails] = useState(initialEmails);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "templates" | "emails">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [venueFilter, setVenueFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; emailId: string | null }>({ 
    open: false, 
    emailId: null 
  });
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; email: EmailWithRelations | null }>({
    open: false,
    email: null,
  });

  useEffect(() => {
    let active = true;

    const loadFolders = async () => {
      try {
        const response = await listFolderTree({ module: "create" });
        if (!active || !response.success || !response.tree) {
          return;
        }

        setFolderOptions(flattenFolderOptions(response.tree));
      } catch (error) {
        console.error("Error loading email folders:", error);
      }
    };

    void loadFolders();

    return () => {
      active = false;
    };
  }, []);

  // Get unique categories from emails
  const categories = useMemo(() => {
    const cats = new Set<string>();
    emails.forEach(email => {
      if (email.category) cats.add(email.category);
    });
    return Array.from(cats).sort();
  }, [emails]);

  // Filter emails
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch = 
          email.name.toLowerCase().includes(searchLower) ||
          email.subject.toLowerCase().includes(searchLower) ||
          (email.description?.toLowerCase().includes(searchLower) ?? false);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (typeFilter === "templates" && !email.isTemplate) return false;
      if (typeFilter === "emails" && email.isTemplate) return false;

      // Category filter
      if (categoryFilter !== "all" && email.category !== categoryFilter) return false;

      // Venue filter (admin only)
      if (isAdmin && venueFilter !== "all") {
        if (venueFilter === "system" && email.venueId) return false;
        if (venueFilter !== "system" && email.venueId !== venueFilter) return false;
      }

      // Folder filter
      if (folderFilter !== "all") {
        if (folderFilter === "none" && email.folderId) return false;
        if (folderFilter !== "none" && email.folderId !== folderFilter) return false;
      }

      return true;
    });
  }, [emails, search, typeFilter, categoryFilter, venueFilter, folderFilter, isAdmin]);

  // Separate templates and emails for display
  const templates = filteredEmails.filter(e => e.isTemplate);
  const regularEmails = filteredEmails.filter(e => !e.isTemplate);

  const handleDelete = async () => {
    if (!deleteDialog.emailId) return;

    const result = await deleteEmail(deleteDialog.emailId);
    if (result.success) {
      setEmails(prev => prev.filter(e => e.id !== deleteDialog.emailId));
      toast.success("Email deleted successfully");
    } else {
      toast.error(result.error || "Failed to delete email");
    }
    setDeleteDialog({ open: false, emailId: null });
  };

  const handleDuplicate = async (emailId: string) => {
    const result = await duplicateEmail(emailId);
    if (result.success && result.email) {
      setEmails(prev => [result.email as EmailWithRelations, ...prev]);
      toast.success("Email duplicated successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to duplicate email");
    }
  };

  const handleSaveAsTemplate = async (emailId: string) => {
    const result = await saveEmailAsTemplate(emailId);
    if (result.success && result.email) {
      setEmails(prev => [result.email as EmailWithRelations, ...prev]);
      toast.success("Saved as template successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to save as template");
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const EmailCard = ({ email }: { email: EmailWithRelations }) => (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {email.isTemplate ? (
                <Star className="h-4 w-4 text-yellow-500" />
              ) : (
                <Mail className="h-4 w-4 text-blue-500" />
              )}
              <CardTitle className="text-base truncate">{email.name}</CardTitle>
            </div>
            <CardDescription className="line-clamp-1">
              {email.subject}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/system/emails/builder/${email.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPreviewDialog({ open: true, email })}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDuplicate(email.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              {!email.isTemplate && (
                <DropdownMenuItem onClick={() => handleSaveAsTemplate(email.id)}>
                  <Star className="h-4 w-4 mr-2" />
                  Save as Template
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setDeleteDialog({ open: true, emailId: email.id })}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {email.isTemplate && (
            <Badge variant="secondary" className="text-xs">
              Template
            </Badge>
          )}
          {email.category && (
            <Badge variant="outline" className="text-xs">
              {email.category}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {email.emailType}
          </Badge>
          {email.isSystem && (
            <Badge variant="outline" className="text-xs bg-blue-50">
              System
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {email.venue && (
            <div className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              <span>{email.venue.name}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(email.updatedAt)}</span>
          </div>
          {email.useCount > 0 && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>Used {email.useCount}x</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Email Builder Studio</h1>
          <p className="text-muted-foreground">
            Create and manage email templates with AI assistance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/system/emails/builder/ai-generate">
              <Wand2 className="h-4 w-4 mr-2" />
              AI Generate
            </Link>
          </Button>
          <Button asChild>
            <Link href="/system/emails/builder/new">
              <Plus className="h-4 w-4 mr-2" />
              New Email
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value: "all" | "templates" | "emails") => setTypeFilter(value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="templates">Templates</SelectItem>
                <SelectItem value="emails">Emails</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="w-[170px]">
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
            {isAdmin && (
              <Select value={venueFilter} onValueChange={setVenueFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  <SelectItem value="system">System Only</SelectItem>
                  {venues.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Templates Section */}
      {templates.length > 0 && (typeFilter === "all" || typeFilter === "templates") && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Templates ({templates.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(email => (
              <EmailCard key={email.id} email={email} />
            ))}
          </div>
        </div>
      )}

      {/* Emails Section */}
      {regularEmails.length > 0 && (typeFilter === "all" || typeFilter === "emails") && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-500" />
            Emails ({regularEmails.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularEmails.map(email => (
              <EmailCard key={email.id} email={email} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredEmails.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Layout className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No emails found</h3>
            <p className="text-muted-foreground mb-4">
              {search || typeFilter !== "all" || categoryFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating your first email or template"}
            </p>
            <Button asChild>
              <Link href="/system/emails/builder/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Email
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, emailId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, email: null })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewDialog.email?.name}</DialogTitle>
            <DialogDescription>
              Subject: {previewDialog.email?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-lg">
            {previewDialog.email && (
              <div 
                className="p-4"
                dangerouslySetInnerHTML={{ __html: sanitizeEmailHtmlFragment(previewDialog.email.htmlContent) }}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog({ open: false, email: null })}>
              Close
            </Button>
            <Button asChild>
              <Link href={`/system/emails/builder/${previewDialog.email?.id}`}>
                Edit Email
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
