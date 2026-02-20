/**
 * Messaging System Configuration
 * 
 * Centralized configuration for messaging features including:
 * - Edit time limits
 * - Rate limiting
 * - Message expiration options
 * - Encryption settings
 */

// ============================================================================
// MESSAGE EDIT CONFIGURATION
// ============================================================================

/**
 * Time window for editing messages (in minutes)
 * Users can edit their own messages within this time frame
 */
export const MESSAGE_EDIT_WINDOW_MINUTES = parseInt(
  process.env.MESSAGE_EDIT_WINDOW_MINUTES || '15',
  10
);

/**
 * Maximum number of edits allowed per message
 */
export const MAX_EDITS_PER_MESSAGE = parseInt(
  process.env.MAX_EDITS_PER_MESSAGE || '5',
  10
);

/**
 * Whether to keep edit history
 */
export const KEEP_EDIT_HISTORY = process.env.KEEP_EDIT_HISTORY !== 'false';

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

export interface RateLimitConfig {
  maxMessages: number;
  windowMs: number;
  blockDurationMs: number;
}

/**
 * Rate limits for sending messages
 */
export const MESSAGE_RATE_LIMITS: RateLimitConfig = {
  // Maximum messages per time window
  maxMessages: parseInt(process.env.MESSAGE_RATE_LIMIT_MAX || '30', 10),
  // Time window in milliseconds (default: 1 minute)
  windowMs: parseInt(process.env.MESSAGE_RATE_LIMIT_WINDOW_MS || '60000', 10),
  // How long to block if limit exceeded (default: 5 minutes)
  blockDurationMs: parseInt(process.env.MESSAGE_RATE_LIMIT_BLOCK_MS || '300000', 10),
};

/**
 * Rate limits for creating posts
 */
export const POST_RATE_LIMITS: RateLimitConfig = {
  maxMessages: parseInt(process.env.POST_RATE_LIMIT_MAX || '20', 10),
  windowMs: parseInt(process.env.POST_RATE_LIMIT_WINDOW_MS || '60000', 10),
  blockDurationMs: parseInt(process.env.POST_RATE_LIMIT_BLOCK_MS || '300000', 10),
};

/**
 * Rate limits for comments
 */
export const COMMENT_RATE_LIMITS: RateLimitConfig = {
  maxMessages: parseInt(process.env.COMMENT_RATE_LIMIT_MAX || '50', 10),
  windowMs: parseInt(process.env.COMMENT_RATE_LIMIT_WINDOW_MS || '60000', 10),
  blockDurationMs: parseInt(process.env.COMMENT_RATE_LIMIT_BLOCK_MS || '300000', 10),
};

// ============================================================================
// MESSAGE EXPIRATION CONFIGURATION
// ============================================================================

export type ExpireType = 'AFTER_READ' | 'TIMED' | 'NONE';

export interface ExpirationOption {
  type: ExpireType;
  label: string;
  description: string;
  durationMs?: number;
}

/**
 * Available message expiration options
 */
export const EXPIRATION_OPTIONS: ExpirationOption[] = [
  {
    type: 'NONE',
    label: 'Never',
    description: 'Message will not expire',
  },
  {
    type: 'TIMED',
    label: '5 minutes',
    description: 'Message deletes after 5 minutes',
    durationMs: 5 * 60 * 1000,
  },
  {
    type: 'TIMED',
    label: '1 hour',
    description: 'Message deletes after 1 hour',
    durationMs: 60 * 60 * 1000,
  },
  {
    type: 'TIMED',
    label: '24 hours',
    description: 'Message deletes after 24 hours',
    durationMs: 24 * 60 * 60 * 1000,
  },
  {
    type: 'TIMED',
    label: '7 days',
    description: 'Message deletes after 7 days',
    durationMs: 7 * 24 * 60 * 60 * 1000,
  },
  {
    type: 'AFTER_READ',
    label: 'After read',
    description: 'Message deletes after being read by all recipients',
    durationMs: undefined,
  },
];

/**
 * Default expiration time for new conversations (null = no expiration)
 */
export const DEFAULT_MESSAGE_EXPIRATION_HOURS = process.env.DEFAULT_MESSAGE_EXPIRATION_HOURS
  ? parseInt(process.env.DEFAULT_MESSAGE_EXPIRATION_HOURS, 10)
  : null;

// ============================================================================
// ENCRYPTION CONFIGURATION
// ============================================================================

/**
 * Whether encryption is enabled
 */
export const ENCRYPTION_ENABLED = process.env.MESSAGE_ENCRYPTION_ENABLED !== 'false';

/**
 * Current encryption version (for future algorithm upgrades)
 */
export const CURRENT_ENCRYPTION_VERSION = 1;

/**
 * Whether to encrypt existing messages during migration
 */
export const ENCRYPT_ON_READ = process.env.ENCRYPT_ON_READ === 'true';

// ============================================================================
// DELIVERY STATUS CONFIGURATION
// ============================================================================

export type DeliveryStatus = 'SENT' | 'DELIVERED' | 'READ';

/**
 * Whether to track delivery status
 */
export const TRACK_DELIVERY_STATUS = process.env.TRACK_DELIVERY_STATUS !== 'false';

/**
 * Time to wait before marking as delivered (for push notifications)
 */
export const DELIVERY_CONFIRMATION_DELAY_MS = parseInt(
  process.env.DELIVERY_CONFIRMATION_DELAY_MS || '1000',
  10
);

// ============================================================================
// MENTION CONFIGURATION
// ============================================================================

/**
 * Maximum mentions per message
 */
export const MAX_MENTIONS_PER_MESSAGE = parseInt(
  process.env.MAX_MENTIONS_PER_MESSAGE || '10',
  10
);

/**
 * Whether to notify mentioned users
 */
export const NOTIFY_MENTIONS = process.env.NOTIFY_MENTIONS !== 'false';

// ============================================================================
// MESSAGE CONTENT CONFIGURATION
// ============================================================================

/**
 * Maximum message length
 */
export const MAX_MESSAGE_LENGTH = parseInt(
  process.env.MAX_MESSAGE_LENGTH || '10000',
  10
);

/**
 * Maximum media attachments per message
 */
export const MAX_MEDIA_PER_MESSAGE = parseInt(
  process.env.MAX_MEDIA_PER_MESSAGE || '5',
  10
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate expiration date for a message
 */
export function calculateExpirationDate(
  expireType: ExpireType | null | undefined,
  durationMs?: number
): Date | null {
  if (!expireType || expireType === 'NONE') {
    return null;
  }

  if (expireType === 'TIMED' && durationMs) {
    return new Date(Date.now() + durationMs);
  }

  // AFTER_READ is handled separately when the message is read
  return null;
}

/**
 * Check if a message is expired
 */
export function isMessageExpired(
  expiresAt: Date | null,
  expireType: ExpireType | null,
  readByCount: number,
  totalRecipients: number
): boolean {
  if (!expiresAt && expireType !== 'AFTER_READ') {
    return false;
  }

  if (expireType === 'AFTER_READ') {
    // Message expires when all recipients have read it
    return readByCount >= totalRecipients;
  }

  if (expiresAt && new Date() > expiresAt) {
    return true;
  }

  return false;
}

/**
 * Get delivery status label
 */
export function getDeliveryStatusLabel(status: DeliveryStatus): string {
  switch (status) {
    case 'SENT':
      return 'Sent';
    case 'DELIVERED':
      return 'Delivered';
    case 'READ':
      return 'Read';
    default:
      return 'Unknown';
  }
}

/**
 * Check if user can edit message
 */
export function canEditMessage(
  createdAt: Date,
  senderId: string,
  userId: string,
  editCount: number
): { canEdit: boolean; reason?: string } {
  // Must be own message
  if (senderId !== userId) {
    return { canEdit: false, reason: 'You can only edit your own messages' };
  }

  // Check edit count
  if (editCount >= MAX_EDITS_PER_MESSAGE) {
    return { canEdit: false, reason: `Maximum ${MAX_EDITS_PER_MESSAGE} edits allowed` };
  }

  // Check time window
  const editDeadline = new Date(createdAt.getTime() + MESSAGE_EDIT_WINDOW_MINUTES * 60 * 1000);
  if (new Date() > editDeadline) {
    return { canEdit: false, reason: `Messages can only be edited within ${MESSAGE_EDIT_WINDOW_MINUTES} minutes` };
  }

  return { canEdit: true };
}
