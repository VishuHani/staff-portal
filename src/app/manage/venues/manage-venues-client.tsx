"use client";

import { useRouter } from "next/navigation";
import { Building2, DollarSign, Users, Clock, Coffee, FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
  payConfig?: {
    id: string;
  } | null;
  shiftTemplates?: { id: string }[];
  breakRules?: { id: string }[];
  _count?: {
    userVenues: number;
  };
}

interface ManageVenuesClientProps {
  venues: Venue[];
}

export function ManageVenuesClient({ venues }: ManageVenuesClientProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Venue Pay Settings</h2>
        <p className="mt-2 text-muted-foreground">
          Select a venue to configure pay rates, shift templates, and break rules
        </p>
      </div>

      {/* Venues Grid */}
      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900">No venues available</p>
            <p className="text-sm text-gray-500 mt-1">
              You don't have access to any venues yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((venue) => (
            <Card key={venue.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 shrink-0" />
                      <span className="truncate">{venue.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Code: <span className="font-mono">{venue.code}</span>
                    </CardDescription>
                  </div>
                  <Badge variant={venue.active ? "default" : "secondary"}>
                    {venue.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{venue._count?.userVenues || 0} staff</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{venue.shiftTemplates?.length || 0} templates</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coffee className="h-4 w-4" />
                      <span>{venue.breakRules?.length || 0} break rules</span>
                    </div>
                  </div>

                  {/* Configuration Status */}
                  <div className="flex items-center gap-2">
                    {venue.payConfig ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Pay configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Not configured
                      </Badge>
                    )}
                  </div>

                  {/* Action Button */}
                  <Button
                    className="w-full mt-2"
                    onClick={() => router.push(`/manage/venues/${venue.id}/pay-settings`)}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Configure Pay Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
