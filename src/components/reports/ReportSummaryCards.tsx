import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SummaryCardData {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  color?: string;
}

interface ReportSummaryCardsProps {
  cards: SummaryCardData[];
  className?: string;
}

export function ReportSummaryCards({ cards, className }: ReportSummaryCardsProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              {Icon && (
                <Icon
                  className={cn(
                    "h-4 w-4",
                    card.color || "text-muted-foreground"
                  )}
                />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">
                  {card.subtitle}
                </p>
              )}
              {card.trend && (
                <div className="flex items-center gap-1 mt-1">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      card.trend.isPositive
                        ? "text-green-600"
                        : "text-red-600"
                    )}
                  >
                    {card.trend.isPositive ? "+" : ""}
                    {card.trend.value}%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {card.trend.label}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Example usage with specific card types
export interface CoverageStatsCards {
  totalStaff: number;
  availableStaff: number;
  averageCoverage: number;
  peakCoverage: number;
}

export function coverageStatsToCards(stats: CoverageStatsCards): SummaryCardData[] {
  return [
    {
      title: "Total Staff",
      value: stats.totalStaff,
      subtitle: "In selected date range",
    },
    {
      title: "Available Staff",
      value: stats.availableStaff,
      subtitle: "Currently available",
      color: "text-green-600",
    },
    {
      title: "Average Coverage",
      value: `${stats.averageCoverage}%`,
      subtitle: "Across all days",
      color: "text-blue-600",
    },
    {
      title: "Peak Coverage",
      value: `${stats.peakCoverage}%`,
      subtitle: "Highest availability",
      color: "text-purple-600",
    },
  ];
}
