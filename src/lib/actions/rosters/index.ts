// Roster Actions
export {
  createRoster,
  updateRoster,
  deleteRoster,
  archiveRoster,
  copyRoster,
  type CreateRosterInput,
  type UpdateRosterInput,
  type CopyRosterInput,
} from "./roster-actions";

// Shift Actions
export {
  addShift,
  updateShift,
  deleteShift,
  bulkAddShifts,
  checkShiftConflicts,
  recheckRosterConflicts,
  type ShiftInput,
} from "./shift-actions";

// Roster Queries
export {
  getRosters,
  getRosterById,
  getRosterVersionChain,
  getMyShifts,
  getVenueStaff,
  getRosterStats,
  getAdjacentRoster,
  type RosterFilters,
  type DateRange,
} from "./roster-queries";

// Approval Actions (New Manager Self-Review Workflow)
export {
  // New workflow functions
  finalizeRoster,
  publishRoster,
  revertToDraft,
  // Legacy functions (redirects to new workflow)
  submitForReview,
  approveRoster,
  rejectRoster,
  recallSubmission,
  // Query functions
  getPendingApprovals,
  getApprovalHistory,
  getPendingApprovalsCount,
  // Types
  type ApprovalResult,
  type PendingApproval,
  type ApprovalComment,
} from "./approval-actions";

// Version Actions
export {
  getVersionHistory,
  getVersionSnapshot,
  getVersionDiff,
  compareRosterVersions,
  createVersionSnapshot,
  rollbackToVersion,
  restoreFromVersion,
  previewMerge,
  applyMerge,
  type VersionEntry,
  type ShiftSnapshot,
  type VersionDiff,
  type MergePreview,
} from "./version-actions";

// Chain Repair Actions (Admin only)
export {
  repairChainActiveFlags,
  diagnoseChainIntegrity,
} from "./repair-chains";
