"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  History,
  FileText,
  User,
  Calendar,
  ExternalLink,
  Loader2,
  AlertCircle,
  Check,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getImportHistory,
  type ImportHistoryItem,
} from "@/lib/actions/documents/library";

// ============================================================================
// Types
// ============================================================================

interface ImportHistoryProps {
  venueId: string;
  onTemplateClick?: (templateId: string) => void;
}

// ============================================================================
// Component
// ============================================================================

export function ImportHistory({ venueId, onTemplateClick }: ImportHistoryProps) {
  // State
  const [imports, setImports] = useState<ImportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Selected import for details
  const [selectedImport, setSelectedImport] = useState<ImportHistoryItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  // Fetch import history
  const fetchImports = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getImportHistory(venueId, {
        limit: pageSize,
        offset: page * pageSize,
      });

      if (result.success && result.data) {
        setImports(result.data);
        setTotal(result.total || 0);
      } else {
        setError(result.error || "Failed to load import history");
      }
    } catch (err) {
      console.error("Error fetching import history:", err);
      setError("Failed to load import history");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, page]);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  // Handlers
  const handleViewDetails = useCallback((importItem: ImportHistoryItem) => {
    setSelectedImport(importItem);
    setShowDetailsDialog(true);
  }, []);

  const handleViewTemplate = useCallback((templateId: string) => {
    if (onTemplateClick) {
      onTemplateClick(templateId);
    } else {
      // Navigate to template page
      window.open(`/system/documents/${templateId}`, "_blank");
    }
  }, [onTemplateClick]);

  const totalPages = Math.ceil(total / pageSize);

  // Stats
  const stats = {
    total: total,
    customized: imports.filter((i) => i.customized).length,
    thisMonth: imports.filter((i) => {
      const importDate = new Date(i.importedAt);
      const now = new Date();
      return (
        importDate.getMonth() === now.getMonth() &&
        importDate.getFullYear() === now.getFullYear()
      );
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Imports</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <History className="h-4 w-4 mr-1" />
              All time
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Customized</CardDescription>
            <CardTitle className="text-3xl">{stats.customized}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Edit className="h-4 w-4 mr-1" />
              Modified after import
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This Month</CardDescription>
            <CardTitle className="text-3xl">{stats.thisMonth}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              Recent imports
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Import History
          </CardTitle>
          <CardDescription>
            Templates you've imported from the library
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={fetchImports} className="mt-4">
                Retry
              </Button>
            </div>
          ) : imports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No imports yet</p>
              <p className="text-sm">Templates you import will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Imported By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.map((importItem) => (
                  <TableRow key={importItem.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{importItem.libraryItemName}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {importItem.templateId.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {importItem.importedByName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(importItem.importedAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {importItem.customized ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Edit className="h-3 w-3" />
                          Customized
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Check className="h-3 w-3" />
                          Original
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(importItem)}
                        >
                          Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTemplate(importItem.templateId)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
            <DialogDescription>
              Information about this imported template
            </DialogDescription>
          </DialogHeader>

          {selectedImport && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Template Name</p>
                <p className="font-medium">{selectedImport.libraryItemName}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Template ID</p>
                <p className="font-mono text-sm">{selectedImport.templateId}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Imported By</p>
                <p>{selectedImport.importedByName}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Import Date</p>
                <p>{new Date(selectedImport.importedAt).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                {selectedImport.customized ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <Edit className="h-3 w-3 mr-1" />
                      Customized
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      This template has been modified since import
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <Check className="h-3 w-3 mr-1" />
                      Original
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      This template matches the original library version
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            {selectedImport && (
              <Button onClick={() => handleViewTemplate(selectedImport.templateId)}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ImportHistory;
