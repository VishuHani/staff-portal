"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RosterUploadWizardV3 } from "@/components/rosters/roster-upload-wizard-v3";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Brain, ShieldCheck, FileSearch, ArrowLeft, Sparkles, RefreshCw, Image } from "lucide-react";
import Link from "next/link";

interface UploadClientProps {
  venueId: string;
  venueName: string;
}

export function UploadClient({ venueId, venueName }: UploadClientProps) {
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(true);

  const handleClose = (open: boolean) => {
    setShowWizard(open);
    if (!open) {
      router.push("/manage/rosters-v2");
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
            <Link href="/manage/rosters-v2" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold">Upload Roster</h1>
            <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              V3 Production
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Uploading for <span className="font-medium text-foreground">{venueName}</span>
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
                <Image className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="font-semibold text-blue-700 dark:text-blue-300">Preprocessing</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Contrast boost, crop, resize to 1000-2000px
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
              <span className="font-semibold text-purple-700 dark:text-purple-300">Single-Pass</span>
            </div>
            <p className="text-sm text-muted-foreground">
              One GPT-4o call with focused prompt
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-amber-200 dark:border-amber-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-amber-700 dark:text-amber-300">Validation</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Code-based: time format, dates, consistency
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-green-200 dark:border-green-800">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-600" />
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <RefreshCw className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-semibold text-green-700 dark:text-green-300">Retry</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Correction prompt on low confidence
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upload Wizard */}
      <RosterUploadWizardV3
        venueId={venueId}
        venueName={venueName}
        open={showWizard}
        onOpenChange={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
