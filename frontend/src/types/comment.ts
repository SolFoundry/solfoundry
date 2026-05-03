export interface BountyComment {
  id: string;
  bounty_id: string;
  author_username: string;
  author_avatar_url?: string | null;
  body: string;
  parent_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  moderation_status?: 'visible' | 'pending' | 'hidden' | 'flagged';
}

export interface BountyCommentCreatePayload {
  body: string;
  parent_id?: string | null;
}
