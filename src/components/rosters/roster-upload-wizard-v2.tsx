"use client";

/**
 * Roster Upload Wizard V2 Component
 * Multi-step wizard with multi-phase extraction progress
 * 
 * Key differences from V1:
 * - Shows extraction phase progress (SEE, THINK, EXTRACT, VALIDATE)
 * - Displays validation results and anomalies
 * - Shows structure analysis information
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
  Zap,
  Brain,
  FileSearch,
  ShieldCheck,
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
import { VersionPromptDialog, VersionIndicator } from "./version-prompt-dialog";
import {
  uploadAndExtractRosterV2,
  confirmExtractionAndCreateRosterV2,
  cancelExtractionV2,
  manualStaffMatchV2,
  getMatchableStaffV2,
  checkForDuplicateRoster,
} from "@/lib/actions/rosters";
import type {
  RosterExtractionResult,
  ExtractionV2Metadata,
} from "@/lib/schemas/rosters/extraction";
import { RosterStatus } from "@prisma/client";
import { format, startOfWeek, addDays } from "date-fns";

interface RosterUploadWizardV2Props {
  venueId: string;
  venueName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (rosterId: string) => void;
}

type WizardStep = "upload" | "extracting" | "preview" | "confirm";

// Phase icons and labels
const EXTRACTION_PHASES = [
  { id: 1, name: "SEE", label: "Structure Analysis", icon: FileSearch },
  { id: 2, name: "THINK", label: "Cell Parsing", icon: Brain },
  { id: 3, name: "EXTRACT", label: "Shift Creation", icon: Zap },
  { id: 4, name: "VALIDATE", label: "Quality Check", icon: ShieldCheck },
];

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
  { id: "extracting", label: "Extracting", icon: <Zap className="h-4 w-4" /> },
  { id: "preview", label: "Review", icon: <Eye className="h-4 w-4" /> },
  { id: "confirm", label: "Confirm", icon: <Check className="h-4 w-4" /> },
];

export function RosterUploadWizardV2({
  venueId,
  venueName,
  open,
  onOpenChange,
  onSuccess,
}: RosterUploadWizardV2Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [extraction, setExtraction] = useState<RosterExtractionResult | null>(null);
  const [venueStaff, setVenueStaff] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [weekStart, setWeekStart] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  );
  const [includedShiftIds, setIncludedShiftIds] = useState<Set<string>>(new Set());

  // V2 specific state
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [extractionStartTime, setExtractionStartTime] = useState<number | null>(null);

  // Version handling state
  const [showVersionPrompt, setShowVersionPrompt] = useState(false);
  const [existingRoster, setExistingRoster] = useState<{
    id: string;
    name: string;
    versionNumber: number;
    status: RosterStatus;
    shiftCount: number;
    createdAt: Date;
    createdByName: string | null;
    chainId: string | null;
  } | null>(null);
  const [nextVersionNumber, setNextVersionNumber] = useState<number>(1);
  const [createAsNewVersion, setCreateAsNewVersion] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  // Track elapsed time during extraction
  useEffect(() => {
    if (currentStep === "extracting" && isLoading) {
      setExtractionStartTime(Date.now());
      setElapsedTime(0);
      
      const timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setExtractionStartTime(null);
      setElapsedTime(0);
    }
  }, [currentStep, isLoading]);

  // Simulate phase progress during extraction (slower, more realistic)
  useEffect(() => {
    if (currentStep === "extracting" && isLoading) {
      // Each phase takes roughly 60-90 seconds, so we simulate progress slowly
      const interval = setInterval(() => {
        setPhaseProgress((prev) => {
          if (prev >= 100) {
            setCurrentPhase((p) => Math.min(p + 1, 4));
            return 0;
          }
          // Add 1-2% progress every 2 seconds to simulate ~100 seconds per phase
          return prev + 1;
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [currentStep, isLoading]);

  // Load venue staff when entering preview step
  const loadVenueStaff = useCallback(async () => {
    const result = await getMatchableStaffV2(venueId);
    if (result.success) {
      setVenueStaff(result.staff);
    }
  }, [venueId]);

  // Handle file upload and extraction
  const handleFileSelect = useCallback(
    async (file: File, fileType: "excel" | "csv" | "image") => {
      setIsLoading(true);
      setCurrentStep("extracting");
      setCurrentPhase(1);
      setPhaseProgress(0);
      setElapsedTime(0);
      setExtractionStartTime(Date.now());

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("venueId", venueId);

        const result = await uploadAndExtractRosterV2(formData);

        if (result.success && result.isV2) {
          setExtraction(result.extraction);
          setIncludedShiftIds(new Set(result.extraction.shifts.map((s) => s.id)));
          await loadVenueStaff();
          setCurrentStep("preview");
          
          // Show extraction summary
          const metadata = result.extraction.metadata;
          if (metadata) {
            const timeSeconds = Math.round(metadata.processingTimeMs / 1000);
            toast.success(
              `Extracted ${result.extraction.shifts.length} shifts in ${timeSeconds}s`
            );
          } else {
            toast.success("File extracted successfully");
          }
        } else if (!result.success) {
          toast.error(result.error || "Failed to extract roster");
          setCurrentStep("upload");
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload file");
        setCurrentStep("upload");
      } finally {
        setIsLoading(false);
        setCurrentPhase(0);
        setPhaseProgress(0);
        setExtractionStartTime(null);
      }
    },
    [venueId, loadVenueStaff]
  );

  // Handle manual staff matching
  const handleStaffMatch = useCallback(
    async (extractedName: string, userId: string) => {
      if (!extraction) return;

      setIsLoading(true);
      try {
        const result = await manualStaffMatchV2(extraction.id, extractedName, userId);

        if (result.success) {
          setExtraction(result.extraction);
          toast.success("Staff member matched");
        } else {
          toast.error(result.error || "Failed to match staff member");
        }
      } catch (error) {
        toast.error("Failed to match staff member");
      } finally {
        setIsLoading(false);
      }
    },
    [extraction]
  );

  // Handle shift toggle
  const handleShiftToggle = useCallback((shiftId: string, included: boolean) => {
    setIncludedShiftIds((prev) => {
      const next = new Set(prev);
      if (included) {
        next.add(shiftId);
      } else {
        next.delete(shiftId);
      }
      return next;
    });
  }, []);

  // Handle confirmation and roster creation
  const handleConfirm = useCallback(async () => {
    if (!extraction) return;

    setIsLoading(true);
    try {
      // Get included shifts
      const includedShifts = extraction.shifts.filter((shift) =>
        includedShiftIds.has(shift.id)
      );

      // Separate matched and unmatched
      const matchedShifts = includedShifts.filter((shift) => shift.matchedUserId);
      const unmatchedShifts = includedShifts.filter((shift) => !shift.matchedUserId);

      // Group unmatched by staff name
      const unmatchedByStaff = new Map<
        string,
        { name: string; email: string | null; shifts: typeof unmatchedShifts }
      >();

      for (const shift of unmatchedShifts) {
        const key = shift.staffName?.toLowerCase() || "unknown";
        if (!unmatchedByStaff.has(key)) {
          unmatchedByStaff.set(key, {
            name: shift.staffName || "Unknown",
            email: shift.staffEmail,
            shifts: [],
          });
        }
        unmatchedByStaff.get(key)!.shifts.push(shift);
      }

      const result = await confirmExtractionAndCreateRosterV2({
        extractionId: extraction.id,
        venueId,
        weekStart,
        shifts: matchedShifts.map((shift) => ({
          staffName: shift.staffName || "",
          staffEmail: shift.staffEmail || undefined,
          matchedUserId: shift.matchedUserId || undefined,
          date: shift.date || "",
          startTime: shift.startTime || "",
          endTime: shift.endTime || "",
          position: shift.position || undefined,
          notes: shift.notes || undefined,
        })),
        unmatchedStaff: Array.from(unmatchedByStaff.values()).map((staff) => ({
          name: staff.name,
          email: staff.email || undefined,
          shifts: staff.shifts.map((shift) => ({
            date: shift.date || "",
            startTime: shift.startTime || "",
            endTime: shift.endTime || "",
            position: shift.position || undefined,
          })),
        })),
        // Version creation options
        createAsNewVersion,
        existingRosterId: existingRoster?.id,
        chainId: existingRoster?.chainId || undefined,
        versionNumber: createAsNewVersion ? nextVersionNumber : undefined,
      });

      if (result.success) {
        toast.success("Roster created successfully!");
        onOpenChange(false);
        onSuccess?.(result.rosterId);
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
  }, [extraction, includedShiftIds, venueId, weekStart, onOpenChange, onSuccess, router, createAsNewVersion, existingRoster, nextVersionNumber]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (extraction) {
      await cancelExtractionV2(extraction.id);
    }
    setExtraction(null);
    setCurrentStep("upload");
    setCurrentPhase(0);
    setPhaseProgress(0);
    setElapsedTime(0);
    setExtractionStartTime(null);
    onOpenChange(false);
  }, [extraction, onOpenChange]);

  // Navigation
  const canGoBack = currentStepIndex > 0 && currentStep !== "extracting";
  const canGoNext = currentStepIndex < STEPS.length - 1;

  const handleBack = () => {
    if (canGoBack) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  };

  const handleNext = async () => {
    if (!canGoNext) return;

    const nextStep = STEPS[currentStepIndex + 1].id;

    // Check for duplicates when entering confirm step
    if (nextStep === "confirm") {
      setIsLoading(true);
      try {
        const duplicateCheck = await checkForDuplicateRoster(venueId, weekStart);

        if (duplicateCheck.success && duplicateCheck.hasDuplicate) {
          setExistingRoster(duplicateCheck.existingRoster as typeof existingRoster);
          setNextVersionNumber(duplicateCheck.nextVersionNumber);
          setShowVersionPrompt(true);
          setIsLoading(false);
          return;
        }

        // No duplicate, proceed to confirm
        setCreateAsNewVersion(false);
        setExistingRoster(null);
      } catch (error) {
        console.error("Error checking for duplicate:", error);
        toast.error("Failed to check for existing roster");
      } finally {
        setIsLoading(false);
      }
    }

    setCurrentStep(nextStep);
  };

  // Handle version prompt response
  const handleCreateAsNewVersion = () => {
    setCreateAsNewVersion(true);
    setShowVersionPrompt(false);
    setCurrentStep("confirm");
  };

  const handleCancelVersionPrompt = () => {
    setShowVersionPrompt(false);
  };

  // Calculate summary stats
  const includedShiftsCount = includedShiftIds.size;
  const matchedShiftsCount = extraction?.shifts.filter(
    (s) => includedShiftIds.has(s.id) && s.matchedUserId
  ).length || 0;

  // Get V2 metadata
  const metadata = extraction?.metadata;

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Roster (V2) - {venueName}
            <Badge variant="secondary" className="ml-2">Multi-Phase Extraction</Badge>
          </DialogTitle>
          <DialogDescription>
            Upload an image file to extract roster data using our enhanced multi-phase AI extraction
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between py-4 border-b">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center",
                index < STEPS.length - 1 && "flex-1"
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
                  step.icon
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {index < STEPS.length - 1 && (
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
                <Info className="h-4 w-4" />
                <AlertTitle>V2 Multi-Phase Extraction</AlertTitle>
                <AlertDescription>
                  This version uses a 4-phase extraction process for better accuracy:
                  <ol className="mt-2 space-y-1 list-decimal list-inside text-sm">
                    <li><strong>SEE</strong> - Analyzes roster structure</li>
                    <li><strong>THINK</strong> - Parses complex cells</li>
                    <li><strong>EXTRACT</strong> - Creates shift records</li>
                    <li><strong>VALIDATE</strong> - Quality checks results</li>
                  </ol>
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
              
              {/* Phase Progress */}
              <div className="w-full max-w-md space-y-4">
                <div className="text-center">
                  <p className="text-lg font-medium">Extracting roster data...</p>
                  <p className="text-sm text-muted-foreground">
                    Phase {currentPhase} of 4: {EXTRACTION_PHASES[currentPhase - 1]?.label || "Starting..."}
                  </p>
                  {elapsedTime > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Elapsed: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                    </p>
                  )}
                </div>

                {/* Phase Indicators */}
                <div className="flex justify-between">
                  {EXTRACTION_PHASES.map((phase) => {
                    const PhaseIcon = phase.icon;
                    const isActive = currentPhase === phase.id;
                    const isComplete = currentPhase > phase.id;
                    
                    return (
                      <div
                        key={phase.id}
                        className={cn(
                          "flex flex-col items-center gap-1",
                          isActive && "text-primary",
                          isComplete && "text-green-600"
                        )}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border-2",
                            isActive && "border-primary bg-primary/10",
                            isComplete && "border-green-600 bg-green-100"
                          )}
                        >
                          {isComplete ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <PhaseIcon className="h-5 w-5" />
                          )}
                        </div>
                        <span className="text-xs font-medium">{phase.name}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Bar */}
                <Progress value={phaseProgress} className="h-2" />
              </div>

              <div className="text-center max-w-md space-y-2">
                <p className="text-sm text-muted-foreground">
                  This typically takes 3-6 minutes. The AI is analyzing the roster structure
                  and extracting all shifts, including those in congested cells.
                </p>
                {elapsedTime > 120 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Still processing... Large or complex rosters may take longer.
                  </p>
                )}
              </div>
            </div>
          )}

          {currentStep === "preview" && extraction && (
            <div className="space-y-4">
              {/* V2 Metadata Summary */}
              {metadata && (
                <Collapsible open={showValidationDetails} onOpenChange={setShowValidationDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Info className="h-4 w-4 mr-2" />
                      Extraction Details ({metadata.phasesCompleted} phases, {metadata.processingTimeMs}ms)
                      <ChevronRight className={cn(
                        "h-4 w-4 ml-auto transition-transform",
                        showValidationDetails && "rotate-90"
                      )} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="rounded-lg border p-4 space-y-3">
                      {/* Structure Info */}
                      <div>
                        <h5 className="font-medium text-sm">Structure Analysis</h5>
                        <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                          <div>
                            <span className="text-muted-foreground">Type:</span>{" "}
                            <span className="font-medium">{metadata.structure.type}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Columns:</span>{" "}
                            <span className="font-medium">{metadata.structure.columns.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Staff Rows:</span>{" "}
                            <span className="font-medium">{metadata.structure.staffRows.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Complex Cells:</span>{" "}
                            <span className="font-medium">{metadata.structure.complexCells.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* Validation Results */}
                      <div>
                        <h5 className="font-medium text-sm">Validation Results</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant={
                              metadata.validation.extractionQuality === "excellent" ? "default" :
                              metadata.validation.extractionQuality === "good" ? "secondary" :
                              "destructive"
                            }
                          >
                            {metadata.validation.extractionQuality}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {metadata.validation.overallConfidence}% confidence
                          </span>
                        </div>

                        {/* Anomalies */}
                        {metadata.validation.anomalies.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {metadata.validation.anomalies.map((anomaly, idx) => (
                              <Alert
                                key={idx}
                                variant={anomaly.severity === "error" ? "destructive" : "default"}
                                className="py-2"
                              >
                                <AlertTriangle className="h-4 w-4" />
                                <AlertDescription className="text-xs">
                                  <strong>{anomaly.staff}:</strong> {anomaly.details}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Recommendations */}
                      {metadata.validation.recommendations.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm">Recommendations</h5>
                          <ul className="text-sm text-muted-foreground list-disc list-inside mt-1">
                            {metadata.validation.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <ExtractionMatrixPreview
                extraction={extraction}
                venueStaff={venueStaff}
                weekStart={weekStart}
                onStaffMatch={handleStaffMatch}
                onShiftToggle={handleShiftToggle}
                includedShiftIds={includedShiftIds}
              />
            </div>
          )}

          {currentStep === "confirm" && extraction && (
            <div className="space-y-6">
              {/* Version Indicator */}
              {createAsNewVersion && (
                <VersionIndicator
                  isNewVersion={true}
                  versionNumber={nextVersionNumber}
                  parentVersionNumber={existingRoster?.versionNumber}
                />
              )}

              {/* Week Selection */}
              <div className="space-y-2">
                <Label>Roster Week Start</Label>
                <Input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  disabled={createAsNewVersion}
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
                    <p className="font-medium">
                      {includedShiftsCount - matchedShiftsCount} entries
                    </p>
                  </div>
                </div>

                {metadata && (
                  <div className="text-xs text-blue-700 bg-blue-50 rounded p-2">
                    <strong>V2 Extraction:</strong> {metadata.phasesCompleted} phases completed in {metadata.processingTimeMs}ms
                  </div>
                )}

                {includedShiftsCount - matchedShiftsCount > 0 && (
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
              {canGoBack && currentStep !== "upload" && (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isLoading}
                >
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

      {/* Version Prompt Dialog */}
      {existingRoster && (
        <VersionPromptDialog
          open={showVersionPrompt}
          onOpenChange={setShowVersionPrompt}
          existingRoster={existingRoster}
          weekStart={new Date(weekStart)}
          nextVersionNumber={nextVersionNumber}
          onCreateNewVersion={handleCreateAsNewVersion}
          onCancel={handleCancelVersionPrompt}
          isLoading={isLoading}
        />
      )}
    </Dialog>
  );
}