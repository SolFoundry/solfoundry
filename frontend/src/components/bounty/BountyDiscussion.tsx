import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';

interface Comment {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  replies?: Comment[];
}

interface BountyDiscussionProps {
  bountyId: string;
  comments?: Comment[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

function CommentThread({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  const [showReplies, setShowReplies] = useState(depth < 1);
  const [replyText, setReplyText] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);

  return (
    <div className={depth > 0 ? 'ml-8 border-l border-border/30 pl-4' : ''}>
      <div className="flex gap-3 py-3">
        <img src={comment.avatar} className="w-8 h-8 rounded-full flex-shrink-0" alt="" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{comment.author}</span>
            <span className="text-xs text-text-muted">{timeAgo(comment.timestamp)}</span>
          </div>
          <p className="text-sm text-text-secondary mt-1">{comment.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-xs text-text-muted hover:text-text-primary transition-colors">
              Reply
            </button>
            {comment.replies && comment.replies.length > 0 && (
              <button onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-emerald hover:text-emerald-light flex items-center gap-1">
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
          {showReplyInput && (
            <div className="flex gap-2 mt-2">
              <input value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 bg-forge-800 border border-border rounded px-3 py-1.5 text-sm text-text-primary" />
              <button className="text-emerald hover:text-emerald-light">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <AnimatePresence>
        {showReplies && comment.replies?.map(r => (
          <motion.div key={r.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <CommentThread comment={r} depth={depth + 1} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function BountyDiscussion({ bountyId, comments = [] }: BountyDiscussionProps) {
  const [newComment, setNewComment] = useState('');

  return (
    <div className="border border-border rounded-xl bg-forge-900">
      <div className="p-4 border-b border-border/50 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-emerald" />
        <h3 className="text-sm font-semibold text-text-primary">Discussion ({comments.length})</h3>
      </div>
      
      <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
        {comments.map(c => <CommentThread key={c.id} comment={c} />)}
      </div>
      
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            placeholder="Add to the discussion..."
            className="flex-1 bg-forge-800 border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-emerald/50" />
          <button disabled={!newComment.trim()}
            className="px-4 py-2 bg-emerald/10 text-emerald border border-emerald/20 rounded-lg text-sm font-medium hover:bg-emerald/20 transition-colors disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}