"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createTimeOffRequest } from "@/lib/actions/time-off";
import { Loader2, Send, Calendar } from "lucide-react";

export function TimeOffRequestForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    type: "UNAVAILABLE",
    reason: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await createTimeOffRequest({
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        type: formData.type as any,
        reason: formData.reason || undefined,
      });

      if ("error" in result) {
        setError(result.error || "An error occurred");
      } else {
        setSuccessMessage("Time-off request submitted successfully!");
        // Reset form
        setFormData({
          startDate: "",
          endDate: "",
          type: "UNAVAILABLE",
          reason: "",
        });
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate number of days
  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return diff + 1; // Include both start and end days
    }
    return 0;
  };

  const days = calculateDays();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle>Request Time Off</CardTitle>
        </div>
        <CardDescription>
          Submit a new time-off request for manager approval
        </CardDescription>
      </CardHeader>
      <CardContent>
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

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">
                End Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                min={formData.startDate || new Date().toISOString().split("T")[0]}
                required
              />
            </div>
          </div>

          {/* Days count */}
          {days > 0 && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <strong>Duration:</strong> {days} day{days !== 1 ? "s" : ""}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-muted-foreground text-xs">(Optional, min 10 characters)</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Please provide a reason for your time-off request..."
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              rows={4}
              maxLength={500}
            />
            {formData.reason && (
              <p className="text-xs text-muted-foreground">
                {formData.reason.length}/500 characters
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  startDate: "",
                  endDate: "",
                  type: "UNAVAILABLE",
                  reason: "",
                });
                setError(null);
                setSuccessMessage(null);
              }}
              disabled={isSubmitting}
            >
              Clear
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
