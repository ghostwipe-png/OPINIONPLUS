'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { CornerDownRight, MessageCircle, Pin, Flag, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStore } from '../lib/store';

const REACTIONS = ['👍', '👏', '❤️', '🔥', '💡'];
const PAGE_SIZE = 20;
const TYPING_TIMEOUT_MS = 3000;

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------- v10: local-storage helpers ----------
// Reactions, pins, and moderation are stored client-side for v1 (per the
// spec: "Stored in a comment_reactions table (or localStorage for v1)").
// These are additive UI layers on top of the existing comments prop and
// never mutate the data passed in from the parent.

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ---------- v10: minimal, safe markdown rendering ----------
// Supports **bold**, *italic*, [text](url) only — deliberately narrow so we
// don't need a full sanitizer pass here; text is HTML-escaped first.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-signal underline">$1</a>');
  html = html.replace(/@([a-zA-Z0-9_]+)/g, '<span class="text-signal font-semibold">@$1</span>');
  return html;
}

function ReactionBar({ commentId }) {
  const key = `comment-reactions:${commentId}`;
  const [counts, setCounts] = useState(() => readLS(key, {}));
  const [mine, setMine] = useState(() => readLS(`${key}:mine`, []));
  const [popId, setPopId] = useState(null);

  const toggle = (emoji) => {
    const has = mine.includes(emoji);
    const nextMine = has ? mine.filter((e) => e !== emoji) : [...mine, emoji];
    const nextCounts = { ...counts, [emoji]: Math.max(0, (counts[emoji] || 0) + (has ? -1 : 1)) };
    setMine(nextMine);
    setCounts(nextCounts);
    writeLS(`${key}:mine`, nextMine);
    writeLS(key, nextCounts);
    if (!has) {
      setPopId(emoji);
      setTimeout(() => setPopId(null), 250);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {REACTIONS.map((emoji) => {
        const count = counts[emoji] || 0;
        const active = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-transform ${
              active ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600 hover:border-ink'
            } ${popId === emoji ? 'scale-125' : 'scale-100'}`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-[10px]">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function MentionAutocomplete({ query, users, onPick }) {
  const matches = users.filter((u) => u.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
  if (!query || matches.length === 0) return null;
  return (
    <div className="absolute z-20 bottom-full mb-1 left-0 w-48 bg-paper border border-wire rounded-sm shadow-lg py-1">
      {matches.map((u) => (
        <button
          key={u}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(u); }}
          className="w-full text-left px-2 py-1 text-xs text-ink-600 hover:bg-ink-50"
        >
          @{u}
        </button>
      ))}
    </div>
  );
}

function ReplyComposer({ placeholder, onSubmit, onCancel, knownUsers }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    const caret = e.target.selectionStart;
    const upToCaret = val.slice(0, caret);
    const match = upToCaret.match(/@([a-zA-Z0-9_]*)$/);
    setMentionQuery(match ? match[1] : '');
  };

  const pickMention = (username) => {
    const caret = inputRef.current?.selectionStart ?? text.length;
    const upToCaret = text.slice(0, caret);
    const replaced = upToCaret.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
    const next = replaced + text.slice(caret);
    setText(next);
    setMentionQuery('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
    setPreview(false);
  };

  return (
    <form onSubmit={submit} className="mt-2">
      <div className="relative">
        {preview ? (
          <div
            className="flex-1 text-sm border-b border-wire py-1 min-h-[1.5rem]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '*Nothing to preview*') }}
          />
        ) : (
          <input
            ref={inputRef}
            autoFocus
            value={text}
            onChange={handleChange}
            placeholder={placeholder}
            className="flex-1 w-full text-sm border-b border-wire focus:border-ink outline-none py-1 bg-transparent"
          />
        )}
        {!preview && (
          <MentionAutocomplete query={mentionQuery} users={knownUsers} onPick={pickMention} />
        )}
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        <button type="submit" className="text-xs font-semibold text-signal shrink-0">Post</button>
        <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs text-ink-400 shrink-0 flex items-center gap-1">
          <Eye size={11} /> {preview ? 'Edit' : 'Preview'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-xs text-ink-400 shrink-0">Cancel</button>}
      </div>
    </form>
  );
}

function Comment({ comment, storyId, all, depth = 0, knownUsers, removedIds, onRemove, onReport, canModerate, isPinned, onPin, typingUserId }) {
  const { user, isAuthenticated } = useAuth();
  const { addComment } = useStore();
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const replies = all.filter((c) => c.parentId === comment.id);
  const removed = removedIds.has(comment.id);

  const submitReply = (text) => {
    addComment(storyId, {
      userId: user.id,
      userName: user.publisherName,
      userAvatar: user.logoUrl,
      body: text,
      parentId: comment.id,
    });
    setReplying(false);
    setShowReplies(true);
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-wire pl-4 mt-3' : 'mt-5'}>
      <div className={`flex gap-3 ${isPinned ? 'bg-ink-50/60 -mx-2 px-2 py-2 rounded-sm' : ''}`}>
        <img
          src={comment.userAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + comment.userName}
          alt={comment.userName}
          className="w-8 h-8 rounded-full border border-wire flex-shrink-0 object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{comment.userName}</span>
            <span className="text-xs text-ink-400">{timeAgo(comment.createdAt)}</span>
            {isPinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-signal">
                <Pin size={10} /> Pinned by author
              </span>
            )}
          </div>

          {removed ? (
            <p className="text-sm text-ink-400 italic mt-0.5">[This comment was removed]</p>
          ) : (
            <p
              className="text-sm text-ink-600 mt-0.5 break-words"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body) }}
            />
          )}

          {!removed && <ReactionBar commentId={comment.id} />}

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {isAuthenticated && !removed && (
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
            {!removed && isAuthenticated && (
              <button onClick={() => onReport(comment.id)} className="text-xs font-medium text-ink-400 hover:text-signal flex items-center gap-1">
                <Flag size={12} /> Report
              </button>
            )}
            {!removed && canModerate && (
              <button onClick={() => onRemove(comment.id)} className="text-xs font-medium text-ink-400 hover:text-signal flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            )}
            {!removed && depth === 0 && canModerate && (
              <button onClick={() => onPin(comment.id)} className="text-xs font-medium text-ink-400 hover:text-ink-600 flex items-center gap-1">
                <Pin size={12} /> {isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>

          {typingUserId && (
            <p className="text-xs text-ink-400 mt-1 flex items-center gap-1">
              {typingUserId} is typing
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-ink-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-ink-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-ink-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </p>
          )}

          {replying && (
            <ReplyComposer
              placeholder={`Reply to ${comment.userName}...`}
              onSubmit={submitReply}
              onCancel={() => setReplying(false)}
              knownUsers={knownUsers}
            />
          )}

          {showReplies && replies.map((r) => (
            <Comment
              key={r.id}
              comment={r}
              storyId={storyId}
              all={all}
              depth={depth + 1}
              knownUsers={knownUsers}
              removedIds={removedIds}
              onRemove={onRemove}
              onReport={onReport}
              canModerate={canModerate}
              isPinned={false}
              onPin={onPin}
              typingUserId={null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({ storyId, comments, storyAuthorId }) {
  const { user, isAuthenticated } = useAuth();
  const { addComment } = useStore();
  const [showComments, setShowComments] = useState(true);
  const [sortBy, setSortBy] = useState('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [removedIds, setRemovedIds] = useState(() => new Set(readLS(`comment-removed:${storyId}`, [])));
  const [pinnedId, setPinnedId] = useState(() => readLS(`comment-pinned:${storyId}`, null));
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);

  const canModerate = isAuthenticated && user && (user.id === storyAuthorId || user.role === 'admin' || user.role === 'root');

  const knownUsers = useMemo(
    () => Array.from(new Set(comments.map((c) => c.userName).filter(Boolean))),
    [comments]
  );

  const reactionCountFor = (commentId) => {
    const counts = readLS(`comment-reactions:${commentId}`, {});
    return Object.values(counts).reduce((a, b) => a + b, 0);
  };

  const top = useMemo(() => {
    let list = comments.filter((c) => !c.parentId);
    list = [...list].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'reacted') return reactionCountFor(b.id) - reactionCountFor(a.id);
      return new Date(b.createdAt) - new Date(a.createdAt); // newest (default)
    });
    if (pinnedId) {
      const pinned = list.find((c) => c.id === pinnedId);
      if (pinned) list = [pinned, ...list.filter((c) => c.id !== pinnedId)];
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, sortBy, pinnedId]);

  const visibleTop = top.slice(0, visibleCount);
  const hasMore = top.length > visibleCount;

  const handleRemove = (commentId) => {
    const next = new Set(removedIds);
    next.add(commentId);
    setRemovedIds(next);
    writeLS(`comment-removed:${storyId}`, Array.from(next));
  };

  const handleReport = (commentId) => {
    // Best-effort client-side flag; wire to POST /stories/:id/report style
    // endpoint if/when a per-comment report route exists.
    writeLS(`comment-reported:${commentId}`, true);
  };

  const handlePin = (commentId) => {
    const next = pinnedId === commentId ? null : commentId;
    setPinnedId(next);
    writeLS(`comment-pinned:${storyId}`, next);
  };

  const handleTyping = () => {
    setIsTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setIsTyping(false), TYPING_TIMEOUT_MS);
  };

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  const submit = (text) => {
    addComment(storyId, {
      userId: user.id,
      userName: user.publisherName,
      userAvatar: user.logoUrl,
      body: text,
      parentId: null,
    });
    setShowComments(true);
    setIsTyping(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button
          onClick={() => setShowComments(!showComments)}
          className="wire-tag flex items-center gap-2 hover:text-signal transition-colors"
        >
          <MessageCircle size={14} />
          {comments.length} comment{comments.length === 1 ? '' : 's'}
          <span className="text-xs text-ink-400">{showComments ? '▲' : '▼'}</span>
        </button>

        {showComments && comments.length > 1 && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-wire rounded-sm px-2 py-1 bg-paper text-ink-600"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="reacted">Most reacted</option>
          </select>
        )}
      </div>

      {showComments && (
        <>
          {isAuthenticated ? (
            <div className="flex gap-3 items-start mb-6">
              <img src={user.logoUrl} alt="" className="w-8 h-8 rounded-full border border-wire object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <ReplyComposerRoot onSubmit={submit} onTyping={handleTyping} knownUsers={knownUsers} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-400 mb-4">
              <a href="/login" className="text-signal font-medium">Sign in</a> to join the conversation.
            </p>
          )}

          <div className="transition-opacity duration-200">
            {visibleTop.map((c) => (
              <Comment
                key={c.id}
                comment={c}
                storyId={storyId}
                all={comments}
                knownUsers={knownUsers}
                removedIds={removedIds}
                onRemove={handleRemove}
                onReport={handleReport}
                canModerate={canModerate}
                isPinned={pinnedId === c.id}
                onPin={handlePin}
                typingUserId={null}
              />
            ))}
          </div>

          {isTyping && (
            <p className="text-xs text-ink-400 mt-3 flex items-center gap-1">
              {user?.publisherName || 'Someone'} is typing
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-ink-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-ink-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-ink-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </p>
          )}

          {hasMore && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="mt-5 w-full text-xs font-semibold text-ink-600 border border-wire rounded-sm py-2 hover:bg-ink-50"
            >
              Load more comments ({top.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Root-level composer (separate from ReplyComposer so the top-level box
// keeps its textarea styling and wires up the typing indicator).
function ReplyComposerRoot({ onSubmit, onTyping, knownUsers }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    onTyping();
    const caret = e.target.selectionStart;
    const upToCaret = val.slice(0, caret);
    const match = upToCaret.match(/@([a-zA-Z0-9_]*)$/);
    setMentionQuery(match ? match[1] : '');
  };

  const pickMention = (username) => {
    const caret = inputRef.current?.selectionStart ?? text.length;
    const upToCaret = text.slice(0, caret);
    const replaced = upToCaret.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
    const next = replaced + text.slice(caret);
    setText(next);
    setMentionQuery('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
    setPreview(false);
  };

  return (
    <form onSubmit={submit}>
      <div className="relative">
        {preview ? (
          <div
            className="w-full text-sm border-b border-wire py-1 resize-none min-h-[3rem]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '*Nothing to preview*') }}
          />
        ) : (
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleChange}
            placeholder="Add to the record... (supports **bold**, *italic*, [links](url), @mentions)"
            rows={2}
            className="w-full text-sm border-b border-wire focus:border-ink outline-none py-1 resize-none bg-transparent"
          />
        )}
        {!preview && <MentionAutocomplete query={mentionQuery} users={knownUsers} onPick={pickMention} />}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button type="submit" className="btn-primary text-xs px-3 py-1.5 rounded-sm">
          Comment
        </button>
        <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs text-ink-400 flex items-center gap-1">
          <Eye size={11} /> {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
    </form>
  );
}
