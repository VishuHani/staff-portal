/**
 * Profile Utility Functions
 * Helpers for user profile display, avatar management, and name formatting
 */

/**
 * Get user's full name from profile
 * Falls back to email if name not available
 */
export function getFullName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  if (user.lastName) {
    return user.lastName;
  }
  // Fallback to email username (before @)
  return user.email.split('@')[0];
}

/**
 * Get user's initials for avatar placeholder
 */
export function getInitials(user: {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}): string {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName.substring(0, 2).toUpperCase();
  }
  if (user.lastName) {
    return user.lastName.substring(0, 2).toUpperCase();
  }
  // Fallback to first 2 characters of email
  return user.email.substring(0, 2).toUpperCase();
}

/**
 * Get profile image URL or generate placeholder
 * Returns either the uploaded image or a placeholder based on initials
 */
export function getProfileImageUrl(user: {
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  email: string;
}): string | null {
  if (user.profileImage) {
    return user.profileImage;
  }
  // Return null for placeholder generation in component
  return null;
}

/**
 * Check if user has completed their profile
 */
export function isProfileComplete(user: {
  firstName?: string | null;
  lastName?: string | null;
  profileCompletedAt?: Date | null;
}): boolean {
  return !!user.profileCompletedAt;
}

/**
 * Get profile completion percentage
 */
export function getProfileCompletionPercentage(user: {
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
  phone?: string | null;
  bio?: string | null;
  dateOfBirth?: Date | null;
}): number {
  const fields = [
    user.firstName,
    user.lastName,
    user.profileImage,
    user.phone,
    user.bio,
    user.dateOfBirth,
  ];

  const completedFields = fields.filter(field => field !== null && field !== undefined && field !== '').length;
  return Math.round((completedFields / fields.length) * 100);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string | null): string | null {
  if (!phone) return null;

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX if 10 digits
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  // Return as-is if not standard format
  return phone;
}

/**
 * Generate placeholder avatar color based on user email
 * Consistent color for same user
 */
export function getAvatarColor(email: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-cyan-500',
  ];

  // Generate consistent index based on email
  const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * Validate profile image file
 */
export function validateProfileImage(file: File): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.',
    };
  }

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size too large. Maximum size is 5MB.',
    };
  }

  return { valid: true };
}

/**
 * Generate unique filename for avatar upload
 */
export function generateAvatarFilename(userId: string, file: File): string {
  const extension = file.name.split('.').pop();
  const timestamp = Date.now();
  return `avatars/${userId}_${timestamp}.${extension}`;
}
