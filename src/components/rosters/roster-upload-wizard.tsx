"use client";

/**
 * Roster Upload Wizard Component
 * Multi-step wizard for uploading, extracting, and confirming roster data
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Settings,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FileUploadZone } from "./file-upload-zone";
import { ColumnMapper } from "./column-mapper";
import { ExtractionMatrixPreview } from "./extraction-matrix-preview";
import { VersionPromptDialog, VersionIndicator } from "./version-prompt-dialog";
import {
  uploadAndExtractRoster,
  updateColumnMappings,
  confirmExtractionAndCreateRoster,
  cancelExtraction,
  manualStaffMatch,
  getMatchableStaff,
  checkForDuplicateRoster,
} from "@/lib/actions/rosters";
import type {
  RosterExtractionResult,
  ColumnMapping,
  RosterFileSource,
} from "@/lib/schemas/rosters/extraction";
import { RosterStatus } from "@prisma/client";
import { format, startOfWeek, addDays } from "date-fns";

interface RosterUploadWizardProps {
  venueId: string;
  venueName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (rosterId: string) => void;
}

type WizardStep = "upload" | "mapping" | "preview" | "confirm";

const STEPS: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
  { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
  { id: "mapping", label: "Map Columns", icon: <Settings className="h-4 w-4" /> },
  { id: "preview", label: "Review", icon: <Eye className="h-4 w-4" /> },
  { id: "confirm", label: "Confirm", icon: <Check className="h-4 w-4" /> },
];

export function RosterUploadWizard({
  venueId,
  venueName,
  open,
  onOpenChange,
  onSuccess,
}: RosterUploadWizardProps) {
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

  // Load venue staff when entering preview step
  const loadVenueStaff = useCallback(async () => {
    const result = await getMatchableStaff(venueId);
    if (result.success) {
      setVenueStaff(result.staff);
    }
  }, [venueId]);

  // Handle file upload and extraction
  const handleFileSelect = useCallback(
    async (file: File, fileType: RosterFileSource) => {
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("venueId", venueId);

        const result = await uploadAndExtractRoster(formData);

        if (result.success) {
          setExtraction(result.extraction);
          setIncludedShiftIds(new Set(result.extraction.shifts.map((s) => s.id)));
          await loadVenueStaff();
          setCurrentStep("mapping");
          toast.success("File extracted successfully");
        } else {
          toast.error(result.error || "Failed to extract roster");
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error("Failed to upload file");
      } finally {
        setIsLoading(false);
      }
    },
    [venueId, loadVenueStaff]
  );

  // Handle column mapping changes
  const handleMappingsChange = useCallback(
    async (mappings: ColumnMapping[]) => {
      if (!extraction) return;

      const result = await updateColumnMappings({
        extractionId: extraction.id,
        mappings,
      });

      if (result.success) {
        setExtraction(result.extraction);
      }
    },
    [extraction]
  );

  // Handle manual staff matching
  const handleStaffMatch = useCallback(
    async (extractedName: string, userId: string) => {
      if (!extraction) return;

      setIsLoading(true);
      try {
        const result = await manualStaffMatch(extraction.id, extractedName, userId);

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

      const result = await confirmExtractionAndCreateRoster({
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
  }, [extraction, includedShiftIds, venueId, weekStart, onOpenChange, onSuccess, router]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (extraction) {
      await cancelExtraction(extraction.id);
    }
    setExtraction(null);
    setCurrentStep("upload");
    onOpenChange(false);
  }, [extraction, onOpenChange]);

  // Navigation
  const canGoBack = currentStepIndex > 0;
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

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Roster - {venueName}
          </DialogTitle>
          <DialogDescription>
            Upload an Excel, CSV, or image file to automatically extract roster data
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
              <FileUploadZone
                onFileSelect={handleFileSelect}
                isUploading={isLoading}
                disabled={isLoading}
              />
            </div>
          )}

          {currentStep === "mapping" && extraction && (
            <ColumnMapper
              mappings={extraction.detectedColumns}
              onChange={handleMappingsChange}
            />
          )}

          {currentStep === "preview" && extraction && (
            <ExtractionMatrixPreview
              extraction={extraction}
              venueStaff={venueStaff}
              weekStart={weekStart}
              onStaffMatch={handleStaffMatch}
              onShiftToggle={handleShiftToggle}
              includedShiftIds={includedShiftIds}
            />
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

                {includedShiftsCount - matchedShiftsCount > 0 && (
                  <div className="text-xs text-yellow-700 bg-yellow-50 rounded p-2">
                    Note: Unmatched entries will be saved for review but won&apos;t appear
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

              {currentStep !== "confirm" && currentStep !== "upload" && (
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
