'use client';

import { useState } from 'react';
import { CornerDownRight, MessageCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Comment({ comment, storyId, all, depth = 0 }) {
  const { user, isAuthenticated } = useAuth();
  const { addComment } = useStore();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const replies = all.filter((c) => c.parentId === comment.id);

  const submitReply = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(storyId, {
      userId: user.id,
      userName: user.publisherName,
      userAvatar: user.logoUrl,
      body: text.trim(),
      parentId: comment.id,
    });
    setText('');
    setReplying(false);
    setShowReplies(true);
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-wire pl-4 mt-3' : 'mt-5'}>
      <div className="flex gap-3">
        <img
          src={comment.userAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + comment.userName}
          alt={comment.userName}
          className="w-8 h-8 rounded-full border border-wire flex-shrink-0 object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{comment.userName}</span>
            <span className="text-xs text-ink-400">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-ink-600 mt-0.5 break-words">{comment.body}</p>

          <div className="flex items-center gap-3 mt-1.5">
            {isAuthenticated && (
              <button
                onClick={() => setReplying((r) => !r)}
                className="text-xs font-medium text-ink-400 hover:text-signal flex items-center gap-1"
              >
                <CornerDownRight size={12} /> Reply
              </button>
            )}
            {replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs font-medium text-ink-400 hover:text-ink-600 flex items-center gap-1"
              >
                <MessageCircle size={12} />
                {showReplies ? 'Hide' : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>

          {replying && (
            <form onSubmit={submitReply} className="mt-2 flex gap-2">
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Reply to ${comment.userName}...`}
                className="flex-1 text-sm border-b border-wire focus:border-ink outline-none py-1 bg-transparent"
              />
              <button type="submit" className="text-xs font-semibold text-signal shrink-0">Post</button>
              <button type="button" onClick={() => setReplying(false)} className="text-xs text-ink-400 shrink-0">Cancel</button>
            </form>
          )}

          {showReplies && replies.map((r) => (
            <Comment key={r.id} comment={r} storyId={storyId} all={all} depth={depth + 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({ storyId, comments }) {
  const { user, isAuthenticated } = useAuth();
  const { addComment } = useStore();
  const [text, setText] = useState('');
  const [showComments, setShowComments] = useState(true);
  const top = comments.filter((c) => !c.parentId);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(storyId, {
      userId: user.id,
      userName: user.publisherName,
      userAvatar: user.logoUrl,
      body: text.trim(),
      parentId: null,
    });
    setText('');
    setShowComments(true);
  };

  return (
    <div>
      <button
        onClick={() => setShowComments(!showComments)}
        className="wire-tag mb-4 flex items-center gap-2 hover:text-signal transition-colors"
      >
        <MessageCircle size={14} />
        {comments.length} comment{comments.length === 1 ? '' : 's'}
        <span className="text-xs text-ink-400">{showComments ? '▲' : '▼'}</span>
      </button>

      {showComments && (
        <>
          {isAuthenticated ? (
            <form onSubmit={submit} className="flex gap-3 items-start mb-6">
              <img src={user.logoUrl} alt="" className="w-8 h-8 rounded-full border border-wire object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add to the record..."
                  rows={2}
                  className="w-full text-sm border-b border-wire focus:border-ink outline-none py-1 resize-none"
                />
                <button type="submit" className="btn-primary text-xs px-3 py-1.5 rounded-sm mt-2">
                  Comment
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-ink-400 mb-4">
              <a href="/login" className="text-signal font-medium">Sign in</a> to join the conversation.
            </p>
          )}

          <div>
            {top.map((c) => (
              <Comment key={c.id} comment={c} storyId={storyId} all={comments} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}