import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bountyCommentsWebSocketUrl, listBountyComments } from '../api/comments';
import type { BountyComment, BountyCommentThread, CommentWsMessage } from '../types/comment';

const queryKey = (bountyId: string) => ['bounty-comments', bountyId] as const;

function buildThreads(flat: BountyComment[]): BountyCommentThread[] {
  const byId = new Map<string, BountyCommentThread>();
  for (const c of flat) {
    byId.set(c.id, { ...c, replies: [] });
  }
  const roots: BountyCommentThread[] = [];
  for (const c of flat) {
    const node = byId.get(c.id)!;
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortTree = (nodes: BountyCommentThread[]) => {
    nodes.sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const n of nodes) sortTree(n.replies);
  };
  sortTree(roots);
  return roots;
}

function mergeComment(list: BountyComment[], incoming: BountyComment): BountyComment[] {
  if (list.some((c) => c.id === incoming.id)) return list;
  return [...list, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function useBountyComments(bountyId: string) {
  const queryClient = useQueryClient();
  const [liveConnected, setLiveConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);

  const query = useQuery({
    queryKey: queryKey(bountyId),
    queryFn: () => listBountyComments(bountyId),
    staleTime: 30_000,
    refetchInterval: liveConnected ? false : 20_000,
  });

  const applyWs = useCallback(
    (msg: CommentWsMessage) => {
      queryClient.setQueryData<BountyComment[]>(queryKey(bountyId), (prev) => {
        const list = prev ?? [];
        if (msg.type === 'comment_created') {
          return mergeComment(list, msg.comment);
        }
        if (msg.type === 'comment_hidden' || msg.type === 'comment_deleted') {
          return list.filter((c) => c.id !== msg.comment_id);
        }
        return list;
      });
    },
    [bountyId, queryClient],
  );

  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const url = bountyCommentsWebSocketUrl(bountyId);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        if (!cancelled) {
          setLiveConnected(true);
          reconnectRef.current = 0;
        }
      };
      ws.onclose = () => {
        if (!cancelled) {
          setLiveConnected(false);
          wsRef.current = null;
          const delay = Math.min(30_000, 1000 * 2 ** reconnectRef.current);
          reconnectRef.current += 1;
          window.setTimeout(connect, delay);
        }
      };
      ws.onerror = () => {
        ws.close();
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as CommentWsMessage;
          if (msg.type === 'comment_created' || msg.type === 'comment_hidden' || msg.type === 'comment_deleted') {
            applyWs(msg);
          }
        } catch {
          /* ignore */
        }
      };
    };
    connect();
    const ping = window.setInterval(() => {
      const w = wsRef.current;
      if (w?.readyState === WebSocket.OPEN) w.send('ping');
    }, 25_000);
    return () => {
      cancelled = true;
      window.clearInterval(ping);
      setLiveConnected(false);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [bountyId, applyWs]);

  const threads = useMemo(() => buildThreads(query.data ?? []), [query.data]);

  return {
    ...query,
    threads,
    liveConnected,
    invalidate: () => queryClient.invalidateQueries({ queryKey: queryKey(bountyId) }),
  };
}
