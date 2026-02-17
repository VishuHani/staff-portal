import { Badge } from "@/components/ui/badge";
import { Crown, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

type ChannelRole = "CREATOR" | "MODERATOR" | "MEMBER";

interface RoleBadgeProps {
  role: ChannelRole | string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const roleConfig = {
  CREATOR: {
    label: "Creator",
    icon: Crown,
    className: "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20",
    iconClassName: "text-amber-600",
  },
  MODERATOR: {
    label: "Moderator",
    icon: Shield,
    className: "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-500/20",
    iconClassName: "text-blue-600",
  },
  MEMBER: {
    label: "Member",
    icon: User,
    className: "bg-gray-500/10 text-gray-700 hover:bg-gray-500/20 border-gray-500/20",
    iconClassName: "text-gray-600",
  },
};

const sizeConfig = {
  sm: {
    badge: "text-xs px-1.5 py-0.5",
    icon: "h-3 w-3",
  },
  md: {
    badge: "text-sm px-2 py-1",
    icon: "h-3.5 w-3.5",
  },
  lg: {
    badge: "text-base px-2.5 py-1.5",
    icon: "h-4 w-4",
  },
};

export function RoleBadge({
  role,
  size = "md",
  showIcon = true,
  className,
}: RoleBadgeProps) {
  // Normalize role to uppercase for matching
  const normalizedRole = role.toUpperCase() as keyof typeof roleConfig;
  const config = roleConfig[normalizedRole] || roleConfig.MEMBER;
  const sizeClasses = sizeConfig[size];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, sizeClasses.badge, className)}
    >
      {showIcon && (
        <Icon className={cn(config.iconClassName, sizeClasses.icon, "mr-1")} />
      )}
      {config.label}
    </Badge>
  );
}

/**
 * Role Badge for display in lists/tables
 */
export function RoleBadgeCompact({ role }: { role: ChannelRole | string }) {
  return <RoleBadge role={role} size="sm" showIcon={false} />;
}

/**
 * Role Badge with icon for detailed views
 */
export function RoleBadgeWithIcon({ role }: { role: ChannelRole | string }) {
  return <RoleBadge role={role} size="md" showIcon={true} />;
}

/**
 * Large role badge for headers/emphasis
 */
export function RoleBadgeLarge({ role }: { role: ChannelRole | string }) {
  return <RoleBadge role={role} size="lg" showIcon={true} />;
}
