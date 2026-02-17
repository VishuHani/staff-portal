/**
 * Shift Diff Utility
 * Compares two rosters to detect shift changes for notifications
 */

import { format } from "date-fns";

// Types for shift comparison
export interface ShiftForComparison {
  id: string;
  userId: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  position: string | null;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

export type ShiftChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "REASSIGNED";

export interface ShiftChange {
  type: ShiftChangeType;
  shiftId: string;
  userId: string | null; // The affected user
  previousUserId?: string | null; // For REASSIGNED changes
  date: Date;
  startTime: string;
  endTime: string;
  position: string | null;
  userName?: string;
  previousUserName?: string;
  changes?: {
    field: string;
    oldValue: string;
    newValue: string;
  }[];
}

export interface RosterDiff {
  added: ShiftChange[];
  removed: ShiftChange[];
  modified: ShiftChange[];
  reassigned: ShiftChange[];
  summary: {
    totalChanges: number;
    affectedUsers: string[]; // User IDs who need notification
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    reassignedCount: number;
  };
}

/**
 * Create a unique key for a shift based on date, time, and position
 * Used to match shifts between old and new rosters
 */
function createShiftKey(shift: ShiftForComparison): string {
  const dateStr = format(new Date(shift.date), "yyyy-MM-dd");
  return `${dateStr}|${shift.startTime}|${shift.endTime}|${shift.position || ""}`;
}

/**
 * Get display name for a user
 */
function getUserName(user: ShiftForComparison["user"]): string {
  if (!user) return "Unassigned";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email;
}

/**
 * Compare two rosters and return the differences
 * @param oldShifts - Shifts from the previous version (or empty for new rosters)
 * @param newShifts - Shifts from the new version
 */
export function compareRosterShifts(
  oldShifts: ShiftForComparison[],
  newShifts: ShiftForComparison[]
): RosterDiff {
  const added: ShiftChange[] = [];
  const removed: ShiftChange[] = [];
  const modified: ShiftChange[] = [];
  const reassigned: ShiftChange[] = [];
  const affectedUserIds = new Set<string>();

  // Create maps for efficient lookup
  const oldShiftMap = new Map<string, ShiftForComparison>();
  const newShiftMap = new Map<string, ShiftForComparison>();

  for (const shift of oldShifts) {
    oldShiftMap.set(createShiftKey(shift), shift);
  }

  for (const shift of newShifts) {
    newShiftMap.set(createShiftKey(shift), shift);
  }

  // Find ADDED shifts (in new but not in old)
  for (const [key, newShift] of newShiftMap) {
    if (!oldShiftMap.has(key)) {
      if (newShift.userId) {
        affectedUserIds.add(newShift.userId);
        added.push({
          type: "ADDED",
          shiftId: newShift.id,
          userId: newShift.userId,
          date: newShift.date,
          startTime: newShift.startTime,
          endTime: newShift.endTime,
          position: newShift.position,
          userName: getUserName(newShift.user),
        });
      }
    }
  }

  // Find REMOVED shifts (in old but not in new)
  for (const [key, oldShift] of oldShiftMap) {
    if (!newShiftMap.has(key)) {
      if (oldShift.userId) {
        affectedUserIds.add(oldShift.userId);
        removed.push({
          type: "REMOVED",
          shiftId: oldShift.id,
          userId: oldShift.userId,
          date: oldShift.date,
          startTime: oldShift.startTime,
          endTime: oldShift.endTime,
          position: oldShift.position,
          userName: getUserName(oldShift.user),
        });
      }
    }
  }

  // Find MODIFIED and REASSIGNED shifts (exist in both)
  for (const [key, newShift] of newShiftMap) {
    const oldShift = oldShiftMap.get(key);
    if (!oldShift) continue;

    // Check if user assignment changed
    if (oldShift.userId !== newShift.userId) {
      // Track both old and new users
      if (oldShift.userId) affectedUserIds.add(oldShift.userId);
      if (newShift.userId) affectedUserIds.add(newShift.userId);

      reassigned.push({
        type: "REASSIGNED",
        shiftId: newShift.id,
        userId: newShift.userId,
        previousUserId: oldShift.userId,
        date: newShift.date,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        position: newShift.position,
        userName: getUserName(newShift.user),
        previousUserName: getUserName(oldShift.user),
      });
    }

    // Check for other modifications (break time changes)
    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    if (oldShift.breakMinutes !== newShift.breakMinutes) {
      changes.push({
        field: "breakMinutes",
        oldValue: `${oldShift.breakMinutes} min`,
        newValue: `${newShift.breakMinutes} min`,
      });
    }

    // If there are modifications and it wasn't a reassignment
    if (changes.length > 0 && oldShift.userId === newShift.userId && newShift.userId) {
      affectedUserIds.add(newShift.userId);
      modified.push({
        type: "MODIFIED",
        shiftId: newShift.id,
        userId: newShift.userId,
        date: newShift.date,
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        position: newShift.position,
        userName: getUserName(newShift.user),
        changes,
      });
    }
  }

  return {
    added,
    removed,
    modified,
    reassigned,
    summary: {
      totalChanges: added.length + removed.length + modified.length + reassigned.length,
      affectedUsers: Array.from(affectedUserIds),
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      reassignedCount: reassigned.length,
    },
  };
}

/**
 * Get changes affecting a specific user
 */
export function getChangesForUser(diff: RosterDiff, userId: string): ShiftChange[] {
  const userChanges: ShiftChange[] = [];

  // Added shifts for this user
  userChanges.push(...diff.added.filter((c) => c.userId === userId));

  // Removed shifts for this user
  userChanges.push(...diff.removed.filter((c) => c.userId === userId));

  // Modified shifts for this user
  userChanges.push(...diff.modified.filter((c) => c.userId === userId));

  // Reassigned shifts (where user gained or lost shift)
  userChanges.push(
    ...diff.reassigned.filter((c) => c.userId === userId || c.previousUserId === userId)
  );

  return userChanges;
}

/**
 * Format shift change for notification message
 */
export function formatShiftChangeMessage(change: ShiftChange): string {
  const dateStr = format(new Date(change.date), "EEE, MMM d");
  const timeStr = `${change.startTime} - ${change.endTime}`;
  const positionStr = change.position ? ` (${change.position})` : "";

  switch (change.type) {
    case "ADDED":
      return `New shift added: ${dateStr} ${timeStr}${positionStr}`;
    case "REMOVED":
      return `Shift removed: ${dateStr} ${timeStr}${positionStr}`;
    case "MODIFIED":
      const changesStr = change.changes
        ?.map((c) => `${c.field}: ${c.oldValue} → ${c.newValue}`)
        .join(", ");
      return `Shift modified: ${dateStr} ${timeStr}${positionStr} - ${changesStr}`;
    case "REASSIGNED":
      return `Shift reassigned: ${dateStr} ${timeStr}${positionStr}`;
    default:
      return `Shift changed: ${dateStr} ${timeStr}${positionStr}`;
  }
}

/**
 * Create a summary notification message for a user
 */
export function createUserChangeSummary(
  changes: ShiftChange[],
  userId: string,
  venueName: string,
  dateRange: string
): string {
  if (changes.length === 0) return "";

  const added = changes.filter((c) => c.type === "ADDED").length;
  const removed = changes.filter((c) => c.type === "REMOVED").length;
  const reassignedIn = changes.filter(
    (c) => c.type === "REASSIGNED" && c.userId === userId
  ).length;
  const reassignedOut = changes.filter(
    (c) => c.type === "REASSIGNED" && c.previousUserId === userId
  ).length;
  const modified = changes.filter((c) => c.type === "MODIFIED").length;

  const parts: string[] = [];

  if (added > 0) parts.push(`${added} new shift${added > 1 ? "s" : ""}`);
  if (removed > 0) parts.push(`${removed} shift${removed > 1 ? "s" : ""} removed`);
  if (reassignedIn > 0)
    parts.push(`${reassignedIn} shift${reassignedIn > 1 ? "s" : ""} assigned to you`);
  if (reassignedOut > 0)
    parts.push(`${reassignedOut} shift${reassignedOut > 1 ? "s" : ""} reassigned away`);
  if (modified > 0) parts.push(`${modified} shift${modified > 1 ? "s" : ""} modified`);

  return `${venueName} roster (${dateRange}) updated: ${parts.join(", ")}. Please review your schedule.`;
}
