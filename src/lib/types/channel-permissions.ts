/**
 * Channel Permissions System
 *
 * Defines granular permissions for channel operations.
 * Stored in Channel.permissions JSON field.
 */

export type ChannelPermissionLevel = "EVERYONE" | "MEMBERS" | "MODERATORS" | "CREATORS";

export interface ChannelPermissions {
  /**
   * Who can view posts in this channel
   * Default: MEMBERS
   */
  canViewPosts: ChannelPermissionLevel;

  /**
   * Who can create posts in this channel
   * Default: MEMBERS
   */
  canCreatePosts: ChannelPermissionLevel;

  /**
   * Who can edit their own posts
   * Default: MEMBERS
   */
  canEditOwnPosts: ChannelPermissionLevel;

  /**
   * Who can delete their own posts
   * Default: MEMBERS
   */
  canDeleteOwnPosts: ChannelPermissionLevel;

  /**
   * Who can edit any posts (moderation)
   * Default: MODERATORS
   */
  canEditAnyPosts: ChannelPermissionLevel;

  /**
   * Who can delete any posts (moderation)
   * Default: MODERATORS
   */
  canDeleteAnyPosts: ChannelPermissionLevel;

  /**
   * Who can add comments/reactions to posts
   * Default: MEMBERS
   */
  canComment: ChannelPermissionLevel;

  /**
   * Who can pin posts
   * Default: MODERATORS
   */
  canPinPosts: ChannelPermissionLevel;

  /**
   * Who can invite new members to the channel
   * Default: MODERATORS
   */
  canInviteMembers: ChannelPermissionLevel;

  /**
   * Who can remove members from the channel
   * Default: MODERATORS
   */
  canRemoveMembers: ChannelPermissionLevel;

  /**
   * Whether this channel is read-only
   * Default: false
   */
  isReadOnly: boolean;

  /**
   * Whether posts require approval before being published
   * Default: false
   */
  requiresApproval: boolean;
}

/**
 * Default channel permissions
 * Used when creating new channels or when permissions are not set
 */
export const DEFAULT_CHANNEL_PERMISSIONS: ChannelPermissions = {
  canViewPosts: "MEMBERS",
  canCreatePosts: "MEMBERS",
  canEditOwnPosts: "MEMBERS",
  canDeleteOwnPosts: "MEMBERS",
  canEditAnyPosts: "MODERATORS",
  canDeleteAnyPosts: "MODERATORS",
  canComment: "MEMBERS",
  canPinPosts: "MODERATORS",
  canInviteMembers: "MODERATORS",
  canRemoveMembers: "MODERATORS",
  isReadOnly: false,
  requiresApproval: false,
};

/**
 * Preset permission templates for common channel types
 */
export const PERMISSION_PRESETS: Record<
  string,
  { label: string; description: string; permissions: ChannelPermissions }
> = {
  PUBLIC: {
    label: "Public (Default)",
    description: "All members can post and comment",
    permissions: DEFAULT_CHANNEL_PERMISSIONS,
  },
  ANNOUNCEMENTS: {
    label: "Announcements Only",
    description: "Only moderators and creators can post, everyone can view",
    permissions: {
      ...DEFAULT_CHANNEL_PERMISSIONS,
      canCreatePosts: "MODERATORS",
      canEditOwnPosts: "MODERATORS",
      canDeleteOwnPosts: "MODERATORS",
      canComment: "MEMBERS",
    },
  },
  READ_ONLY: {
    label: "Read-Only",
    description: "Only creators can post, no one can comment",
    permissions: {
      ...DEFAULT_CHANNEL_PERMISSIONS,
      canCreatePosts: "CREATORS",
      canEditOwnPosts: "CREATORS",
      canDeleteOwnPosts: "CREATORS",
      canComment: "CREATORS",
      isReadOnly: true,
    },
  },
  MODERATED: {
    label: "Moderated",
    description: "Posts require approval before being published",
    permissions: {
      ...DEFAULT_CHANNEL_PERMISSIONS,
      requiresApproval: true,
    },
  },
  RESTRICTED: {
    label: "Restricted",
    description: "Only moderators and creators can post and comment",
    permissions: {
      ...DEFAULT_CHANNEL_PERMISSIONS,
      canCreatePosts: "MODERATORS",
      canComment: "MODERATORS",
    },
  },
};

/**
 * Permission level hierarchy
 * Higher levels inherit lower level permissions
 */
export const PERMISSION_HIERARCHY: Record<ChannelPermissionLevel, number> = {
  EVERYONE: 0,
  MEMBERS: 1,
  MODERATORS: 2,
  CREATORS: 3,
};

/**
 * Check if a user's role meets the required permission level
 */
export function hasPermissionLevel(
  userRole: "CREATOR" | "MODERATOR" | "MEMBER" | null,
  requiredLevel: ChannelPermissionLevel,
  isMember: boolean = true
): boolean {
  // If permission is EVERYONE, always allow
  if (requiredLevel === "EVERYONE") {
    return true;
  }

  // If permission requires MEMBERS, user must be a member
  if (requiredLevel === "MEMBERS" && !isMember) {
    return false;
  }

  // If user is not a member, deny (for MEMBERS, MODERATORS, CREATORS)
  if (!isMember && requiredLevel !== "EVERYONE") {
    return false;
  }

  // Map user role to hierarchy level
  // Note: Database uses MEMBER, MODERATOR, CREATOR
  // Permission system uses MEMBERS, MODERATORS, CREATORS
  const userLevel = userRole
    ? userRole === "CREATOR"
      ? PERMISSION_HIERARCHY.CREATORS
      : userRole === "MODERATOR"
      ? PERMISSION_HIERARCHY.MODERATORS
      : PERMISSION_HIERARCHY.MEMBERS
    : isMember
    ? PERMISSION_HIERARCHY.MEMBERS
    : PERMISSION_HIERARCHY.EVERYONE;

  const requiredHierarchyLevel = PERMISSION_HIERARCHY[requiredLevel];

  // User level must be >= required level
  return userLevel >= requiredHierarchyLevel;
}

/**
 * Parse channel permissions from JSON
 * Returns default permissions if parsing fails
 */
export function parseChannelPermissions(
  permissionsJson: any
): ChannelPermissions {
  if (!permissionsJson || typeof permissionsJson !== "object") {
    return DEFAULT_CHANNEL_PERMISSIONS;
  }

  return {
    canViewPosts:
      permissionsJson.canViewPosts || DEFAULT_CHANNEL_PERMISSIONS.canViewPosts,
    canCreatePosts:
      permissionsJson.canCreatePosts ||
      DEFAULT_CHANNEL_PERMISSIONS.canCreatePosts,
    canEditOwnPosts:
      permissionsJson.canEditOwnPosts ||
      DEFAULT_CHANNEL_PERMISSIONS.canEditOwnPosts,
    canDeleteOwnPosts:
      permissionsJson.canDeleteOwnPosts ||
      DEFAULT_CHANNEL_PERMISSIONS.canDeleteOwnPosts,
    canEditAnyPosts:
      permissionsJson.canEditAnyPosts ||
      DEFAULT_CHANNEL_PERMISSIONS.canEditAnyPosts,
    canDeleteAnyPosts:
      permissionsJson.canDeleteAnyPosts ||
      DEFAULT_CHANNEL_PERMISSIONS.canDeleteAnyPosts,
    canComment:
      permissionsJson.canComment || DEFAULT_CHANNEL_PERMISSIONS.canComment,
    canPinPosts:
      permissionsJson.canPinPosts || DEFAULT_CHANNEL_PERMISSIONS.canPinPosts,
    canInviteMembers:
      permissionsJson.canInviteMembers ||
      DEFAULT_CHANNEL_PERMISSIONS.canInviteMembers,
    canRemoveMembers:
      permissionsJson.canRemoveMembers ||
      DEFAULT_CHANNEL_PERMISSIONS.canRemoveMembers,
    isReadOnly:
      permissionsJson.isReadOnly ?? DEFAULT_CHANNEL_PERMISSIONS.isReadOnly,
    requiresApproval:
      permissionsJson.requiresApproval ??
      DEFAULT_CHANNEL_PERMISSIONS.requiresApproval,
  };
}

/**
 * Validate channel permissions object
 */
export function validateChannelPermissions(
  permissions: any
): permissions is ChannelPermissions {
  if (!permissions || typeof permissions !== "object") {
    return false;
  }

  const validLevels: ChannelPermissionLevel[] = [
    "EVERYONE",
    "MEMBERS",
    "MODERATORS",
    "CREATORS",
  ];

  return (
    validLevels.includes(permissions.canViewPosts) &&
    validLevels.includes(permissions.canCreatePosts) &&
    validLevels.includes(permissions.canEditOwnPosts) &&
    validLevels.includes(permissions.canDeleteOwnPosts) &&
    validLevels.includes(permissions.canEditAnyPosts) &&
    validLevels.includes(permissions.canDeleteAnyPosts) &&
    validLevels.includes(permissions.canComment) &&
    validLevels.includes(permissions.canPinPosts) &&
    validLevels.includes(permissions.canInviteMembers) &&
    validLevels.includes(permissions.canRemoveMembers) &&
    typeof permissions.isReadOnly === "boolean" &&
    typeof permissions.requiresApproval === "boolean"
  );
}
