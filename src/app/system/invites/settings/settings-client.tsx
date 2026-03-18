"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  ArrowLeft,
  Shield,
  Clock,
  Users,
  Building,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { toast } from "sonner";
import { updateInviteSettingsAction } from "@/lib/actions/invites";

interface InviteSettings {
  id: string;
  blockUntilDocumentsComplete: boolean;
  maxPendingPerVenue: number;
  maxPendingPerUser: number;
  maxInvitationsPerDay: number;
  invitationExpirationDays: number;
}

interface InviteSettingsClientProps {
  settings: InviteSettings;
}

export function InviteSettingsClient({ settings }: InviteSettingsClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    blockUntilDocumentsComplete: settings.blockUntilDocumentsComplete,
    maxPendingPerVenue: settings.maxPendingPerVenue,
    maxPendingPerUser: settings.maxPendingPerUser,
    maxInvitationsPerDay: settings.maxInvitationsPerDay,
    invitationExpirationDays: settings.invitationExpirationDays,
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateInviteSettingsAction(formData);
      
      if (result.success) {
        toast.success("Settings Saved", {
          description: "Invite settings have been updated successfully.",
        });
      } else {
        toast.error("Error", {
          description: result.error || "Failed to save settings",
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/system/invites")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Invite Settings</h2>
            <p className="mt-2 text-muted-foreground">
              Configure invitation system behavior and limits
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-6">
        {/* Document Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Document Requirements
            </CardTitle>
            <CardDescription>
              Control how onboarding documents interact with invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="block-documents">Block Until Documents Complete</Label>
                <p className="text-sm text-muted-foreground">
                  Prevent new users from accessing the system until they complete all assigned onboarding documents
                </p>
              </div>
              <Switch
                id="block-documents"
                checked={formData.blockUntilDocumentsComplete}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, blockUntilDocumentsComplete: checked })
                }
              />
            </div>
            
            {formData.blockUntilDocumentsComplete && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  When enabled, users will have limited access until they complete their onboarding documents.
                  This feature requires the onboarding documents system to be configured.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Invitation Limits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Invitation Limits
            </CardTitle>
            <CardDescription>
              Set limits to prevent abuse and manage invitation flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="max-venue">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Max Pending Per Venue
                  </div>
                </Label>
                <Input
                  id="max-venue"
                  type="number"
                  min={1}
                  max={500}
                  value={formData.maxPendingPerVenue}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxPendingPerVenue: parseInt(e.target.value) || 50,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of pending invitations per venue (1-500)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-user">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Max Pending Per User
                  </div>
                </Label>
                <Input
                  id="max-user"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.maxPendingPerUser}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxPendingPerUser: parseInt(e.target.value) || 20,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Maximum pending invitations a single user can have (1-100)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-day">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Max Invitations Per Day
                  </div>
                </Label>
                <Input
                  id="max-day"
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.maxInvitationsPerDay}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxInvitationsPerDay: parseInt(e.target.value) || 100,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  System-wide daily invitation limit (1-1000)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Expiration Days
                  </div>
                </Label>
                <Input
                  id="expiration"
                  type="number"
                  min={1}
                  max={30}
                  value={formData.invitationExpirationDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invitationExpirationDays: parseInt(e.target.value) || 7,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Number of days before an invitation expires (1-30)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
              <Settings className="mr-2 h-5 w-5" />
              How These Settings Work
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-600 dark:text-blue-400">
            <ul className="space-y-2">
              <li>
                <strong>Max Pending Per Venue:</strong> Limits how many unaccepted invitations 
                can exist for a single venue. Useful for preventing spam to a specific location.
              </li>
              <li>
                <strong>Max Pending Per User:</strong> Limits how many invitations a single 
                staff member can have outstanding at once.
              </li>
              <li>
                <strong>Max Per Day:</strong> A system-wide rate limit to prevent mass invitation 
                attacks or accidental bulk sends.
              </li>
              <li>
                <strong>Expiration Days:</strong> New invitations will expire after this many days. 
                Expired invitations can be resent if needed.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
