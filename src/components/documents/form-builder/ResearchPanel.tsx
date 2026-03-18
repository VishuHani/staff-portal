"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Globe,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCheck,
  Shield,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { ResearchResult } from "@/lib/services/web-research-service";
import { FormCategory, Region } from "@/lib/documents/compliance-rules";

interface ResearchPanelProps {
  /** Whether research is currently enabled */
  enabled: boolean;
  /** Callback when research toggle changes */
  onEnabledChange: (enabled: boolean) => void;
  /** Selected region for compliance */
  region: Region;
  /** Callback when region changes */
  onRegionChange: (region: Region) => void;
  /** Research depth */
  depth: "quick" | "standard" | "comprehensive";
  /** Callback when depth changes */
  onDepthChange: (depth: "quick" | "standard" | "comprehensive") => void;
  /** Whether research is currently in progress */
  isResearching?: boolean;
  /** Research result after completion */
  researchResult?: ResearchResult | null;
  /** Detected form category */
  category?: FormCategory;
  /** Applied compliance rules */
  complianceRulesApplied?: string[];
  /** Research duration in ms */
  researchDuration?: number;
  /** Whether research feature is available */
  isAvailable?: boolean;
}

const REGIONS: { value: Region; label: string; flag: string }[] = [
  { value: "AU", label: "Australia", flag: "🇦🇺" },
  { value: "US", label: "United States", flag: "🇺🇸" },
  { value: "UK", label: "United Kingdom", flag: "🇬🇧" },
  { value: "EU", label: "European Union", flag: "🇪🇺" },
  { value: "CA", label: "Canada", flag: "🇨🇦" },
  { value: "NZ", label: "New Zealand", flag: "🇳🇿" },
  { value: "GLOBAL", label: "Global", flag: "🌍" },
];

const DEPTHS: { value: "quick" | "standard" | "comprehensive"; label: string; description: string }[] = [
  { value: "quick", label: "Quick", description: "~5 seconds, basic research" },
  { value: "standard", label: "Standard", description: "~15 seconds, balanced research" },
  { value: "comprehensive", label: "Comprehensive", description: "~30 seconds, detailed research" },
];

const CATEGORY_LABELS: Record<FormCategory, string> = {
  'employment-application': "Employment Application",
  'employee-onboarding': "Employee Onboarding",
  'medical-patient': "Medical/Patient",
  'financial-application': "Financial Application",
  'legal-contract': "Legal Contract",
  'survey-feedback': "Survey/Feedback",
  'event-registration': "Event Registration",
  'membership-application': "Membership Application",
  'insurance-claim': "Insurance Claim",
  'government-form': "Government Form",
  'educational-enrollment': "Educational Enrollment",
  'vendor-registration': "Vendor Registration",
  'general': "General",
};

export function ResearchPanel({
  enabled,
  onEnabledChange,
  region,
  onRegionChange,
  depth,
  onDepthChange,
  isResearching = false,
  researchResult,
  category,
  complianceRulesApplied = [],
  researchDuration,
  isAvailable = true,
}: ResearchPanelProps) {
  const [showResults, setShowResults] = useState(false);

  // Auto-expand results when research completes
  useEffect(() => {
    if (researchResult && !isResearching) {
      setShowResults(true);
    }
  }, [researchResult, isResearching]);

  if (!isAvailable) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Web Research</CardTitle>
              <CardDescription className="text-xs">
                Enhance form with compliance research
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            disabled={isResearching}
          />
        </div>
      </CardHeader>
      
      {enabled && (
        <CardContent className="space-y-4 pt-0">
          {/* Region and Depth Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Region</Label>
              <Select value={region} onValueChange={(v) => onRegionChange(v as Region)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="mr-2">{r.flag}</span>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Depth</Label>
              <Select value={depth} onValueChange={(v) => onDepthChange(v as typeof depth)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPTHS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Research Progress */}
          {isResearching && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Researching form requirements...</p>
                <p className="text-xs text-muted-foreground">
                  Analyzing compliance rules and best practices
                </p>
              </div>
            </div>
          )}

          {/* Detected Category */}
          {category && !isResearching && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Detected category:</span>
              <Badge variant="secondary">{CATEGORY_LABELS[category]}</Badge>
            </div>
          )}

          {/* Compliance Rules Applied */}
          {complianceRulesApplied.length > 0 && !isResearching && (
            <Collapsible open={showResults} onOpenChange={setShowResults}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between h-auto py-2"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      {complianceRulesApplied.length} compliance rules applied
                    </span>
                  </div>
                  {showResults ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1 pl-6">
                  {complianceRulesApplied.map((rule, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {rule}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Research Results */}
          {researchResult && !isResearching && (
            <Collapsible open={showResults} onOpenChange={setShowResults}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between h-auto py-2"
                >
                  <div className="flex items-center gap-2">
                    {researchResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                    )}
                    <span className="text-sm">
                      Research {researchResult.success ? "completed" : "partial"}
                    </span>
                    {researchDuration && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {(researchDuration / 1000).toFixed(1)}s
                      </Badge>
                    )}
                  </div>
                  {showResults ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 space-y-3">
                  {/* Summary */}
                  {researchResult.summary && (
                    <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">
                      {researchResult.summary}
                    </div>
                  )}

                  {/* Key Facts */}
                  {researchResult.keyFacts.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-medium">Key Facts</span>
                      </div>
                      <ul className="space-y-1 pl-5">
                        {researchResult.keyFacts.slice(0, 5).map((fact, i) => (
                          <li key={i} className="text-xs text-muted-foreground list-disc">
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Compliance Requirements */}
                  {researchResult.complianceRequirements.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-medium">Compliance Requirements</span>
                      </div>
                      <ul className="space-y-1 pl-5">
                        {researchResult.complianceRequirements.slice(0, 5).map((req, i) => (
                          <li key={i} className="text-xs text-muted-foreground list-disc">
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Fields */}
                  {researchResult.recommendedFields.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Search className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-medium">Recommended Fields</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {researchResult.recommendedFields.slice(0, 8).map((field, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Depth Description */}
          <p className="text-xs text-muted-foreground">
            {DEPTHS.find((d) => d.value === depth)?.description}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
