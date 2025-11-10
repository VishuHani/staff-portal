/**
 * UserAvatar Component
 * Displays user profile image or generates placeholder with initials
 */

import { User } from 'lucide-react';
import { getInitials, getAvatarColor } from '@/lib/utils/profile';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    email: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showFallbackIcon?: boolean; // Show user icon if no image and no name
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-24 w-24 text-2xl',
};

const iconSizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-12 w-12',
};

export function UserAvatar({
  user,
  size = 'md',
  className,
  showFallbackIcon = false,
}: UserAvatarProps) {
  const initials = getInitials(user);
  const avatarColor = getAvatarColor(user.email);

  // Has uploaded profile image
  if (user.profileImage) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0',
          sizeClasses[size],
          className
        )}
      >
        <img
          src={user.profileImage}
          alt={`${user.firstName || user.email}'s avatar`}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // Has name - show initials placeholder
  if (user.firstName || user.lastName) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex items-center justify-center font-semibold text-white flex-shrink-0',
          sizeClasses[size],
          avatarColor,
          className
        )}
      >
        {initials}
      </div>
    );
  }

  // No name and no image - show icon fallback if enabled
  if (showFallbackIcon) {
    return (
      <div
        className={cn(
          'relative rounded-full overflow-hidden flex items-center justify-center bg-gray-300 text-gray-600 flex-shrink-0',
          sizeClasses[size],
          className
        )}
      >
        <User className={iconSizeClasses[size]} />
      </div>
    );
  }

  // Default: show initials from email
  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden flex items-center justify-center font-semibold text-white flex-shrink-0',
        sizeClasses[size],
        avatarColor,
        className
      )}
    >
      {initials}
    </div>
  );
}
