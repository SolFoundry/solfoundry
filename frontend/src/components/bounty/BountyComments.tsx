import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Radio, Reply, Trash2, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBountyComments } from '../../hooks/useBountyComments';
import {
  deleteBountyComment,
  hideBountyComment,
  postBountyComment,
} from '../../api/comments';
import { ApiError } from '../../services/apiClient';
import { timeAgo } from '../../lib/utils';
import type { BountyCommentThread } from '../../types/comment';

function moderatorIds(): string[] {
  const raw = import.meta.env.VITE_MODERATOR_IDS as string | undefined;
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

interface NodeProps {
  bountyId: string;
  node: BountyCommentThread;
  depth: number;
  currentUserId: string | undefined;
  isMod: boolean;
  onReply: (c: BountyCommentThread) => void;
  onDeleted: () => void;
}

function CommentNode({
  bountyId,
  node,
  depth,
  currentUserId,
  isMod,
  onReply,
  onDeleted,
}: NodeProps) {
  const [busy, setBusy] = useState(false);

  const canDelete = currentUserId && node.author_id === currentUserId;

  const handleDelete = async () => {
    if (!canDelete && !isMod) return;
    if (!window.confirm('Remove this comment?')) return;
    setBusy(true);
    try {
      await deleteBountyComment(bountyId, node.id);
      onDeleted();
    } catch {
      /* ws / refetch will reconcile */
    } finally {
      setBusy(false);
    }
  };

  const handleHide = async () => {
    if (!isMod) return;
    setBusy(true);
    try {
      await hideBountyComment(bountyId, node.id);
      onDeleted();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : 'Hide failed');
    } finally {
      setBusy(false);
    }
  };

  const maxVisualDepth = 6;
  const indent = Math.min(depth, maxVisualDepth);

  return (
    <div className={indent > 0 ? `ml-4 pl-4 border-l border-border/80` : ''}>
      <div className="rounded-lg border border-border bg-forge-850/50 p-4 mb-3">
        <div className="flex items-start gap-3">
          {node.author_avatar_url ? (
            <img
              src={node.author_avatar_url}
              alt=""
              className="w-9 h-9 rounded-full border border-border flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-forge-700 border border-border flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-text-muted font-mono">
                {node.author_username[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-medium text-text-primary text-sm">{node.author_username}</span>
              <span className="text-xs font-mono text-text-muted">{timeAgo(node.created_at)}</span>
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">{node.body}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => onReply(node)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-emerald transition-colors"
              >
                <Reply className="w-3.5 h-3.5" /> Reply
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-status-error transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
              {isMod && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleHide}
                  className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-status-warning transition-colors disabled:opacity-50"
                  title="Hide from thread (moderator)"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Hide
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {node.replies.map((r) => (
        <CommentNode
          key={r.id}
          bountyId={bountyId}
          node={r}
          depth={depth + 1}
          currentUserId={currentUserId}
          isMod={isMod}
          onReply={onReply}
          onDeleted={onDeleted}
        />
      ))}
    </div>
  );
}

interface BountyCommentsProps {
  bountyId: string;
}

export function BountyComments({ bountyId }: BountyCommentsProps) {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { threads, isLoading, isError, error, liveConnected } = useBountyComments(bountyId);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<BountyCommentThread | null>(null);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isMod = useMemo(
    () => Boolean(user && moderatorIds().includes(user.id)),
    [user],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['bounty-comments', bountyId] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !isAuthenticated) return;
    setPending(true);
    setFormError(null);
    try {
      await postBountyComment(bountyId, body.trim(), replyTo?.id ?? null);
      setBody('');
      setReplyTo(null);
      await invalidate();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not post comment.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="font-sans text-lg font-semibold text-text-primary inline-flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-emerald" />
          Discussion
        </h2>
        <div
          className={`inline-flex items-center gap-1.5 text-xs font-mono ${
            liveConnected ? 'text-emerald' : 'text-text-muted'
          }`}
          title={liveConnected ? 'Live updates connected' : 'Reconnecting for live updates…'}
        >
          <Radio className={`w-3.5 h-3.5 ${liveConnected ? 'animate-pulse' : ''}`} />
          {liveConnected ? 'Live' : 'Polling'}
        </div>
      </div>

      <p className="text-sm text-text-muted mb-4">
        Ask questions, clarify requirements, or share progress. Comments are filtered for spam; moderators may hide
        off-topic posts.
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-text-muted text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading comments…
        </div>
      )}

      {isError && (
        <p className="text-sm text-status-error py-4" role="alert">
          {error instanceof Error ? error.message : 'Could not load comments. Is the API running?'}
        </p>
      )}

      {!isLoading && !isError && threads.length === 0 && (
        <p className="text-sm text-text-muted py-4">No comments yet. Start the thread below.</p>
      )}

      {!isLoading &&
        !isError &&
        threads.map((t) => (
          <CommentNode
            key={t.id}
            bountyId={bountyId}
            node={t}
            depth={0}
            currentUserId={user?.id}
            isMod={isMod}
            onReply={setReplyTo}
            onDeleted={invalidate}
          />
        ))}

      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t border-border space-y-3">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-text-muted bg-forge-800 rounded-lg px-3 py-2">
              <span>
                Replying to <span className="text-emerald font-medium">@{replyTo.author_username}</span>
              </span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-text-secondary hover:text-text-primary">
                Cancel
              </button>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={8000}
            placeholder="Write a comment…"
            className="w-full bg-forge-700 border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none transition-all resize-y min-h-[100px]"
          />
          {formError && (
            <p className="text-sm text-status-error" role="alert">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald text-text-inverse text-sm font-semibold hover:bg-emerald-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
            {replyTo ? 'Post reply' : 'Post comment'}
          </button>
        </form>
      ) : (
        <div className="mt-6 pt-6 border-t border-border text-center">
          <p className="text-sm text-text-muted mb-3">Sign in with GitHub to join the discussion.</p>
          <a
            href="/api/auth/github/authorize"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-forge-800 border border-border hover:border-border-hover text-text-primary text-sm font-medium transition-all"
          >
            Sign in with GitHub
          </a>
        </div>
      )}
    </div>
  );
}
