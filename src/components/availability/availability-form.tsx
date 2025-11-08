"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DAYS_OF_WEEK } from "@/lib/schemas/availability";
import { bulkUpdateAvailability } from "@/lib/actions/availability";
import { Loader2, Save, Clock } from "lucide-react";

interface AvailabilityData {
  id: string;
  dayOfWeek: number;
  isAvailable: boolean;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

interface AvailabilityFormProps {
  initialAvailability: AvailabilityData[];
}

export function AvailabilityForm({ initialAvailability }: AvailabilityFormProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState(initialAvailability);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggle = (dayOfWeek: number, isAvailable: boolean) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              isAvailable,
              // Reset times if marking as unavailable
              startTime: isAvailable ? day.startTime || "09:00" : null,
              endTime: isAvailable ? day.endTime || "17:00" : null,
              isAllDay: isAvailable ? day.isAllDay : false,
            }
          : day
      )
    );
  };

  const handleAllDayToggle = (dayOfWeek: number, isAllDay: boolean) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? {
              ...day,
              isAllDay,
              // If all day is checked, times will be set to 00:00-23:59 on server
              // If unchecked, restore default times
              startTime: isAllDay ? "00:00" : day.startTime || "09:00",
              endTime: isAllDay ? "23:59" : day.endTime || "17:00",
            }
          : day
      )
    );
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability((prev) =>
      prev.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await bulkUpdateAvailability({
        availability: availability.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          isAvailable: day.isAvailable,
          isAllDay: day.isAllDay,
          startTime: day.startTime,
          endTime: day.endTime,
        })),
      });

      if ("error" in result) {
        setError(result.error || "An error occurred");
      } else {
        setSuccessMessage("Availability updated successfully!");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600">
          {successMessage}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">How It Works</p>
            <p className="text-xs mt-1 text-blue-600">
              • Toggle "Available" for each day you can work<br />
              • Check "All Day" for full availability (00:00 - 23:59)<br />
              • Or set specific start and end times<br />
              • Click "Save Availability" to apply changes
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {availability.map((day) => {
          const dayInfo = DAYS_OF_WEEK.find((d) => d.value === day.dayOfWeek);
          if (!dayInfo) return null;

          return (
            <Card key={day.dayOfWeek}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{dayInfo.label}</CardTitle>
                    {day.isAvailable ? (
                      day.isAllDay ? (
                        <Badge variant="default" className="bg-blue-600">
                          All Day
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">
                          Available
                        </Badge>
                      )
                    ) : (
                      <Badge variant="secondary">Unavailable</Badge>
                    )}
                  </div>
                  <Switch
                    checked={day.isAvailable}
                    onCheckedChange={(checked) =>
                      handleToggle(day.dayOfWeek, checked)
                    }
                  />
                </div>
              </CardHeader>

              {day.isAvailable && (
                <CardContent>
                  <div className="space-y-4">
                    {/* All Day Checkbox */}
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`allday-${day.dayOfWeek}`}
                        checked={day.isAllDay}
                        onCheckedChange={(checked) =>
                          handleAllDayToggle(day.dayOfWeek, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`allday-${day.dayOfWeek}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        All Day (Full availability)
                      </Label>
                    </div>

                    {/* Time Pickers - Only show if not all day */}
                    {!day.isAllDay && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`start-${day.dayOfWeek}`}>
                            Start Time
                          </Label>
                          <Input
                            id={`start-${day.dayOfWeek}`}
                            type="time"
                            value={day.startTime || ""}
                            onChange={(e) =>
                              handleTimeChange(
                                day.dayOfWeek,
                                "startTime",
                                e.target.value
                              )
                            }
                            required={day.isAvailable && !day.isAllDay}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`end-${day.dayOfWeek}`}>End Time</Label>
                          <Input
                            id={`end-${day.dayOfWeek}`}
                            type="time"
                            value={day.endTime || ""}
                            onChange={(e) =>
                              handleTimeChange(
                                day.dayOfWeek,
                                "endTime",
                                e.target.value
                              )
                            }
                            required={day.isAvailable && !day.isAllDay}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Availability
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
