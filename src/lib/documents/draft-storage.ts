/**
 * Draft Auto-Save Storage
 * 
 * This module provides LocalStorage-based draft saving for form data:
 * - Auto-save every 30 seconds
 * - Draft recovery on page load
 * - Clear draft on successful submission
 * - Support for multiple drafts (one per form/assignment)
 */

import { FormData, FormSchema } from '@/lib/types/form-schema';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Draft metadata
 */
export interface DraftMetadata {
  id: string;
  formId: string;
  formName: string;
  assignmentId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  version: number;
}

/**
 * Stored draft with data and metadata
 */
export interface StoredDraft {
  metadata: DraftMetadata;
  data: FormData;
}

/**
 * Draft storage configuration
 */
export interface DraftStorageConfig {
  storageKey: string;
  maxDraftAge: number; // in days
  maxDrafts: number;
  autoSaveInterval: number; // in milliseconds
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: DraftStorageConfig = {
  storageKey: 'document_drafts',
  maxDraftAge: 7, // 7 days
  maxDrafts: 50,
  autoSaveInterval: 30000, // 30 seconds
};

// ============================================================================
// STORAGE HELPERS
// ============================================================================

/**
 * Get all drafts from localStorage
 */
function getAllDrafts(): Record<string, StoredDraft> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(DEFAULT_CONFIG.storageKey);
    if (!stored) return {};
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to read drafts from localStorage:', error);
    return {};
  }
}

/**
 * Save all drafts to localStorage
 */
function saveAllDrafts(drafts: Record<string, StoredDraft>): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(DEFAULT_CONFIG.storageKey, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to save drafts to localStorage:', error);
    
    // If storage is full, try to clean up old drafts
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      cleanupOldDrafts();
      try {
        localStorage.setItem(DEFAULT_CONFIG.storageKey, JSON.stringify(drafts));
      } catch {
        console.error('Failed to save drafts even after cleanup');
      }
    }
  }
}

/**
 * Clean up old/expired drafts
 */
function cleanupOldDrafts(): void {
  const drafts = getAllDrafts();
  const now = new Date();
  const maxAge = DEFAULT_CONFIG.maxDraftAge * 24 * 60 * 60 * 1000; // days to ms
  
  const validDrafts: Record<string, StoredDraft> = {};
  
  for (const [id, draft] of Object.entries(drafts)) {
    const expiresAt = new Date(draft.metadata.expiresAt);
    if (expiresAt > now) {
      validDrafts[id] = draft;
    }
  }
  
  saveAllDrafts(validDrafts);
}

/**
 * Generate a unique draft ID
 */
function generateDraftId(formId: string, assignmentId?: string): string {
  if (assignmentId) {
    return `draft_${formId}_${assignmentId}`;
  }
  return `draft_${formId}_${Date.now()}`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Save a draft
 */
export function saveDraft(
  formId: string,
  formName: string,
  data: FormData,
  assignmentId?: string
): DraftMetadata {
  const drafts = getAllDrafts();
  const draftId = assignmentId 
    ? `draft_${formId}_${assignmentId}`
    : generateDraftId(formId);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_CONFIG.maxDraftAge * 24 * 60 * 60 * 1000);
  
  const existingDraft = drafts[draftId];
  
  const metadata: DraftMetadata = {
    id: draftId,
    formId,
    formName,
    assignmentId,
    createdAt: existingDraft?.metadata.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    version: (existingDraft?.metadata.version || 0) + 1,
  };
  
  const draft: StoredDraft = {
    metadata,
    data,
  };
  
  drafts[draftId] = draft;
  saveAllDrafts(drafts);
  
  return metadata;
}

/**
 * Load a draft
 */
export function loadDraft(
  formId: string,
  assignmentId?: string
): StoredDraft | null {
  const drafts = getAllDrafts();
  const draftId = assignmentId 
    ? `draft_${formId}_${assignmentId}`
    : null;
  
  if (!draftId) return null;
  
  const draft = drafts[draftId];
  
  if (!draft) return null;
  
  // Check if draft has expired
  const expiresAt = new Date(draft.metadata.expiresAt);
  if (expiresAt < new Date()) {
    deleteDraft(draftId);
    return null;
  }
  
  return draft;
}

/**
 * Delete a draft
 */
export function deleteDraft(draftId: string): void {
  const drafts = getAllDrafts();
  delete drafts[draftId];
  saveAllDrafts(drafts);
}

/**
 * Clear draft for a specific form/assignment
 */
export function clearDraft(formId: string, assignmentId?: string): void {
  const draftId = assignmentId 
    ? `draft_${formId}_${assignmentId}`
    : null;
  
  if (draftId) {
    deleteDraft(draftId);
  }
}

/**
 * Get all drafts for a form
 */
export function getDraftsForForm(formId: string): StoredDraft[] {
  const drafts = getAllDrafts();
  
  return Object.values(drafts).filter(
    (draft) => draft.metadata.formId === formId
  );
}

/**
 * Get all drafts (for admin/debug purposes)
 */
export function getAllStoredDrafts(): StoredDraft[] {
  const drafts = getAllDrafts();
  return Object.values(drafts);
}

/**
 * Check if a draft exists
 */
export function hasDraft(formId: string, assignmentId?: string): boolean {
  return loadDraft(formId, assignmentId) !== null;
}

/**
 * Get draft count
 */
export function getDraftCount(): number {
  const drafts = getAllDrafts();
  return Object.keys(drafts).length;
}

/**
 * Clear all drafts
 */
export function clearAllDrafts(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEFAULT_CONFIG.storageKey);
}

/**
 * Clear expired drafts
 */
export function clearExpiredDrafts(): number {
  const drafts = getAllDrafts();
  const now = new Date();
  let cleared = 0;
  
  const validDrafts: Record<string, StoredDraft> = {};
  
  for (const [id, draft] of Object.entries(drafts)) {
    const expiresAt = new Date(draft.metadata.expiresAt);
    if (expiresAt > now) {
      validDrafts[id] = draft;
    } else {
      cleared++;
    }
  }
  
  saveAllDrafts(validDrafts);
  return cleared;
}

// ============================================================================
// AUTO-SAVE HOOK
// ============================================================================

/**
 * Auto-save options
 */
export interface AutoSaveOptions {
  formId: string;
  formName: string;
  assignmentId?: string;
  interval?: number;
  enabled?: boolean;
  onSave?: (metadata: DraftMetadata) => void;
  onError?: (error: Error) => void;
}

/**
 * Create an auto-save manager
 */
export function createAutoSave(options: AutoSaveOptions) {
  const {
    formId,
    formName,
    assignmentId,
    interval = DEFAULT_CONFIG.autoSaveInterval,
    enabled = true,
    onSave,
    onError,
  } = options;
  
  let timeoutId: NodeJS.Timeout | null = null;
  let lastData: FormData | null = null;
  let isDirty = false;
  
  /**
   * Save the current data
   */
  const save = (data: FormData): DraftMetadata | null => {
    try {
      const metadata = saveDraft(formId, formName, data, assignmentId);
      lastData = data;
      isDirty = false;
      onSave?.(metadata);
      return metadata;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to save draft'));
      return null;
    }
  };
  
  /**
   * Schedule the next auto-save
   */
  const scheduleNext = (data: FormData) => {
    if (!enabled) return;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      if (isDirty) {
        save(data);
      }
      scheduleNext(data);
    }, interval);
  };
  
  /**
   * Mark data as changed
   */
  const markDirty = (data: FormData) => {
    isDirty = true;
    lastData = data;
  };
  
  /**
   * Start auto-save
   */
  const start = (initialData?: FormData) => {
    if (!enabled) return;
    
    if (initialData) {
      lastData = initialData;
    }
    
    scheduleNext(lastData || {});
  };
  
  /**
   * Stop auto-save
   */
  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  /**
   * Force save now
   */
  const forceSave = (): DraftMetadata | null => {
    if (lastData) {
      return save(lastData);
    }
    return null;
  };
  
  /**
   * Clear the draft
   */
  const clear = () => {
    clearDraft(formId, assignmentId);
    lastData = null;
    isDirty = false;
  };
  
  return {
    save,
    markDirty,
    start,
    stop,
    forceSave,
    clear,
    isDirty: () => isDirty,
    getLastData: () => lastData,
  };
}

// ============================================================================
// DRAFT RECOVERY
// ============================================================================

/**
 * Check for and offer to recover draft
 */
export function checkForDraftRecovery(
  formId: string,
  assignmentId?: string
): {
  hasDraft: boolean;
  draft: StoredDraft | null;
  recover: () => FormData | null;
  discard: () => void;
} {
  const draft = loadDraft(formId, assignmentId);
  
  return {
    hasDraft: draft !== null,
    draft,
    recover: () => draft?.data || null,
    discard: () => {
      if (draft) {
        deleteDraft(draft.metadata.id);
      }
    },
  };
}

/**
 * Format draft age for display
 */
export function formatDraftAge(updatedAt: string): string {
  const updated = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - updated.getTime();
  
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// ============================================================================
// EXPORT DEFAULT CONFIG
// ============================================================================

export { DEFAULT_CONFIG };
