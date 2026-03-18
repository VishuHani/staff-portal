"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { CalendarIcon, Loader2, ArrowLeft, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { createRoster, copyRoster, getRosters } from "@/lib/actions/rosters";
import { toast } from "sonner";
import Link from "next/link";

interface Venue {
  id: string;
  name: string;
  code: string;
}

interface PastRoster {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  _count: { shifts: number };
}

interface CreateRosterFormProps {
  venues: Venue[];
}

export function CreateRosterForm({ venues }: CreateRosterFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [pastRosters, setPastRosters] = useState<PastRoster[]>([]);
  const [loadingPastRosters, setLoadingPastRosters] = useState(false);

  // Default to next week
  const defaultStartDate = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
  const defaultEndDate = endOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    venueId: venues.length === 1 ? venues[0].id : "",
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    copyFromRosterId: "",
  });

  // Load past rosters when venue changes
  useEffect(() => {
    if (formData.venueId) {
      loadPastRosters(formData.venueId);
    } else {
      setPastRosters([]);
    }
  }, [formData.venueId]);

  const loadPastRosters = async (venueId: string) => {
    setLoadingPastRosters(true);
    try {
      const result = await getRosters({
        venueId,
        status: "PUBLISHED",
        endDate: new Date(), // Only past rosters
        includeSuperseded: true,
      });
      
      if (result.success) {
        setPastRosters(result.rosters as PastRoster[]);
      } else {
        console.error("Failed to load past rosters:", result.error);
        setPastRosters([]);
      }
    } catch (error) {
      console.error("Error loading past rosters:", error);
      setPastRosters([]);
    } finally {
      setLoadingPastRosters(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.venueId) {
      toast.error("Please select a venue");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Please enter a roster name");
      return;
    }

    setIsLoading(true);

    try {
      if (formData.copyFromRosterId) {
        // Copy from existing roster
        const result = await copyRoster(formData.copyFromRosterId, {
          targetWeekStart: formData.startDate,
          name: formData.name.trim(),
          createNewVersion: false,
        });

        if (result.success && result.rosterId) {
          toast.success("Roster copied successfully");
          router.push(`/manage/rosters/${result.rosterId}`);
        } else {
          toast.error(result.error || "Failed to copy roster");
        }
      } else {
        // Create new empty roster
        const result = await createRoster({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          venueId: formData.venueId,
          startDate: formData.startDate,
          endDate: formData.endDate,
        });

        if (result.success && result.roster) {
          toast.success("Roster created successfully");
          router.push(`/manage/rosters/${result.roster.id}`);
        } else {
          toast.error(result.error || "Failed to create roster");
        }
      }
    } catch (error) {
      console.error("Error creating/copying roster:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate suggested name when venue and dates change
  const suggestName = () => {
    const venue = venues.find((v) => v.id === formData.venueId);
    if (venue && formData.startDate) {
      const weekNum = format(formData.startDate, "w");
      return `Week ${weekNum} - ${venue.name}`;
    }
    return "";
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Roster Details</CardTitle>
          <CardDescription>
            Set up the basic information for your new roster
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Venue Selection */}
          <div className="space-y-2">
            <Label htmlFor="venue">Venue *</Label>
            <Select
              value={formData.venueId}
              onValueChange={(value) =>
                setFormData({ ...formData, venueId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Roster Name *</Label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder="e.g., Week 48 - Main Bar"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              {formData.venueId && !formData.name && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormData({ ...formData, name: suggestName() })}
                >
                  Suggest
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Any notes about this roster..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
            />
          </div>

          {/* Copy from Past Roster */}
          {pastRosters.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="copyFromRoster">Copy from Past Roster (Optional)</Label>
              <Select
                value={formData.copyFromRosterId}
                onValueChange={(value) =>
                  setFormData({ ...formData, copyFromRosterId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a past roster to copy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Create empty roster</SelectItem>
                  {pastRosters.map((roster) => (
                    <SelectItem key={roster.id} value={roster.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{roster.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(roster.startDate), "MMM d")} - {format(new Date(roster.endDate), "MMM d")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {roster._count.shifts} shifts
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.copyFromRosterId && (
                <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-md flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  <span>Roster will be copied with all shifts to the selected date range</span>
                </div>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.startDate
                      ? format(formData.startDate, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.startDate}
                    onSelect={(date) =>
                      date && setFormData({ ...formData, startDate: date })
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.endDate
                      ? format(formData.endDate, "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.endDate}
                    onSelect={(date) =>
                      date && setFormData({ ...formData, endDate: date })
                    }
                    disabled={(date) => date < formData.startDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm">Quick presets</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextWeekStart = startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
                  const nextWeekEnd = endOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 });
                  setFormData({
                    ...formData,
                    startDate: nextWeekStart,
                    endDate: nextWeekEnd,
                  });
                }}
              >
                Next Week
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const twoWeeksStart = startOfWeek(addDays(new Date(), 14), { weekStartsOn: 1 });
                  const twoWeeksEnd = endOfWeek(addDays(new Date(), 14), { weekStartsOn: 1 });
                  setFormData({
                    ...formData,
                    startDate: twoWeeksStart,
                    endDate: twoWeeksEnd,
                  });
                }}
              >
                In 2 Weeks
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Link href="/manage/rosters">
              <Button type="button" variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Roster
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
