import React, { useMemo, useState } from 'react';
import { MessageSquare, Reply, Send } from 'lucide-react';
import type { Bounty } from '../../types/bounty';
import { timeAgo } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { useBountyComments, useCreateBountyComment } from '../../hooks/useComments';

const BLOCKED_TERMS = ['http://', 'https://', 'telegram', 'whatsapp', 'airdrop', 'wallet seed'];

interface Node {
  id: string;
  parent_id?: string | null;
  author: string;
  message: string;
  created_at: string;
  children: Node[];
}

function buildTree(items: Node[]): Node[] {
  const byId = new Map<string, Node>();
  const roots: Node[] = [];
  items.forEach((i) => byId.set(i.id, { ...i, children: [] }));
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(n);
    else roots.push(n);
  });
  return roots;
}

function CommentItem({ node, onReply }: { node: Node; onReply: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-forge-850 p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-text-primary">{node.author}</p>
        <span className="text-xs text-text-muted font-mono">{timeAgo(node.created_at)}</span>
      </div>
      <p className="text-sm text-text-secondary whitespace-pre-wrap">{node.message}</p>
      <button onClick={() => onReply(node.id)} className="mt-2 inline-flex items-center gap-1 text-xs text-emerald hover:text-emerald-light">
        <Reply className="w-3 h-3" /> Reply
      </button>
      {node.children.length > 0 && (
        <div className="mt-3 pl-3 border-l border-border space-y-2">
          {node.children.map((c) => (
            <CommentItem key={c.id} node={c} onReply={onReply} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BountyDiscussion({ bounty }: { bounty: Bounty }) {
  const { user, isAuthenticated } = useAuth();
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const { data, isError } = useBountyComments(bounty.id);
  const createComment = useCreateBountyComment(bounty.id);

  const items = data?.items ?? [];
  const tree = useMemo(() => buildTree(items as Node[]), [items]);

  const onSubmit = async () => {
    const text = message.trim();
    if (!text) return;
    if (BLOCKED_TERMS.some((k) => text.toLowerCase().includes(k))) {
      setLocalError('Message blocked by anti-spam filter. Remove links or contact handles.');
      return;
    }
    setLocalError(null);
    await createComment.mutateAsync({ message: text, ...(replyTo ? { parent_id: replyTo } : {}) });
    setMessage('');
    setReplyTo(null);
  };

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-emerald" />
        <h2 className="font-sans text-lg font-semibold text-text-primary">Discussion</h2>
        <span className="text-xs text-text-muted font-mono">live refresh: 5s</span>
      </div>

      {isError && <p className="text-xs text-text-muted mb-3">Comments API unavailable right now.</p>}

      {tree.length === 0 ? (
        <p className="text-sm text-text-muted mb-4">No comments yet — start the discussion.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {tree.map((n) => (
            <CommentItem key={n.id} node={n} onReply={setReplyTo} />
          ))}
        </div>
      )}

      {isAuthenticated ? (
        <div className="space-y-2">
          {replyTo && (
            <p className="text-xs text-emerald">
              Replying in thread · <button onClick={() => setReplyTo(null)} className="underline">cancel</button>
            </p>
          )}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Ask a question, share progress, or clarify requirements..."
            className="w-full bg-forge-800 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:ring-1 focus:ring-emerald/30 outline-none"
          />
          {localError && <p className="text-xs text-status-error">{localError}</p>}
          <div className="flex justify-between items-center">
            <p className="text-xs text-text-muted">Posting as {user?.username ?? 'you'}</p>
            <button
              onClick={onSubmit}
              disabled={!message.trim() || createComment.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald text-text-inverse text-sm font-medium disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">Sign in to join the thread.</p>
      )}
    </div>
  );
}
