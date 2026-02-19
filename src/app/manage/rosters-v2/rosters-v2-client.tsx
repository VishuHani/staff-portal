"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RosterUploadWizardV2 } from "@/components/rosters/roster-upload-wizard-v2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Brain, ShieldCheck, FileSearch, ArrowLeft, Sparkles, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";

interface Venue {
  id: string;
  name: string;
  code: string | null;
}

interface RostersV2ClientProps {
  venues: Venue[];
}

export function RostersV2Client({ venues }: RostersV2ClientProps) {
  const router = useRouter();
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const handleVenueSelect = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowWizard(true);
  };

  const handleClose = (open: boolean) => {
    setShowWizard(open);
    if (!open) {
      setSelectedVenue(null);
    }
  };

  const handleSuccess = (rosterId: string) => {
    router.push(`/manage/rosters/${rosterId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/manage/rosters" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold">Roster V2 Upload</h1>
            <Badge variant="secondary" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Beta
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Enhanced 4-phase AI extraction for complex rosters with multiple shifts per cell
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-blue-200 dark:border-blue-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileSearch className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-semibold text-blue-700 dark:text-blue-300">Phase 1: SEE</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Structure analysis with GPT-4o Vision
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-purple-200 dark:border-purple-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-600" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="font-semibold text-purple-700 dark:text-purple-300">Phase 2: THINK</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Cell parsing with complex cell handling
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-amber-200 dark:border-amber-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-amber-700 dark:text-amber-300">Phase 3: EXTRACT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Rule-based shift creation
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-green-200 dark:border-green-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-semibold text-green-700 dark:text-green-300">Phase 4: VALIDATE</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Quality check with GPT-4o-mini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Benefits */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-3">Why use V2 extraction?</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Better Accuracy</p>
                <p className="text-xs text-muted-foreground">Multi-phase approach catches more shifts</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Complex Cell Handling</p>
                <p className="text-xs text-muted-foreground">Detects multiple shifts in one cell</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Quality Validation</p>
                <p className="text-xs text-muted-foreground">AI reviews extraction for anomalies</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue Selection */}
      {venues.length === 0 ? (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">
              You don't have access to any venues. Please contact an administrator.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Select a Venue</h2>
            <Badge variant="outline">{venues.length} venue{venues.length !== 1 ? 's' : ''} available</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <Card 
                key={venue.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-purple-400 dark:hover:border-purple-600"
                onClick={() => handleVenueSelect(venue)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{venue.name}</CardTitle>
                  <CardDescription>{venue.code || "No code"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full group hover:bg-purple-50 dark:hover:bg-purple-950">
                    <Zap className="h-4 w-4 mr-2 text-purple-500 group-hover:animate-pulse" />
                    Upload Roster
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upload Wizard */}
      {selectedVenue && (
        <RosterUploadWizardV2
          venueId={selectedVenue.id}
          venueName={selectedVenue.name}
          open={showWizard}
          onOpenChange={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
