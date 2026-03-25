"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
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
  UserPlus,
  FileStack,
  FolderOpen,
  ClipboardList,
  Send,
  DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  userRole: string;
  rolePermissions?: Array<{
    permission: {
      resource: string;
      action: string;
    };
  }>;
  venuePermissions?: Array<{
    venueId: string;
    permission: {
      resource: string;
      action: string;
    };
  }>;
  className?: string;
  unreadMessageCount?: number;
}

interface NavPermission {
  resource: string;
  action: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  roles?: string[]; // If specified, only shown to these roles
  permissions?: NavPermission[]; // If specified, shown when any permission matches
}

export function Sidebar({
  userRole,
  rolePermissions = [],
  venuePermissions = [],
  className,
  unreadMessageCount,
}: SidebarProps) {
  const pathname = usePathname();

  const effectivePermissionKeys = useMemo(() => {
    const keys = new Set<string>();
    rolePermissions.forEach((entry) => {
      keys.add(`${entry.permission.resource}:${entry.permission.action}`);
    });
    venuePermissions.forEach((entry) => {
      keys.add(`${entry.permission.resource}:${entry.permission.action}`);
    });
    return keys;
  }, [rolePermissions, venuePermissions]);

  const hasAnyPermission = (permissions?: NavPermission[]) =>
    !!permissions &&
    permissions.some((permission) =>
      effectivePermissionKeys.has(`${permission.resource}:${permission.action}`)
    );

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
      title: "My Documents",
      href: "/my/documents",
      icon: FileStack,
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
    {
      title: "Emails",
      href: "/emails",
      icon: Mail,
    },
  ];

  // Team management items (/manage/*) - MANAGER + ADMIN
  const teamItems: NavItem[] = [
    {
      title: "Rosters",
      href: "/manage/rosters",
      icon: CalendarDays,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "rosters", action: "view_team" },
        { resource: "rosters", action: "view_all" },
      ],
    },
    {
      title: "Team Availability",
      href: "/manage/availability",
      icon: Calendar,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "availability", action: "view_team" },
        { resource: "availability", action: "view_all" },
      ],
    },
    {
      title: "Time-Off Approvals",
      href: "/manage/time-off",
      icon: Clock,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "timeoff", action: "approve" },
        { resource: "timeoff", action: "view_team" },
        { resource: "timeoff", action: "view_all" },
      ],
    },
    {
      title: "Documents",
      href: "/manage/documents",
      icon: FolderOpen,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "documents", action: "read" },
        { resource: "documents", action: "view_team" },
        { resource: "documents", action: "view_all" },
      ],
    },
    {
      title: "Send Documents",
      href: "/manage/documents/send",
      icon: Send,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "documents", action: "create" },
        { resource: "documents", action: "assign" },
      ],
    },
    {
      title: "Reports & Analytics",
      href: userRole === "ADMIN" ? "/system/reports" : "/manage/reports",
      icon: BarChart3,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "reports", action: "view_team" },
        { resource: "reports", action: "view_all" },
      ],
    },
    {
      title: "Channels",
      href: "/manage/channels",
      icon: Hash,
      roles: ["ADMIN", "MANAGER"],
      permissions: [{ resource: "posts", action: "manage" }],
    },
    {
      title: "Team Members",
      href: "/manage/users",
      icon: Users,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "users", action: "view_team" },
        { resource: "users", action: "view_all" },
        { resource: "users", action: "read" },
      ],
    },
    {
      title: "Invite Users",
      href: "/manage/invites",
      icon: UserPlus,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "invites", action: "create" },
        { resource: "invites", action: "view" },
      ],
    },
    {
      title: "Venue Pay Settings",
      href: "/manage/venues",
      icon: DollarSign,
      roles: ["ADMIN", "MANAGER"],
      permissions: [
        { resource: "stores", action: "view" },
        { resource: "stores", action: "view_all" },
        { resource: "venues", action: "view" },
        { resource: "venues", action: "view_all" },
      ],
    },
  ];

  // System administration items (/system/*) - ADMIN only
  const systemItems: NavItem[] = [
    {
      title: "Role Management",
      href: "/system/roles",
      icon: Shield,
      roles: ["ADMIN"],
      permissions: [
        { resource: "roles", action: "manage" },
        { resource: "admin", action: "manage_roles" },
      ],
    },
    {
      title: "Venue Management",
      href: "/system/venues",
      icon: Store,
      roles: ["ADMIN"],
      permissions: [
        { resource: "stores", action: "manage" },
        { resource: "stores", action: "view_all" },
        { resource: "venues", action: "manage" },
        { resource: "venues", action: "view_all" },
      ],
    },
    {
      title: "Document Management",
      href: "/system/documents",
      icon: ClipboardList,
      roles: ["ADMIN"],
      permissions: [{ resource: "documents", action: "manage" }],
    },
    {
      title: "User Invitations",
      href: "/system/invites",
      icon: UserPlus,
      roles: ["ADMIN"],
      permissions: [
        { resource: "invites", action: "view" },
        { resource: "invites", action: "create" },
      ],
    },
    {
      title: "Audit Logs",
      href: "/system/audit",
      icon: FileText,
      roles: ["ADMIN"],
      permissions: [
        { resource: "audit", action: "view_audit_logs" },
        { resource: "audit", action: "read" },
      ],
    },
    {
      title: "Announcements",
      href: "/system/announcements",
      icon: Megaphone,
      roles: ["ADMIN"],
      permissions: [
        { resource: "announcements", action: "manage" },
        { resource: "announcements", action: "create" },
      ],
    },
    {
      title: "Permissions",
      href: "/system/permissions",
      icon: Lock,
      roles: ["ADMIN"],
      permissions: [
        { resource: "roles", action: "manage" },
        { resource: "admin", action: "manage_permissions" },
      ],
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
      return pathname.startsWith("/manage/reports") && !pathname.startsWith("/manage/reports/send");
    }
    if (href === "/system/reports") {
      return pathname.startsWith("/system/reports") && !pathname.startsWith("/system/reports/send");
    }
    // Handle /manage/rosters and /system/rosters separately
    if (href === "/manage/rosters") {
      return pathname.startsWith("/manage/rosters") && !pathname.startsWith("/manage/rosters/send");
    }
    if (href === "/system/rosters") {
      return pathname.startsWith("/system/rosters") && !pathname.startsWith("/system/rosters/send");
    }
    // Handle /manage/documents and /manage/documents/send separately
    if (href === "/manage/documents") {
      return pathname.startsWith("/manage/documents") && !pathname.startsWith("/manage/documents/send");
    }
    if (href === "/manage/documents/send") {
      return pathname.startsWith("/manage/documents/send");
    }
    // Handle unified Emails navigation and legacy email routes
    if (href === "/emails") {
      return (
        pathname.startsWith("/emails") ||
        pathname.startsWith("/system/emails") ||
        pathname.startsWith("/manage/emails")
      );
    }
    return pathname.startsWith(href);
  };

  const shouldShowItem = (item: NavItem) => {
    const roleAllowed = item.roles ? item.roles.includes(userRole) : false;
    const permissionAllowed = hasAnyPermission(item.permissions);

    if (item.roles && item.permissions) {
      return roleAllowed || permissionAllowed;
    }

    if (item.roles) {
      return roleAllowed;
    }

    if (item.permissions) {
      return permissionAllowed;
    }

    return true;
  };

  const hasVisibleTeamItems = teamItems.some(shouldShowItem);
  const hasVisibleSystemItems = systemItems.some(shouldShowItem);

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
        {hasVisibleTeamItems && (
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
        {hasVisibleSystemItems && (
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
