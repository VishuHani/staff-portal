/**
 * Message Encryption Utility
 * 
 * Uses AES-256-GCM for authenticated encryption with:
 * - Random IV for each message
 * - Authentication tag for integrity verification
 * - Key derivation using PBKDF2 for password-based encryption
 * 
 * Security considerations:
 * - Messages are encrypted at rest in the database
 * - Each message has a unique IV, preventing pattern analysis
 * - Authentication tag prevents tampering
 * - Keys are derived from environment secret + conversation context
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100000; // PBKDF2 iterations

/**
 * Get the encryption key from environment
 * In production, this should be a secure, randomly generated key stored securely
 */
function getMasterKey(): Buffer {
  const secret = process.env.MESSAGE_ENCRYPTION_KEY;
  
  if (!secret) {
    // Fallback for development - should always be set in production
    console.warn('WARNING: MESSAGE_ENCRYPTION_KEY not set. Using development fallback. DO NOT USE IN PRODUCTION!');
    return Buffer.from('development-key-do-not-use-in-production-32b!', 'utf8');
  }
  
  // Derive a 32-byte key from the secret
  return pbkdf2Sync(secret, 'staff-portal-encryption-salt', ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Derive a unique encryption key for a conversation
 * This ensures that compromising one conversation's key doesn't expose others
 */
function deriveConversationKey(conversationId: string): Buffer {
  const masterKey = getMasterKey();
  const salt = pbkdf2Sync(
    masterKey.toString('hex'),
    conversationId,
    1000, // Lower iterations for key derivation (master key already derived)
    KEY_LENGTH,
    'sha256'
  );
  return salt;
}

/**
 * Encrypt a message for storage
 * 
 * @param content - The plaintext message content
 * @param conversationId - The conversation ID for key derivation
 * @returns Object containing encrypted data and metadata
 */
export function encryptMessage(
  content: string,
  conversationId: string
): { encryptedContent: string; iv: string; authTag: string } {
  const key = deriveConversationKey(conversationId);
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(content, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedContent: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt a message from storage
 * 
 * @param encryptedContent - The encrypted message content
 * @param iv - The initialization vector (hex string)
 * @param authTag - The authentication tag (hex string)
 * @param conversationId - The conversation ID for key derivation
 * @returns The decrypted plaintext content
 */
export function decryptMessage(
  encryptedContent: string,
  iv: string,
  authTag: string,
  conversationId: string
): string {
  const key = deriveConversationKey(conversationId);
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt media URLs (for messages with attachments)
 */
export function encryptMediaUrls(
  mediaUrls: string[],
  conversationId: string
): { encryptedContent: string; iv: string; authTag: string } {
  const content = JSON.stringify(mediaUrls);
  return encryptMessage(content, conversationId);
}

/**
 * Decrypt media URLs
 */
export function decryptMediaUrls(
  encryptedUrls: string,
  iv: string,
  authTag: string,
  conversationId: string
): string[] {
  try {
    const decrypted = decryptMessage(encryptedUrls, iv, authTag, conversationId);
    return JSON.parse(decrypted);
  } catch {
    return [];
  }
}

/**
 * Check if content appears to be encrypted
 * This is useful for handling migration of unencrypted messages
 */
export function isEncrypted(content: string): boolean {
  // Encrypted content is hex string, typically longer than original
  // and we store it with metadata
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && 
           'encryptedContent' in parsed && 
           'iv' in parsed && 
           'authTag' in parsed;
  } catch {
    return false;
  }
}

/**
 * Encrypt content and return as JSON string for storage
 */
export function encryptForStorage(
  content: string,
  conversationId: string
): string {
  const { encryptedContent, iv, authTag } = encryptMessage(content, conversationId);
  return JSON.stringify({ encryptedContent, iv, authTag });
}

/**
 * Decrypt content from storage (handles both encrypted and legacy plaintext)
 */
export function decryptFromStorage(
  storedContent: string,
  conversationId: string
): string {
  // Check if content is encrypted
  if (isEncrypted(storedContent)) {
    try {
      const { encryptedContent, iv, authTag } = JSON.parse(storedContent);
      return decryptMessage(encryptedContent, iv, authTag, conversationId);
    } catch (error) {
      console.error('Failed to decrypt message:', error);
      return '[Encrypted message - unable to decrypt]';
    }
  }
  
  // Legacy plaintext message
  return storedContent;
}

/**
 * Generate a secure random token for message deletion links
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a value using SHA-256 (for secure comparison)
 */
export function hashValue(value: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Message encryption status type
 */
export interface EncryptedMessageData {
  encryptedContent: string;
  iv: string;
  authTag: string;
}

/**
 * Result type for encryption operations
 */
export type EncryptionResult = 
  | { success: true; data: EncryptedMessageData }
  | { success: false; error: string };

/**
 * Result type for decryption operations
 */
export type DecryptionResult = 
  | { success: true; content: string }
  | { success: false; error: string };
