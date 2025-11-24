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

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Availability",
      href: "/availability",
      icon: Calendar,
    },
    {
      title: "Time Off",
      href: "/time-off",
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

  const adminItems: NavItem[] = [
    {
      title: "Staff Availability",
      href: "/admin/availability",
      icon: Calendar,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Time-Off Approval",
      href: "/admin/time-off",
      icon: Clock,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Reports & Analytics",
      href: "/admin/reports",
      icon: BarChart3,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Channels",
      href: "/admin/channels",
      icon: Hash,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "User Management",
      href: "/admin/users",
      icon: Users,
      roles: ["ADMIN", "MANAGER"],
    },
    {
      title: "Role Management",
      href: "/admin/roles",
      icon: Shield,
      roles: ["ADMIN"],
    },
    {
      title: "Venue Management",
      href: "/admin/stores",
      icon: Store,
      roles: ["ADMIN"],
    },
    {
      title: "Audit Logs",
      href: "/admin/audit",
      icon: FileText,
      roles: ["ADMIN"],
    },
    {
      title: "Notifications",
      href: "/admin/notifications",
      icon: Megaphone,
      roles: ["ADMIN"],
    },
    {
      title: "Venue Permissions",
      href: "/admin/venue-permissions",
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
      href: "/settings/profile",
      icon: User,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
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
      {/* Main Navigation */}
      <div className="flex-1 space-y-1">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
            Main
          </h2>
          <div className="space-y-1">{navItems.map(renderNavItem)}</div>
        </div>

        {/* Admin Section */}
        {(userRole === "ADMIN" || userRole === "MANAGER") && (
          <>
            <Separator />
            <div className="px-3 py-2">
              <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-tight text-muted-foreground">
                Administration
              </h2>
              <div className="space-y-1">{adminItems.map(renderNavItem)}</div>
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
