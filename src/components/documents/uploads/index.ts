/**
 * Upload Components - Phase 5
 * 
 * Export upload-related components for document management
 */

export {
  PhotoCapture,
  usePhotoCapture,
  type PhotoCaptureProps,
  type CapturedPhoto,
} from './PhotoCapture';

export {
  AttachmentManager,
  useAttachmentManager,
  type AttachmentManagerProps,
  type Attachment,
  type AttachmentUploadProgress,
} from './AttachmentManager';
