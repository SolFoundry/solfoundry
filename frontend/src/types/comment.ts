export type CommentStatus = 'visible' | 'hidden' | 'flagged' | 'spam';

export interface Comment {
  id: string;
  bounty_id: string;
  parent_id: string | null;
  author_id: string;
  author_username: string;
  author_avatar_url: string | null;
  content: string;
  status: CommentStatus;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  /** Nested replies (populated client-side from flat list) */
  replies?: Comment[];
  /** Reply count (from API) */
  reply_count?: number;
}

export interface CommentCreatePayload {
  content: string;
  parent_id?: string | null;
}

export interface CommentUpdatePayload {
  content: string;
}

export interface CommentsListResponse {
  items: Comment[];
  total: number;
}

export interface ModerationAction {
  action: 'approve' | 'hide' | 'flag_spam';
}
