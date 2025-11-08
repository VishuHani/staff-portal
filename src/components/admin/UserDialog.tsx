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
import { createUser, updateUser } from "@/lib/actions/admin/users";
import { createUserSchema, updateUserSchema } from "@/lib/schemas/admin/users";
import { toast } from "sonner";
import type { z } from "zod";

interface User {
  id: string;
  email: string;
  active: boolean;
  role: {
    id: string;
    name: string;
  };
  store: {
    id: string;
    name: string;
  } | null;
}

interface Role {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  roles: Role[];
  stores: Store[];
}

type FormData = {
  email: string;
  password?: string;
  roleId: string;
  storeId?: string;
  active: boolean;
};

export function UserDialog({
  open,
  onOpenChange,
  user,
  roles,
  stores,
}: UserDialogProps) {
  const [submitting, setSubmitting] = useState(false);
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
          email: user.email,
          roleId: user.role.id,
          storeId: user.store?.id || undefined,
          active: user.active,
        }
      : {
          email: "",
          password: "",
          roleId: "",
          storeId: undefined,
          active: true,
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
        reset({
          email: user.email,
          roleId: user.role.id,
          storeId: user.store?.id || undefined,
          active: user.active,
        });
      } else {
        reset({
          email: "",
          password: "",
          roleId: "",
          storeId: undefined,
          active: true,
        });
      }
    }
  }, [open, user, reset]);

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);

    let result;
    if (isEditing && user) {
      result = await updateUser({
        userId: user.id,
        email: data.email,
        roleId: data.roleId,
        storeId: data.storeId || null,
        active: data.active,
      });
    } else {
      if (!data.password) {
        toast.error("Password is required");
        setSubmitting(false);
        return;
      }
      result = await createUser({
        email: data.email,
        password: data.password,
        roleId: data.roleId,
        storeId: data.storeId,
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

          <div className="grid gap-4 py-4">
            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
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

            {/* Password (only for create) */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="roleId">Role</Label>
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

            {/* Store (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="storeId">Store (Optional)</Label>
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
            </div>

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
