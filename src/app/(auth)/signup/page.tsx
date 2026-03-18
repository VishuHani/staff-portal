"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signup } from "@/lib/actions/auth";
import { validateInvitationToken, acceptInvitation } from "@/lib/actions/invites";
import { signupSchema, type SignupInput } from "@/lib/auth/schemas";
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
import { Badge } from "@/components/ui/badge";
import { Building, Shield, CheckCircle, AlertCircle } from "lucide-react";

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(true);
  const [invitation, setInvitation] = useState<{
    email: string;
    scope: string;
    venueId: string | null;
    venueName?: string | null;
    roleId: string;
    roleName: string;
    documentIds: string[];
  } | null>(null);
  const [invitationError, setInvitationError] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });

  // Check for invitation token in URL
  useEffect(() => {
    const token = searchParams.get("invite");
    if (token) {
      validateInvitation(token);
    } else {
      setInvitationLoading(false);
    }
  }, [searchParams]);

  const validateInvitation = async (token: string) => {
    setInvitationLoading(true);
    try {
      const result = await validateInvitationToken(token);
      if (result.success && result.invitation) {
        setInvitation(result.invitation);
        // Pre-fill email
        setValue("email", result.invitation.email);
      } else {
        setInvitationError(result.error || "Invalid invitation");
      }
    } catch (err) {
      setInvitationError("Failed to validate invitation");
    } finally {
      setInvitationLoading(false);
    }
  };

  const onSubmit = async (data: SignupInput) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await signup(data);

      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        // If there's an invitation, accept it after signup
        const inviteToken = searchParams.get("invite");
        if (inviteToken && result.userId) {
          const acceptResult = await acceptInvitation(inviteToken, result.userId);
          if (!acceptResult.success) {
            console.error("Failed to accept invitation:", acceptResult.error);
          }
        }

        setSuccess(
          result.message ||
            "Account created! Please check your email to verify your account."
        );
        // Optionally redirect to login after a delay
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while validating invitation
  if (invitationLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Validating invitation...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error if invitation is invalid
  if (invitationError && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Invalid Invitation</CardTitle>
            <CardDescription>{invitationError}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/signup">
              <Button>Continue to Sign Up</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {invitation ? "Accept Your Invitation" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {invitation
              ? "Complete your registration to join the team"
              : "Enter your details to create your account"}
          </CardDescription>
        </CardHeader>

        {/* Show invitation details */}
        {invitation && (
          <div className="px-6 pb-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">You've been invited!</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <Shield className="mr-1 h-3 w-3" />
                  {invitation.roleName}
                </Badge>
                {invitation.venueName && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Building className="mr-1 h-3 w-3" />
                    {invitation.venueName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Your email has been pre-filled. Create a password to complete your registration.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
                {success}
              </div>
            )}

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
                  <p className="text-sm text-red-400">{errors.firstName.message}</p>
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
                  <p className="text-sm text-red-400">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                disabled={loading || !!invitation}
                className={invitation ? "bg-muted" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-400">{errors.email.message}</p>
              )}
              {invitation && (
                <p className="text-xs text-muted-foreground">
                  Email is locked from your invitation
                </p>
              )}
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
                <p className="text-sm text-red-400">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={loading}
              />
              {errors.password && (
                <p className="text-sm text-red-400">
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-gray-400">
                Must contain at least 6 characters, including uppercase,
                lowercase, and a number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                {...register("confirmPassword")}
                disabled={loading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-400">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : invitation ? "Accept Invitation" : "Create account"}
            </Button>

            <p className="text-center text-sm text-gray-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    }>
      <SignupPageContent />
    </Suspense>
  );
}
