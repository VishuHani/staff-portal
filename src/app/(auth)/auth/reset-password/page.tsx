"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { completePasswordReset } from "@/lib/actions/auth";
import {
  updatePasswordSchema,
  type UpdatePasswordInput,
} from "@/lib/auth/schemas";
import { createClient } from "@/lib/auth/supabase-client";
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

type OtpType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

function parseHashParams(hash: string): Record<string, string> {
  return hash
    .replace(/^#/, "")
    .split("&")
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [rawKey, rawValue] = part.split("=");
      if (!rawKey) return acc;
      acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue || "");
      return acc;
    }, {});
}

export default function ResetPasswordPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(updatePasswordSchema),
  });

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    const initializeResetSession = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        } else if (tokenHash && type) {
          await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as OtpType,
          });
        } else if (window.location.hash) {
          const hashParams = parseHashParams(window.location.hash);
          const accessToken = hashParams.access_token;
          const refreshToken = hashParams.refresh_token;
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) return;
        if (!user) {
          setError("Reset link is invalid or expired. Please request a new one.");
          setSessionReady(false);
          return;
        }

        setSessionReady(true);
      } catch (initError) {
        if (!active) return;
        setError("Unable to verify reset link. Please request a new one.");
        setSessionReady(false);
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    };

    initializeResetSession();

    return () => {
      active = false;
    };
  }, []);

  const onSubmit = async (data: UpdatePasswordInput) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await completePasswordReset(data);

      if (result?.error) {
        setError(result.error);
        return;
      }

      setSuccess(result?.message || "Password updated successfully.");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          <CardDescription>
            Enter your new password to complete account recovery
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Create a strong password"
                {...register("newPassword")}
                disabled={loading || !sessionReady || initializing}
              />
              {errors.newPassword && (
                <p className="text-sm text-red-400">{errors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your new password"
                {...register("confirmPassword")}
                disabled={loading || !sessionReady || initializing}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !sessionReady || initializing}
            >
              {initializing ? "Verifying link..." : loading ? "Updating..." : "Update password"}
            </Button>

            <p className="text-center text-sm text-gray-400">
              Back to{" "}
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
