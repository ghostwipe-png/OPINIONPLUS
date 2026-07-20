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

function readLS(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writeLS(key, value) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

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
  html = html.replace(/@([a-zA-Z0-9_]+)/g, '<span class="text-signal font-bold">@$1</span>');
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
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {REACTIONS.map((emoji) => {
        const count = counts[emoji] || 0;
        const active = mine.includes(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            className={`text-xs px-2 py-0.5 rounded-sm border flex items-center gap-1 transition-transform ${
              active ? 'bg-ink text-white border-ink' : 'border-wire bg-paper text-ink-600 hover:border-ink'
            } ${popId === emoji ? 'scale-110' : 'scale-100'}`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
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
    <div className="absolute z-20 bottom-full mb-1 left-0 w-48 bg-paper border border-wire rounded-sm shadow-xl py-1">
      {matches.map((u) => (
        <button
          key={u}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onPick(u); }}
          className="w-full text-left px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
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
    <form onSubmit={submit} className="mt-3">
      <div className="relative">
        {preview ? (
          <div className="text-xs text-ink-700 border-b border-wire py-2 min-h-[2rem]" dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '*Nothing to preview*') }} />
        ) : (
          <input
            ref={inputRef}
            autoFocus
            value={text}
            onChange={handleChange}
            placeholder={placeholder}
            className="w-full text-xs border-b border-wire focus:border-ink outline-none py-1.5 bg-transparent font-medium"
          />
        )}
        {!preview && <MentionAutocomplete query={mentionQuery} users={knownUsers} onPick={pickMention} />}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button type="submit" className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-3 py-1 rounded-sm hover:bg-signal transition-colors">Post Reply</button>
        <button type="button" onClick={() => setPreview((p) => !p)} className="text-[10px] font-bold uppercase tracking-wider text-ink-400 hover:text-ink flex items-center gap-1">
          <Eye size={11} /> {preview ? 'Edit' : 'Preview'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Cancel</button>}
      </div>
    </form>
  );
}

function Comment({ comment, storyId, all, depth = 0, knownUsers, removedIds, onRemove, onReport, canModerate, isPinned, onPin }) {
  const { user, isAuthenticated } = useAuth();
  const { addComment } = useStore();
  const [replying, setReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const replies = all.filter((c) => c.parentId === comment.id);
  const removed = removedIds.has(comment.id);

  const submitReply = (text) => {
    addComment(storyId, { userId: user.id, userName: user.publisherName, userAvatar: user.logoUrl, body: text, parentId: comment.id });
    setReplying(false);
    setShowReplies(true);
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-wire pl-4 mt-4' : 'mt-6'}>
      <div className={`flex gap-3.5 p-3 rounded-sm ${isPinned ? 'bg-ink-50 border border-wire' : ''}`}>
        <img
          src={comment.userAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + comment.userName}
          alt={comment.userName}
          className="w-9 h-9 rounded-full border border-wire object-cover shrink-0 shadow-sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold text-ink">{comment.userName}</span>
            <span className="text-[11px] text-ink-400 font-medium">{timeAgo(comment.createdAt)}</span>
            {isPinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-signal uppercase tracking-wider">
                <Pin size={10} /> Pinned
              </span>
            )}
          </div>

          {removed ? (
            <p className="text-xs text-ink-400 italic">[Comment removed]</p>
          ) : (
            <p className="text-xs sm:text-sm text-ink-700 leading-relaxed font-medium break-words" dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.body) }} />
          )}

          {!removed && <ReactionBar commentId={comment.id} />}

          <div className="flex items-center gap-4 mt-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-400 flex-wrap">
            {isAuthenticated && !removed && (
              <button onClick={() => setReplying((r) => !r)} className="hover:text-signal flex items-center gap-1 transition-colors">
                <CornerDownRight size={12} /> Reply
              </button>
            )}
            {replies.length > 0 && (
              <button onClick={() => setShowReplies(!showReplies)} className="hover:text-ink-700 flex items-center gap-1 transition-colors">
                <MessageCircle size={12} /> {showReplies ? 'Hide' : `${replies.length} replies`}
              </button>
            )}
            {!removed && isAuthenticated && (
              <button onClick={() => onReport(comment.id)} className="hover:text-signal flex items-center gap-1 transition-colors">
                <Flag size={12} /> Report
              </button>
            )}
            {!removed && canModerate && (
              <button onClick={() => onRemove(comment.id)} className="text-signal hover:opacity-75 flex items-center gap-1">
                <Trash2 size={12} /> Delete
              </button>
            )}
            {!removed && depth === 0 && canModerate && (
              <button onClick={() => onPin(comment.id)} className="hover:text-ink-700 flex items-center gap-1">
                <Pin size={12} /> {isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>

          {replying && <ReplyComposer placeholder={`Reply to ${comment.userName}...`} onSubmit={submitReply} onCancel={() => setReplying(false)} knownUsers={knownUsers} />}

          {showReplies && replies.map((r) => (
            <Comment key={r.id} comment={r} storyId={storyId} all={all} depth={depth + 1} knownUsers={knownUsers} removedIds={removedIds} onRemove={onRemove} onReport={onReport} canModerate={canModerate} isPinned={false} onPin={onPin} />
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
  const [removedIds, setRemovedIds] = useState(() => new Set(readLS(`comment-removed:${storyId}, []`)));
  const [pinnedId, setPinnedId] = useState(() => readLS(`comment-pinned:${storyId}`, null));
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);

  const canModerate = isAuthenticated && user && (user.id === storyAuthorId || user.role === 'admin' || user.role === 'root');
  const knownUsers = useMemo(() => Array.from(new Set(comments.map((c) => c.userName).filter(Boolean))), [comments]);

  const top = useMemo(() => {
    let list = comments.filter((c) => !c.parentId);
    list = [...list].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    if (pinnedId) {
      const pinned = list.find((c) => c.id === pinnedId);
      if (pinned) list = [pinned, ...list.filter((c) => c.id !== pinnedId)];
    }
    return list;
  }, [comments, sortBy, pinnedId]);

  const visibleTop = top.slice(0, visibleCount);
  const hasMore = top.length > visibleCount;

  const handleRemove = (commentId) => {
    const next = new Set(removedIds);
    next.add(commentId);
    setRemovedIds(next);
    writeLS(`comment-removed:${storyId}`, Array.from(next));
  };

  const handleReport = (commentId) => { writeLS(`comment-reported:${commentId}`, true); };
  const handlePin = (commentId) => { const next = pinnedId === commentId ? null : commentId; setPinnedId(next); writeLS(`comment-pinned:${storyId}`, next); };

  const submit = (text) => {
    addComment(storyId, { userId: user.id, userName: user.publisherName, userAvatar: user.logoUrl, body: text, parentId: null });
    setShowComments(true);
  };

  return (
    <div className="border-t border-wire pt-10 mt-12">
      <div className="flex items-center justify-between mb-6 pb-2 border-b-2 border-wire/60">
        <div className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 flex items-center gap-2">
          <MessageCircle size={14} /> Discussion ({comments.length})
        </div>

        {comments.length > 1 && (
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs font-bold uppercase tracking-wider border border-wire rounded-sm px-3 py-1.5 bg-paper text-ink">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        )}
      </div>

      {showComments && (
        <div className="space-y-6">
          {isAuthenticated ? (
            <div className="flex gap-4 items-start bg-ink-50 p-4 border border-wire rounded-sm">
              <img src={user.logoUrl} alt="" className="w-10 h-10 rounded-full border border-wire object-cover shrink-0 shadow-sm" />
              <div className="flex-1 min-w-0">
                <ReplyComposerRoot onSubmit={submit} knownUsers={knownUsers} />
              </div>
            </div>
          ) : (
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400 bg-ink-50 p-4 rounded-sm border border-wire">
              <a href="/login" className="text-signal underline">Sign in</a> to contribute to the discussion.
            </p>
          )}

          <div className="divide-y divide-wire">
            {visibleTop.map((c) => (
              <Comment key={c.id} comment={c} storyId={storyId} all={comments} knownUsers={knownUsers} removedIds={removedIds} onRemove={handleRemove} onReport={handleReport} canModerate={canModerate} isPinned={pinnedId === c.id} onPin={handlePin} />
            ))}
          </div>

          {hasMore && (
            <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)} className="border border-ink text-ink font-bold uppercase text-xs tracking-wider w-full py-3 rounded-sm hover:bg-ink hover:text-white transition-colors">
              Load More Comments ({top.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReplyComposerRoot({ onSubmit, knownUsers }) {
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
    setText(replaced + text.slice(caret));
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
    <form onSubmit={submit} className="space-y-3">
      <div className="relative">
        {preview ? (
          <div className="text-sm text-ink-700 bg-paper border border-wire p-3 rounded-sm min-h-[4rem]" dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '*Nothing to preview*') }} />
        ) : (
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleChange}
            placeholder="Add to the record... (supports **bold**, *italic*, @mentions)"
            rows={3}
            className="w-full text-sm border border-wire rounded-sm p-3 focus:outline-none focus:border-ink resize-none bg-paper font-medium"
          />
        )}
        {!preview && <MentionAutocomplete query={mentionQuery} users={knownUsers} onPick={pickMention} />}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal/90 transition-colors">
          Publish Comment
        </button>
        <button type="button" onClick={() => setPreview((p) => !p)} className="text-xs font-bold uppercase tracking-wider text-ink-500 hover:text-ink flex items-center gap-1">
          <Eye size={13} /> {preview ? 'Edit' : 'Preview'}
        </button>
      </div>
    </form>
  );
}