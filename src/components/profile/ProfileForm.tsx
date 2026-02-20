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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ProfileFormProps {
  initialData: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    bio?: string | null;
    dateOfBirth?: Date | null;
    // Address fields
    addressStreet?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostcode?: string | null;
    addressCountry?: string | null;
    // Emergency contact
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    // Employment details
    employmentType?: string | null;
    employmentStartDate?: Date | null;
  };
  onSuccess?: () => void;
}

export function ProfileForm({ initialData, onSuccess }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
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
      // Address
      addressStreet: initialData.addressStreet || "",
      addressCity: initialData.addressCity || "",
      addressState: initialData.addressState || "",
      addressPostcode: initialData.addressPostcode || "",
      addressCountry: initialData.addressCountry || "Australia",
      // Emergency contact
      emergencyContactName: initialData.emergencyContactName || "",
      emergencyContactPhone: initialData.emergencyContactPhone || "",
      emergencyContactRelation: initialData.emergencyContactRelation || "",
      // Employment
      employmentType: (initialData.employmentType as "FULL_TIME" | "PART_TIME" | "CASUAL" | "CONTRACTOR") || undefined,
      employmentStartDate: initialData.employmentStartDate
        ? new Date(initialData.employmentStartDate).toISOString().split("T")[0]
        : "",
    },
  });

  const employmentType = watch("employmentType") as "FULL_TIME" | "PART_TIME" | "CASUAL" | "CONTRACTOR" | undefined;

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
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Basic Information</h3>
        
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
      </div>

      {/* Address Section */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="address">
          <AccordionTrigger className="text-lg font-medium hover:no-underline">
            Address Information
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="addressStreet">Street Address</Label>
              <Input
                id="addressStreet"
                type="text"
                placeholder="123 Main Street"
                {...register("addressStreet")}
                disabled={loading}
              />
              {errors.addressStreet && (
                <p className="text-sm text-red-600">{errors.addressStreet.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressCity">City</Label>
                <Input
                  id="addressCity"
                  type="text"
                  placeholder="Sydney"
                  {...register("addressCity")}
                  disabled={loading}
                />
                {errors.addressCity && (
                  <p className="text-sm text-red-600">{errors.addressCity.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressState">State/Province</Label>
                <Input
                  id="addressState"
                  type="text"
                  placeholder="NSW"
                  {...register("addressState")}
                  disabled={loading}
                />
                {errors.addressState && (
                  <p className="text-sm text-red-600">{errors.addressState.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressPostcode">Postcode</Label>
                <Input
                  id="addressPostcode"
                  type="text"
                  placeholder="2000"
                  {...register("addressPostcode")}
                  disabled={loading}
                />
                {errors.addressPostcode && (
                  <p className="text-sm text-red-600">{errors.addressPostcode.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressCountry">Country</Label>
                <Input
                  id="addressCountry"
                  type="text"
                  placeholder="Australia"
                  {...register("addressCountry")}
                  disabled={loading}
                />
                {errors.addressCountry && (
                  <p className="text-sm text-red-600">{errors.addressCountry.message}</p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Emergency Contact Section */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="emergency">
          <AccordionTrigger className="text-lg font-medium hover:no-underline">
            Emergency Contact
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 mb-4">
              <p className="font-medium">Important</p>
              <p className="mt-1 text-xs">
                This information will be used in case of emergency. Please ensure it is kept up to date.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">Contact Name</Label>
              <Input
                id="emergencyContactName"
                type="text"
                placeholder="Jane Doe"
                {...register("emergencyContactName")}
                disabled={loading}
              />
              {errors.emergencyContactName && (
                <p className="text-sm text-red-600">{errors.emergencyContactName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register("emergencyContactPhone")}
                disabled={loading}
              />
              {errors.emergencyContactPhone && (
                <p className="text-sm text-red-600">{errors.emergencyContactPhone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergencyContactRelation">Relationship</Label>
              <Input
                id="emergencyContactRelation"
                type="text"
                placeholder="Spouse, Parent, Sibling, etc."
                {...register("emergencyContactRelation")}
                disabled={loading}
              />
              {errors.emergencyContactRelation && (
                <p className="text-sm text-red-600">{errors.emergencyContactRelation.message}</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Employment Details Section */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="employment">
          <AccordionTrigger className="text-lg font-medium hover:no-underline">
            Employment Details
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="employmentType">Employment Type</Label>
              <Select
                value={employmentType || ""}
                onValueChange={(value) => setValue("employmentType", value as "FULL_TIME" | "PART_TIME" | "CASUAL" | "CONTRACTOR", { shouldDirty: true })}
              >
                <SelectTrigger id="employmentType" disabled={loading}>
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Full Time</SelectItem>
                  <SelectItem value="PART_TIME">Part Time</SelectItem>
                  <SelectItem value="CASUAL">Casual</SelectItem>
                  <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                </SelectContent>
              </Select>
              {errors.employmentType && (
                <p className="text-sm text-red-600">{errors.employmentType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentStartDate">Start Date</Label>
              <Input
                id="employmentStartDate"
                type="date"
                {...register("employmentStartDate")}
                disabled={loading}
              />
              {errors.employmentStartDate && (
                <p className="text-sm text-red-600">{errors.employmentStartDate.message}</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading || !isDirty}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
