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

import { useState, useCallback, useEffect } from "react";
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
import {
  uploadAndExtractRosterV3,
  confirmExtractionAndCreateRosterV3,
  getMatchableStaffV3,
} from "@/lib/actions/rosters/extraction-v3-actions";
import type { ExtractionResultV3 } from "@/lib/services/roster-extraction-v3-service";
import { format, startOfWeek, addDays } from "date-fns";

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

interface ShiftData {
  date: string;
  day: string;
  role: string | null;
  staff_name: string;
  start_time: string;
  end_time: string;
  break: boolean;
  matchedUserId: string | null;
  matchConfidence: number;
}

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
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [venueStaff, setVenueStaff] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [weekStart, setWeekStart] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  // Load venue staff
  const loadVenueStaff = useCallback(async () => {
    const result = await getMatchableStaffV3(venueId);
    if (result.success) {
      setVenueStaff(result.staff);
    }
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

        const result = await uploadAndExtractRosterV3(formData);

        if (result.success && result.extraction && result.extraction.data) {
          setExtraction(result.extraction);
          setShifts(
            result.matchedShifts?.map((s) => ({
              date: s.shift.date,
              day: s.shift.day,
              role: s.shift.role,
              staff_name: s.shift.staff_name,
              start_time: s.shift.start_time,
              end_time: s.shift.end_time,
              break: s.shift.break || false,
              matchedUserId: s.matchedUserId,
              matchConfidence: s.matchConfidence,
            })) || []
          );
          await loadVenueStaff();
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

    setIsLoading(true);
    try {
      const result = await confirmExtractionAndCreateRosterV3({
        venueId,
        weekStart,
        shifts: shifts.map((shift) => ({
          staff_name: shift.staff_name,
          matchedUserId: shift.matchedUserId || undefined,
          date: shift.date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          role: shift.role || undefined,
          break: shift.break,
        })),
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
  }, [extraction, shifts, venueId, weekStart, onOpenChange, onSuccess, router]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setExtraction(null);
    setShifts([]);
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
  const matchedShiftsCount = shifts.filter((s) => s.matchedUserId).length;
  const unmatchedShiftsCount = shifts.length - matchedShiftsCount;

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

          {currentStep === "preview" && extraction && (
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

              {/* Shifts Preview */}
              <div className="rounded-lg border">
                <div className="p-4 border-b">
                  <h4 className="font-medium">Extracted Shifts</h4>
                  <p className="text-sm text-muted-foreground">
                    {shifts.length} shifts extracted, {matchedShiftsCount} matched to staff
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Staff</th>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Role</th>
                        <th className="text-left p-2">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shifts.map((shift, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{shift.staff_name}</td>
                          <td className="p-2">{shift.day}</td>
                          <td className="p-2">{shift.start_time} - {shift.end_time}</td>
                          <td className="p-2">{shift.role || "-"}</td>
                          <td className="p-2">
                            {shift.matchedUserId ? (
                              <Badge variant="default" className="text-xs">
                                {shift.matchConfidence}%
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                Unmatched
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
      </DialogContent>
    </Dialog>
  );
}
