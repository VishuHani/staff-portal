"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, Save } from "lucide-react";

interface AvailabilityData {
  id: string;
  dayOfWeek: number;
  isAvailable: boolean;
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
                      <Badge variant="default" className="bg-green-600">
                        Available
                      </Badge>
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
                        required={day.isAvailable}
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
                        required={day.isAvailable}
                      />
                    </div>
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
