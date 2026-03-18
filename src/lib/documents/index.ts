/**
 * PDF Processing Library Index
 * 
 * Export all PDF processing utilities for the Document Management System.
 */

// Types
export * from './pdf-types';

// Field Extraction
export {
  getPDFDocumentInfo,
  extractPDFFormFields,
  determinePDFFieldType,
  hasFillableFields,
  getFieldCounts,
  isValidPDFFieldName,
  sanitizePDFFieldName,
} from './pdf-field-extraction';

// Rendering (PDF.js)
export {
  loadPDFDocument,
  loadPDFDocumentWithProgress,
  renderPDFPage,
  renderPDFPages,
  generatePageThumbnail,
  generateAllThumbnails,
  getPDFInfo,
  getPageDimensions,
  searchInPDF,
  renderPDFWithStreaming,
  printPDF,
  canvasToBlob,
  canvasToDataURL,
  downloadPageAsImage,
  getPageAsDataURL,
  type SearchResult,
  type StreamingRenderOptions,
} from './pdf-renderer';

// Prefill
export {
  applyTransform,
  resolvePrefillValue,
  generatePrefillValues,
  prefillPDF,
  generatePrefilledPDF,
  getAvailablePrefillDataFields,
  validatePrefillContext,
  type UserPrefillData,
  type VenuePrefillData,
  type AssignmentPrefillData,
  type PrefillDataContext,
  type PrefillResult,
} from './pdf-prefill';

// Generation (pdf-lib)
export {
  fillPDFFormFields,
  fillPDFWithData,
  flattenPDF,
  flattenPDFComplete,
  embedSignatureImage,
  addSignatureToField,
  generateFilledPDF,
  generateSubmissionPDF,
  createBlankPDF,
  addWatermark,
  addPageNumbers,
  mergePDFs,
  splitPDF,
  getPDFMetadata,
} from './pdf-generation';

// AI Prompts
export {
  STRUCTURE_DETECTION_SYSTEM_PROMPT,
  FIELD_DETECTION_SYSTEM_PROMPT,
  CHANGE_DETECTION_SYSTEM_PROMPT,
  FORM_GENERATION_SYSTEM_PROMPT,
  generateStructureDetectionPrompt,
  generateFieldDetectionPrompt,
  generateChangeDetectionPrompt,
  generateFormGenerationPrompt,
  parseAIResponse,
  parseStructureDetectionResponse,
  parseFieldDetectionResponse,
  parseChangeDetectionResponse,
  parseFormGenerationResponse,
  fallbackFieldDetection,
  fallbackStructureDetection,
  mapAITypeToFieldType,
  convertAIDetectedFieldToFormField,
  type DocumentType,
  type AIDetectedFieldType,
  type AIDetectedField,
  type DocumentStructureAnalysis,
  type FieldDetectionResult,
  type ChangeType,
  type ImpactLevel,
  type DetectedChange,
  type ChangeDetectionResult,
  type GeneratedFormSection,
  type FormGenerationResult,
} from './ai-prompts';

// AI Field Detection
export {
  analyzePDFFromBuffer,
  analyzePDFFromURL,
  analyzePDFFromBase64,
  refineDetectedFields,
  validateDetectedFields,
  isAIAvailable,
  getFieldDetectionStats,
  exportDetectedFields,
  type PDFAnalysisResult,
  type FieldDetectionOptions,
  type FieldDetectionProgressCallback,
} from './ai-field-detection';

// AI Form Generation
export {
  generateFormFromFields,
  enhanceFieldValidation,
  generateSmartDefaults,
  validateFormSchema,
  mergeFormSchemas,
  createFormSchemaFromFields,
  groupFieldsIntoSections,
  exportSchemaToJSON,
  importSchemaFromJSON,
  type FormGenerationOptions,
  type FormGenerationOutput,
} from './ai-form-generation';

// AI Change Detection
export {
  comparePDFDocuments,
  comparePDFsFromURL,
  generateChangeReport,
  isChangeDetectionAvailable,
  exportChanges,
  changesRequireNotification,
  getChangeSeverity,
  type ChangeDetectionOptions,
  type PDFComparisonResult,
  type FieldMappingSuggestion,
  type ChangeReport,
} from './ai-change-detection';

// Overlay Fields
export {
  createOverlayFromDetectedFields,
  createOverlayField,
  calculateAbsolutePosition,
  calculatePercentagePosition,
  pointsToPercentage,
  percentageToPoints,
  updateOverlayField,
  deleteOverlayField,
  moveOverlayField,
  reorderOverlayFields,
  duplicateOverlayField,
  overlayToFormField,
  formFieldToOverlay,
  overlayConfigToFormFields,
  validateOverlayConfig,
  exportOverlayConfigToJSON,
  importOverlayConfigFromJSON,
  getFieldsForPage,
  getFieldById,
  countFieldsByType,
  type PDFFOverlayField,
  type PDFOverlayConfig,
  type CreateOverlayOptions,
  type CreateOverlayResult,
  type AbsoluteFieldPosition,
} from './overlay-fields';

// Signature Storage (Phase 5)
export {
  uploadSignature,
  retrieveSignature,
  deleteSignature,
  listUserSignatures,
  getSignatureUrl,
  generateSignatureHash,
  validateSignatureData,
  type SignatureMetadata,
  type SignatureUploadOptions,
  type SignatureUploadResult,
  type SignatureRetrievalResult,
} from './signature-storage';

// Signature Verification (Phase 5)
export {
  verifySignature,
  verifySignatureIntegrity,
  verifySignatureFull,
  compareSignatures,
  addSignatureAuditEntry,
  getSignatureAuditTrail,
  isSignatureExpired,
  getVerificationBadge,
  batchVerifySignatures,
  generateVerificationHash,
  type VerificationStatus,
  type AuditAction,
  type SignatureAuditEntry,
  type VerificationResult,
  type SignatureComparisonResult,
} from './signature-verification';

// Reminder Service (Phase 6)
export {
  scheduleRemindersForAssignment,
  getPendingReminders,
  markReminderSent,
  markReminderFailed,
  cancelRemindersForAssignment,
  rescheduleReminders,
  getReminderStats,
  getUpcomingRemindersForUser,
  cleanupOldReminders,
  type ScheduleRemindersInput,
  type ReminderSchedule,
  type ProcessRemindersResult,
} from './reminder-service';

// Due Date Tracker (Phase 6)
export {
  calculateDueDate,
  calculateDaysUntilDue,
  getEscalationLevel,
  getEscalationAction,
  getOverdueAssignments,
  getUserOverdueAssignments,
  generateOverdueReport,
  getDueDateStats,
  getUserDueDateStats,
  processEscalations,
  processExpiredAssignments,
  isAssignmentOverdue,
  getDueDateStatusText,
  getDueDateStatusColor,
  type OverdueAssignment,
  type OverdueReport,
  type DueDateStats,
  type EscalationRule,
} from './due-date-tracker';
