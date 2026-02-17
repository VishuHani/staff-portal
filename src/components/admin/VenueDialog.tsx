"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  createVenueSchema,
  updateVenueSchema,
  type CreateVenueInput,
  type UpdateVenueInput,
} from "@/lib/schemas/admin/venues";
import { createVenue, updateVenue } from "@/lib/actions/admin/venues";

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  operatingDays?: number[] | unknown;
  _count?: {
    userVenues: number;
  };
}

interface VenueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: Venue | null;
  onSuccess?: () => void;
}

// Use a broader type that works for both create and update
type FormData = {
  venueId?: string;
  name: string;
  code: string;
  active?: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  operatingDays?: number[];
};

/**
 * VenueDialog Component
 *
 * Dialog for creating or editing venues.
 * Handles form validation, submission, and error handling.
 *
 * @example
 * ```tsx
 * <VenueDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   venue={selectedVenue}
 *   onSuccess={() => router.refresh()}
 * />
 * ```
 */
export function VenueDialog({
  open,
  onOpenChange,
  venue,
  onSuccess,
}: VenueDialogProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = Boolean(venue);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(isEditing ? updateVenueSchema : createVenueSchema) as any,
    defaultValues: venue
      ? {
          venueId: venue.id,
          name: venue.name,
          code: venue.code,
          active: venue.active,
          businessHoursStart: venue.businessHoursStart || "08:00",
          businessHoursEnd: venue.businessHoursEnd || "22:00",
          operatingDays: (Array.isArray(venue.operatingDays) ? venue.operatingDays : [1, 2, 3, 4, 5]) as number[],
        }
      : {
          name: "",
          code: "",
          active: true,
          businessHoursStart: "08:00",
          businessHoursEnd: "22:00",
          operatingDays: [1, 2, 3, 4, 5],
        },
  });

  // Reset form when venue changes or dialog opens
  useEffect(() => {
    if (open) {
      if (venue) {
        // Editing existing venue - populate form
        reset({
          venueId: venue.id,
          name: venue.name,
          code: venue.code,
          active: venue.active,
          businessHoursStart: venue.businessHoursStart || "08:00",
          businessHoursEnd: venue.businessHoursEnd || "22:00",
          operatingDays: (Array.isArray(venue.operatingDays) ? venue.operatingDays : [1, 2, 3, 4, 5]) as number[],
        });
      } else {
        // Creating new venue - clear form
        reset({
          name: "",
          code: "",
          active: true,
          businessHoursStart: "08:00",
          businessHoursEnd: "22:00",
          operatingDays: [1, 2, 3, 4, 5],
        });
      }
    }
  }, [open, venue, reset]);

  const activeValue = watch("active");
  const operatingDaysValue = watch("operatingDays") || [];

  const onSubmit = async (data: FormData) => {
    setLoading(true);

    try {
      let result;

      if (isEditing && venue) {
        // Update existing venue
        result = await updateVenue({
          venueId: venue.id,
          ...data,
        } as UpdateVenueInput);
      } else {
        // Create new venue
        result = await createVenue(data as CreateVenueInput);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isEditing ? "Venue updated successfully!" : "Venue created successfully!"
        );
        reset();
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error("Error submitting venue:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isEditing ? "Edit Venue" : "Create New Venue"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the venue information below."
              : "Add a new venue to the system. Venue code must be unique."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Venue Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Venue Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Main Office"
              {...register("name")}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Venue Code */}
          <div className="space-y-2">
            <Label htmlFor="code">
              Venue Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="code"
              placeholder="MAIN-OFFICE"
              {...register("code")}
              disabled={loading}
              onChange={(e) => {
                // Auto-uppercase and validate format
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                setValue("code", value, { shouldDirty: true });
              }}
            />
            <p className="text-xs text-gray-500">
              Uppercase letters, numbers, hyphens, and underscores only
            </p>
            {errors.code && (
              <p className="text-sm text-red-600">{errors.code.message}</p>
            )}
          </div>

          {/* Business Hours */}
          <div className="space-y-3 rounded-lg border p-4">
            <Label className="text-base">Business Hours</Label>
            <p className="text-xs text-gray-500">
              Define when this venue operates. Availability can only be set within these hours.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessHoursStart">Opening Time</Label>
                <Input
                  id="businessHoursStart"
                  type="time"
                  {...register("businessHoursStart")}
                  disabled={loading}
                />
                {errors.businessHoursStart && (
                  <p className="text-sm text-red-600">{errors.businessHoursStart.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessHoursEnd">Closing Time</Label>
                <Input
                  id="businessHoursEnd"
                  type="time"
                  {...register("businessHoursEnd")}
                  disabled={loading}
                />
                {errors.businessHoursEnd && (
                  <p className="text-sm text-red-600">{errors.businessHoursEnd.message}</p>
                )}
              </div>
            </div>

            {/* Operating Days */}
            <div className="space-y-2">
              <Label>Operating Days</Label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  { label: "Sun", value: 0 },
                  { label: "Mon", value: 1 },
                  { label: "Tue", value: 2 },
                  { label: "Wed", value: 3 },
                  { label: "Thu", value: 4 },
                  { label: "Fri", value: 5 },
                  { label: "Sat", value: 6 },
                ].map((day) => (
                  <div key={day.value} className="flex flex-col items-center space-y-1">
                    <Label htmlFor={`day-${day.value}`} className="text-xs cursor-pointer">
                      {day.label}
                    </Label>
                    <Checkbox
                      id={`day-${day.value}`}
                      checked={operatingDaysValue.includes(day.value)}
                      onCheckedChange={(checked) => {
                        const current = operatingDaysValue;
                        if (checked) {
                          setValue("operatingDays", [...current, day.value].sort(), { shouldDirty: true });
                        } else {
                          setValue("operatingDays", current.filter((d: number) => d !== day.value), { shouldDirty: true });
                        }
                      }}
                      disabled={loading}
                    />
                  </div>
                ))}
              </div>
              {errors.operatingDays && (
                <p className="text-sm text-red-600">{errors.operatingDays.message}</p>
              )}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="active" className="text-base">
                Active Status
              </Label>
              <p className="text-sm text-gray-500">
                {activeValue
                  ? "Venue is active and visible to users"
                  : "Venue is inactive and hidden from users"}
              </p>
            </div>
            <Switch
              id="active"
              checked={activeValue}
              onCheckedChange={(checked) => setValue("active", checked, { shouldDirty: true })}
              disabled={loading}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || (!isDirty && isEditing)}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Venue" : "Create Venue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
