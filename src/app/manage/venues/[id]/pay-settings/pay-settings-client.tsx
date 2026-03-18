"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Clock,
  Users,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Save,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper to safely format a rate value (handles Decimal, number, string, or null)
const formatRate = (rate: number | string | null | undefined): string => {
  if (rate === null || rate === undefined) return "-";
  const num = typeof rate === "string" ? parseFloat(rate) : Number(rate);
  if (isNaN(num)) return "-";
  return `$${num.toFixed(2)}`;
};

// Helper to convert rate to number for editing
const rateToNumber = (rate: number | string | null | undefined): number | null => {
  if (rate === null || rate === undefined) return null;
  const num = typeof rate === "string" ? parseFloat(rate) : Number(rate);
  return isNaN(num) ? null : num;
};

// ============================================================================
// TYPES
// ============================================================================

interface VenuePayConfig {
  id?: string;
  venueId: string;
  defaultWeekdayRate: number | null;
  defaultSaturdayRate: number | null;
  defaultSundayRate: number | null;
  defaultPublicHolidayRate: number | null;
  defaultOvertimeRate: number | null;
  defaultLateRate: number | null;
  overtimeThresholdHours: number;
  overtimeMultiplier: number | null;
  lateStartHour: number;
  autoCalculateBreaks: boolean;
  breakThresholdHours: number;
  defaultBreakMinutes: number;
  publicHolidayRegion: string;
  // Superannuation fields
  superRate: number | null;
  superEnabled: boolean;
}

interface ShiftTemplate {
  id: string;
  name: string;
  description: string | null;
  color: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  autoCalculateBreak: boolean;
  position: string | null;
  daysOfWeek: number[];
  displayOrder: number;
}

interface BreakRule {
  id: string;
  name: string;
  description: string | null;
  minShiftHours: number;
  maxShiftHours: number | null;
  breakMinutes: number;
  isPaid: boolean;
  additionalBreakMinutes: number | null;
  additionalBreakThreshold: number | null;
  priority: number;
  isDefault: boolean;
}

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: { name: string } | null;
  weekdayRate: number | null;
  saturdayRate: number | null;
  sundayRate: number | null;
  publicHolidayRate: number | null;
  // Superannuation fields
  superEnabled: boolean | null;
  customSuperRate: number | null;
}

interface Venue {
  id: string;
  name: string;
  payConfig: VenuePayConfig | null;
  shiftTemplates: ShiftTemplate[];
  breakRules: BreakRule[];
}

interface PaySettingsClientProps {
  venue: Venue;
  staff: StaffMember[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PaySettingsClient({ venue, staff }: PaySettingsClientProps) {
  const [activeTab, setActiveTab] = useState("default-rates");
  const [config, setConfig] = useState<VenuePayConfig>(
    venue.payConfig || {
      venueId: venue.id,
      defaultWeekdayRate: null,
      defaultSaturdayRate: null,
      defaultSundayRate: null,
      defaultPublicHolidayRate: null,
      defaultOvertimeRate: null,
      defaultLateRate: null,
      overtimeThresholdHours: 8,
      overtimeMultiplier: 1.5,
      lateStartHour: 22,
      autoCalculateBreaks: true,
      breakThresholdHours: 4,
      defaultBreakMinutes: 30,
      publicHolidayRegion: "NSW",
      superRate: 0.115, // 11.5% Australian Super Guarantee 2025-26
      superEnabled: true,
    }
  );
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>(venue.shiftTemplates);
  const [breakRules, setBreakRules] = useState<BreakRule[]>(venue.breakRules);
  const [staffState, setStaffState] = useState<StaffMember[]>(staff);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog states
  const [addBreakRuleOpen, setAddBreakRuleOpen] = useState(false);
  const [editBreakRuleOpen, setEditBreakRuleOpen] = useState(false);
  const [editingBreakRule, setEditingBreakRule] = useState<BreakRule | null>(null);

  const [addShiftTemplateOpen, setAddShiftTemplateOpen] = useState(false);
  const [editShiftTemplateOpen, setEditShiftTemplateOpen] = useState(false);
  const [editingShiftTemplate, setEditingShiftTemplate] = useState<ShiftTemplate | null>(null);

  const [editStaffRatesOpen, setEditStaffRatesOpen] = useState(false);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);

  // ============================================================================
  // DEFAULT RATES TAB
  // ============================================================================

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/venue-pay-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success("Pay configuration saved successfully");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save pay configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================================
  // BREAK RULES HANDLERS
  // ============================================================================

  const handleAddBreakRule = async (rule: Omit<BreakRule, "id">) => {
    try {
      const response = await fetch("/api/admin/break-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, venueId: venue.id }),
      });

      if (!response.ok) throw new Error("Failed to add break rule");

      const newRule = await response.json();
      setBreakRules([...breakRules, newRule]);
      setAddBreakRuleOpen(false);
      toast.success("Break rule added successfully");
    } catch (error) {
      console.error("Error adding break rule:", error);
      toast.error("Failed to add break rule");
    }
  };

  const handleUpdateBreakRule = async (rule: BreakRule) => {
    try {
      const response = await fetch(`/api/admin/break-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });

      if (!response.ok) throw new Error("Failed to update break rule");

      const updatedRule = await response.json();
      setBreakRules(breakRules.map((r) => r.id === rule.id ? updatedRule : r));
      setEditBreakRuleOpen(false);
      setEditingBreakRule(null);
      toast.success("Break rule updated successfully");
    } catch (error) {
      console.error("Error updating break rule:", error);
      toast.error("Failed to update break rule");
    }
  };

  const handleDeleteBreakRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this break rule?")) return;

    try {
      const response = await fetch(`/api/admin/break-rules/${ruleId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete break rule");

      setBreakRules(breakRules.filter((r) => r.id !== ruleId));
      toast.success("Break rule deleted successfully");
    } catch (error) {
      console.error("Error deleting break rule:", error);
      toast.error("Failed to delete break rule");
    }
  };

  // ============================================================================
  // SHIFT TEMPLATES HANDLERS
  // ============================================================================

  const handleAddShiftTemplate = async (template: Omit<ShiftTemplate, "id">) => {
    try {
      const response = await fetch("/api/admin/shift-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...template, venueId: venue.id }),
      });

      if (!response.ok) throw new Error("Failed to add shift template");

      const newTemplate = await response.json();
      setShiftTemplates([...shiftTemplates, newTemplate]);
      setAddShiftTemplateOpen(false);
      toast.success("Shift template added successfully");
    } catch (error) {
      console.error("Error adding shift template:", error);
      toast.error("Failed to add shift template");
    }
  };

  const handleUpdateShiftTemplate = async (template: ShiftTemplate) => {
    try {
      const response = await fetch(`/api/admin/shift-templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });

      if (!response.ok) throw new Error("Failed to update shift template");

      const updatedTemplate = await response.json();
      setShiftTemplates(shiftTemplates.map((t) => t.id === template.id ? updatedTemplate : t));
      setEditShiftTemplateOpen(false);
      setEditingShiftTemplate(null);
      toast.success("Shift template updated successfully");
    } catch (error) {
      console.error("Error updating shift template:", error);
      toast.error("Failed to update shift template");
    }
  };

  const handleDeleteShiftTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this shift template?")) return;

    try {
      const response = await fetch(`/api/admin/shift-templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete shift template");

      setShiftTemplates(shiftTemplates.filter((t) => t.id !== templateId));
      toast.success("Shift template deleted successfully");
    } catch (error) {
      console.error("Error deleting shift template:", error);
      toast.error("Failed to delete shift template");
    }
  };

  // ============================================================================
  // STAFF PAY RATES HANDLERS
  // ============================================================================

  const handleUpdateStaffRates = async (member: StaffMember) => {
    try {
      const response = await fetch(`/api/admin/staff/${member.id}/pay-rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekdayRate: member.weekdayRate,
          saturdayRate: member.saturdayRate,
          sundayRate: member.sundayRate,
          publicHolidayRate: member.publicHolidayRate,
          superEnabled: member.superEnabled,
          customSuperRate: member.customSuperRate,
        }),
      });
      if (!response.ok) throw new Error("Failed to update staff pay rates");

      const updatedMember = await response.json();
      setStaffState(staffState.map((s) => s.id === member.id ? updatedMember : s));
      setEditStaffRatesOpen(false);
      setEditingStaffMember(null);
      toast.success("Staff pay rates updated successfully");
    } catch (error) {
      console.error("Error updating staff pay rates:", error);
      toast.error("Failed to update staff pay rates");
    }
  };

  const DefaultRatesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Default Hourly Rates
          </CardTitle>
          <CardDescription>
            These rates are used when staff don't have individual rates set.
            All rates are hourly and confidential.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weekdayRate">Weekday Rate ($/hr)</Label>
              <Input
                id="weekdayRate"
                type="number"
                step="0.01"
                value={config.defaultWeekdayRate ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, defaultWeekdayRate: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 25.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saturdayRate">Saturday Rate ($/hr)</Label>
              <Input
                id="saturdayRate"
                type="number"
                step="0.01"
                value={config.defaultSaturdayRate ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, defaultSaturdayRate: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 30.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sundayRate">Sunday Rate ($/hr)</Label>
              <Input
                id="sundayRate"
                type="number"
                step="0.01"
                value={config.defaultSundayRate ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, defaultSundayRate: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 35.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="publicHolidayRate">Public Holiday Rate ($/hr)</Label>
              <Input
                id="publicHolidayRate"
                type="number"
                step="0.01"
                value={config.defaultPublicHolidayRate ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, defaultPublicHolidayRate: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 50.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Superannuation
          </CardTitle>
          <CardDescription>
            Configure superannuation (super) settings for this venue.
            The Australian Super Guarantee rate is 11.5% for 2025-26.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Superannuation</Label>
              <p className="text-xs text-muted-foreground">
                Calculate superannuation for eligible employees
              </p>
            </div>
            <Switch
              checked={config.superEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, superEnabled: checked })}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="superRate">Super Rate (%)</Label>
              <Input
                id="superRate"
                type="number"
                step="0.001"
                min="0"
                max="1"
                value={config.superRate ?? 0.115}
                onChange={(e) =>
                  setConfig({ ...config, superRate: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 0.115 for 11.5%"
              />
              <p className="text-xs text-muted-foreground">
                Enter as decimal (0.115 = 11.5%). Current SG rate: 11.5%
              </p>
            </div>
            <div className="space-y-2">
              <Label>Current Rate Display</Label>
              <div className="flex h-10 items-center px-3 rounded-md border bg-muted/50">
                <span className="text-lg font-semibold">
                  {((config.superRate ?? 0.115) * 100).toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                This rate will be applied to gross wages
              </p>
            </div>
          </div>
          <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-4 text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">Australian Super Guarantee Rates:</p>
            <ul className="mt-2 text-blue-700 dark:text-blue-300 space-y-1">
              <li>• 2024-25: 11.5%</li>
              <li>• 2025-26: 11.5%</li>
              <li>• 2026-27: 12%</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Overtime & Late Hours
          </CardTitle>
          <CardDescription>
            Configure overtime thresholds and late hour premiums.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="overtimeThreshold">Overtime Threshold (hours)</Label>
              <Input
                id="overtimeThreshold"
                type="number"
                value={config.overtimeThresholdHours}
                onChange={(e) =>
                  setConfig({ ...config, overtimeThresholdHours: parseInt(e.target.value) || 8 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Hours worked per day after which overtime applies
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overtimeMultiplier">Overtime Multiplier</Label>
              <Input
                id="overtimeMultiplier"
                type="number"
                step="0.1"
                value={config.overtimeMultiplier ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, overtimeMultiplier: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 1.5"
              />
              <p className="text-xs text-muted-foreground">
                Multiply base rate by this factor for overtime
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateStartHour">Late Hours Start (24h)</Label>
              <Input
                id="lateStartHour"
                type="number"
                min="0"
                max="23"
                value={config.lateStartHour}
                onChange={(e) =>
                  setConfig({ ...config, lateStartHour: parseInt(e.target.value) || 22 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Hour after which late rate applies (default: 10pm = 22)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateRate">Late Rate ($/hr)</Label>
              <Input
                id="lateRate"
                type="number"
                step="0.01"
                value={config.defaultLateRate ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, defaultLateRate: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="e.g., 30.00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Break Configuration
          </CardTitle>
          <CardDescription>
            Automatic break calculation settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Calculate Breaks</Label>
              <p className="text-xs text-muted-foreground">
                Automatically add breaks based on shift length
              </p>
            </div>
            <Switch
              checked={config.autoCalculateBreaks}
              onCheckedChange={(checked) => setConfig({ ...config, autoCalculateBreaks: checked })}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakThreshold">Break Threshold (hours)</Label>
              <Input
                id="breakThreshold"
                type="number"
                value={config.breakThresholdHours}
                onChange={(e) =>
                  setConfig({ ...config, breakThresholdHours: parseInt(e.target.value) || 4 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Shifts longer than this get a break
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultBreak">Default Break (minutes)</Label>
              <Input
                id="defaultBreak"
                type="number"
                value={config.defaultBreakMinutes}
                onChange={(e) =>
                  setConfig({ ...config, defaultBreakMinutes: parseInt(e.target.value) || 30 })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="publicHolidayRegion">Public Holiday Region</Label>
            <select
              id="publicHolidayRegion"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              value={config.publicHolidayRegion}
              onChange={(e) => setConfig({ ...config, publicHolidayRegion: e.target.value })}
            >
              <option value="NSW">New South Wales</option>
              <option value="VIC">Victoria</option>
              <option value="QLD">Queensland</option>
              <option value="WA">Western Australia</option>
              <option value="SA">South Australia</option>
              <option value="TAS">Tasmania</option>
              <option value="ACT">Australian Capital Territory</option>
              <option value="NT">Northern Territory</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveConfig} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );

  // ============================================================================
  // SHIFT TEMPLATES TAB
  // ============================================================================

  const ShiftTemplatesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Shift Templates</CardTitle>
              <CardDescription>
                Pre-defined shift configurations for quick roster creation.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddShiftTemplateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {shiftTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shift templates configured yet.</p>
              <p className="text-sm">Create templates for common shifts like Morning, Evening, Night.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shiftTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-3 h-12 rounded"
                      style={{ backgroundColor: template.color }}
                    />
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {template.startTime} - {template.endTime} ({template.breakMinutes}min break)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditingShiftTemplate(template);
                      setEditShiftTemplateOpen(true);
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteShiftTemplate(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // BREAK RULES TAB
  // ============================================================================

  const BreakRulesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Break Rules</CardTitle>
              <CardDescription>
                Configure automatic break calculations based on shift length.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddBreakRuleOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {breakRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No break rules configured yet.</p>
              <p className="text-sm">
                Create rules like: "Shifts over 6 hours get 30min break".
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {breakRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      {rule.isDefault && <Badge variant="secondary">Default</Badge>}
                      {rule.isPaid && <Badge variant="outline">Paid</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rule.minShiftHours}h+ shifts: {rule.breakMinutes}min break
                      {rule.maxShiftHours && ` (up to ${rule.maxShiftHours}h)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditingBreakRule(rule);
                      setEditBreakRuleOpen(true);
                    }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteBreakRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // STAFF RATES TAB
  // ============================================================================

  const StaffRatesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Pay Rates
          </CardTitle>
          <CardDescription>
            Individual pay rates for staff members. These override venue defaults.
            <br />
            <span className="text-amber-600 flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              Confidential - Only visible to admins and managers
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staffState.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No staff members found for this venue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Staff Member</th>
                    <th className="text-left py-3 px-4">Role</th>
                    <th className="text-right py-3 px-4">Weekday</th>
                    <th className="text-right py-3 px-4">Saturday</th>
                    <th className="text-right py-3 px-4">Sunday</th>
                    <th className="text-right py-3 px-4">Public Holiday</th>
                    <th className="text-center py-3 px-4">Super</th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffState.map((member) => (
                    <tr key={member.id} className="border-b">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{member.role?.name || "No Role"}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatRate(member.weekdayRate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatRate(member.saturdayRate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatRate(member.sundayRate)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {formatRate(member.publicHolidayRate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {member.superEnabled === false ? (
                          <Badge variant="destructive" className="text-xs">No Super</Badge>
                        ) : member.customSuperRate ? (
                          <Badge variant="secondary" className="text-xs">
                            {((typeof member.customSuperRate === 'string' ? parseFloat(member.customSuperRate) : member.customSuperRate) * 100).toFixed(1)}%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Venue Default</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingStaffMember(member);
                          setEditStaffRatesOpen(true);
                        }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // DIALOGS
  // ============================================================================

  const BreakRuleDialog = () => (
    <Dialog open={addBreakRuleOpen || editBreakRuleOpen} onOpenChange={(open) => {
      if (!open) {
        setAddBreakRuleOpen(false);
        setEditBreakRuleOpen(false);
        setEditingBreakRule(null);
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingBreakRule ? "Edit Break Rule" : "Add Break Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure automatic break calculation based on shift length.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (editingBreakRule) {
            handleUpdateBreakRule(editingBreakRule);
          } else {
            const newRule: Omit<BreakRule, "id"> = {
              name: (e.target as any).elements.ruleName.value,
              description: (e.target as any).elements.ruleDescription.value || null,
              minShiftHours: parseFloat((e.target as any).elements.minShiftHours.value),
              maxShiftHours: (e.target as any).elements.maxShiftHours.value ? parseFloat((e.target as any).elements.maxShiftHours.value) : null,
              breakMinutes: parseInt((e.target as any).elements.breakMinutes.value),
              isPaid: (e.target as any).elements.isPaid.checked,
              additionalBreakMinutes: (e.target as any).elements.additionalBreakMinutes.value ? parseInt((e.target as any).elements.additionalBreakMinutes.value) : null,
              additionalBreakThreshold: (e.target as any).elements.additionalBreakThreshold.value ? parseFloat((e.target as any).elements.additionalBreakThreshold.value) : null,
              priority: parseInt((e.target as any).elements.priority.value),
              isDefault: (e.target as any).elements.isDefault.checked,
            };
            handleAddBreakRule(newRule);
          }
        }}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name *</Label>
              <Input
                id="ruleName"
                name="ruleName"
                defaultValue={editingBreakRule?.name || ""}
                placeholder="e.g., Standard Break Rule"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruleDescription">Description</Label>
              <Input
                id="ruleDescription"
                name="ruleDescription"
                defaultValue={editingBreakRule?.description || ""}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minShiftHours">Min Shift Hours *</Label>
                <Input
                  id="minShiftHours"
                  name="minShiftHours"
                  type="number"
                  step="0.5"
                  defaultValue={editingBreakRule?.minShiftHours?.toString() || "4"}
                  placeholder="e.g., 4"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxShiftHours">Max Shift Hours</Label>
                <Input
                  id="maxShiftHours"
                  name="maxShiftHours"
                  type="number"
                  step="0.5"
                  defaultValue={editingBreakRule?.maxShiftHours?.toString() || ""}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Break Minutes *</Label>
                <Input
                  id="breakMinutes"
                  name="breakMinutes"
                  type="number"
                  defaultValue={editingBreakRule?.breakMinutes?.toString() || "30"}
                  placeholder="e.g., 30"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isPaid">Paid Break</Label>
                <Switch
                  id="isPaid"
                  name="isPaid"
                  defaultChecked={editingBreakRule?.isPaid || false}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="additionalBreakMinutes">Additional Break Minutes</Label>
                <Input
                  id="additionalBreakMinutes"
                  name="additionalBreakMinutes"
                  type="number"
                  defaultValue={editingBreakRule?.additionalBreakMinutes?.toString() || ""}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="additionalBreakThreshold">Additional Break Threshold</Label>
                <Input
                  id="additionalBreakThreshold"
                  name="additionalBreakThreshold"
                  type="number"
                  step="0.5"
                  defaultValue={editingBreakRule?.additionalBreakThreshold?.toString() || ""}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  name="priority"
                  type="number"
                  defaultValue={editingBreakRule?.priority?.toString() || "0"}
                  placeholder="Higher priority rules take precedence"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="isDefault">Default Rule</Label>
                <Switch
                  id="isDefault"
                  name="isDefault"
                  defaultChecked={editingBreakRule?.isDefault || false}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setAddBreakRuleOpen(false);
              setEditBreakRuleOpen(false);
              setEditingBreakRule(null);
            }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingBreakRule ? "Update Rule" : "Add Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const ShiftTemplateDialog = () => (
    <Dialog open={addShiftTemplateOpen || editShiftTemplateOpen} onOpenChange={(open) => {
      if (!open) {
        setAddShiftTemplateOpen(false);
        setEditShiftTemplateOpen(false);
        setEditingShiftTemplate(null);
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingShiftTemplate ? "Edit Shift Template" : "Add Shift Template"}
          </DialogTitle>
          <DialogDescription>
            Create pre-defined shift configurations for quick roster creation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (editingShiftTemplate) {
            handleUpdateShiftTemplate(editingShiftTemplate);
          } else {
            const newTemplate: Omit<ShiftTemplate, "id"> = {
              name: (e.target as any).elements.templateName.value,
              description: (e.target as any).elements.templateDescription.value || null,
              color: (e.target as any).elements.templateColor.value || "#3B82F6",
              startTime: (e.target as any).elements.startTime.value,
              endTime: (e.target as any).elements.endTime.value,
              breakMinutes: parseInt((e.target as any).elements.breakMinutes.value) || 30,
              autoCalculateBreak: (e.target as any).elements.autoCalculateBreak.checked,
              position: (e.target as any).elements.position.value || null,
              daysOfWeek: Array.from((e.target as any).querySelectorAll('input[name="daysOfWeek"]:checked') as NodeListOf<HTMLInputElement>).map((cb) => parseInt(cb.value)),
              displayOrder: shiftTemplates.length,
            };
            handleAddShiftTemplate(newTemplate);
          }
        }}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                name="templateName"
                defaultValue={editingShiftTemplate?.name || ""}
                placeholder="e.g., Morning Shift"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateDescription">Description</Label>
              <Input
                id="templateDescription"
                name="templateDescription"
                defaultValue={editingShiftTemplate?.description || ""}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue={editingShiftTemplate?.startTime || "06:00"}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue={editingShiftTemplate?.endTime || "14:00"}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Break Minutes</Label>
                <Input
                  id="breakMinutes"
                  name="breakMinutes"
                  type="number"
                  defaultValue={editingShiftTemplate?.breakMinutes?.toString() || "30"}
                  placeholder="e.g., 30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="autoCalculateBreak">Auto Calculate Break</Label>
                <Switch
                  id="autoCalculateBreak"
                  name="autoCalculateBreak"
                  defaultChecked={editingShiftTemplate?.autoCalculateBreak ?? true}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                name="position"
                defaultValue={editingShiftTemplate?.position || ""}
                placeholder="e.g., Waiter, Cook"
              />
            </div>
            <div className="space-y-2">
              <Label>Applicable Days</Label>
              <div className="flex gap-4 mt-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                  <label key={day} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="daysOfWeek"
                      value={index}
                      defaultChecked={editingShiftTemplate?.daysOfWeek?.includes(index) ?? true}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateColor">Color</Label>
              <Input
                id="templateColor"
                name="templateColor"
                type="color"
                defaultValue={editingShiftTemplate?.color || "#3B82F6"}
                className="h-10 w-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setAddShiftTemplateOpen(false);
              setEditShiftTemplateOpen(false);
              setEditingShiftTemplate(null);
            }}>
              Cancel
            </Button>
            <Button type="submit">
              {editingShiftTemplate ? "Update Template" : "Add Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  const StaffRatesDialog = () => (
    <Dialog open={editStaffRatesOpen} onOpenChange={(open) => {
      if (!open) {
        setEditStaffRatesOpen(false);
        setEditingStaffMember(null);
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Staff Pay Rates</DialogTitle>
          <DialogDescription>
            Configure individual pay rates for {editingStaffMember?.firstName} {editingStaffMember?.lastName}.
            <br />
            <span className="text-amber-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Confidential - Only visible to admins and managers
            </span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (editingStaffMember) {
            const form = e.target as HTMLFormElement;
            const customSuperRateValue = (form.elements.namedItem('staffCustomSuperRate') as HTMLInputElement)?.value;
            const updatedMember = {
              ...editingStaffMember,
              weekdayRate: (form.elements.namedItem('weekdayRate') as HTMLInputElement)?.value
                ? parseFloat((form.elements.namedItem('weekdayRate') as HTMLInputElement).value) : null,
              saturdayRate: (form.elements.namedItem('saturdayRate') as HTMLInputElement)?.value
                ? parseFloat((form.elements.namedItem('saturdayRate') as HTMLInputElement).value) : null,
              sundayRate: (form.elements.namedItem('sundayRate') as HTMLInputElement)?.value
                ? parseFloat((form.elements.namedItem('sundayRate') as HTMLInputElement).value) : null,
              publicHolidayRate: (form.elements.namedItem('publicHolidayRate') as HTMLInputElement)?.value
                ? parseFloat((form.elements.namedItem('publicHolidayRate') as HTMLInputElement).value) : null,
              superEnabled: editingStaffMember.superEnabled,
              customSuperRate: customSuperRateValue ? parseFloat(customSuperRateValue) : null,
            };
            handleUpdateStaffRates(updatedMember);
          }
        }}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weekdayRate">Weekday Rate ($/hr)</Label>
                <Input
                  id="weekdayRate"
                  name="weekdayRate"
                  type="number"
                  step="0.01"
                  defaultValue={rateToNumber(editingStaffMember?.weekdayRate)?.toString() || ""}
                  placeholder="e.g., 25.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saturdayRate">Saturday Rate ($/hr)</Label>
                <Input
                  id="saturdayRate"
                  name="saturdayRate"
                  type="number"
                  step="0.01"
                  defaultValue={rateToNumber(editingStaffMember?.saturdayRate)?.toString() || ""}
                  placeholder="e.g., 30.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sundayRate">Sunday Rate ($/hr)</Label>
                <Input
                  id="sundayRate"
                  name="sundayRate"
                  type="number"
                  step="0.01"
                  defaultValue={rateToNumber(editingStaffMember?.sundayRate)?.toString() || ""}
                  placeholder="e.g., 35.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="publicHolidayRate">Public Holiday Rate ($/hr)</Label>
                <Input
                  id="publicHolidayRate"
                  name="publicHolidayRate"
                  type="number"
                  step="0.01"
                  defaultValue={rateToNumber(editingStaffMember?.publicHolidayRate)?.toString() || ""}
                  placeholder="e.g., 50.00"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Leave a field empty to use venue default rate.
            </p>
          </div>

          <Separator className="my-4" />

          {/* Superannuation Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Superannuation Settings</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Superannuation</Label>
                <p className="text-xs text-muted-foreground">
                  {editingStaffMember?.superEnabled === false
                    ? "Super is disabled for this staff member"
                    : "Use venue default setting"}
                </p>
              </div>
              <Switch
                id="staffSuperEnabled"
                name="staffSuperEnabled"
                checked={editingStaffMember?.superEnabled !== false}
                onCheckedChange={(checked) => {
                  if (editingStaffMember) {
                    setEditingStaffMember({
                      ...editingStaffMember,
                      superEnabled: checked ? null : false,
                      customSuperRate: checked ? null : editingStaffMember.customSuperRate
                    });
                  }
                }}
              />
            </div>

            {editingStaffMember?.superEnabled !== false && (
              <div className="space-y-2">
                <Label htmlFor="staffCustomSuperRate">Custom Super Rate (optional)</Label>
                <Input
                  id="staffCustomSuperRate"
                  name="staffCustomSuperRate"
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  defaultValue={editingStaffMember?.customSuperRate?.toString() || ""}
                  placeholder="e.g., 0.115 for 11.5% (leave empty for venue default)"
                />
                <p className="text-xs text-muted-foreground">
                  Override the venue super rate for this staff member. Enter as decimal (0.115 = 11.5%)
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setEditStaffRatesOpen(false);
              setEditingStaffMember(null);
            }}>
              Cancel
            </Button>
            <Button type="submit">
              Save Rates
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pay Settings</h1>
          <p className="text-muted-foreground">
            Configure pay rates and break rules for {venue.name}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="default-rates">Default Rates</TabsTrigger>
          <TabsTrigger value="shift-templates">Shift Templates</TabsTrigger>
          <TabsTrigger value="break-rules">Break Rules</TabsTrigger>
          <TabsTrigger value="staff-rates">Staff Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="default-rates" className="mt-6">
          <DefaultRatesTab />
        </TabsContent>

        <TabsContent value="shift-templates" className="mt-6">
          <ShiftTemplatesTab />
        </TabsContent>

        <TabsContent value="break-rules" className="mt-6">
          <BreakRulesTab />
        </TabsContent>

        <TabsContent value="staff-rates" className="mt-6">
          <StaffRatesTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <BreakRuleDialog />
      <ShiftTemplateDialog />
      <StaffRatesDialog />
    </div>
  );
}
