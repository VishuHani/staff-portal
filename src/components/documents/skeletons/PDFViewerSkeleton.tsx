"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================================
// PDF VIEWER SKELETON
// ============================================================================

interface PDFViewerSkeletonProps {
  /** Number of pages to show in thumbnail sidebar */
  thumbnailCount?: number;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show sidebar */
  showSidebar?: boolean;
  /** Viewer height */
  height?: string | number;
}

export function PDFViewerSkeleton({
  thumbnailCount = 5,
  showToolbar = true,
  showSidebar = true,
  height = 600,
}: PDFViewerSkeletonProps) {
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      className="flex rounded-lg border overflow-hidden"
      style={{ height: heightStyle }}
      role="status"
      aria-label="Loading PDF viewer"
    >
      {/* Sidebar - Page thumbnails */}
      {showSidebar && (
        <div className="w-48 border-r bg-muted/30 p-3 space-y-3 overflow-y-auto shrink-0">
          {Array.from({ length: thumbnailCount }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-8 mx-auto" />
              <Skeleton className="aspect-[8.5/11] w-full rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Main viewer area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        {showToolbar && (
          <div className="border-b bg-muted/30 p-2">
            <div className="flex items-center justify-between">
              {/* Navigation */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
                <div className="flex items-center gap-1 ml-2">
                  <Skeleton className="h-6 w-12" />
                  <span className="text-muted-foreground">/</span>
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* PDF page display */}
        <div className="flex-1 bg-muted/20 p-8 overflow-auto flex justify-center">
          <div className="bg-white shadow-lg rounded" style={{ width: "595px", height: "842px" }}>
            {/* Simulated PDF content */}
            <div className="p-12 space-y-6">
              {/* Header */}
              <div className="text-center space-y-3">
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>

              {/* Content blocks */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}

              {/* Form fields */}
              <div className="space-y-4 pt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full border border-dashed" />
                  </div>
                ))}
              </div>

              {/* Signature area */}
              <div className="pt-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-20 w-full border border-dashed" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">Loading PDF document...</span>
    </div>
  );
}

// ============================================================================
// PDF PAGE SKELETON
// ============================================================================

interface PDFPageSkeletonProps {
  /** Page width */
  width?: number;
  /** Page height */
  height?: number;
  /** Show form fields */
  showFormFields?: boolean;
}

export function PDFPageSkeleton({
  width = 595,
  height = 842,
  showFormFields = true,
}: PDFPageSkeletonProps) {
  return (
    <div
      className="bg-white shadow-lg rounded"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <div className="p-8 space-y-4">
        {/* Content lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}

        {/* Form fields */}
        {showFormFields && (
          <div className="space-y-3 pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 flex-1" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PDF THUMBNAIL SKELETON
// ============================================================================

interface PDFThumbnailSkeletonProps {
  /** Show page number */
  showPageNumber?: boolean;
}

export function PDFThumbnailSkeleton({ showPageNumber = true }: PDFThumbnailSkeletonProps) {
  return (
    <div className="space-y-1">
      {showPageNumber && <Skeleton className="h-3 w-6 mx-auto" />}
      <Skeleton className="aspect-[8.5/11] w-full rounded" />
    </div>
  );
}

// ============================================================================
// PDF TOOLBAR SKELETON
// ============================================================================

export function PDFToolbarSkeleton() {
  return (
    <div className="border-b bg-muted/30 p-2">
      <div className="flex items-center justify-between">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <div className="flex items-center gap-1 ml-2">
            <Skeleton className="h-6 w-12" />
            <span className="text-muted-foreground">/</span>
            <Skeleton className="h-6 w-12" />
          </div>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PDF SIGNATURE PAD SKELETON
// ============================================================================

export function PDFSignaturePadSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-dashed rounded-lg p-4">
          <div className="h-32 flex items-center justify-center">
            <div className="text-center space-y-2">
              <Skeleton className="h-8 w-8 mx-auto rounded-full" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PDF FIELD OVERLAY SKELETON
// ============================================================================

export function PDFFieldOverlaySkeleton() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Simulated field overlays */}
      <div className="absolute top-[20%] left-[15%] w-[70%]">
        <Skeleton className="h-10 w-full opacity-50" />
      </div>
      <div className="absolute top-[30%] left-[15%] w-[70%]">
        <Skeleton className="h-10 w-full opacity-50" />
      </div>
      <div className="absolute top-[40%] left-[15%] w-[35%]">
        <Skeleton className="h-10 w-full opacity-50" />
      </div>
      <div className="absolute top-[40%] left-[52%] w-[33%]">
        <Skeleton className="h-10 w-full opacity-50" />
      </div>
      <div className="absolute bottom-[25%] left-[15%] w-[70%]">
        <Skeleton className="h-16 w-full opacity-50" />
      </div>
    </div>
  );
}

// ============================================================================
// PDF COMPARISON SKELETON
// ============================================================================

export function PDFComparisonSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4" role="status" aria-label="Loading PDF comparison">
      {/* Original document */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[8.5/11] w-full rounded" />
        </CardContent>
      </Card>

      {/* New document */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-[8.5/11] w-full rounded" />
        </CardContent>
      </Card>

      <span className="sr-only">Loading PDF comparison...</span>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default PDFViewerSkeleton;