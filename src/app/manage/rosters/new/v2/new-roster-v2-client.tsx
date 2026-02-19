"use client";

import { useRouter } from "next/navigation";
import { RosterUploadWizardV2 } from "@/components/rosters/roster-upload-wizard-v2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Brain, ShieldCheck, FileSearch } from "lucide-react";
import Link from "next/link";

interface Venue {
  id: string;
  name: string;
  code: string | null;
}

interface NewRosterV2ClientProps {
  venues: Venue[];
}

export function NewRosterV2Client({ venues }: NewRosterV2ClientProps) {
  const router = useRouter();

  const handleClose = (open: boolean) => {
    if (!open) {
      router.push("/manage/rosters");
    }
  };

  return (
    <>
      {/* Venue Selection if multiple venues */}
      {venues.length > 1 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Select a Venue</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <Link
                key={venue.id}
                href={`/manage/rosters/new/v2?venueId=${venue.id}`}
                className="block"
              >
                <Card className="hover:border-primary transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg">{venue.name}</CardTitle>
                    <CardDescription>{venue.code || "No code"}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Single venue or no venues */}
      {venues.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            You don't have access to any venues. Please contact an administrator.
          </CardContent>
        </Card>
      )}

      {venues.length === 1 && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Upload Roster (V2)</h1>
              <Badge variant="secondary">Multi-Phase Extraction</Badge>
            </div>
            <p className="text-muted-foreground">
              Upload an image file to extract roster data using our enhanced multi-phase AI extraction
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileSearch className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-700 dark:text-blue-300">Phase 1: SEE</span>
                </div>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Structure analysis with GPT-4o Vision
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-purple-700 dark:text-purple-300">Phase 2: THINK</span>
                </div>
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Cell parsing with complex cell handling
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-amber-700 dark:text-amber-300">Phase 3: EXTRACT</span>
                </div>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Rule-based shift creation
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-300">Phase 4: VALIDATE</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Quality check with GPT-4o-mini
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Wizard */}
          <RosterUploadWizardV2
            venueId={venues[0].id}
            venueName={venues[0].name}
            open={true}
            onOpenChange={handleClose}
          />
        </>
      )}
    </>
  );
}
