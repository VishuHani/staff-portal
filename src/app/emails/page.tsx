import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, FolderOpen, Mail, Megaphone, Users } from "lucide-react";
import type { ComponentType } from "react";
import { requireAuth } from "@/lib/rbac/access";
import {
  canAccessEmailWorkspace,
  getAccessibleEmailModules,
  type EmailWorkspaceModule,
} from "@/lib/rbac/email-workspace";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Emails | Workspace",
  description: "Email workspace for creating content, audiences, campaigns, and reports",
};

const MODULE_META: Record<
  EmailWorkspaceModule,
  { title: string; description: string; href: string; icon: ComponentType<{ className?: string }> }
> = {
  create: {
    title: "Create Email",
    description: "Build, draft, preview, and test emails with visual and code editing.",
    href: "/emails/create",
    icon: Mail,
  },
  assets: {
    title: "Assets",
    description: "Organize images, GIFs, and videos with folder and search workflows.",
    href: "/emails/assets",
    icon: FolderOpen,
  },
  audience: {
    title: "Audience",
    description: "Create and organize reusable audience lists with SQL, AI, and filters.",
    href: "/emails/audience",
    icon: Users,
  },
  campaigns: {
    title: "Campaigns",
    description: "Configure one-off and recurring campaigns using saved emails and audiences.",
    href: "/emails/campaigns",
    icon: Megaphone,
  },
  reports: {
    title: "Reports",
    description: "Build custom email reports, save configurations, and schedule recurring runs.",
    href: "/emails/reports",
    icon: BarChart3,
  },
};

export default async function EmailsWorkspacePage() {
  const user = await requireAuth();

  if (!(await canAccessEmailWorkspace(user.id))) {
    redirect("/dashboard?error=access_denied");
  }

  const accessMap = await getAccessibleEmailModules(user.id);
  const accessibleModules = (Object.keys(accessMap) as EmailWorkspaceModule[]).filter(
    (module) => accessMap[module]
  );

  if (accessibleModules.length === 0) {
    redirect("/dashboard?error=access_denied");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Emails</h1>
            <Badge variant="secondary">Workspace</Badge>
          </div>
          <p className="text-muted-foreground">
            Unified workspace for email creation, assets, audience segmentation, campaigns, and reporting.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accessibleModules.map((module) => {
            const meta = MODULE_META[module];
            const Icon = meta.icon;
            return (
              <Card key={module} className="h-full">
                <CardHeader className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{meta.title}</CardTitle>
                  </div>
                  <CardDescription>{meta.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href={meta.href}>Open {meta.title}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
