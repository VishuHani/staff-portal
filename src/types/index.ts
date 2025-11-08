// Core Types
export type UserRole = "ADMIN" | "MANAGER" | "STAFF";

export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TimeOffType = "VACATION" | "SICK" | "PERSONAL" | "OTHER";

export type ChannelType = "ALL_STAFF" | "MANAGERS" | "CUSTOM";

export type ConversationType = "ONE_ON_ONE" | "GROUP";

// Permission Types
export type PermissionResource =
  | "availability"
  | "time_off"
  | "posts"
  | "messages"
  | "admin"
  | "users"
  | "roles";

export type PermissionAction =
  | "view_own"
  | "edit_own"
  | "view_team"
  | "edit_team"
  | "create"
  | "approve"
  | "moderate"
  | "manage";
