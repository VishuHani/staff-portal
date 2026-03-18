"use client";

/**
 * Roster Upload Wizard V3 Component
 * 
 * Production-grade extraction with:
 * - Single GPT-4o vision call
 * - Image preprocessing
 * - Code-based validation
 * - Retry mechanism with correction prompt
 * - Confidence gating
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { FileUploadZone } from "./file-upload-zone";
import { ExtractionMatrixPreview } from "./extraction-matrix-preview";
import {
  UnresolvedIdentityPanel,
  MatchingSummary,
  type UnresolvedIdentity,
} from "./unresolved-identity-panel";
import {
  uploadAndExtractRosterV3,
  confirmExtractionAndCreateRosterV3,
  getMatchableStaffV3,
} from "@/lib/actions/rosters/extraction-v3-actions";
import type { ExtractionResultV3 } from "@/lib/services/roster-extraction-v3-service";
import type { RosterExtractionResult } from "@/lib/schemas/rosters/extraction";
import { format, startOfWeek, addDays } from "date-fns";
import {
  buildMatrixExtractionResult,
  buildPreviewShiftState,
  toConfirmPayloadShifts,
  categorizeShiftsByMatchStatus,
  getMatchingStatistics,
  hasBlockingUnresolvedIdentities,
  type PreviewShiftState,
} from "@/lib/rosters/v3-preview-engine";

// ============================================================================
// TYPES
// ============================================================================

interface RosterUploadWizardV3Props {
  venueId: string;
  venueName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (rosterId: string) => void;
}

type WizardStep = "upload" | "extracting" | "preview" | "confirm";

// ============================================================================
// COMPONENT
// ============================================================================

export function RosterUploadWizardV3({
  venueId,
  venueName,
  open,
  onOpenChange,
  onSuccess,
}: RosterUploadWizardV3Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResultV3 | null>(null);
  const [previewExtraction, setPreviewExtraction] = useState<RosterExtractionResult | null>(null);
  const [previewShifts, setPreviewShifts] = useState<PreviewShiftState[]>([]);
  const [venueStaff, setVenueStaff] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [weekStart, setWeekStart] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [blockingIssues, setBlockingIssues] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("uploaded");
  const [showUnresolvedPanel, setShowUnresolvedPanel] = useState(false);
  const [unresolvedIdentities, setUnresolvedIdentities] = useState<UnresolvedIdentity[]>([]);

  // Load venue staff
  const loadVenueStaff = useCallback(async () => {
    const result = await getMatchableStaffV3(venueId);
    if (result.success) {
      setVenueStaff(result.staff);
      return result.staff;
    }
    return [] as Array<{ id: string; name: string; email: string }>;
  }, [venueId]);

  // Track elapsed time during extraction
  useEffect(() => {
    if (currentStep === "extracting" && isLoading) {
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setElapsedTime(0);
    }
  }, [currentStep, isLoading]);

  // Handle file upload and extraction
  const handleFileSelect = useCallback(
    async (file: File, fileType: "excel" | "csv" | "image") => {
      setIsLoading(true);
      setCurrentStep("extracting");
      setElapsedTime(0);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("venueId", venueId);
        setUploadedFileName(file.name);

        const result = await uploadAndExtractRosterV3(formData);

        if (result.success && result.extraction && result.extraction.data) {
          setExtraction(result.extraction);
          const staff = await loadVenueStaff();

          const validationErrorsByIndex = new Map<number, string[]>();
          const validationWarningsByIndex = new Map<number, string[]>();

          for (const err of result.extraction.validation?.errors || []) {
            const list = validationErrorsByIndex.get(err.shiftIndex) || [];
            list.push(err.message);
            validationErrorsByIndex.set(err.shiftIndex, list);
          }
          for (const warn of result.extraction.validation?.warnings || []) {
            const list = validationWarningsByIndex.get(warn.shiftIndex) || [];
            list.push(warn.message);
            validationWarningsByIndex.set(warn.shiftIndex, list);
          }

          const nextPreviewShifts = buildPreviewShiftState({
            matchedShifts: (result.matchedShifts || []).map((ms) => ({
              ...ms,
              matchStrategy: ms.matchStrategy as import("@/lib/rosters/staff-matching-engine").MatchStrategy | undefined,
            })),
            weekStart: result.extraction.data.week_start || weekStart,
            validationErrorsByIndex,
            validationWarningsByIndex,
          });
          setPreviewShifts(nextPreviewShifts);

          const nextPreviewExtraction = buildMatrixExtractionResult({
            shifts: nextPreviewShifts,
            venueStaff: staff,
            fileName: file.name,
            weekStart: result.extraction.data.week_start || weekStart,
            extractionConfidence: result.extraction.validation?.confidence || 0,
            warnings: result.extraction.validation?.warnings.map((w) => w.message) || [],
            errors: result.extraction.validation?.errors.map((e) => e.message) || [],
          });
          setPreviewExtraction(nextPreviewExtraction);
          setBlockingIssues(result.extraction.validation?.errors.map((e) => e.message) || []);

          setCurrentStep("preview");

          const timeSeconds = Math.round(result.extraction.metadata.processingTimeMs / 1000);
          toast.success(
            `Extracted ${result.extraction.data.shifts.length} shifts in ${timeSeconds}s with ${result.extraction.validation?.confidence}% confidence`
          );
        } else {
          toast.error(result.error || "Failed to extract roster");
          setCurrentStep("upload");
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload file");
        setCurrentStep("upload");
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, loadVenueStaff]
  );

  // Handle confirmation and roster creation
  const handleConfirm = useCallback(async () => {
    if (!extraction?.data) return;

    const includedShifts = previewShifts.filter((s) => s.included);
    if (includedShifts.length === 0) {
      toast.error("No included shifts. Include at least one shift before creating roster.");
      return;
    }

    const unmatchedIncluded = includedShifts.filter((s) => !s.matchedUserId).length;
    if (unmatchedIncluded > 0) {
      toast.error("Please match all included staff before creating roster.");
      return;
    }

    if (blockingIssues.length > 0) {
      toast.error("Resolve extraction errors before creating roster.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await confirmExtractionAndCreateRosterV3({
        venueId,
        weekStart,
        shifts: toConfirmPayloadShifts(previewShifts),
      });

      if (result.success) {
        toast.success("Roster created successfully!");
        onOpenChange(false);
        onSuccess?.(result.rosterId!);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create roster");
      }
    } catch (error) {
      console.error("Confirm error:", error);
      toast.error("Failed to create roster");
    } finally {
      setIsLoading(false);
    }
  }, [
    extraction,
    previewShifts,
    venueId,
    weekStart,
    onOpenChange,
    onSuccess,
    router,
    blockingIssues,
  ]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setExtraction(null);
    setPreviewExtraction(null);
    setPreviewShifts([]);
    setBlockingIssues([]);
    setCurrentStep("upload");
    setElapsedTime(0);
    onOpenChange(false);
  }, [onOpenChange]);

  // Navigation
  const currentStepIndex = ["upload", "extracting", "preview", "confirm"].indexOf(currentStep);
  const canGoBack = currentStepIndex > 0 && currentStep !== "extracting";

  const handleBack = () => {
    if (canGoBack) {
      const steps: WizardStep[] = ["upload", "extracting", "preview", "confirm"];
      setCurrentStep(steps[currentStepIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < 3) {
      const steps: WizardStep[] = ["upload", "extracting", "preview", "confirm"];
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  };

  // Calculate summary stats
  const includedShifts = previewShifts.filter((s) => s.included);
  const matchedShiftsCount = includedShifts.filter((s) => s.matchedUserId).length;
  const unmatchedShiftsCount = includedShifts.length - matchedShiftsCount;

  // Build unresolved identities for the panel
  const buildUnresolvedIdentities = useCallback((): UnresolvedIdentity[] => {
    const { unresolved, needsReview } = categorizeShiftsByMatchStatus(previewShifts);
    const allUnresolved = [...unresolved, ...needsReview];
    
    // Group by staff name
    const byName = new Map<string, PreviewShiftState[]>();
    for (const shift of allUnresolved) {
      const key = shift.staff_name.toLowerCase().trim();
      const list = byName.get(key) || [];
      list.push(shift);
      byName.set(key, list);
    }
    
    return Array.from(byName.entries()).map(([name, shifts]) => {
      const first = shifts[0];
      return {
        id: `identity-${name}`,
        staffName: first.staff_name,
        confidence: first.matchConfidence,
        confidenceBand: first.matchConfidenceBand || 'none',
        strategy: first.matchStrategy || 'no_match',
        matchReason: first.matchReason || null,
        alternatives: first.matchAlternatives || [],
        shiftCount: shifts.length,
        shiftIds: shifts.map(s => s.id),
      };
    });
  }, [previewShifts]);

  // Handle opening unresolved identity panel
  const handleOpenUnresolvedPanel = useCallback(() => {
    setUnresolvedIdentities(buildUnresolvedIdentities());
    setShowUnresolvedPanel(true);
  }, [buildUnresolvedIdentities]);

  // Handle resolving identities from the panel
  const handleResolveIdentities = useCallback(
    (resolutions: Array<{ identityId: string; matchedUserId: string | null }>) => {
      const updated = previewShifts.map((shift) => {
        const resolution = resolutions.find((r) =>
          shift.staff_name.toLowerCase().trim() === r.identityId.replace("identity-", "").toLowerCase()
        );
        if (resolution && resolution.matchedUserId) {
          return {
            ...shift,
            matchedUserId: resolution.matchedUserId,
            matchConfidence: 100,
            requiresMatchConfirmation: false,
          };
        }
        return shift;
      });
      setPreviewShifts(updated);
      setShowUnresolvedPanel(false);

      // Update preview extraction
      if (previewExtraction) {
        setPreviewExtraction(
          buildMatrixExtractionResult({
            shifts: updated,
            venueStaff,
            fileName: uploadedFileName,
            weekStart,
            extractionConfidence: extraction?.validation?.confidence || previewExtraction.confidenceScore,
            warnings: previewExtraction.warnings,
            errors: previewExtraction.errors,
          })
        );
      }

      toast.success(`Resolved ${resolutions.filter(r => r.matchedUserId).length} identities`);
    },
    [previewShifts, previewExtraction, venueStaff, uploadedFileName, weekStart, extraction]
  );

  // Get matching statistics for the summary component
  const matchingStats = useMemo(() => getMatchingStatistics(previewShifts), [previewShifts]);

  const handleStaffMatch = useCallback(
    (extractedName: string, userId: string) => {
      const updated = previewShifts.map((shift) => {
        if (shift.staff_name.toLowerCase().trim() !== extractedName.toLowerCase().trim()) {
          return shift;
        }
        return { ...shift, matchedUserId: userId, matchConfidence: Math.max(shift.matchConfidence, 95) };
      });
      setPreviewShifts(updated);
      if (previewExtraction) {
        setPreviewExtraction(
          buildMatrixExtractionResult({
            shifts: updated,
            venueStaff,
            fileName: uploadedFileName,
            weekStart,
            extractionConfidence: extraction?.validation?.confidence || previewExtraction.confidenceScore,
            warnings: previewExtraction.warnings,
            errors: previewExtraction.errors,
          })
        );
      }
    },
    [previewShifts, previewExtraction, venueStaff, uploadedFileName, weekStart, extraction]
  );

  const handleShiftToggle = useCallback(
    (shiftId: string, included: boolean) => {
      setPreviewShifts((prev) =>
        prev.map((shift) => (shift.id === shiftId ? { ...shift, included } : shift))
      );
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Upload Roster - {venueName}
            <Badge variant="default" className="ml-2">V3 Production</Badge>
          </DialogTitle>
          <DialogDescription>
            Single-pass extraction with image preprocessing and code-based validation
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between py-4 border-b">
          {["Upload", "Extracting", "Review", "Confirm"].map((step, index) => (
            <div
              key={step}
              className={cn(
                "flex items-center",
                index < 3 && "flex-1"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
                  currentStepIndex === index && "bg-primary text-primary-foreground",
                  currentStepIndex > index && "bg-green-100 text-green-800",
                  currentStepIndex < index && "bg-muted text-muted-foreground"
                )}
              >
                {currentStepIndex > index ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="h-4 w-4 flex items-center justify-center">{index + 1}</span>
                )}
                <span className="hidden sm:inline">{step}</span>
              </div>
              {index < 3 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    currentStepIndex > index ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === "upload" && (
            <div className="space-y-4">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>V3 Production Extraction</AlertTitle>
                <AlertDescription>
                  This version uses a single-pass extraction with:
                  <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                    <li><strong>Image preprocessing</strong> - Contrast boost, crop, resize</li>
                    <li><strong>Focused prompt</strong> - Clear extraction rules, strict JSON schema</li>
                    <li><strong>Code-based validation</strong> - Time format, date format, consistency</li>
                    <li><strong>Retry mechanism</strong> - Correction prompt on low confidence</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <FileUploadZone
                onFileSelect={handleFileSelect}
                isUploading={isLoading}
                disabled={isLoading}
              />
            </div>
          )}

          {currentStep === "extracting" && (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              
              <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                  <p className="text-lg font-medium">Extracting roster data...</p>
                  <p className="text-sm text-muted-foreground">
                    Single-pass extraction with preprocessing
                  </p>
                  {elapsedTime > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                    </p>
                  )}
                </div>

                <Progress value={50} className="h-2" />
              </div>

              <div className="text-center max-w-md space-y-2">
                <p className="text-sm text-muted-foreground">
                  This typically takes 30-60 seconds. The AI is analyzing the roster
                  and extracting all shifts in a single pass.
                </p>
                {elapsedTime > 90 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Still processing... Large rosters may take longer.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentStep === "preview" && extraction && previewExtraction && (
            <div className="space-y-4">
              {/* Validation Summary */}
              {extraction.validation && (
                <Collapsible open={showValidationDetails} onOpenChange={setShowValidationDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Info className="h-4 w-4 mr-2" />
                      Extraction Details ({extraction.validation.confidence}% confidence)
                      <ChevronRight className={cn(
                        "h-4 w-4 ml-auto transition-transform",
                        showValidationDetails && "rotate-90"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-lg border p-4 space-y-3">
                      {/* Stats */}
                      <div>
                        <h5 className="font-medium text-sm">Extraction Stats</h5>
                        <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                          <div>
                            <span className="text-muted-foreground">Total Shifts:</span>{" "}
                            <span className="font-medium">{extraction.validation.stats.totalShifts}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valid Shifts:</span>{" "}
                            <span className="font-medium">{extraction.validation.stats.validShifts}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Unique Staff:</span>{" "}
                            <span className="font-medium">{extraction.validation.stats.uniqueStaff}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Processing Time:</span>{" "}
                            <span className="font-medium">{Math.round(extraction.metadata.processingTimeMs / 1000)}s</span>
                          </div>
                        </div>
                      </div>

                      {/* Errors */}
                      {extraction.validation.errors.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm text-destructive">Errors ({extraction.validation.errors.length})</h5>
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {extraction.validation.errors.slice(0, 5).map((error, idx) => (
                              <Alert key={idx} variant="destructive" className="py-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  Shift #{error.shiftIndex + 1}: {error.message}
                                </AlertDescription>
                              </Alert>
                            ))}
                            {extraction.validation.errors.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                ...and {extraction.validation.errors.length - 5} more errors
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Warnings */}
                      {extraction.validation.warnings.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm text-amber-600">Warnings ({extraction.validation.warnings.length})</h5>
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {extraction.validation.warnings.slice(0, 5).map((warning, idx) => (
                              <Alert key={idx} className="py-2 border-amber-200 bg-amber-50">
                                <AlertDescription className="text-xs">
                                  Shift #{warning.shiftIndex + 1}: {warning.message}
                                </AlertDescription>
                              </Alert>
                            ))}
                            {extraction.validation.warnings.length > 5 && (
                              <p className="text-xs text-muted-foreground">
                                ...and {extraction.validation.warnings.length - 5} more warnings
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {blockingIssues.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Blocking issues detected</AlertTitle>
                  <AlertDescription>
                    Resolve extraction errors before creating the roster. Found {blockingIssues.length} blocking issue{blockingIssues.length !== 1 ? "s" : ""}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Matching Summary and Unresolved Identity Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <MatchingSummary
                    stats={matchingStats}
                    onStartReview={handleOpenUnresolvedPanel}
                  />
                </div>
                <div className="md:col-span-2">
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertTitle>Staff Matching</AlertTitle>
                    <AlertDescription>
                      {matchingStats.unmatched > 0 || matchingStats.needsConfirmation > 0 ? (
                        <span>
                          {matchingStats.unmatched + matchingStats.needsConfirmation} staff members need to be identified.
                          Click "Review Issues" to resolve unmatched or low-confidence matches.
                        </span>
                      ) : (
                        <span>All staff members have been successfully matched with high confidence.</span>
                      )}
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              <ExtractionMatrixPreview
                extraction={previewExtraction}
                venueStaff={venueStaff}
                weekStart={weekStart}
                onStaffMatch={handleStaffMatch}
                onShiftToggle={handleShiftToggle}
                includedShiftIds={new Set(previewShifts.filter((s) => s.included).map((s) => s.id))}
              />
            </div>
          )}

          {currentStep === "confirm" && extraction && (
            <div className="space-y-6">
              {/* Week Selection */}
              <div className="space-y-2">
                <Label>Roster Week Start</Label>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This roster will cover {format(new Date(weekStart), "MMM d, yyyy")} to{" "}
                  {format(addDays(new Date(weekStart), 6), "MMM d, yyyy")}
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium">Roster Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Venue</p>
                    <p className="font-medium">{venueName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Week</p>
                    <p className="font-medium">
                      {format(new Date(weekStart), "MMM d")} -{" "}
                      {format(addDays(new Date(weekStart), 6), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Shifts to Create</p>
                    <p className="font-medium">{matchedShiftsCount} shifts</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unmatched Entries</p>
                    <p className="font-medium">{unmatchedShiftsCount} entries</p>
                  </div>
                </div>

                {extraction.validation && (
                  <div className="text-xs text-blue-700 bg-blue-50 rounded p-2">
                    <strong>V3 Extraction:</strong> {extraction.validation.confidence}% confidence, 
                    processed in {Math.round(extraction.metadata.processingTimeMs / 1000)}s
                  </div>
                )}

                {unmatchedShiftsCount > 0 && (
                  <div className="text-xs text-yellow-700 bg-yellow-50 rounded p-2">
                    Note: Unmatched entries will be saved for review but won't appear
                    on staff calendars until matched.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {canGoBack && (
                <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              {currentStep === "preview" && (
                <Button onClick={handleNext} disabled={isLoading}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {currentStep === "confirm" && (
                <Button onClick={handleConfirm} disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create Roster
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>

        {/* Unresolved Identity Panel */}
        <UnresolvedIdentityPanel
          open={showUnresolvedPanel}
          onOpenChange={setShowUnresolvedPanel}
          identities={unresolvedIdentities}
          staffOptions={venueStaff}
          onResolve={(identityId, matchedUserId) => {
            // Single identity resolution
            const updated = previewShifts.map((shift) => {
              if (shift.staff_name.toLowerCase().trim() === identityId.replace("identity-", "").toLowerCase()) {
                return {
                  ...shift,
                  matchedUserId,
                  matchConfidence: matchedUserId ? 100 : shift.matchConfidence,
                  requiresMatchConfirmation: false,
                };
              }
              return shift;
            });
            setPreviewShifts(updated);
          }}
          onResolveAll={handleResolveIdentities}
          onCancel={() => setShowUnresolvedPanel(false)}
          config={{
            allowSkipUnresolved: false,
            requireAllResolved: true,
            showConfidenceDetails: true,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
