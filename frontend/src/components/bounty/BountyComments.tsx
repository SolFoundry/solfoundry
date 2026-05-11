import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Reply, Send, Flag, MoreVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '../services/apiClient';

// Types
export interface Comment {
  id: string;
  bountyId: string;
  parentId: string | null;
  author: { username: string; avatar_url: string | null };
  content: string;
  createdAt: string;
  isFlagged: boolean;
  replies?: Comment[];
}

export interface CommentsResponse {
  comments: Comment[];
  total: number;
}

// API
async function fetchComments(bountyId: string): Promise<CommentsResponse> {
  return apiClient<CommentsResponse>(`/api/bounties/${bountyId}/comments`);
}

async function postComment(bountyId: string, content: string, parentId?: string): Promise<Comment> {
  return apiClient<Comment>(`/api/bounties/${bountyId}/comments`, {
    method: 'POST',
    body: { content, parent_id: parentId },
  });
}

async function flagComment(commentId: string): Promise<void> {
  await apiClient(`/api/comments/${commentId}/flag`, { method: 'POST' });
}

// Time ago
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Spam filter (client-side basic check)
function isSpam(content: string): boolean {
  const lower = content.toLowerCase();
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /https?:\/\/[^\s]+\.(xyz|top|click)/i, // Suspicious domains
    /\b(free|earn|click|winner|prize)\b.*\b(money|crypto|bitcoin|wallet)\b/i,
  ];
  return spamPatterns.some((pattern) => pattern.test(lower));
}

// Single Comment Component
function CommentItem({
  comment,
  bountyId,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  bountyId: string;
  onReply: (parentId: string, username: string) => void;
  depth?: number;
}) {
  const [showReplies, setShowReplies] = useState(depth < 1);
  const [showMenu, setShowMenu] = useState(false);

  if (comment.isFlagged) {
    return (
      <div className="py-2 px-3 text-xs text-text-muted italic border-l-2 border-border-primary">
        [Comment flagged as spam — hidden]
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-border-primary pl-4' : ''}`}>
      <div className="flex items-start gap-3 py-3">
        {/* Avatar */}
        {comment.author.avatar_url ? (
          <img src={comment.author.avatar_url} alt={comment.author.username} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-xs font-mono text-text-muted">
            {comment.author.username.slice(0, 2).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text-primary">{comment.author.username}</span>
            <span className="text-xs text-text-muted">{timeAgo(comment.createdAt)}</span>

            {/* Actions */}
            <div className="ml-auto relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded hover:bg-surface-hover"
              >
                <MoreVertical className="w-3.5 h-3.5 text-text-muted" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-6 z-20 bg-surface-card border border-border-primary rounded-lg shadow-lg p-1">
                  <button
                    onClick={() => { flagComment(comment.id); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-status-error hover:bg-surface-hover rounded"
                  >
                    <Flag className="w-3 h-3 inline mr-1" /> Flag as spam
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onReply(comment.id, comment.author.username)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-emerald"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
          </div>

          {/* Nested Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 text-xs text-emerald hover:underline mb-1"
              >
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
              {showReplies && comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  bountyId={bountyId}
                  onReply={onReply}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Component
export function BountyComments({ bountyId }: { bountyId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Fetch comments
  const loadComments = useCallback(async () => {
    try {
      const data = await fetchComments(bountyId);
      setComments(data.comments);
    } catch {
      setError('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [bountyId]);

  useEffect(() => {
    loadComments();
    // Auto-refresh every 15 seconds for real-time updates
    const interval = setInterval(loadComments, 15000);
    return () => clearInterval(interval);
  }, [loadComments]);

  // Submit comment
  const handleSubmit = useCallback(async () => {
    const content = newComment.trim();
    if (!content || isSpam(content)) {
      if (isSpam(content)) setError('Comment appears to be spam');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const comment = await postComment(bountyId, content, replyTo?.id);
      setComments((prev) => {
        if (replyTo) {
          // Add reply to parent comment
          return prev.map((c) => {
            if (c.id === replyTo.id) {
              return { ...c, replies: [...(c.replies || []), comment] };
            }
            return c;
          });
        }
        return [...prev, comment];
      });
      setNewComment('');
      setReplyTo(null);
      // Scroll to bottom
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      setError('Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, bountyId, replyTo]);

  const handleReply = useCallback((parentId: string, username: string) => {
    setReplyTo({ id: parentId, username });
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-emerald" />
        <h3 className="text-sm font-semibold text-text-primary">Discussion</h3>
        <span className="text-xs text-text-muted">({comments.length} comments)</span>
      </div>

      {/* Comment Input */}
      <div className="space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-emerald">
            <Reply className="w-3.5 h-3.5" />
            Replying to <strong>{replyTo.username}</strong>
            <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text-primary">
              ✕
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? `Reply to ${replyTo.username}...` : 'Ask a question or share progress...'}
            className="flex-1 px-3 py-2 bg-surface-card border border-border-primary rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-emerald/30 focus:border-emerald/50 resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !newComment.trim()}
            className="px-4 py-2 rounded-lg bg-emerald text-dark-forge font-medium text-sm hover:bg-emerald/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-status-error">{error}</p>}
        <p className="text-xs text-text-muted">Ctrl+Enter to send</p>
      </div>

      {/* Comments List */}
      <div className="space-y-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-start gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-surface-hover" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-hover rounded w-24" />
                <div className="h-3 bg-surface-hover rounded w-full" />
              </div>
            </div>
          ))
        ) : comments.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            No comments yet. Be the first to ask a question!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              bountyId={bountyId}
              onReply={handleReply}
            />
          ))
        )}
        <div ref={commentsEndRef} />
      </div>
    </div>
  );
}

export default BountyComments;
