"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  User,
  Calendar,
  Clock,
  MessageSquare,
  Mail,
  Settings,
  Shield,
  Store,
  Bell,
  FileText,
  Lock,
  Megaphone,
  BarChart3,
  Hash,
  CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  userRole: string;
  className?: string;
  unreadMessageCount?: number;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  roles?: string[]; // If specified, only shown to these roles
}

export function Sidebar({ userRole, className, unreadMessageCount }: SidebarProps) {
  const pathname = usePathname();

  // Personal navigation items (/my/*)
  const personalItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "My Shifts",
      href: "/my/rosters",
      icon: CalendarDays,
    },
    {
      title: "My Availability",
      href: "/my/availability",
      icon: Calendar,
    },
    {
      title: "My Time Off",
      href: "/my/time-off",
      icon: Clock,
    },
    {
      title: "Posts",
      href: "/posts",
      icon: MessageSquare,
    },
    {
      title: "Messages",
      href: "/messages",
      icon: Mail,
      badge: unreadMessageCount || undefined,
    },
  ];

  // Team management items (/manage/*) - MANAGER + ADMIN
  const teamItems: NavItem[] = [
    {
      title: "Rosters",
      href: userRole === "ADMIN" ? "/system/rosters" : "/manage/rosters",
      icon: CalendarDays,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Team Availability",
      href: "/manage/availability",
      icon: Calendar,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Time-Off Approvals",
      href: "/manage/time-off",
      icon: Clock,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Reports & Analytics",
      href: userRole === "ADMIN" ? "/system/reports" : "/manage/reports",
      icon: BarChart3,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Channels",
      href: "/manage/channels",
      icon: Hash,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Team Members",
      href: "/manage/users",
      icon: Users,
      roles: ["ADMIN", "MANAGER"],
    },
  ];

  // System administration items (/system/*) - ADMIN only
  const systemItems: NavItem[] = [
    {
      title: "Role Management",
      href: "/system/roles",
      icon: Shield,
      roles: ["ADMIN"],
    },
    {
      title: "Venue Management",
      href: "/system/venues",
      icon: Store,
      roles: ["ADMIN"],
    },
    {
      title: "Audit Logs",
      href: "/system/audit",
      icon: FileText,
      roles: ["ADMIN"],
    },
    {
      title: "Announcements",
      href: "/system/announcements",
      icon: Megaphone,
      roles: ["ADMIN"],
    },
    {
      title: "Permissions",
      href: "/system/permissions",
      icon: Lock,
      roles: ["ADMIN"],
    },
  ];

  const bottomItems: NavItem[] = [
    {
      title: "Notifications",
      href: "/notifications",
      icon: Bell,
    },
    {
      title: "Profile",
      href: "/my/profile",
      icon: User,
    },
    {
      title: "Settings",
      href: "/my/settings",
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    // Handle /manage/reports and /system/reports separately
    if (href === "/manage/reports") {
      return pathname.startsWith("/manage/reports");
    }
    if (href === "/system/reports") {
      return pathname.startsWith("/system/reports");
    }
    // Handle /manage/rosters and /system/rosters separately
    if (href === "/manage/rosters") {
      return pathname.startsWith("/manage/rosters");
    }
    if (href === "/system/rosters") {
      return pathname.startsWith("/system/rosters");
    }
    return pathname.startsWith(href);
  };

  const shouldShowItem = (item: NavItem) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  };

  const renderNavItem = (item: NavItem) => {
    if (!shouldShowItem(item)) return null;

    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{item.title}</span>
        {item.badge && (
          <Badge variant="secondary" className="ml-auto">
            {item.badge}
          </Badge>
        )}
      </Link>
    );
  };

  return (
    <div className={cn("flex h-full flex-col gap-2", className)}>
      {/* Personal Navigation */}
      <div className="flex-1 space-y-1">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
            Personal
          </h2>
          <div className="space-y-1">{personalItems.map(renderNavItem)}</div>
        </div>

        {/* Team Management Section */}
        {(userRole === "ADMIN" || userRole === "MANAGER") && (
          <>
            <Separator />
            <div className="px-3 py-2">
              <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                Team Management
              </h2>
              <div className="space-y-1">{teamItems.map(renderNavItem)}</div>
            </div>
          </>
        )}

        {/* System Administration Section - ADMIN only */}
        {userRole === "ADMIN" && (
          <>
            <Separator />
            <div className="px-3 py-2">
              <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                System
              </h2>
              <div className="space-y-1">{systemItems.map(renderNavItem)}</div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="mt-auto space-y-1 border-t pt-4">
        {bottomItems.map(renderNavItem)}
      </div>
    </div>
  );
}
