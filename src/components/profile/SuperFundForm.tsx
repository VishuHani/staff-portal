"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMySuperSettings } from "@/lib/actions/profile";
import { PiggyBank, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuperFundFormProps {
  initialData: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    superEnabled?: boolean | null;
    customSuperRate?: number | null;
    superFundName?: string | null;
    superFundMemberNumber?: string | null;
    superFundUSI?: string | null;
    superFundABN?: string | null;
  };
  venueDefaultRate?: number | null;
}

// Australian Super Guarantee rate for 2025-26
const SG_RATE = 0.115;

export function SuperFundForm({ initialData, venueDefaultRate }: SuperFundFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [superEnabled, setSuperEnabled] = useState<string>(
    initialData.superEnabled === null ? "default" : initialData.superEnabled ? "enabled" : "disabled"
  );
  const [customSuperRate, setCustomSuperRate] = useState<string>(
    initialData.customSuperRate ? (initialData.customSuperRate * 100).toFixed(2) : ""
  );
  const [superFundName, setSuperFundName] = useState(initialData.superFundName || "");
  const [superFundMemberNumber, setSuperFundMemberNumber] = useState(initialData.superFundMemberNumber || "");
  const [superFundUSI, setSuperFundUSI] = useState(initialData.superFundUSI || "");
  const [superFundABN, setSuperFundABN] = useState(initialData.superFundABN || "");

  const effectiveRate = getEffectiveRate();

  function getEffectiveRate(): number {
    if (superEnabled === "disabled") return 0;
    if (superEnabled === "enabled" && customSuperRate) {
      return parseFloat(customSuperRate) / 100;
    }
    return venueDefaultRate ?? SG_RATE;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateMySuperSettings({
        superEnabled: superEnabled === "default" ? null : superEnabled === "enabled",
        customSuperRate: customSuperRate ? parseFloat(customSuperRate) / 100 : null,
        superFundName: superFundName || null,
        superFundMemberNumber: superFundMemberNumber || null,
        superFundUSI: superFundUSI || null,
        superFundABN: superFundABN || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-green-600" />
          <CardTitle>Superannuation Settings</CardTitle>
        </div>
        <CardDescription>
          Manage your superannuation fund details and contribution settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Super Status */}
          <div className="space-y-3">
            <Label className="text-base">Superannuation Status</Label>
            <Select value={superEnabled} onValueChange={setSuperEnabled}>
              <SelectTrigger>
                <SelectValue placeholder="Select super status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  <div className="flex items-center gap-2">
                    <span>Use venue default</span>
                    {venueDefaultRate !== undefined && venueDefaultRate !== null && (
                      <Badge variant="secondary" className="ml-2">
                        {(venueDefaultRate * 100).toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                </SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled (No super contributions)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {superEnabled === "default" 
                ? `Super will be calculated at the venue default rate (${((venueDefaultRate ?? SG_RATE) * 100).toFixed(1)}%)`
                : superEnabled === "disabled"
                ? "No superannuation contributions will be calculated"
                : "Super will be calculated based on your custom settings"}
            </p>
          </div>

          {/* Custom Rate */}
          {superEnabled === "enabled" && (
            <div className="space-y-3">
              <Label htmlFor="customRate">Custom Super Rate (%)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="customRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={customSuperRate}
                  onChange={(e) => setCustomSuperRate(e.target.value)}
                  placeholder={(SG_RATE * 100).toFixed(1)}
                  className="max-w-[150px]"
                />
                <span className="text-muted-foreground">%</span>
                {customSuperRate && (
                  <Badge variant={parseFloat(customSuperRate) > SG_RATE * 100 ? "default" : "secondary"}>
                    {parseFloat(customSuperRate) > SG_RATE * 100 ? "Above SG" : 
                     parseFloat(customSuperRate) < SG_RATE * 100 ? "Below SG" : "At SG"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Leave empty to use the Australian Super Guarantee rate ({(SG_RATE * 100).toFixed(1)}%)
              </p>
            </div>
          )}

          {/* Effective Rate Display */}
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Effective Super Rate</span>
              </div>
              <Badge 
                variant={effectiveRate >= SG_RATE ? "default" : "destructive"}
                className="text-base"
              >
                {(effectiveRate * 100).toFixed(2)}%
              </Badge>
            </div>
          </div>

          {/* Super Fund Details */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">Superannuation Fund Details</h4>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fundName">Fund Name</Label>
                <Input
                  id="fundName"
                  value={superFundName}
                  onChange={(e) => setSuperFundName(e.target.value)}
                  placeholder="e.g., AustralianSuper"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memberNumber">Member Number</Label>
                <Input
                  id="memberNumber"
                  value={superFundMemberNumber}
                  onChange={(e) => setSuperFundMemberNumber(e.target.value)}
                  placeholder="Your member number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usi">USI (Unique Superannuation Identifier)</Label>
                <Input
                  id="usi"
                  value={superFundUSI}
                  onChange={(e) => setSuperFundUSI(e.target.value)}
                  placeholder="e.g., STA0100AU"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abn">Fund ABN</Label>
                <Input
                  id="abn"
                  value={superFundABN}
                  onChange={(e) => setSuperFundABN(e.target.value)}
                  placeholder="e.g., 65 714 108 698"
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              These details are used for payroll processing and SG contribution reporting.
            </p>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Superannuation settings updated successfully
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
