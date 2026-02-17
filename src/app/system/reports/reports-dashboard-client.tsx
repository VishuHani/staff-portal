"use client";

import { useState, useEffect } from "react";
import { SmartSuggestions } from "@/components/reports/SmartSuggestions";
import { generateSuggestions } from "@/lib/services/suggestions-service";
import type { Suggestion } from "@/lib/services/suggestions-service";

export function ReportsDashboardClient() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSuggestions = async () => {
      setLoading(true);
      try {
        const result = await generateSuggestions({ limit: 5 });
        if (result.success && result.data) {
          setSuggestions(result.data);
        }
      } catch (error) {
        console.error("Error loading suggestions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, []);

  return (
    <SmartSuggestions
      suggestions={suggestions}
      loading={loading}
      compact={true}
      showDismiss={false}
    />
  );
}
