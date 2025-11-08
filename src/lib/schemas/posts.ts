import { z } from "zod";

/**
 * Constants
 */
export const MAX_POST_LENGTH = 2000;
export const MAX_COMMENT_LENGTH = 500;
export const MAX_MEDIA_FILES = 4;
export const COMMON_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏", "🎉", "🔥"] as const;

/**
 * Helper function to validate media URLs array
 */
export function validateMediaUrls(mediaUrls: string | null): boolean {
  if (!mediaUrls) return true;

  try {
    const urls = JSON.parse(mediaUrls);
    if (!Array.isArray(urls)) return false;
    if (urls.length > MAX_MEDIA_FILES) return false;

    // Validate each URL
    return urls.every((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Helper function to parse media URLs
 */
export function parseMediaUrls(mediaUrls: string | null): string[] {
  if (!mediaUrls) return [];

  try {
    const urls = JSON.parse(mediaUrls);
    return Array.isArray(urls) ? urls : [];
  } catch {
    return [];
  }
}

/**
 * Schema for creating a new post
 */
export const createPostSchema = z.object({
  channelId: z.string().cuid("Invalid channel ID"),
  content: z
    .string()
    .min(1, "Post content cannot be empty")
    .max(MAX_POST_LENGTH, `Post content must not exceed ${MAX_POST_LENGTH} characters`)
    .trim(),
  mediaUrls: z
    .array(z.string().url("Invalid media URL"))
    .max(MAX_MEDIA_FILES, `Maximum ${MAX_MEDIA_FILES} media files allowed`)
    .optional(),
});

/**
 * Schema for updating a post
 */
export const updatePostSchema = z.object({
  id: z.string().cuid("Invalid post ID"),
  content: z
    .string()
    .min(1, "Post content cannot be empty")
    .max(MAX_POST_LENGTH, `Post content must not exceed ${MAX_POST_LENGTH} characters`)
    .trim(),
});

/**
 * Schema for deleting a post
 */
export const deletePostSchema = z.object({
  id: z.string().cuid("Invalid post ID"),
});

/**
 * Schema for pinning/unpinning a post
 */
export const pinPostSchema = z.object({
  id: z.string().cuid("Invalid post ID"),
  pinned: z.boolean(),
});

/**
 * Schema for filtering posts
 */
export const filterPostsSchema = z.object({
  channelId: z.string().cuid("Invalid channel ID").optional(),
  authorId: z.string().cuid("Invalid author ID").optional(),
  pinned: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().cuid().optional(), // For pagination
});

/**
 * Schema for creating a comment
 */
export const createCommentSchema = z.object({
  postId: z.string().cuid("Invalid post ID"),
  parentId: z.string().cuid("Invalid parent comment ID").optional().nullable(),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(MAX_COMMENT_LENGTH, `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`)
    .trim(),
});

/**
 * Schema for updating a comment
 */
export const updateCommentSchema = z.object({
  id: z.string().cuid("Invalid comment ID"),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(MAX_COMMENT_LENGTH, `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`)
    .trim(),
});

/**
 * Schema for deleting a comment
 */
export const deleteCommentSchema = z.object({
  id: z.string().cuid("Invalid comment ID"),
});

/**
 * Schema for adding a reaction
 */
export const addReactionSchema = z.object({
  postId: z.string().cuid("Invalid post ID"),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Invalid emoji"),
});

/**
 * Schema for removing a reaction
 */
export const removeReactionSchema = z.object({
  postId: z.string().cuid("Invalid post ID"),
  emoji: z.string().min(1, "Emoji cannot be empty").max(10, "Invalid emoji"),
});

// Type exports
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type DeletePostInput = z.infer<typeof deletePostSchema>;
export type PinPostInput = z.infer<typeof pinPostSchema>;
export type FilterPostsInput = z.infer<typeof filterPostsSchema>;

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;

export type AddReactionInput = z.infer<typeof addReactionSchema>;
export type RemoveReactionInput = z.infer<typeof removeReactionSchema>;
