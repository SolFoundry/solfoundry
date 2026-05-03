import React, { useMemo, useState } from 'react';
import { MessageCircle, Send, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBountyComments, useCreateBountyComment } from '../../hooks/useBountyComments';
import type { BountyComment } from '../../types/comment';
import { timeAgo } from '../../lib/utils';

interface BountyCommentsProps {
  bountyId: string;
}

function CommentForm({
  bountyId,
  parentId,
  onDone,
}: {
  bountyId: string;
  parentId?: string | null;
  onDone?: () => void;
}) {
  const [body, setBody] = useState('');
  const createComment = useCreateBountyComment(bountyId);
  const trimmed = body.trim();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (trimmed.length < 3) return;
    await createComment.mutateAsync({ body: trimmed, parent_id: parentId ?? null });
    setBody('');
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={1200}
        placeholder={parentId ? 'Write a reply…' : 'Ask a question or share progress…'}
        className="min-h-24 w-full rounded-xl border border-border bg-forge-950 px-3 py-2 text-sm text-text-primary outline-none transition focus:border-emerald"
      />
      {createComment.error && (
        <p className="text-xs text-status-error">Comment could not be posted. It may need moderation or sign-in refresh.</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">Basic spam/moderation is enforced by the API before comments become visible.</p>
        <button
          type="submit"
          disabled={trimmed.length < 3 || createComment.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald px-4 py-2 text-sm font-semibold text-text-inverse disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {createComment.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  );
}

function CommentCard({ comment, replies, bountyId }: { comment: BountyComment; replies: BountyComment[]; bountyId: string }) {
  const [replying, setReplying] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-forge-950/70 p-4">
      <div className="flex items-start gap-3">
        {comment.author_avatar_url ? (
          <img src={comment.author_avatar_url} alt="" className="h-8 w-8 rounded-full border border-border" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forge-800 text-xs text-text-muted">
            {comment.author_username.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-text-primary">{comment.author_username}</span>
            <span className="text-text-muted">{timeAgo(comment.created_at)}</span>
            {comment.moderation_status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-status-warning"><ShieldAlert className="h-3 w-3" /> pending moderation</span>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{comment.body}</p>
          <button onClick={() => setReplying((value) => !value)} className="mt-3 text-xs font-medium text-emerald hover:text-emerald-light">
            {replying ? 'Cancel reply' : 'Reply'}
          </button>
          {replying && <div className="mt-3"><CommentForm bountyId={bountyId} parentId={comment.id} onDone={() => setReplying(false)} /></div>}
        </div>
      </div>
      {replies.length > 0 && (
        <div className="mt-4 space-y-3 border-l border-border pl-4">
          {replies.map((reply) => <CommentCard key={reply.id} comment={reply} replies={[]} bountyId={bountyId} />)}
        </div>
      )}
    </div>
  );
}

export function BountyComments({ bountyId }: BountyCommentsProps) {
  const { isAuthenticated } = useAuth();
  const commentsQuery = useBountyComments(bountyId);

  const { roots, repliesByParent } = useMemo(() => {
    const replies = new Map<string, BountyComment[]>();
    const rootComments: BountyComment[] = [];
    for (const comment of commentsQuery.data ?? []) {
      if (comment.parent_id) replies.set(comment.parent_id, [...(replies.get(comment.parent_id) ?? []), comment]);
      else rootComments.push(comment);
    }
    return { roots: rootComments, repliesByParent: replies };
  }, [commentsQuery.data]);

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 font-sans text-lg font-semibold text-text-primary">
          <MessageCircle className="h-5 w-5 text-emerald" /> Discussion
        </h2>
        <span className="font-mono text-xs text-text-muted">{roots.length} thread{roots.length === 1 ? '' : 's'}</span>
      </div>

      {isAuthenticated ? (
        <div className="mb-5"><CommentForm bountyId={bountyId} /></div>
      ) : (
        <div className="mb-5 rounded-xl border border-border bg-forge-950 p-4 text-sm text-text-secondary">
          Sign in with GitHub to ask a question or share progress.
        </div>
      )}

      {commentsQuery.isLoading ? (
        <p className="text-sm text-text-muted">Loading discussion…</p>
      ) : commentsQuery.error ? (
        <p className="text-sm text-status-error">Discussion is unavailable right now.</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-text-muted">No discussion yet. Be the first to ask a clarifying question.</p>
      ) : (
        <div className="space-y-3">
          {roots.map((comment) => (
            <CommentCard key={comment.id} comment={comment} replies={repliesByParent.get(comment.id) ?? []} bountyId={bountyId} />
          ))}
        </div>
      )}
    </div>
  );
}
