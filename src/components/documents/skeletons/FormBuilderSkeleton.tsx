"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================================
// FORM BUILDER SKELETON
// ============================================================================

interface FormBuilderSkeletonProps {
  /** Number of field skeletons to show */
  fieldCount?: number;
  /** Show sidebar */
  showSidebar?: boolean;
  /** Show preview panel */
  showPreview?: boolean;
}

export function FormBuilderSkeleton({
  fieldCount = 5,
  showSidebar = true,
  showPreview = false,
}: FormBuilderSkeletonProps) {
  return (
    <div className="flex h-[600px] gap-4" role="status" aria-label="Loading form builder">
      {/* Sidebar - Field Types */}
      {showSidebar && (
        <Card className="w-64 shrink-0">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Canvas */}
      <Card className="flex-1">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Form fields skeleton */}
          {Array.from({ length: fieldCount }).map((_, i) => (
            <FormFieldSkeleton key={i} />
          ))}

          {/* Add field button */}
          <div className="border-2 border-dashed rounded-lg p-4">
            <div className="flex items-center justify-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      {showPreview && (
        <Card className="w-80 shrink-0">
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      )}

      <span className="sr-only">Loading form builder...</span>
    </div>
  );
}

// ============================================================================
// FORM FIELD SKELETON
// ============================================================================

interface FormFieldSkeletonProps {
  /** Field type appearance */
  type?: "text" | "textarea" | "select" | "checkbox" | "radio" | "signature";
}

export function FormFieldSkeleton({ type = "text" }: FormFieldSkeletonProps) {
  return (
    <Card className="border-2 border-transparent hover:border-primary/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Drag handle */}
          <Skeleton className="h-6 w-6 mt-1 shrink-0" />

          <div className="flex-1 space-y-3">
            {/* Label */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>

            {/* Field based on type */}
            {type === "text" && (
              <Skeleton className="h-10 w-full" />
            )}

            {type === "textarea" && (
              <Skeleton className="h-24 w-full" />
            )}

            {type === "select" && (
              <Skeleton className="h-10 w-full" />
            )}

            {type === "checkbox" && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            )}

            {type === "radio" && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            )}

            {type === "signature" && (
              <Skeleton className="h-32 w-full" />
            )}

            {/* Helper text */}
            <Skeleton className="h-3 w-48" />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// FORM RENDERER SKELETON
// ============================================================================

interface FormRendererSkeletonProps {
  /** Number of fields to show */
  fieldCount?: number;
  /** Show progress indicator */
  showProgress?: boolean;
  /** Show actions */
  showActions?: boolean;
}

export function FormRendererSkeleton({
  fieldCount = 6,
  showProgress = true,
  showActions = true,
}: FormRendererSkeletonProps) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading form">
      {/* Progress indicator */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      )}

      {/* Form title */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Form fields */}
      <div className="space-y-6">
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Skeleton className="h-10 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      )}

      <span className="sr-only">Loading form...</span>
    </div>
  );
}

// ============================================================================
// FORM FIELD PALETTE SKELETON
// ============================================================================

export function FormFieldPaletteSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading field palette">
      {/* Search */}
      <Skeleton className="h-10 w-full" />

      {/* Field categories */}
      {["Text Fields", "Choice Fields", "Media Fields", "Layout"].map((category, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2 p-2 rounded border">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <span className="sr-only">Loading field palette...</span>
    </div>
  );
}

// ============================================================================
// FORM SETTINGS SKELETON
// ============================================================================

export function FormSettingsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading form settings">
      {/* General settings */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Submission settings */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>

      <span className="sr-only">Loading form settings...</span>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FormBuilderSkeleton;