/**
 * Soft Delete Utilities - Phase 4 Code Quality (Nov 2025)
 *
 * Provides utilities for soft delete operations.
 * Soft delete sets a `deletedAt` timestamp instead of permanently removing records.
 *
 * Benefits:
 * - Data recovery is possible
 * - Audit trail is preserved
 * - Referential integrity is maintained
 * - Compliance requirements (data retention)
 *
 * Usage:
 * ```ts
 * // Soft delete a record
 * await softDelete(prisma.user, userId);
 *
 * // Check if deleted
 * if (isDeleted(user)) { ... }
 *
 * // Restore a record
 * await restore(prisma.user, userId);
 *
 * // Get where clause to exclude deleted
 * const users = await prisma.user.findMany({
 *   where: notDeleted()
 * });
 * ```
 */

import { Prisma } from "@prisma/client";

/**
 * Type for models that support soft delete
 */
export interface SoftDeletable {
  deletedAt: Date | null;
}

/**
 * Prisma where input for filtering soft-deleted records
 */
export type SoftDeleteWhere = {
  deletedAt: null | { not: null };
};

/**
 * Get where clause to exclude soft-deleted records
 *
 * @returns Where clause fragment { deletedAt: null }
 *
 * @example
 * const activeUsers = await prisma.user.findMany({
 *   where: {
 *     ...notDeleted(),
 *     active: true
 *   }
 * });
 */
export function notDeleted(): { deletedAt: null } {
  return { deletedAt: null };
}

/**
 * Get where clause to include only soft-deleted records
 *
 * @returns Where clause fragment { deletedAt: { not: null } }
 *
 * @example
 * const deletedUsers = await prisma.user.findMany({
 *   where: onlyDeleted()
 * });
 */
export function onlyDeleted(): { deletedAt: { not: null } } {
  return { deletedAt: { not: null } };
}

/**
 * Check if a record has been soft deleted
 *
 * @param record - Record with deletedAt field
 * @returns true if deletedAt is set, false otherwise
 */
export function isDeleted(record: SoftDeletable): boolean {
  return record.deletedAt !== null;
}

/**
 * Check if a record is active (not soft deleted)
 *
 * @param record - Record with deletedAt field
 * @returns true if deletedAt is null, false otherwise
 */
export function isActive(record: SoftDeletable): boolean {
  return record.deletedAt === null;
}

/**
 * Get the soft delete update data
 *
 * @returns Update data to set deletedAt to current time
 *
 * @example
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: softDeleteData()
 * });
 */
export function softDeleteData(): { deletedAt: Date } {
  return { deletedAt: new Date() };
}

/**
 * Get the restore update data
 *
 * @returns Update data to clear deletedAt
 *
 * @example
 * await prisma.user.update({
 *   where: { id: userId },
 *   data: restoreData()
 * });
 */
export function restoreData(): { deletedAt: null } {
  return { deletedAt: null };
}

/**
 * Soft delete a single record by ID
 *
 * @param model - Prisma model delegate (e.g., prisma.user)
 * @param id - Record ID
 * @returns Updated record with deletedAt set
 *
 * @example
 * const deletedUser = await softDeleteById(prisma.user, userId);
 */
export async function softDeleteById<T>(
  model: {
    update: (args: { where: { id: string }; data: { deletedAt: Date } }) => Promise<T>;
  },
  id: string
): Promise<T> {
  return model.update({
    where: { id },
    data: softDeleteData(),
  });
}

/**
 * Restore a soft-deleted record by ID
 *
 * @param model - Prisma model delegate (e.g., prisma.user)
 * @param id - Record ID
 * @returns Updated record with deletedAt cleared
 *
 * @example
 * const restoredUser = await restoreById(prisma.user, userId);
 */
export async function restoreById<T>(
  model: {
    update: (args: { where: { id: string }; data: { deletedAt: null } }) => Promise<T>;
  },
  id: string
): Promise<T> {
  return model.update({
    where: { id },
    data: restoreData(),
  });
}

/**
 * Soft delete multiple records by IDs
 *
 * @param model - Prisma model delegate
 * @param ids - Array of record IDs
 * @returns Count of updated records
 *
 * @example
 * const result = await softDeleteMany(prisma.user, [id1, id2, id3]);
 * console.log(`Deleted ${result.count} users`);
 */
export async function softDeleteMany(
  model: {
    updateMany: (args: {
      where: { id: { in: string[] } };
      data: { deletedAt: Date };
    }) => Promise<{ count: number }>;
  },
  ids: string[]
): Promise<{ count: number }> {
  return model.updateMany({
    where: { id: { in: ids } },
    data: softDeleteData(),
  });
}

/**
 * Restore multiple soft-deleted records by IDs
 *
 * @param model - Prisma model delegate
 * @param ids - Array of record IDs
 * @returns Count of updated records
 */
export async function restoreMany(
  model: {
    updateMany: (args: {
      where: { id: { in: string[] } };
      data: { deletedAt: null };
    }) => Promise<{ count: number }>;
  },
  ids: string[]
): Promise<{ count: number }> {
  return model.updateMany({
    where: { id: { in: ids } },
    data: restoreData(),
  });
}

/**
 * Permanently delete soft-deleted records older than specified days
 *
 * Use this for GDPR compliance or storage cleanup.
 * CAUTION: This permanently removes data!
 *
 * @param model - Prisma model delegate
 * @param olderThanDays - Delete records soft-deleted more than N days ago
 * @returns Count of permanently deleted records
 *
 * @example
 * // Delete records soft-deleted more than 30 days ago
 * const result = await permanentlyDeleteOld(prisma.user, 30);
 */
export async function permanentlyDeleteOld(
  model: {
    deleteMany: (args: {
      where: { deletedAt: { not: null; lt: Date } };
    }) => Promise<{ count: number }>;
  },
  olderThanDays: number
): Promise<{ count: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  return model.deleteMany({
    where: {
      deletedAt: {
        not: null,
        lt: cutoffDate,
      },
    },
  });
}
