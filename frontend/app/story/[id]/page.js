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

  // Seed content is stored as plain text; the rich text editor produces
  // HTML. Treat anything without markup as plain paragraphs.
  const bodyHtml = story.body.includes('<')
    ? story.body
    : story.body
        .split('\n')
        .filter((p) => p.trim())
        .map((p) => `<p>${p}</p>`)
        .join('');

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
    <article className="max-w-3xl mx-auto px-5 py-12">
      {story.privacy !== 'public' && (
        <p className="wire-tag mb-4">
          {story.privacy === 'private' ? 'Private — visible to you only' : 'Archived'}
        </p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className="wire-tag flex items-center gap-1.5">
          {story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
          {story.type}
        </span>
        <span className="text-xs text-ink-400">· {date}</span>
      </div>

      <h1 className="editorial-h text-3xl sm:text-5xl font-black leading-tight mb-6">{story.title}</h1>

      {author && (
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
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

      <div
        className="prose-story text-ink-800 text-[1.05rem] mb-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-signal [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink-600 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-signal [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {story.files?.length > 0 && (
        <div className="mb-8 border border-wire rounded-sm p-4">
          <p className="wire-tag mb-2">Attachments</p>
          <ul className="space-y-1">
            {story.files.map((f, i) => (
              <li key={i} className="text-sm flex items-center gap-2">
                <Paperclip size={13} />
                <a href={f.url} className="underline hover:text-signal">
                  {f.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rule pt-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <button
            onClick={requireAuth(() => toggleLike(story.id, user.id))}
            className={`flex items-center gap-2 text-sm font-medium ${liked ? 'text-signal' : 'text-ink-600'}`}
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
              className="text-xs text-ink-400 hover:text-signal flex items-center gap-1 disabled:opacity-40"
            >
              <Flag size={13} /> {reported ? 'Reported' : 'Report'}
            </button>
          )}
        </div>

        <ShareButtons url={`/story/${story.id}`} title={story.title} />
      </div>

      <div className="mt-12">
        <CommentThread storyId={story.id} comments={story.comments} />
      </div>

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
