"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Lock, Mail, User, Calendar, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { changePassword, updateEmail, deactivateAccount } from "@/lib/actions/account";
import { changePasswordSchema, updateEmailSchema, type ChangePasswordInput, type UpdateEmailInput } from "@/lib/schemas/account";
import { toast } from "sonner";

interface AccountInfo {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: {
    name: string;
  };
  createdAt: Date;
  active: boolean;
}

interface AccountSettingsClientProps {
  accountInfo: AccountInfo;
}

export function AccountSettingsClient({ accountInfo }: AccountSettingsClientProps) {
  const [changingPassword, setChangingPassword] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");

  // Password change form
  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Email update form
  const emailForm = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: {
      newEmail: accountInfo.email,
      password: "",
    },
  });

  // Handle password change
  const handlePasswordChange = async (data: ChangePasswordInput) => {
    setChangingPassword(true);
    try {
      const result = await changePassword(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Password changed successfully");
        passwordForm.reset();
      }
    } catch (error) {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle email update
  const handleEmailUpdate = async (data: UpdateEmailInput) => {
    setUpdatingEmail(true);
    try {
      const result = await updateEmail(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success("Email updated successfully");
        }
        emailForm.setValue("password", "");
      }
    } catch (error) {
      toast.error("Failed to update email");
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Handle account deactivation
  const handleDeactivate = async () => {
    if (!deactivatePassword) {
      toast.error("Please enter your password");
      return;
    }

    setDeactivating(true);
    try {
      const result = await deactivateAccount(deactivatePassword);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Account deactivated. You will be signed out.");
        // Redirect will happen automatically after sign out
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } catch (error) {
      toast.error("Failed to deactivate account");
    } finally {
      setDeactivating(false);
    }
  };

  const fullName = `${accountInfo.firstName || ""} ${accountInfo.lastName || ""}`.trim() || "N/A";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Account Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage your account security and preferences
        </p>
      </div>

      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
          <CardDescription>Your account details and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Full Name</Label>
              <p className="text-sm font-medium">{fullName}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{accountInfo.email}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Role</Label>
              <div>
                <Badge variant="secondary" className="flex w-fit items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {accountInfo.role.name}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Member Since</Label>
              <p className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(accountInfo.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Account Status</Label>
              <div>
                <Badge variant={accountInfo.active ? "default" : "destructive"}>
                  {accountInfo.active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                {...passwordForm.register("currentPassword")}
                disabled={changingPassword}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                {...passwordForm.register("newPassword")}
                disabled={changingPassword}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...passwordForm.register("confirmPassword")}
                disabled={changingPassword}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={changingPassword}>
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Update Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Change Email Address
          </CardTitle>
          <CardDescription>
            Update the email address associated with your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={emailForm.handleSubmit(handleEmailUpdate)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                {...emailForm.register("newEmail")}
                disabled={updatingEmail}
              />
              {emailForm.formState.errors.newEmail && (
                <p className="text-sm text-destructive">
                  {emailForm.formState.errors.newEmail.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailPassword">Confirm Password</Label>
              <Input
                id="emailPassword"
                type="password"
                {...emailForm.register("password")}
                disabled={updatingEmail}
                placeholder="Enter your password to confirm"
              />
              {emailForm.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {emailForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={updatingEmail}>
              {updatingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Email
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-medium">Deactivate Account</h3>
              <p className="text-sm text-muted-foreground">
                Deactivate your account and sign out. Your account can be reactivated by an administrator.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Deactivate</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will deactivate your account and sign you out. You will need an administrator to reactivate your account before you can log in again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="deactivatePassword">Confirm Password</Label>
                  <Input
                    id="deactivatePassword"
                    type="password"
                    placeholder="Enter your password"
                    value={deactivatePassword}
                    onChange={(e) => setDeactivatePassword(e.target.value)}
                    disabled={deactivating}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeactivate();
                    }}
                    disabled={deactivating}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deactivating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deactivate Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
