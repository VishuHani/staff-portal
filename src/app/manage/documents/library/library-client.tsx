"use client";

import { useRouter } from "next/navigation";
import { TemplateLibraryBrowser } from "@/components/documents/library/TemplateLibraryBrowser";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface LibraryClientProps {
  defaultVenueId: string;
}

export function LibraryClient({ defaultVenueId }: LibraryClientProps) {
  const router = useRouter();

  const handleTemplateImported = (templateId: string) => {
    // Redirect to the documents page after successful import
    router.push("/manage/documents");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/manage/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground">
            Browse and import pre-built document templates
          </p>
        </div>
      </div>

      <TemplateLibraryBrowser
        venueId={defaultVenueId}
        onTemplateImported={handleTemplateImported}
      />
    </div>
  );
}
