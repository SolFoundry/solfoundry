export interface Comment {
  id: string;
  bounty_id: string;
  parent_id: string | null;
  author_id: string;
  author_username: string | null;
  author_avatar: string | null;
  body: string;
  is_deleted: boolean;
  is_moderated: boolean;
  moderation_reason: string | null;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommentCreatePayload {
  body: string;
  parent_id?: string | null;
}

export interface CommentUpdatePayload {
  body: string;
}

export interface CommentListResponse {
  items: Comment[];
  total: number;
  limit: number;
  offset: number;
}