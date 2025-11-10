"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateProfile } from "@/lib/actions/profile";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/schemas/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ProfileFormProps {
  initialData: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    bio?: string | null;
    dateOfBirth?: Date | null;
  };
  onSuccess?: () => void;
}

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: initialData.firstName || "",
      lastName: initialData.lastName || "",
      phone: initialData.phone || "",
      bio: initialData.bio || "",
      dateOfBirth: initialData.dateOfBirth
        ? new Date(initialData.dateOfBirth).toISOString().split("T")[0]
        : "",
    },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    setLoading(true);

    try {
      const result = await updateProfile(data);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated!");
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            type="text"
            placeholder="John"
            {...register("firstName")}
            disabled={loading}
          />
          {errors.firstName && (
            <p className="text-sm text-red-600">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            type="text"
            placeholder="Doe"
            {...register("lastName")}
            disabled={loading}
          />
          {errors.lastName && (
            <p className="text-sm text-red-600">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          {...register("phone")}
          disabled={loading}
        />
        {errors.phone && (
          <p className="text-sm text-red-600">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          {...register("dateOfBirth")}
          disabled={loading}
        />
        {errors.dateOfBirth && (
          <p className="text-sm text-red-600">{errors.dateOfBirth.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          placeholder="Tell us a bit about yourself..."
          rows={4}
          {...register("bio")}
          disabled={loading}
        />
        {errors.bio && (
          <p className="text-sm text-red-600">{errors.bio.message}</p>
        )}
        <p className="text-xs text-gray-500">Maximum 500 characters</p>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading || !isDirty}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
