export interface BountyComment {
  id: string;
  bounty_id: string;
  parent_id: string | null;
  author_id: string;
  author_username: string;
  author_avatar_url?: string | null;
  body: string;
  created_at: string;
  hidden?: boolean;
}

export interface BountyCommentThread extends BountyComment {
  replies: BountyCommentThread[];
}

export type CommentWsMessage =
  | { type: 'comment_created'; comment: BountyComment }
  | { type: 'comment_hidden'; comment_id: string }
  | { type: 'comment_deleted'; comment_id: string };
