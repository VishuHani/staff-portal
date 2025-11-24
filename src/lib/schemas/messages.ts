import { z } from "zod";

// Constants
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_CONVERSATION_NAME_LENGTH = 100;
export const MAX_MEDIA_FILES = 4;
export const MAX_PARTICIPANTS = 50; // For group conversations

// Message schemas
export const createMessageSchema = z.object({
  conversationId: z.string().cuid("Invalid conversation ID"),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH, `Message must not exceed ${MAX_MESSAGE_LENGTH} characters`)
    .trim(),
  mediaUrls: z
    .array(z.string().url("Invalid media URL"))
    .max(MAX_MEDIA_FILES, `Maximum ${MAX_MEDIA_FILES} files allowed`)
    .optional(),
});

export const updateMessageSchema = z.object({
  id: z.string().cuid("Invalid message ID"),
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(MAX_MESSAGE_LENGTH)
    .trim(),
});

export const deleteMessageSchema = z.object({
  id: z.string().cuid("Invalid message ID"),
});

// Conversation schemas
// Note: participantIds are Supabase user IDs (UUID format), not Prisma CUIDs
export const createConversationSchema = z.object({
  participantIds: z
    .array(z.string().min(1, "Invalid user ID"))
    .min(1, "At least one participant required")
    .max(MAX_PARTICIPANTS, `Maximum ${MAX_PARTICIPANTS} participants allowed`),
  type: z.enum(["ONE_ON_ONE", "GROUP"]),
  name: z.string().max(MAX_CONVERSATION_NAME_LENGTH).optional().nullable(),
});

export const updateConversationSchema = z.object({
  id: z.string().cuid("Invalid conversation ID"),
  name: z.string().max(MAX_CONVERSATION_NAME_LENGTH).optional(),
});

export const markAsReadSchema = z.object({
  conversationId: z.string().cuid("Invalid conversation ID"),
  messageId: z.string().cuid("Invalid message ID").optional(),
});

export const addParticipantsSchema = z.object({
  conversationId: z.string().cuid("Invalid conversation ID"),
  userIds: z
    .array(z.string().min(1, "Invalid user ID"))
    .min(1, "At least one user required"),
});

export const removeParticipantSchema = z.object({
  conversationId: z.string().cuid("Invalid conversation ID"),
  userId: z.string().min(1, "Invalid user ID"),
});

export const muteConversationSchema = z.object({
  conversationId: z.string().cuid("Invalid conversation ID"),
  duration: z.number().int().positive().optional(), // Duration in hours
});

export const toggleReactionSchema = z.object({
  messageId: z.string().cuid("Invalid message ID"),
  emoji: z.string().min(1, "Emoji is required"),
});

// Type exports
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type AddParticipantsInput = z.infer<typeof addParticipantsSchema>;
export type RemoveParticipantInput = z.infer<typeof removeParticipantSchema>;
export type MuteConversationInput = z.infer<typeof muteConversationSchema>;
export type ToggleReactionInput = z.infer<typeof toggleReactionSchema>;
