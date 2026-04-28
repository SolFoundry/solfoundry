/**
 * CommentSection — full-featured comment thread for bounty detail pages.
 *
 * Features:
 *   • Nested reply threads (recursive rendering)
 *   • Real-time updates via React Query refetchInterval
 *   • Client-side spam filter + backend moderation
 *   • Upvote toggle with optimistic UI
 *   • Inline edit / delete for own comments
 *   • "Report spam" action
 */
import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Reply,
  ChevronDown,
  ChevronUp,
  ThumbsUp,
  MoreHorizontal,
  Edit3,
  Trash2,
  Flag,
  Send,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { Comment } from '../../types/comment';
import { useAuth } from '../../hooks/useAuth';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useToggleUpvote,
  useReportComment,
} from '../../hooks/useComments';
import { timeAgo } from '../../lib/utils';

/* ------------------------------------------------------------------ */
/*  Spam Filter (client-side pre-check)                                */
/* ------------------------------------------------------------------ */

const SPAM_PATTERNS = [
  /(?:https?:\/\/[^\s]+)/gi, // excessive URLs (allow 1)
  /(.)\1{4,}/g, // repeated chars
  /(?:buy|free|click|subscribe|earn|winner|prize|congratulations)/i,
];

const SPAM_THRESHOLD = 0.6;

function spamScore(content: string): number {
  if (!content || content.trim().length === 0) return 1;
  let score = 0;
  const urlMatches = content.match(/https?:\/\/[^\s]+/g);
  if (urlMatches && urlMatches.length > 2) score += 0.3;

  if (/(.)\1{4,}/.test(content)) score += 0.25;

  const lower = content.toLowerCase();
  const spamWords = ['buy now', 'free money', 'click here', 'subscribe', 'earn $$$', 'winner', 'prize', 'congratulations you won'];
  for (const w of spamWords) {
    if (lower.includes(w)) { score += 0.35; break; }
  }

  if (content.length > 5 && new Set(content.toLowerCase().split(/\s+/)).size < content.split(/\s+/).length * 0.25) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

function isLikelySpam(content: string): boolean {
  return spamScore(content) >= SPAM_THRESHOLD;
}

/* ------------------------------------------------------------------ */
/*  Spam Warning Banner                                                 */
/* ------------------------------------------------------------------ */

function SpamWarning({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-400"
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>Your comment looks like it might be spam. Please review and edit before posting.</span>
      <button onClick={onDismiss} className="ml-auto text-yellow-400 hover:text-yellow-300">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  CommentInput — reusable for new comments and replies               */
/* ------------------------------------------------------------------ */

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

function CommentInput({
  onSubmit,
  placeholder = 'Write a comment...',
  initialValue = '',
  submitLabel = 'Post',
  onCancel,
  autoFocus = false,
}: CommentInputProps) {
  const [content, setContent] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [spamWarning, setSpamWarning] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    if (isLikelySpam(trimmed) && !spamWarning) {
      setSpamWarning(true);
      return;
    }

    setSpamWarning(false);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  }, [content, submitting, spamWarning, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <div className="space-y-2">
      <AnimatePresence>{spamWarning && <SpamWarning onDismiss={() => setSpamWarning(false)} />}</AnimatePresence>

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          if (spamWarning) setSpamWarning(false);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="w-full rounded-lg border border-border bg-forge-800 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald/30 resize-none transition-colors"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {content.length > 0 ? `${content.length} chars` : 'Markdown supported'} · Ctrl+Enter to post
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald text-forge-950 text-sm font-medium hover:bg-emerald-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CommentCard — single comment with actions                          */
/* ------------------------------------------------------------------ */

interface CommentCardProps {
  comment: Comment;
  bountyId: string;
  depth?: number;
}

function CommentCard({ comment, bountyId, depth = 0 }: CommentCardProps) {
  const { user } = useAuth();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportInput, setShowReportInput] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const createMutation = useCreateComment(bountyId);
  const updateMutation = useUpdateComment(bountyId);
  const deleteMutation = useDeleteComment(bountyId);
  const upvoteMutation = useToggleUpvote(bountyId);
  const reportMutation = useReportComment(bountyId);

  const isOwner = user?.id === comment.author_id;
  const isFlagged = comment.status === 'flagged' || comment.status === 'hidden';

  const handleReply = useCallback(
    async (content: string) => {
      await createMutation.mutateAsync({ content, parent_id: comment.id });
      setShowReplyInput(false);
    },
    [createMutation, comment.id]
  );

  const handleEdit = useCallback(
    async (content: string) => {
      await updateMutation.mutateAsync({ commentId: comment.id, payload: { content } });
      setIsEditing(false);
    },
    [updateMutation, comment.id]
  );

  const handleDelete = useCallback(async () => {
    if (window.confirm('Delete this comment?')) {
      await deleteMutation.mutateAsync(comment.id);
    }
    setShowMenu(false);
  }, [deleteMutation, comment.id]);

  const handleUpvote = useCallback(() => {
    upvoteMutation.mutate(comment.id);
  }, [upvoteMutation, comment.id]);

  const handleReport = useCallback(
    async (reason: string) => {
      await reportMutation.mutateAsync({ commentId: comment.id, reason });
      setShowReportInput(false);
      setShowMenu(false);
    },
    [reportMutation, comment.id]
  );

  if (isFlagged) {
    return (
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-text-muted italic">
        <AlertTriangle className="w-3.5 h-3.5 inline mr-2 text-yellow-500" />
        This comment has been flagged for review.
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-border pl-4' : ''}`}>
      <div className="group rounded-lg border border-border bg-forge-900 p-4 hover:border-border-hover transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {comment.author_avatar_url ? (
              <img
                src={comment.author_avatar_url}
                alt={comment.author_username}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-forge-700 flex items-center justify-center text-xs font-mono text-text-muted">
                {comment.author_username?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-sm font-medium text-text-primary">{comment.author_username}</span>
            <span className="text-xs text-text-muted">{timeAgo(comment.created_at)}</span>
            {comment.created_at !== comment.updated_at && (
              <span className="text-xs text-text-muted">(edited)</span>
            )}
          </div>

          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-border bg-forge-800 shadow-xl py-1"
                >
                  {isOwner && (
                    <>
                      <button
                        onClick={() => { setIsEditing(true); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-forge-700 hover:text-text-primary transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                  {!isOwner && (
                    <button
                      onClick={() => { setShowReportInput(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" /> Report
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="mt-2">
            <CommentInput
              initialValue={comment.content}
              onSubmit={handleEdit}
              submitLabel="Save"
              onCancel={() => setIsEditing(false)}
              autoFocus
            />
          </div>
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {comment.content}
          </p>
        )}

        {/* Footer actions */}
        {!isEditing && (
          <div className="flex items-center gap-4 mt-3">
            {/* Upvote */}
            <button
              onClick={handleUpvote}
              className={`inline-flex items-center gap-1 text-xs transition-colors ${
                comment.has_upvoted
                  ? 'text-emerald'
                  : 'text-text-muted hover:text-emerald'
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {comment.upvote_count > 0 && comment.upvote_count}
            </button>

            {/* Reply */}
            {depth < 5 && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                Reply
              </button>
            )}

            {/* Collapse toggle for replies */}
            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors ml-auto"
              >
                {collapsed ? (
                  <><ChevronDown className="w-3.5 h-3.5" /> {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</>
                ) : (
                  <><ChevronUp className="w-3.5 h-3.5" /> Collapse</>
                )}
              </button>
            )}
          </div>
        )}

        {/* Report input */}
        <AnimatePresence>
          {showReportInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <ReportInput
                onSubmit={handleReport}
                onCancel={() => setShowReportInput(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply input */}
        <AnimatePresence>
          {showReplyInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <CommentInput
                onSubmit={handleReply}
                placeholder={`Reply to ${comment.author_username}...`}
                submitLabel="Reply"
                onCancel={() => setShowReplyInput(false)}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nested replies */}
      {!collapsed && comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              bountyId={bountyId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Report Input                                                       */
/* ------------------------------------------------------------------ */

function ReportInput({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = ['Spam', 'Harassment', 'Off-topic', 'Inappropriate content', 'Other'];

  return (
    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 space-y-2">
      <p className="text-xs text-yellow-400 font-medium">Report this comment:</p>
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              reason === r
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                : 'bg-forge-800 text-text-muted border border-border hover:border-border-hover'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            if (!reason) return;
            setSubmitting(true);
            try { await onSubmit(reason); } finally { setSubmitting(false); }
          }}
          disabled={!reason || submitting}
          className="px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 text-xs font-medium hover:bg-yellow-500/30 disabled:opacity-40 transition-colors"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Submit Report'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 rounded-lg text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CommentSection — main exported component                           */
/* ------------------------------------------------------------------ */

interface CommentSectionProps {
  bountyId: string;
}

export function CommentSection({ bountyId }: CommentSectionProps) {
  const { isAuthenticated, user } = useAuth();
  const { data: comments, isLoading, isError } = useComments(bountyId);
  const createMutation = useCreateComment(bountyId);

  const handleNewComment = useCallback(
    async (content: string) => {
      await createMutation.mutateAsync({ content, parent_id: null });
    },
    [createMutation]
  );

  const totalComments = useMemo(() => {
    if (!comments) return 0;
    const count = (list: Comment[]): number =>
      list.reduce((sum, c) => sum + 1 + (c.replies?.length ? count(c.replies) : 0), 0);
    return count(comments);
  }, [comments]);

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-sans text-lg font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald" />
          Discussion
          {totalComments > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-forge-800 text-xs font-mono text-text-muted">
              {totalComments}
            </span>
          )}
        </h2>
        {comments && comments.length > 0 && (
          <span className="text-xs text-text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            Live updates
          </span>
        )}
      </div>

      {/* New comment input (authenticated only) */}
      {isAuthenticated ? (
        <div className="mb-6">
          <div className="flex items-start gap-3">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full mt-1" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-forge-700 flex items-center justify-center text-sm font-mono text-text-muted mt-1">
                {user?.username?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex-1">
              <CommentInput onSubmit={handleNewComment} placeholder="Share your thoughts on this bounty..." />
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-border bg-forge-800 p-4 text-center">
          <p className="text-sm text-text-muted mb-3">Sign in to join the discussion.</p>
          <a
            href="/api/auth/github/authorize"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forge-700 border border-border hover:border-border-hover text-text-primary text-sm font-medium transition-all duration-200"
          >
            Sign in with GitHub
          </a>
        </div>
      )}

      {/* Comment list */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-forge-800 p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-forge-700" />
                <div className="h-3 w-24 rounded bg-forge-700" />
                <div className="h-3 w-16 rounded bg-forge-700" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-forge-700" />
                <div className="h-3 w-3/4 rounded bg-forge-700" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="text-center py-8">
          <p className="text-text-muted text-sm">Failed to load comments. Please try again.</p>
        </div>
      )}

      {comments && !isLoading && comments.length === 0 && (
        <div className="text-center py-8">
          <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
          <p className="text-text-muted text-sm">No comments yet. Be the first to discuss this bounty!</p>
        </div>
      )}

      {comments && !isLoading && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              bountyId={bountyId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
