"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Bell,
  Lock,
  ChevronRight,
  Settings,
} from "lucide-react";

export function SettingsClient() {
  const settingsSections = [
    {
      title: "Profile",
      description: "Manage your personal information and profile details",
      icon: User,
      href: "/settings/profile",
      color: "text-blue-500",
    },
    {
      title: "Account",
      description: "Update your email, password, and account security",
      icon: Lock,
      href: "/settings/account",
      color: "text-green-500",
    },
    {
      title: "Notifications",
      description: "Manage notification preferences and channels",
      icon: Bell,
      href: "/settings/notifications",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Sections */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg bg-muted ${section.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="mt-4">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" className="w-full">
                    Manage {section.title}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Profile:</strong> Update your name, avatar, bio, and contact
            information
          </p>
          <p>
            <strong>Account:</strong> Change your email address, password, and
            manage account security
          </p>
          <p>
            <strong>Notifications:</strong> Control how and when you receive
            notifications across different channels
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
