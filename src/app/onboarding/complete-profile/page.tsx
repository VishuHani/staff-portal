"use client";

import { Suspense, useState } from "react";
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
import { Loader2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function CompleteProfileContent() {
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
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
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
            </div>

            {/* Address Section */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="address">
                <AccordionTrigger className="text-lg font-medium hover:no-underline">
                  Address Information (Optional)
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
                  Emergency Contact (Optional)
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

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
    </div>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CompleteProfileContent />
    </Suspense>
  );
}
