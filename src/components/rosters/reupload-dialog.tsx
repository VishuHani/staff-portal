"use client";

/**
 * Reupload Dialog Component
 * Handles re-uploading a roster file and merging with existing shifts
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  uploadAndExtractRoster,
  previewMerge,
  applyMerge,
  type ShiftSnapshot,
  type MergePreview,
} from "@/lib/actions/rosters";
import { FileUploadZone } from "./file-upload-zone";
import { MergePreviewView } from "./merge-preview";
import type { RosterFileType } from "@/lib/storage/rosters.shared";

interface ReuploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rosterId: string;
  venueId: string;
  onSuccess?: () => void;
}

type Step = "upload" | "extracting" | "preview" | "applying";

export function ReuploadDialog({
  open,
  onOpenChange,
  rosterId,
  venueId,
  onSuccess,
}: ReuploadDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Merge options
  const [addNewShifts, setAddNewShifts] = useState(true);
  const [removeOldShifts, setRemoveOldShifts] = useState(false);
  const [updateExistingShifts, setUpdateExistingShifts] = useState(true);

  const handleFileSelect = async (selectedFile: File, _fileType: RosterFileType) => {
    setFile(selectedFile);
    setError(null);
    await handleExtract(selectedFile);
  };

  const handleExtract = async (fileToExtract: File) => {
    setStep("extracting");
    setError(null);

    try {
      // Create FormData and upload
      const formData = new FormData();
      formData.append("file", fileToExtract);
      formData.append("venueId", venueId);

      const extractResult = await uploadAndExtractRoster(formData);

      if (!extractResult.success) {
        throw new Error("error" in extractResult ? extractResult.error : "Extraction failed");
      }

      const extraction = extractResult.extraction;

      // Create a map of staff matches for quick lookup
      const staffMatchMap = new Map<string, { userId: string | null; userName: string | null }>();
      for (const match of extraction.staffMatches) {
        const key = `${match.extractedName || ""}-${match.extractedEmail || ""}`;
        staffMatchMap.set(key, {
          userId: match.matchedUserId,
          userName: match.matchedUserName || match.extractedName,
        });
      }

      // Convert extracted shifts to ShiftSnapshot format
      const shifts: ShiftSnapshot[] = extraction.shifts
        .filter((shift) => shift.date && shift.startTime && shift.endTime)
        .map((shift) => {
          const key = `${shift.staffName || ""}-${shift.staffEmail || ""}`;
          const matchedStaff = staffMatchMap.get(key);

          return {
            id: crypto.randomUUID(), // Temporary ID
            userId: shift.staffId || matchedStaff?.userId || null,
            userName: matchedStaff?.userName || shift.staffName || null,
            date: shift.date!,
            startTime: shift.startTime!,
            endTime: shift.endTime!,
            position: shift.position || null,
            notes: shift.notes || null,
          };
        });

      // Get merge preview
      const previewResult = await previewMerge(rosterId, shifts);

      if (!previewResult.success || !previewResult.preview) {
        throw new Error(previewResult.error || "Failed to preview merge");
      }

      setMergePreview(previewResult.preview);
      setStep("preview");
    } catch (err) {
      console.error("Extraction error:", err);
      setError(err instanceof Error ? err.message : "Failed to extract roster");
      setStep("upload");
    }
  };

  const handleApplyMerge = async () => {
    if (!mergePreview) return;

    setStep("applying");
    setError(null);

    try {
      const result = await applyMerge(rosterId, {
        addShifts: addNewShifts,
        removeShifts: removeOldShifts,
        updateShifts: updateExistingShifts,
        shiftsToAdd: addNewShifts ? mergePreview.toAdd : undefined,
        shiftsToRemove: removeOldShifts
          ? mergePreview.toRemove.map((s) => s.id)
          : undefined,
        shiftsToUpdate: updateExistingShifts
          ? mergePreview.toUpdate.map((u) => ({
              id: u.existing.id,
              updates: u.incoming,
            }))
          : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Merge failed");
      }

      toast.success("Roster merged successfully");
      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error("Merge error:", err);
      setError(err instanceof Error ? err.message : "Failed to merge roster");
      setStep("preview");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setMergePreview(null);
    setError(null);
    setAddNewShifts(true);
    setRemoveOldShifts(false);
    setUpdateExistingShifts(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-upload Roster</DialogTitle>
          <DialogDescription>
            Upload an updated roster file to merge with existing shifts
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step: Upload */}
        {step === "upload" && (
          <FileUploadZone
            onFileSelect={handleFileSelect}
            disabled={false}
          />
        )}

        {/* Step: Extracting */}
        {step === "extracting" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-medium">Extracting roster data...</p>
            <p className="text-sm text-muted-foreground">
              This may take a moment
            </p>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && mergePreview && (
          <div className="space-y-4">
            <MergePreviewView preview={mergePreview} />

            {/* Merge Options */}
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <h4 className="font-medium">Merge Options</h4>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="add-new">Add new shifts</Label>
                  <p className="text-xs text-muted-foreground">
                    {mergePreview.summary.addCount} shifts to add
                  </p>
                </div>
                <Switch
                  id="add-new"
                  checked={addNewShifts}
                  onCheckedChange={setAddNewShifts}
                  disabled={mergePreview.summary.addCount === 0}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="remove-old">Remove old shifts</Label>
                  <p className="text-xs text-muted-foreground">
                    {mergePreview.summary.removeCount} shifts not in new file
                  </p>
                </div>
                <Switch
                  id="remove-old"
                  checked={removeOldShifts}
                  onCheckedChange={setRemoveOldShifts}
                  disabled={mergePreview.summary.removeCount === 0}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="update-existing">Update existing shifts</Label>
                  <p className="text-xs text-muted-foreground">
                    {mergePreview.summary.updateCount} shifts with changes
                  </p>
                </div>
                <Switch
                  id="update-existing"
                  checked={updateExistingShifts}
                  onCheckedChange={setUpdateExistingShifts}
                  disabled={mergePreview.summary.updateCount === 0}
                />
              </div>
            </div>

            {mergePreview.summary.conflictCount > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {mergePreview.summary.conflictCount} conflicts detected.
                  These will need to be resolved manually after merge.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step: Applying */}
        {step === "applying" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-medium">Applying changes...</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>

          {step === "preview" && (
            <Button
              onClick={handleApplyMerge}
              disabled={
                !addNewShifts &&
                !removeOldShifts &&
                !updateExistingShifts
              }
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Apply Merge
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
