/** Status of a comment after moderation. */
export type CommentStatus = 'visible' | 'hidden' | 'flagged' | 'pending_review';

/** A single comment in a bounty discussion thread. */
export interface Comment {
  id: string;
  bounty_id: string;
  /** The user who wrote this comment. */
  author_id: string;
  author_username: string;
  author_avatar_url?: string | null;
  /** The comment body (plain text or markdown). */
  content: string;
  /** Parent comment ID — null for top-level comments. */
  parent_id: string | null;
  /** Nested replies (populated client-side from flat list). */
  replies?: Comment[];
  /** Number of direct replies. */
  reply_count?: number;
  /** Moderation status. */
  status: CommentStatus;
  /** Reason for flagging/hidden (if any). */
  moderation_note?: string | null;
  /** Upvote count. */
  upvote_count: number;
  /** Whether the current user has upvoted. */
  has_upvoted?: boolean;
  created_at: string;
  updated_at: string;
}

/** Payload for creating a new comment. */
export interface CommentCreatePayload {
  content: string;
  parent_id?: string | null;
}

/** Payload for updating a comment. */
export interface CommentUpdatePayload {
  content: string;
}

/** Paginated list of comments. */
export interface CommentsListResponse {
  items: Comment[];
  total: number;
  limit: number;
  offset: number;
}

/** Spam filter result from backend. */
export interface SpamCheckResult {
  is_spam: boolean;
  reason?: string;
  confidence: number;
}
