"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { getFullName } from "@/lib/utils/profile";
import { Building2, Calendar, Mail } from "lucide-react";

interface ProfilePageClientProps {
  profile: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    phone?: string | null;
    bio?: string | null;
    dateOfBirth?: Date | null;
    profileCompletedAt?: Date | null;
    createdAt: Date;
    role: string;
    venues?: Array<{
      id: string;
      name: string;
      code: string;
      isPrimary: boolean;
    }>;
  };
}

export function ProfilePageClient({ profile }: ProfilePageClientProps) {
  const router = useRouter();
  const fullName = getFullName(profile);

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-gray-600">Manage your personal information and preferences</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Avatar & Info */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
              <CardDescription>Update your profile picture</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <AvatarUpload
                userId={profile.id}
                currentImageUrl={profile.profileImage}
                firstName={profile.firstName}
                lastName={profile.lastName}
                userEmail={profile.email}
                size="2xl"
                onUploadComplete={handleRefresh}
                onDeleteComplete={handleRefresh}
              />
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">{profile.email}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">
                  Joined {new Date(profile.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Role</p>
                <Badge variant="outline">{profile.role}</Badge>
              </div>

              {profile.venues && profile.venues.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Assigned Venues</p>
                  <div className="space-y-2">
                    {profile.venues.map((venue) => (
                      <div
                        key={venue.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-gray-500" />
                          <span>{venue.name}</span>
                        </div>
                        {venue.isPrimary && (
                          <Badge variant="secondary" className="text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Edit Form */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                initialData={{
                  firstName: profile.firstName,
                  lastName: profile.lastName,
                  phone: profile.phone,
                  bio: profile.bio,
                  dateOfBirth: profile.dateOfBirth,
                }}
                onSuccess={handleRefresh}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
