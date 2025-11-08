import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getMyAvailability } from "@/lib/actions/availability";
import { AvailabilityForm } from "@/components/availability/availability-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default async function AvailabilityPage() {
  const user = await requireAuth();

  const result = await getMyAvailability();

  if ("error" in result) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{result.error}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">
              My Availability
            </h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            Set your weekly availability schedule
          </p>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              • Toggle each day on or off to indicate your availability
            </p>
            <p className="text-sm text-muted-foreground">
              • Set your available hours for each day
            </p>
            <p className="text-sm text-muted-foreground">
              • Your manager will use this information for scheduling
            </p>
            <p className="text-sm text-muted-foreground">
              • Update your availability anytime as needed
            </p>
          </CardContent>
        </Card>

        {/* Availability Form */}
        <AvailabilityForm initialAvailability={result.availability} />
      </div>
    </DashboardLayout>
  );
}
