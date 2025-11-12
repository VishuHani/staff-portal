"use client";

import { useState, useEffect } from "react";
import { SchedulingSuggestions } from "@/components/ai/SchedulingSuggestions";
import {
  generateSchedulingSuggestions,
  applySchedulingSuggestion,
  type SchedulingSuggestion,
} from "@/lib/actions/ai/suggestions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, RefreshCw } from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SuggestionsPageClient() {
  const [suggestions, setSuggestions] = useState<SchedulingSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: addDays(new Date(), 1),
    end: addDays(new Date(), 7),
  });
  const [minConfidence, setMinConfidence] = useState(50);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const result = await generateSchedulingSuggestions({
        dateRange,
        minConfidence,
      });

      if (result.success && result.suggestions) {
        setSuggestions(result.suggestions);
        toast.success(`Generated ${result.suggestions.length} suggestions`);
      } else {
        toast.error(result.error || "Failed to generate suggestions");
        setSuggestions([]);
      }
    } catch (error) {
      toast.error("Failed to load suggestions");
      console.error(error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const handleAccept = async (suggestion: SchedulingSuggestion) => {
    const result = await applySchedulingSuggestion(suggestion);

    if (!result.success) {
      throw new Error(result.error || "Failed to apply suggestion");
    }

    // Reload suggestions after applying
    await loadSuggestions();
  };

  const handleReject = (suggestion: SchedulingSuggestion) => {
    // Rejection is handled in the SchedulingSuggestions component
    // Just log it for analytics
    console.log("Suggestion rejected:", suggestion.id);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Suggestion Filters</CardTitle>
          <CardDescription>
            Customize the date range and confidence threshold for suggestions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.start && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.start ? format(dateRange.start, "MMM dd, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.start}
                    onSelect={(date) => date && setDateRange({ ...dateRange, start: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange.end && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.end ? format(dateRange.end, "MMM dd, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.end}
                    onSelect={(date) => date && setDateRange({ ...dateRange, end: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Minimum Confidence */}
            <div className="space-y-2">
              <Label>Minimum Confidence</Label>
              <Select
                value={minConfidence.toString()}
                onValueChange={(value) => setMinConfidence(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All (0%)</SelectItem>
                  <SelectItem value="50">Medium (50%)</SelectItem>
                  <SelectItem value="70">High (70%)</SelectItem>
                  <SelectItem value="85">Very High (85%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={loadSuggestions} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              {loading ? "Generating..." : "Regenerate Suggestions"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions List */}
      <SchedulingSuggestions
        suggestions={suggestions}
        onAccept={handleAccept}
        onReject={handleReject}
        loading={loading}
      />
    </div>
  );
}
