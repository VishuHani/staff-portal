"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VenueSelector } from "@/components/admin/venue-selector";
import { createUser, updateUser } from "@/lib/actions/admin/users";
import { createUserSchema, updateUserSchema } from "@/lib/schemas/admin/users";
import { toast } from "sonner";
import type { z } from "zod";

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  active: boolean;
  weekdayRate?: number | null;
  saturdayRate?: number | null;
  sundayRate?: number | null;
  role: {
    id: string;
    name: string;
  };
  store: {
    id: string;
    name: string;
  } | null;
  venues?: Array<{
    venue: {
      id: string;
      name: string;
      code: string;
      active: boolean;
    };
    isPrimary: boolean;
  }>;
}

interface Role {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: Role[];
  stores: Store[];
  venues: Venue[];
}

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  roleId: string;
  storeId?: string;
  venueIds: string[];
  primaryVenueId?: string;
  active: boolean;
  weekdayRate?: number | null;
  saturdayRate?: number | null;
  sundayRate?: number | null;
};

export function UserDialog({
  open,
  onOpenChange,
  user,
  roles,
  stores,
  venues,
}: UserDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([]);
  const [primaryVenueId, setPrimaryVenueId] = useState<string | undefined>();
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: user
      ? {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email,
          phone: user.phone || "",
          roleId: user.role.id,
          storeId: user.store?.id || undefined,
          venueIds: user.venues?.map((v) => v.venue.id) || [],
          primaryVenueId: user.venues?.find((v) => v.isPrimary)?.venue.id,
          active: user.active,
          weekdayRate: user.weekdayRate ?? null,
          saturdayRate: user.saturdayRate ?? null,
          sundayRate: user.sundayRate ?? null,
        }
      : {
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          password: "",
          roleId: "",
          storeId: undefined,
          venueIds: [],
          primaryVenueId: undefined,
          active: true,
          weekdayRate: null,
          saturdayRate: null,
          sundayRate: null,
        },
  });

  // Watch form values
  const roleId = watch("roleId");
  const storeId = watch("storeId");
  const active = watch("active");

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (user) {
        const userVenueIds = user.venues?.map((v) => v.venue.id) || [];
        const userPrimaryVenueId = user.venues?.find((v) => v.isPrimary)?.venue.id;

        reset({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email,
          phone: user.phone || "",
          roleId: user.role.id,
          storeId: user.store?.id || undefined,
          venueIds: userVenueIds,
          primaryVenueId: userPrimaryVenueId,
          active: user.active,
          weekdayRate: user.weekdayRate ?? null,
          saturdayRate: user.saturdayRate ?? null,
          sundayRate: user.sundayRate ?? null,
        });

        setSelectedVenueIds(userVenueIds);
        setPrimaryVenueId(userPrimaryVenueId);
      } else {
        reset({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          password: "",
          roleId: "",
          storeId: undefined,
          venueIds: [],
          primaryVenueId: undefined,
          active: true,
          weekdayRate: null,
          saturdayRate: null,
          sundayRate: null,
        });

        setSelectedVenueIds([]);
        setPrimaryVenueId(undefined);
      }
    }
  }, [open, user, reset]);

  const handleVenueSelectionChange = (venueIds: string[], primary?: string) => {
    setSelectedVenueIds(venueIds);
    setPrimaryVenueId(primary);
    setValue("venueIds", venueIds);
    setValue("primaryVenueId", primary);
  };

  const onSubmit = async (data: FormData) => {
    // Validate venue selection
    if (selectedVenueIds.length === 0) {
      toast.error("Please select at least one venue");
      return;
    }

    setSubmitting(true);

    let result;
    if (isEditing && user) {
      result = await updateUser({
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        roleId: data.roleId,
        venueIds: selectedVenueIds,
        primaryVenueId: primaryVenueId,
        active: data.active,
        weekdayRate: data.weekdayRate,
        saturdayRate: data.saturdayRate,
        sundayRate: data.sundayRate,
      });
    } else {
      if (!data.password) {
        toast.error("Password is required");
        setSubmitting(false);
        return;
      }
      result = await createUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        password: data.password,
        roleId: data.roleId,
        venueIds: selectedVenueIds,
        primaryVenueId: primaryVenueId,
        active: data.active,
      });
    }

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        isEditing ? "User updated successfully" : "User created successfully"
      );
      onOpenChange(false);
      // Refresh the page
      window.location.reload();
    }

    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit User" : "Create User"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update user information and permissions"
                : "Add a new user to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* First Name */}
            <div className="grid gap-2">
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                placeholder="John"
                {...register("firstName")}
                disabled={submitting}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                placeholder="Doe"
                {...register("lastName")}
                disabled={submitting}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                {...register("email")}
                disabled={submitting}
              />
              {errors.email && (
                <p className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register("phone")}
                disabled={submitting}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* Password (only for create) */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  {...register("password")}
                  disabled={submitting}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>
            )}

            {/* Role */}
            <div className="grid gap-2">
              <Label htmlFor="roleId">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={roleId}
                onValueChange={(value) => setValue("roleId", value)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId && (
                <p className="text-sm text-destructive">
                  {errors.roleId.message}
                </p>
              )}
            </div>

            {/* Venues */}
            <div className="grid gap-2">
              <Label>
                Venues <span className="text-destructive">*</span>
              </Label>
              <VenueSelector
                venues={venues}
                selectedVenueIds={selectedVenueIds}
                primaryVenueId={primaryVenueId}
                onSelectionChange={handleVenueSelectionChange}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Select at least one venue. Choose a primary venue if multiple are selected.
              </p>
            </div>

            {/* Store (optional, legacy) */}
            <div className="grid gap-2">
              <Label htmlFor="storeId">Store (Optional - Legacy)</Label>
              <Select
                value={storeId || "none"}
                onValueChange={(value) =>
                  setValue("storeId", value === "none" ? undefined : value)
                }
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Store</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kept for backward compatibility. Use venues instead.
              </p>
            </div>

            {/* Pay Rates (only for editing) */}
            {isEditing && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">
                  Hourly Pay Rates ($/hour)
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="weekdayRate" className="text-xs text-muted-foreground">
                      Weekday
                    </Label>
                    <Input
                      id="weekdayRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1000"
                      placeholder="0.00"
                      {...register("weekdayRate", {
                        setValueAs: (v) => (v === "" || v === null ? null : parseFloat(v)),
                      })}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="saturdayRate" className="text-xs text-muted-foreground">
                      Saturday
                    </Label>
                    <Input
                      id="saturdayRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1000"
                      placeholder="0.00"
                      {...register("saturdayRate", {
                        setValueAs: (v) => (v === "" || v === null ? null : parseFloat(v)),
                      })}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sundayRate" className="text-xs text-muted-foreground">
                      Sunday
                    </Label>
                    <Input
                      id="sundayRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1000"
                      placeholder="0.00"
                      {...register("sundayRate", {
                        setValueAs: (v) => (v === "" || v === null ? null : parseFloat(v)),
                      })}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty if not applicable. Used for roster pay calculations.
                </p>
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive users cannot log in
                </p>
              </div>
              <Switch
                id="active"
                checked={active}
                onCheckedChange={(checked) => setValue("active", checked)}
                disabled={submitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Creating..."}
                </>
              ) : isEditing ? (
                "Update User"
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
