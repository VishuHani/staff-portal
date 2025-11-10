"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, getAvatarColor, getFullName } from "@/lib/utils/profile";
import { cn } from "@/lib/utils";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface UserAvatarProps {
  imageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  size?: AvatarSize;
  className?: string;
  showOnlineIndicator?: boolean;
  isOnline?: boolean;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
  xl: "h-16 w-16 text-xl",
  "2xl": "h-24 w-24 text-2xl",
};

const indicatorSizeClasses: Record<AvatarSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
  xl: "h-4 w-4",
  "2xl": "h-5 w-5",
};

/**
 * UserAvatar Component
 *
 * Displays a user's profile image with fallback to initials.
 * Features:
 * - Multiple size options
 * - Consistent avatar colors based on name/email
 * - Optional online status indicator
 * - Automatic fallback to initials
 *
 * @example
 * ```tsx
 * <UserAvatar
 *   imageUrl={user.profileImage}
 *   firstName={user.firstName}
 *   lastName={user.lastName}
 *   email={user.email}
 *   size="md"
 * />
 * ```
 */
export function UserAvatar({
  imageUrl,
  firstName,
  lastName,
  email,
  size = "md",
  className,
  showOnlineIndicator = false,
  isOnline = false,
}: UserAvatarProps) {
  // Create user object for utility functions
  const user = { firstName, lastName, email };

  // Get initials for fallback
  const initials = getInitials(user);

  // Get full name for alt text
  const fullName = getFullName(user);

  // Get consistent avatar color based on email
  const avatarColor = getAvatarColor(email);

  return (
    <div className="relative inline-block">
      <Avatar className={cn(sizeClasses[size], className)}>
        {imageUrl && (
          <AvatarImage
            src={imageUrl}
            alt={fullName}
            className="object-cover"
          />
        )}
        <AvatarFallback
          className={cn("font-semibold text-white", avatarColor)}
        >
          {initials}
        </AvatarFallback>
      </Avatar>

      {showOnlineIndicator && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            indicatorSizeClasses[size],
            isOnline ? "bg-green-500" : "bg-gray-400"
          )}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}

interface UserAvatarWithNameProps extends UserAvatarProps {
  nameClassName?: string;
  emailClassName?: string;
  layout?: "horizontal" | "vertical";
}

/**
 * UserAvatarWithName Component
 *
 * Displays avatar with name and optionally email below/beside it.
 *
 * @example
 * ```tsx
 * <UserAvatarWithName
 *   imageUrl={user.profileImage}
 *   firstName={user.firstName}
 *   lastName={user.lastName}
 *   email={user.email}
 *   size="lg"
 *   layout="vertical"
 * />
 * ```
 */
export function UserAvatarWithName({
  imageUrl,
  firstName,
  lastName,
  email,
  size = "md",
  className,
  nameClassName,
  emailClassName,
  layout = "horizontal",
  showOnlineIndicator = false,
  isOnline = false,
}: UserAvatarWithNameProps) {
  // Get display name using utility function
  const user = { firstName, lastName, email };
  const displayName = getFullName(user);

  if (layout === "vertical") {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <UserAvatar
          imageUrl={imageUrl}
          firstName={firstName}
          lastName={lastName}
          email={email}
          size={size}
          showOnlineIndicator={showOnlineIndicator}
          isOnline={isOnline}
        />
        <div className="flex flex-col items-center">
          <p
            className={cn(
              "font-medium text-gray-900",
              nameClassName
            )}
          >
            {displayName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <UserAvatar
        imageUrl={imageUrl}
        firstName={firstName}
        lastName={lastName}
        email={email}
        size={size}
        showOnlineIndicator={showOnlineIndicator}
        isOnline={isOnline}
      />
      <div className="flex flex-col">
        <p className={cn("font-medium text-gray-900", nameClassName)}>
          {displayName}
        </p>
      </div>
    </div>
  );
}

interface AvatarGroupProps {
  users: Array<{
    imageUrl?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  }>;
  size?: AvatarSize;
  max?: number;
  className?: string;
}

/**
 * AvatarGroup Component
 *
 * Displays multiple user avatars in an overlapping stack.
 * Shows count if more than max users.
 *
 * @example
 * ```tsx
 * <AvatarGroup
 *   users={[
 *     { firstName: "John", lastName: "Doe", email: "john@example.com", imageUrl: "/avatar1.jpg" },
 *     ...
 *   ]}
 *   size="sm"
 *   max={3}
 * />
 * ```
 */
export function AvatarGroup({
  users,
  size = "sm",
  max = 3,
  className,
}: AvatarGroupProps) {
  const displayUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {displayUsers.map((user, index) => (
        <div
          key={index}
          className="ring-2 ring-white rounded-full"
          style={{ zIndex: displayUsers.length - index }}
        >
          <UserAvatar
            imageUrl={user.imageUrl}
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            size={size}
          />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium ring-2 ring-white",
            sizeClasses[size]
          )}
          style={{ zIndex: 0 }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
