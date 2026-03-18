"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Download,
  FileText,
  Star,
  Clock,
  Filter,
  Loader2,
  Check,
  ExternalLink,
  Shield,
  MapPin,
  Tag,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplatePreview } from "./TemplatePreview";
import { ImportHistory } from "./ImportHistory";
import {
  getLibraryTemplates,
  getLibraryCategories,
  getLibraryJurisdictions,
  getPopularTemplates,
  getRecentTemplates,
  importLibraryTemplate,
  checkTemplateImported,
  type TemplateLibraryItemWithRelations,
  type LibraryTemplateFilters,
} from "@/lib/actions/documents/library";

// ============================================================================
// Types
// ============================================================================

interface CategoryCount {
  category: string;
  count: number;
}

interface JurisdictionCount {
  jurisdiction: string;
  count: number;
}

interface TemplateLibraryBrowserProps {
  venueId: string;
  onTemplateImported?: (templateId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  COMPLIANCE: "Compliance",
  CERTIFICATION: "Certification",
  HR: "HR Documents",
  CONTRACT: "Contracts",
  GENERAL: "General",
};

const JURISDICTION_LABELS: Record<string, string> = {
  AU: "Australia",
  NZ: "New Zealand",
  US: "United States",
  UK: "United Kingdom",
  GENERAL: "General",
};

const SORT_OPTIONS = [
  { value: "popularity", label: "Most Popular" },
  { value: "name", label: "Name (A-Z)" },
  { value: "importCount", label: "Most Used" },
  { value: "createdAt", label: "Recently Added" },
];

// ============================================================================
// Component
// ============================================================================

export function TemplateLibraryBrowser({
  venueId,
  onTemplateImported,
}: TemplateLibraryBrowserProps) {
  // State
  const [templates, setTemplates] = useState<TemplateLibraryItemWithRelations[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [jurisdictions, setJurisdictions] = useState<JurisdictionCount[]>([]);
  const [popularTemplates, setPopularTemplates] = useState<TemplateLibraryItemWithRelations[]>([]);
  const [recentTemplates, setRecentTemplates] = useState<TemplateLibraryItemWithRelations[]>([]);
  const [totalTemplates, setTotalTemplates] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popularity");
  const [showOfficialOnly, setShowOfficialOnly] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Dialogs
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateLibraryItemWithRelations | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedTemplateIds, setImportedTemplateIds] = useState<Set<string>>(new Set());

  // Active tab
  const [activeTab, setActiveTab] = useState<string>("browse");

  // Fetch initial data
  useEffect(() => {
    async function fetchInitialData() {
      setIsLoading(true);
      try {
        const [categoriesRes, jurisdictionsRes, popularRes, recentRes] = await Promise.all([
          getLibraryCategories(),
          getLibraryJurisdictions(),
          getPopularTemplates(5),
          getRecentTemplates(5),
        ]);

        if (categoriesRes.success && categoriesRes.data) {
          setCategories(categoriesRes.data);
        }
        if (jurisdictionsRes.success && jurisdictionsRes.data) {
          setJurisdictions(jurisdictionsRes.data);
        }
        if (popularRes.success && popularRes.data) {
          setPopularTemplates(popularRes.data);
        }
        if (recentRes.success && recentRes.data) {
          setRecentTemplates(recentRes.data);
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    }

    fetchInitialData();
  }, []);

  // Fetch templates when filters change
  useEffect(() => {
    async function fetchTemplates() {
      setIsLoading(true);
      setError(null);
      try {
        const filters: LibraryTemplateFilters = {
          limit: pageSize,
          offset: page * pageSize,
          sortBy: sortBy as any,
          sortOrder: "desc",
        };

        if (categoryFilter !== "all") {
          filters.category = categoryFilter;
        }
        if (jurisdictionFilter !== "all") {
          filters.jurisdiction = jurisdictionFilter;
        }
        if (searchQuery) {
          filters.search = searchQuery;
        }
        if (showOfficialOnly) {
          filters.isOfficial = true;
        }

        const result = await getLibraryTemplates(filters);
        if (result.success && result.data) {
          setTemplates(result.data);
          setTotalTemplates(result.total || 0);

          // Check which templates are already imported
          const importChecks = await Promise.all(
            result.data.map((t) => checkTemplateImported(t.id, venueId))
          );
          const importedIds = new Set<string>();
          importChecks.forEach((check, index) => {
            if (check.success && check.data?.imported && result.data![index]) {
              importedIds.add(result.data![index].id);
            }
          });
          setImportedTemplateIds(importedIds);
        } else {
          setError(result.error || "Failed to load templates");
        }
      } catch (err) {
        console.error("Error fetching templates:", err);
        setError("Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTemplates();
  }, [venueId, categoryFilter, jurisdictionFilter, sortBy, showOfficialOnly, page, searchQuery]);

  // Handlers
  const handlePreview = useCallback((template: TemplateLibraryItemWithRelations) => {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  }, []);

  const handleImportClick = useCallback((template: TemplateLibraryItemWithRelations) => {
    setSelectedTemplate(template);
    setShowImportDialog(true);
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsImporting(true);
    try {
      const result = await importLibraryTemplate({
        libraryItemId: selectedTemplate.id,
        venueId,
      });

      if (result.success && result.data) {
        setImportedTemplateIds((prev) => new Set([...prev, selectedTemplate.id]));
        setShowImportDialog(false);
        onTemplateImported?.(result.data.templateId);
      } else {
        setError(result.error || "Failed to import template");
      }
    } catch (err) {
      console.error("Error importing template:", err);
      setError("Failed to import template");
    } finally {
      setIsImporting(false);
    }
  }, [selectedTemplate, venueId, onTemplateImported]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setCategoryFilter("all");
    setJurisdictionFilter("all");
    setSortBy("popularity");
    setShowOfficialOnly(false);
    setPage(0);
  }, []);

  const totalPages = Math.ceil(totalTemplates / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Template Library</h2>
          <p className="text-muted-foreground">
            Browse and import pre-built document templates
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {totalTemplates} templates available
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
          <TabsTrigger value="recent">New</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates by name, description, or tags..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(0);
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.category} value={cat.category}>
                          {CATEGORY_LABELS[cat.category] || cat.category} ({cat.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={jurisdictionFilter} onValueChange={(v) => { setJurisdictionFilter(v); setPage(0); }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Jurisdiction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Jurisdictions</SelectItem>
                      {jurisdictions.map((jur) => (
                        <SelectItem key={jur.jurisdiction} value={jur.jurisdiction}>
                          {JURISDICTION_LABELS[jur.jurisdiction] || jur.jurisdiction} ({jur.count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant={showOfficialOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowOfficialOnly(!showOfficialOnly)}
                    className="flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Official Only
                  </Button>

                  {(categoryFilter !== "all" || jurisdictionFilter !== "all" || searchQuery || showOfficialOnly) && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Templates Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                  <FileText className="h-12 w-12 opacity-50" />
                  <p className="text-lg font-medium">No templates found</p>
                  <p>Try adjusting your filters or search query</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    importedTemplateIds.has(template.id) && "opacity-60"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {template.description}
                        </CardDescription>
                      </div>
                      {template.isOfficial && (
                        <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {JURISDICTION_LABELS[template.jurisdiction] || template.jurisdiction}
                      </Badge>
                      {template.stateSpecific && (
                        <Badge variant="secondary" className="text-xs">
                          {template.stateSpecific}
                        </Badge>
                      )}
                    </div>

                    {/* Tags */}
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        {template.importCount}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        {template.popularity.toFixed(1)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePreview(template)}
                      >
                        Preview
                      </Button>
                      {importedTemplateIds.has(template.id) ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          disabled
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Imported
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleImportClick(template)}
                        >
                          Import
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

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
        </TabsContent>

        {/* Popular Tab */}
        <TabsContent value="popular" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Most Popular Templates
              </CardTitle>
              <CardDescription>
                Templates most frequently imported by other venues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {popularTemplates.map((template, index) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handlePreview(template)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {CATEGORY_LABELS[template.category] || template.category} • {template.importCount} imports
                      </p>
                    </div>
                    {template.isOfficial && (
                      <Shield className="h-5 w-5 text-primary" />
                    )}
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImportClick(template);
                      }}
                      disabled={importedTemplateIds.has(template.id)}
                    >
                      {importedTemplateIds.has(template.id) ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Imported
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Recently Added
              </CardTitle>
              <CardDescription>
                New templates added to the library
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => handlePreview(template)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Added {new Date(template.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {template.isOfficial && (
                      <Shield className="h-5 w-5 text-primary" />
                    )}
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleImportClick(template);
                      }}
                      disabled={importedTemplateIds.has(template.id)}
                    >
                      {importedTemplateIds.has(template.id) ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Imported
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import History Tab */}
        <TabsContent value="history">
          <ImportHistory venueId={venueId} />
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TemplatePreview template={selectedTemplate} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            {selectedTemplate && !importedTemplateIds.has(selectedTemplate.id) && (
              <Button onClick={() => {
                setShowPreviewDialog(false);
                handleImportClick(selectedTemplate);
              }}>
                Import Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Confirmation Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to import "{selectedTemplate?.name}" to your venue?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will create a copy of the template in your venue's document library.
              You can customize it after import.
            </p>
            {selectedTemplate?.formSchema && (
              <p className="text-sm text-muted-foreground mt-2">
                The template contains {(selectedTemplate.formSchema as any)?.fields?.length || 0} form fields.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TemplateLibraryBrowser;
