'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Heart, Flag, Pencil, Trash2, Film, FileText, Paperclip } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StarRating from '../../../components/StarRating';
import ShareButtons from '../../../components/ShareButtons';
import CommentThread from '../../../components/CommentThread';
import StoryCard from '../../../components/StoryCard';

export default function StoryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { stories, users, toggleLike, rateStory, reportStory, deleteStory } = useStore();
  const { user, isAuthenticated } = useAuth();
  const [reported, setReported] = useState(false);

  const story = stories.find((s) => s.id === id);

  if (!story || story.deleted) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <p className="editorial-h text-2xl font-bold mb-2">This story no longer exists.</p>
        <Link href="/" className="text-signal text-sm font-medium">
          Back to the feed
        </Link>
      </div>
    );
  }

  const author = users.find((u) => u.id === story.authorId);
  const isOwner = user?.id === story.authorId;
  const liked = user && story.likes.includes(user.id);
  const myRating = user ? story.ratings[user.id] || 0 : 0;
  const related = stories
    .filter((s) => s.authorId === story.authorId && s.id !== story.id && !s.deleted && s.privacy === 'public')
    .slice(0, 3);

  const date = new Date(story.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const bodyHtml = story.body.includes('<')
    ? story.body
    : story.body
        .split('\n')
        .filter((p) => p.trim())
        .map((p) => `<p>${p}</p>`)
        .join('');

  const firstBlockHasText = /^\s*(<(p|blockquote|h\d)[^>]*>)?\s*[A-Za-z0-9"'\u2018\u201C]/.test(bodyHtml);

  const requireAuth = (fn) => (...args) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fn(...args);
  };

  const handleDelete = () => {
    if (confirm('Delete this post permanently? This cannot be undone.')) {
      deleteStory(story.id);
      router.push(`/profile/${story.authorId}`);
    }
  };

  const handleReport = () => {
    reportStory(story.id, user?.id || 'anonymous', 'Reported from story page');
    setReported(true);
  };

  return (
    <article className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Privacy badge */}
      {story.privacy !== 'public' && (
        <p className="wire-tag mb-4">
          {story.privacy === 'private' ? 'Private — visible to you only' : 'Archived'}
        </p>
      )}

      {/* Type + Date */}
      <div className="flex items-center gap-2 mb-4">
        <span className="wire-tag flex items-center gap-1.5">
          {story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
          {story.type}
        </span>
        <span className="text-xs text-ink-400">· {date}</span>
      </div>

      {/* Title */}
      <h1 className="editorial-h text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-6 break-words">
        {story.title}
      </h1>

      {/* Author + actions */}
      {author && (
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8 pb-6 border-b border-wire">
          <Link href={`/profile/${author.id}`} className="nameplate">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={author.logoUrl} alt={author.publisherName} className="nameplate-seal w-10 h-10" />
            <span>
              <span className="block text-sm font-semibold">{author.publisherName}</span>
              {author.suspended && <span className="text-xs text-signal">Account suspended</span>}
            </span>
          </Link>

          {isOwner && (
            <div className="flex gap-3">
              <Link href={`/publish?edit=${story.id}`} className="btn-outline px-3 py-1.5 rounded-sm text-xs flex items-center gap-1.5">
                <Pencil size={13} /> Edit
              </Link>
              <button onClick={handleDelete} className="text-xs font-semibold text-signal flex items-center gap-1.5">
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cover image */}
      {story.coverImage && !story.mediaBlocked && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={story.coverImage} alt="" className="w-full rounded-sm mb-8 border border-wire" />
      )}
      {story.mediaBlocked && (
        <div className="w-full aspect-[16/9] rounded-sm mb-8 border border-wire bg-ink-100 grid place-items-center px-6 text-center">
          <p className="text-sm text-ink-400">
            This content has been removed for violating OPINIONPLUS guidelines.
          </p>
        </div>
      )}

      {/* Body */}
      <div
        className={`prose-story w-full max-w-none text-ink-800 text-[1.05rem] leading-relaxed mb-10 overflow-hidden break-words [word-break:break-word] [overflow-wrap:anywhere]
          [&_h1]:font-display [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:break-words
          [&_h2]:font-display [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:break-words
          [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:break-words
          [&_p]:mb-4 [&_p]:break-words
          [&_blockquote]:border-l-2 [&_blockquote]:border-signal [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_blockquote]:my-4 [&_blockquote]:break-words
          [&_pre]:bg-ink-50 [&_pre]:border [&_pre]:border-wire [&_pre]:rounded-sm [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:my-4
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3
          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3
          [&_li]:mb-1 [&_li]:break-words
          [&_a]:text-signal [&_a]:underline [&_a]:break-words
          [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-sm [&_img]:my-4
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:block [&_table]:overflow-x-auto
          [&_td]:border [&_td]:border-wire [&_td]:p-2 [&_td]:break-words
          [&_th]:border [&_th]:border-wire [&_th]:p-2 [&_th]:bg-ink-50 [&_th]:break-words
          [&_hr]:border-wire [&_hr]:my-6
          ${firstBlockHasText
            ? ' [&>*:first-child]:first-letter:font-display [&>*:first-child]:first-letter:font-black [&>*:first-child]:first-letter:text-signal [&>*:first-child]:first-letter:text-[3.5rem] sm:[&>*:first-child]:first-letter:text-[4.2rem] [&>*:first-child]:first-letter:leading-[0.78] [&>*:first-child]:first-letter:float-left [&>*:first-child]:first-letter:pr-3 [&>*:first-child]:first-letter:pt-1'
            : ''
          }`}
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {/* Attachments */}
      {story.files?.length > 0 && (
        <div className="mb-10 border border-wire rounded-sm p-4">
          <p className="wire-tag mb-2">Attachments</p>
          <ul className="space-y-1">
            {story.files.map((f, i) => (
              <li key={i} className="text-sm flex items-center gap-2 break-words">
                <Paperclip size={13} className="shrink-0" />
                <a href={f.url} className="underline hover:text-signal break-words">
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Engagement bar */}
      <div className="rule pt-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <button
            onClick={requireAuth(() => toggleLike(story.id, user.id))}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${liked ? 'text-signal' : 'text-ink-600 hover:text-signal'}`}
          >
            <Heart size={18} fill={liked ? '#E0492B' : 'none'} /> {story.likes.length}
          </button>

          <div className="flex items-center gap-2">
            <StarRating
              value={myRating}
              onRate={requireAuth((n) => rateStory(story.id, user.id, n))}
              readOnly={!isAuthenticated}
            />
          </div>

          {isAuthenticated && !isOwner && (
            <button
              onClick={handleReport}
              disabled={reported}
              className="text-xs text-ink-400 hover:text-signal flex items-center gap-1 disabled:opacity-40 transition-colors"
            >
              <Flag size={13} /> {reported ? 'Reported' : 'Report'}
            </button>
          )}
        </div>

        <ShareButtons url={`/story/${story.id}`} title={story.title} />
      </div>

      {/* Comments */}
      <div className="mt-12">
        <CommentThread storyId={story.id} comments={story.comments} />
      </div>

      {/* Related stories */}
      {related.length > 0 && (
        <div className="mt-16">
          <h3 className="wire-tag mb-5">More from {author?.publisherName}</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            {related.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}