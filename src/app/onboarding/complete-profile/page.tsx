"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { completeProfile } from "@/lib/actions/profile";
import { completeProfileSchema, type CompleteProfileInput } from "@/lib/schemas/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function CompleteProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/dashboard";
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteProfileInput>({
    resolver: zodResolver(completeProfileSchema),
  });

  const onSubmit = async (data: CompleteProfileInput) => {
    setLoading(true);

    try {
      const result = await completeProfile(data);

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile completed!");
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Complete Your Profile</CardTitle>
          <CardDescription>
            Please provide your details to complete your profile setup
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
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
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
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
              <Label htmlFor="phone">Phone Number (Optional)</Label>
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
              <Label htmlFor="dateOfBirth">Date of Birth (Optional)</Label>
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
              <Label htmlFor="bio">Bio (Optional)</Label>
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
              <p className="text-xs text-gray-500">
                Maximum 500 characters
              </p>
            </div>

            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              <p className="font-medium">Why do we need this?</p>
              <p className="mt-1 text-xs">
                Your profile helps your team members recognize and connect with you.
                Fields marked with * are required.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : "Complete Profile"}
            </Button>

            <p className="text-center text-xs text-gray-500">
              You'll need to complete your profile to access the application
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
