/**
 * Signature Storage Service - Phase 5
 * 
 * Handles signature image uploads to Supabase storage with:
 * - Hash generation for verification
 * - Metadata storage (timestamp, IP, user agent)
 * - Retrieval and validation
 */

import { createClient } from '@/lib/auth/supabase-server';
import { createHash } from 'crypto';

// Storage bucket and folder configuration
const SIGNATURE_BUCKET = 'document-uploads';
const SIGNATURE_FOLDER = 'signatures';

/**
 * Signature metadata stored alongside the image
 */
export interface SignatureMetadata {
  /** Unique signature ID */
  id: string;
  /** User ID who signed */
  userId: string;
  /** Document title being signed */
  documentTitle?: string;
  /** Document assignment ID if applicable */
  assignmentId?: string;
  /** Timestamp when signed */
  signedAt: string;
  /** IP address when signed */
  ipAddress?: string;
  /** Browser user agent */
  userAgent?: string;
  /** Hash of signature image for verification */
  signatureHash: string;
  /** URL to signature image */
  imageUrl: string;
  /** Storage path */
  storagePath: string;
}

/**
 * Signature upload options
 */
export interface SignatureUploadOptions {
  /** User ID uploading the signature */
  userId: string;
  /** Base64 encoded signature image (data URL) */
  signatureData: string;
  /** Document title being signed */
  documentTitle?: string;
  /** Document assignment ID if applicable */
  assignmentId?: string;
  /** IP address of the signer */
  ipAddress?: string;
  /** Browser user agent */
  userAgent?: string;
}

/**
 * Signature upload result
 */
export interface SignatureUploadResult {
  success: boolean;
  metadata?: SignatureMetadata;
  error?: string;
}

/**
 * Signature retrieval result
 */
export interface SignatureRetrievalResult {
  success: boolean;
  metadata?: SignatureMetadata;
  imageData?: string;
  error?: string;
}

/**
 * Generate a hash from signature image data
 * Used for tamper detection and verification
 */
export function generateSignatureHash(signatureData: string): string {
  // Extract base64 data from data URL if present
  const base64Data = signatureData.includes(',')
    ? signatureData.split(',')[1]
    : signatureData;
  
  // Create SHA-256 hash
  const hash = createHash('sha256');
  hash.update(base64Data);
  return hash.digest('hex');
}

/**
 * Generate a unique signature ID
 */
function generateSignatureId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert base64 data URL to Blob
 */
function dataURLtoBlob(dataURL: string): Blob {
  const parts = dataURL.split(',');
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Upload signature to Supabase storage
 * 
 * @param options Upload options including user ID and signature data
 * @returns Upload result with metadata or error
 */
export async function uploadSignature(
  options: SignatureUploadOptions
): Promise<SignatureUploadResult> {
  const { userId, signatureData, documentTitle, assignmentId, ipAddress, userAgent } = options;

  try {
    // Validate signature data
    if (!signatureData || !signatureData.startsWith('data:image/')) {
      return { success: false, error: 'Invalid signature data format' };
    }

    const supabase = await createClient();
    const signatureId = generateSignatureId();
    const signatureHash = generateSignatureHash(signatureData);
    
    // Create storage path: signatures/{userId}/{signatureId}.png
    const storagePath = `${SIGNATURE_FOLDER}/${userId}/${signatureId}.png`;
    
    // Convert data URL to blob
    const blob = dataURLtoBlob(signatureData);
    
    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .upload(storagePath, blob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Signature upload error:', uploadError);
      return { success: false, error: 'Failed to upload signature' };
    }

    // Get signed URL (valid for 1 hour)
    const { data: urlData, error: urlError } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (urlError || !urlData) {
      console.error('Failed to get signed URL:', urlError);
      return { success: false, error: 'Failed to generate signature URL' };
    }

    // Create metadata
    const metadata: SignatureMetadata = {
      id: signatureId,
      userId,
      documentTitle,
      assignmentId,
      signedAt: new Date().toISOString(),
      ipAddress,
      userAgent,
      signatureHash,
      imageUrl: urlData.signedUrl,
      storagePath,
    };

    // Store metadata in database (optional - can be stored in document submission)
    // For now, we'll return it to be stored with the form data

    return { success: true, metadata };
  } catch (error) {
    console.error('Signature upload error:', error);
    return { success: false, error: 'Failed to upload signature' };
  }
}

/**
 * Retrieve signature from storage
 * 
 * @param userId User ID who owns the signature
 * @param signatureId Signature ID to retrieve
 * @returns Signature data with metadata
 */
export async function retrieveSignature(
  userId: string,
  signatureId: string
): Promise<SignatureRetrievalResult> {
  try {
    const supabase = await createClient();
    const storagePath = `${SIGNATURE_FOLDER}/${userId}/${signatureId}.png`;

    // Get signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (urlError || !urlData) {
      console.error('Failed to retrieve signature:', urlError);
      return { success: false, error: 'Signature not found' };
    }

    // Download the image data
    const response = await fetch(urlData.signedUrl);
    if (!response.ok) {
      return { success: false, error: 'Failed to download signature' };
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageData = `data:image/png;base64,${base64}`;

    // Generate hash for verification
    const signatureHash = generateSignatureHash(imageData);

    const metadata: SignatureMetadata = {
      id: signatureId,
      userId,
      signedAt: new Date().toISOString(), // Would be stored in DB
      signatureHash,
      imageUrl: urlData.signedUrl,
      storagePath,
    };

    return { success: true, metadata, imageData };
  } catch (error) {
    console.error('Signature retrieval error:', error);
    return { success: false, error: 'Failed to retrieve signature' };
  }
}

/**
 * Delete signature from storage
 * 
 * @param userId User ID who owns the signature
 * @param signatureId Signature ID to delete
 * @returns Success status
 */
export async function deleteSignature(
  userId: string,
  signatureId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const storagePath = `${SIGNATURE_FOLDER}/${userId}/${signatureId}.png`;

    const { error } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error('Signature deletion error:', error);
      return { success: false, error: 'Failed to delete signature' };
    }

    return { success: true };
  } catch (error) {
    console.error('Signature deletion error:', error);
    return { success: false, error: 'Failed to delete signature' };
  }
}

/**
 * List all signatures for a user
 * 
 * @param userId User ID to list signatures for
 * @returns List of signature metadata
 */
export async function listUserSignatures(
  userId: string
): Promise<{ success: boolean; signatures?: SignatureMetadata[]; error?: string }> {
  try {
    const supabase = await createClient();
    const folderPath = `${SIGNATURE_FOLDER}/${userId}`;

    const { data, error } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .list(folderPath);

    if (error) {
      console.error('Signature list error:', error);
      return { success: false, error: 'Failed to list signatures' };
    }

    const signatures: SignatureMetadata[] = [];

    for (const file of data || []) {
      if (file.name.endsWith('.png')) {
        const signatureId = file.name.replace('.png', '');
        const storagePath = `${folderPath}/${file.name}`;

        // Get signed URL
        const { data: urlData } = await supabase.storage
          .from(SIGNATURE_BUCKET)
          .createSignedUrl(storagePath, 3600);

        if (urlData) {
          signatures.push({
            id: signatureId,
            userId,
            signedAt: file.created_at || new Date().toISOString(),
            storagePath,
            imageUrl: urlData.signedUrl,
            signatureHash: '', // Would need to download and hash
          });
        }
      }
    }

    return { success: true, signatures };
  } catch (error) {
    console.error('Signature list error:', error);
    return { success: false, error: 'Failed to list signatures' };
  }
}

/**
 * Get a signed URL for a signature image
 * 
 * @param storagePath Full storage path to the signature
 * @param expiresInSeconds URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL or error
 */
export async function getSignatureUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(SIGNATURE_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data) {
      return { error: 'Failed to generate signature URL' };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('Signature URL error:', error);
    return { error: 'Failed to generate signature URL' };
  }
}

/**
 * Validate signature data format
 * 
 * @param signatureData Base64 data URL to validate
 * @returns Validation result
 */
export function validateSignatureData(signatureData: string): { valid: boolean; error?: string } {
  if (!signatureData) {
    return { valid: false, error: 'Signature data is required' };
  }

  if (!signatureData.startsWith('data:image/')) {
    return { valid: false, error: 'Invalid signature format' };
  }

  // Check if it's a valid PNG or JPEG
  if (!signatureData.startsWith('data:image/png') && !signatureData.startsWith('data:image/jpeg')) {
    return { valid: false, error: 'Only PNG and JPEG signatures are supported' };
  }

  // Check size (max 500KB for signature)
  const base64Data = signatureData.split(',')[1];
  const sizeInBytes = (base64Data.length * 3) / 4;
  const maxSize = 500 * 1024; // 500KB

  if (sizeInBytes > maxSize) {
    return { valid: false, error: 'Signature image is too large (max 500KB)' };
  }

  return { valid: true };
}

export default {
  uploadSignature,
  retrieveSignature,
  deleteSignature,
  listUserSignatures,
  getSignatureUrl,
  generateSignatureHash,
  validateSignatureData,
};
