'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  CircleDot,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  FormSchema,
  FormField,
  FormPage,
  MultiPageSettings,
} from '@/lib/types/form-schema';

// ============================================================================
// FORM PROGRESS BAR
// ============================================================================

export interface FormProgressBarProps {
  currentPage: number;
  totalPages: number;
  pages: FormPage[];
  settings: MultiPageSettings;
  onPageClick?: (pageIndex: number) => void;
  completedPages?: Set<number>;
  errors?: Map<number, string[]>;
}

export function FormProgressBar({
  currentPage,
  totalPages,
  pages,
  settings,
  onPageClick,
  completedPages = new Set(),
  errors = new Map(),
}: FormProgressBarProps) {
  const progress = ((currentPage + 1) / totalPages) * 100;

  if (settings.progressStyle === 'dots') {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        {Array.from({ length: totalPages }).map((_, index) => {
          const isCompleted = completedPages.has(index);
          const isCurrent = index === currentPage;
          const hasErrors = errors.has(index);

          return (
            <button
              key={index}
              onClick={() => settings.allowJump && onPageClick?.(index)}
              disabled={!settings.allowJump}
              className={cn(
                "transition-all",
                settings.allowJump && "cursor-pointer hover:scale-110"
              )}
              title={pages[index]?.title || `Page ${index + 1}`}
            >
              {hasErrors ? (
                <AlertCircle className={cn(
                  "h-3 w-3",
                  isCurrent ? "text-destructive" : "text-muted-foreground"
                )} />
              ) : isCompleted ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Circle className={cn(
                  "h-3 w-3",
                  isCurrent ? "fill-primary text-primary" : "text-muted-foreground"
                )} />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (settings.progressStyle === 'bar') {
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  }

  // Steps style (default)
  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        {pages.map((page, index) => {
          const isCompleted = completedPages.has(index);
          const isCurrent = index === currentPage;
          const hasErrors = errors.has(index);

          return (
            <React.Fragment key={page.id}>
              <button
                onClick={() => settings.allowJump && onPageClick?.(index)}
                disabled={!settings.allowJump}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  settings.allowJump && "cursor-pointer"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                    isCurrent && "border-primary bg-primary text-primary-foreground",
                    isCompleted && !isCurrent && "border-primary bg-primary/10 text-primary",
                    !isCurrent && !isCompleted && "border-muted-foreground/30 text-muted-foreground",
                    hasErrors && "border-destructive bg-destructive/10 text-destructive"
                  )}
                >
                  {hasErrors ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium max-w-[80px] text-center truncate",
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {page.title || `Page ${index + 1}`}
                </span>
              </button>
              {index < pages.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// MULTI-PAGE FORM NAVIGATION
// ============================================================================

export interface MultiPageNavigationProps {
  currentPage: number;
  totalPages: number;
  canGoBack: boolean;
  canGoNext: boolean;
  isSubmitting?: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
}

export function MultiPageNavigation({
  currentPage,
  totalPages,
  canGoBack,
  canGoNext,
  isSubmitting,
  onBack,
  onNext,
  onSubmit,
  backLabel = 'Previous',
  nextLabel = 'Next',
  submitLabel = 'Submit',
}: MultiPageNavigationProps) {
  const isLastPage = currentPage === totalPages - 1;

  return (
    <div className="flex items-center justify-between pt-4 border-t">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={!canGoBack || isSubmitting}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {backLabel}
      </Button>

      {isLastPage ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canGoNext || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin mr-2">⏳</span>
              Submitting...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              {submitLabel}
            </>
          )}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isSubmitting}
        >
          {nextLabel}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// MULTI-PAGE FORM WRAPPER
// ============================================================================

export interface MultiPageFormProps {
  schema: FormSchema;
  pages: FormPage[];
  settings: MultiPageSettings;
  currentPage: number;
  onPageChange: (page: number) => void;
  onSubmit: () => void;
  children: React.ReactNode;
  completedPages?: Set<number>;
  errors?: Map<number, string[]>;
  isSubmitting?: boolean;
}

export function MultiPageForm({
  schema,
  pages,
  settings,
  currentPage,
  onPageChange,
  onSubmit,
  children,
  completedPages = new Set(),
  errors = new Map(),
  isSubmitting,
}: MultiPageFormProps) {
  const handleBack = () => {
    if (settings.allowBackNavigation && currentPage > 0) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      onPageChange(currentPage + 1);
    }
  };

  const progressPosition = settings.progressPosition || 'top';

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar - Top */}
      {settings.showProgressBar && progressPosition === 'top' && (
        <FormProgressBar
          currentPage={currentPage}
          totalPages={pages.length}
          pages={pages}
          settings={settings}
          onPageClick={onPageChange}
          completedPages={completedPages}
          errors={errors}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Progress Bar - Left */}
        {settings.showProgressBar && progressPosition === 'left' && (
          <div className="w-48 border-r p-4 flex-shrink-0">
            <FormProgressBar
              currentPage={currentPage}
              totalPages={pages.length}
              pages={pages}
              settings={settings}
              onPageClick={onPageChange}
              completedPages={completedPages}
              errors={errors}
            />
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {/* Page Header */}
            {pages[currentPage] && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold">
                  {pages[currentPage].title || `Page ${currentPage + 1}`}
                </h2>
                {pages[currentPage].description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {pages[currentPage].description}
                  </p>
                )}
              </div>
            )}

            {/* Page Fields */}
            {children}

            {/* Navigation */}
            <MultiPageNavigation
              currentPage={currentPage}
              totalPages={pages.length}
              canGoBack={settings.allowBackNavigation && currentPage > 0}
              canGoNext={true}
              isSubmitting={isSubmitting}
              onBack={handleBack}
              onNext={handleNext}
              onSubmit={onSubmit}
            />
          </div>
        </div>

        {/* Progress Bar - Right */}
        {settings.showProgressBar && progressPosition === 'right' && (
          <div className="w-48 border-l p-4 flex-shrink-0">
            <FormProgressBar
              currentPage={currentPage}
              totalPages={pages.length}
              pages={pages}
              settings={settings}
              onPageClick={onPageChange}
              completedPages={completedPages}
              errors={errors}
            />
          </div>
        )}
      </div>

      {/* Progress Bar - Bottom */}
      {settings.showProgressBar && progressPosition === 'bottom' && (
        <FormProgressBar
          currentPage={currentPage}
          totalPages={pages.length}
          pages={pages}
          settings={settings}
          onPageClick={onPageChange}
          completedPages={completedPages}
          errors={errors}
        />
      )}
    </div>
  );
}

// ============================================================================
// PAGE BREAK INDICATOR (for Form Builder)
// ============================================================================

export interface PageBreakIndicatorProps {
  pageNumber: number;
  totalPages: number;
  title?: string;
  description?: string;
}

export function PageBreakIndicator({
  pageNumber,
  totalPages,
  title,
  description,
}: PageBreakIndicatorProps) {
  return (
    <div className="relative py-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t-2 border-dashed border-muted-foreground/30" />
      </div>
      <div className="relative flex justify-center">
        <div className="bg-background px-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Page {pageNumber} of {totalPages}
          </span>
          {title && (
            <>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{title}</span>
            </>
          )}
        </div>
      </div>
      {description && (
        <div className="text-center mt-2">
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Split form fields into pages based on page_break fields
 */
export function splitFieldsIntoPages(fields: FormField[]): FormPage[] {
  const pages: FormPage[] = [];
  let currentPage: FormPage = {
    id: `page_${Date.now()}_0`,
    title: 'Page 1',
    fields: [],
  };

  let pageIndex = 0;

  fields.forEach((field) => {
    if (field.type === 'page_break') {
      // Save current page and start a new one
      pages.push(currentPage);
      pageIndex++;
      currentPage = {
        id: `page_${Date.now()}_${pageIndex}`,
        title: field.pageTitle || `Page ${pageIndex + 1}`,
        description: field.pageDescription,
        fields: [],
        conditionalLogic: field.conditionalLogic,
      };
    } else {
      currentPage.fields.push(field);
    }
  });

  // Add the last page
  pages.push(currentPage);

  return pages;
}

/**
 * Get default multi-page settings
 */
export function getDefaultMultiPageSettings(): MultiPageSettings {
  return {
    showProgressBar: true,
    progressPosition: 'top',
    progressStyle: 'steps',
    allowJump: false,
    allowBackNavigation: true,
    saveOnPageChange: true,
    confirmBeforeLeave: true,
  };
}

export default MultiPageForm;