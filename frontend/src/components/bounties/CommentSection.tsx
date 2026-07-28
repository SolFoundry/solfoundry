'use client';

import React, { useState } from 'react';
import { useComments, useReplies, useCreateComment, useDeleteComment } from '../hooks/useComments';
import { TimeAgo } from './common/TimeAgo';

interface CommentSectionProps {
  bountyId: string;
}

export function CommentSection({ bountyId }: CommentSectionProps) {
  const { data: commentsData, isLoading, isError } = useComments(bountyId);
  const createComment = useCreateComment(bountyId);
  const deleteComment = useDeleteComment(bountyId);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    try {
      await createComment.mutateAsync({ body: newComment.trim() });
      setNewComment('');
    } catch {
      // Error handled by react-query
    }
  };

  const handleReplySubmit = async (parentId: string) => {
    if (!replyText.trim()) return;
    try {
      await createComment.mutateAsync({ body: replyText.trim(), parent_id: parentId });
      setReplyText('');
      setReplyTo(null);
    } catch {
      // Error handled by react-query
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment.mutateAsync(commentId);
    } catch {
      // Error handled by react-query
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-transparent shadow-sm dark:shadow-none">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-300 mb-4">
        Discussion ({commentsData?.total ?? 0})
      </h2>

      {/* New Comment Form */}
      <div className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts, ask questions, or discuss this bounty..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-solana-purple focus:border-transparent resize-y min-h-[80px] text-sm"
          rows={3}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || createComment.isPending}
            className="px-4 py-2 bg-solana-purple hover:bg-violet-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors min-h-[36px]"
          >
            {createComment.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comments List */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="text-red-500 text-sm">Failed to load comments. Please try again.</p>
      )}

      {!isLoading && !isError && commentsData && commentsData.items.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
          No comments yet. Be the first to discuss this bounty!
        </p>
      )}

      {!isLoading && !isError && commentsData && commentsData.items.length > 0 && (
        <div className="space-y-4">
          {commentsData.items.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={(id) => setReplyTo(replyTo === id ? null : id)}
              onDelete={handleDelete}
              isReplying={replyTo === comment.id}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              onReplySubmit={() => handleReplySubmit(comment.id)}
              isSubmitting={createComment.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: {
    id: string;
    author_id: string;
    author_username: string | null;
    author_avatar: string | null;
    body: string;
    is_deleted: boolean;
    is_moderated: boolean;
    moderation_reason: string | null;
    reply_count: number;
    created_at: string;
    updated_at: string;
  };
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  isReplying: boolean;
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onReplySubmit: () => void;
  isSubmitting: boolean;
}

function CommentItem({
  comment,
  onReply,
  onDelete,
  isReplying,
  replyText,
  onReplyTextChange,
  onReplySubmit,
  isSubmitting,
}: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const { data: repliesData } = useReplies(
    comment.is_deleted ? undefined : comment.id,
    showReplies ? comment.id : null
  );

  const currentUserId = localStorage.getItem('wallet_address') || '';
  const isAuthor = comment.author_id === currentUserId;

  if (comment.is_deleted) {
    return (
      <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-3 opacity-60">
        <p className="text-gray-400 dark:text-gray-600 text-sm italic">[deleted]</p>
        {comment.reply_count > 0 && (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-xs text-solana-purple hover:text-violet-600 mt-1"
          >
            {showReplies ? 'Hide replies' : `${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-lg p-3">
      {/* Comment Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {comment.author_avatar && (
            <img
              src={comment.author_avatar}
              alt=""
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {comment.author_username || comment.author_id.slice(0, 8)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <TimeAgo date={comment.created_at} />
          </span>
          {comment.is_moderated && (
            <span className="text-xs text-yellow-600 dark:text-yellow-400" title={comment.moderation_reason ?? ''}>
              [moderated]
            </span>
          )}
        </div>
        {isAuthor && (
          <button
            onClick={() => onDelete(comment.id)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            ✕
          </button>
        )}
      </div>

      {/* Comment Body */}
      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
        {comment.body}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => onReply(comment.id)}
          className="text-xs text-gray-500 hover:text-solana-purple dark:text-gray-400 dark:hover:text-violet-400 transition-colors"
        >
          Reply
        </button>
        {comment.reply_count > 0 && (
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-xs text-solana-purple hover:text-violet-600 transition-colors"
          >
            {showReplies
              ? 'Hide replies'
              : `${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="mt-3 ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
          <textarea
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder="Write a reply..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-solana-purple focus:border-transparent resize-y min-h-[60px] text-sm"
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => onReply('')}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={onReplySubmit}
              disabled={!replyText.trim() || isSubmitting}
              className="px-3 py-1 text-xs bg-solana-purple hover:bg-violet-600 disabled:bg-gray-400 text-white rounded font-medium transition-colors"
            >
              {isSubmitting ? '...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Nested Replies */}
      {showReplies && repliesData && repliesData.items.length > 0 && (
        <div className="mt-3 ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-3 space-y-3">
          {repliesData.items.map((reply) => (
            <div key={reply.id} className="border-l-0 pl-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {reply.author_username || reply.author_id.slice(0, 8)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  <TimeAgo date={reply.created_at} />
                </span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                {reply.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}