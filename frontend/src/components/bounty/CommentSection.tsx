import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Reply,
  Send,
  MoreHorizontal,
  Trash2,
  Shield,
  Flag,
  CheckCircle,
  Edit3,
  X,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { Comment } from '../../types/comment';
import { useAuth } from '../../hooks/useAuth';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useModerateComment,
} from '../../hooks/useComments';

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface CommentInputProps {
  bountyId: string;
  parentId?: string | null;
  placeholder?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
}

function CommentInput({ bountyId, parentId, placeholder, onCancel, autoFocus }: CommentInputProps) {
  const [text, setText] = useState('');
  const { isAuthenticated } = useAuth();
  const createMutation = useCreateComment(bountyId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate(
      { content: trimmed, parent_id: parentId ?? null },
      {
        onSuccess: () => {
          setText('');
          onCancel?.();
        },
      },
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-border bg-forge-900 p-4 text-center">
        <p className="text-text-muted text-sm">
          <a href="/api/auth/github/authorize" className="text-emerald hover:text-emerald-light underline">
            Sign in with GitHub
          </a>{' '}
          to join the discussion.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? 'Write a comment…'}
        rows={2}
        autoFocus={autoFocus}
        className="flex-1 resize-none rounded-lg border border-border bg-forge-800 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-emerald transition-colors"
      />
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={!text.trim() || createMutation.isPending}
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald text-forge-950 hover:bg-emerald-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Single Comment Card ────────────────────────────────────────────────────

interface CommentCardProps {
  comment: Comment;
  bountyId: string;
  depth?: number;
}

function CommentCard({ comment, bountyId, depth = 0 }: CommentCardProps) {
  const { user: currentUser } = useAuth();
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [menuOpen, setMenuOpen] = useState(false);

  const updateMutation = useUpdateComment(bountyId);
  const deleteMutation = useDeleteComment(bountyId);
  const moderateMutation = useModerateComment(bountyId);

  const isOwner = currentUser?.id === comment.author_id;

  const handleEdit = () => {
    if (!editText.trim()) return;
    updateMutation.mutate(
      { commentId: comment.id, payload: { content: editText.trim() } },
      { onSuccess: () => setEditing(false) },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(comment.id);
    setMenuOpen(false);
  };

  const handleModerate = (action: 'approve' | 'hide' | 'flag_spam') => {
    moderateMutation.mutate({ commentId: comment.id, action });
    setMenuOpen(false);
  };

  return (
    <div className={depth > 0 ? 'ml-6 pl-4 border-l border-border' : ''}>
      <div className="group rounded-lg border border-border bg-forge-900 p-4 hover:border-border-hover transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {comment.author_avatar_url ? (
              <img src={comment.author_avatar_url} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-forge-700 flex items-center justify-center text-xs font-bold text-text-muted">
                {comment.author_username[0]?.toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-text-primary">{comment.author_username}</span>
            <span className="text-xs text-text-muted">{timeAgo(comment.created_at)}</span>
            {comment.is_edited && <span className="text-xs text-text-muted">(edited)</span>}
            {comment.status === 'flagged' && (
              <span className="inline-flex items-center gap-1 text-xs text-status-warning">
                <AlertTriangle className="w-3 h-3" /> Flagged
              </span>
            )}
          </div>

          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded hover:bg-forge-800 text-text-muted hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-border bg-forge-800 py-1 shadow-xl"
                >
                  {isOwner && (
                    <>
                      <button
                        onClick={() => { setEditing(true); setEditText(comment.content); setMenuOpen(false); }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:bg-forge-700 hover:text-text-primary transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-status-error hover:bg-forge-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </>
                  )}
                  {/* Moderation actions — visible to all authenticated users for flagging */}
                  <button
                    onClick={() => handleModerate('flag_spam')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-status-warning hover:bg-forge-700 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5" /> Report spam
                  </button>
                  <button
                    onClick={() => handleModerate('approve')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-emerald hover:bg-forge-700 transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleModerate('hide')}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-muted hover:bg-forge-700 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" /> Hide
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Body */}
        {editing ? (
          <div className="flex gap-2 mb-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-emerald bg-forge-800 px-3 py-2 text-sm text-text-primary focus:outline-none transition-colors"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handleEdit}
                disabled={updateMutation.isPending}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald text-forge-950 hover:bg-emerald-light disabled:opacity-40 transition-colors"
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap mb-2">
            {comment.content}
          </p>
        )}

        {/* Reply toggle */}
        {!editing && (
          <button
            onClick={() => setReplyOpen(!replyOpen)}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-emerald transition-colors"
          >
            <Reply className="w-3.5 h-3.5" />
            {replyOpen ? 'Cancel reply' : 'Reply'}
          </button>
        )}
      </div>

      {/* Inline reply input */}
      <AnimatePresence>
        {replyOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden"
          >
            <CommentInput
              bountyId={bountyId}
              parentId={comment.id}
              placeholder={`Reply to ${comment.author_username}…`}
              onCancel={() => setReplyOpen(false)}
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentCard key={reply.id} comment={reply} bountyId={bountyId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Comment Section ───────────────────────────────────────────────────

interface CommentSectionProps {
  bountyId: string;
}

export function CommentSection({ bountyId }: CommentSectionProps) {
  const { data, isLoading, isError } = useComments(bountyId);

  const comments = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-5 h-5 text-emerald" />
        <h2 className="font-sans text-lg font-semibold text-text-primary">
          Discussion
        </h2>
        {total > 0 && (
          <span className="ml-2 rounded-full bg-forge-800 px-2.5 py-0.5 text-xs font-mono text-text-muted">
            {total}
          </span>
        )}
      </div>

      {/* New comment input */}
      <div className="mb-6">
        <CommentInput bountyId={bountyId} />
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg border border-border bg-forge-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-forge-800 via-forge-700 to-forge-800 bg-[length:200%_100%] animate-shimmer" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-6">
          <p className="text-status-error text-sm">Failed to load comments. Please try again.</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
          <p className="text-text-muted text-sm">No comments yet. Be the first to start the discussion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} bountyId={bountyId} />
          ))}
        </div>
      )}
    </div>
  );
}
