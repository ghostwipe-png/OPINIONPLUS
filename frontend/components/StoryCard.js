import Link from 'next/link';
import { Heart, MessageSquare, Star, Film, FileText } from 'lucide-react';
import { useStore } from '../lib/store';

function avgRating(ratings) {
  const vals = Object.values(ratings || {});
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

export default function StoryCard({ story }) {
  const { users } = useStore();
  const author = users.find((u) => u.id === story.authorId);
  const rating = avgRating(story.ratings);
  const date = new Date(story.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <article className="card-clip rounded-sm overflow-hidden">
      <Link href={`/story/${story.id}`} className="block">
        {story.coverImage && !story.mediaBlocked && (
          <div className="aspect-[16/9] overflow-hidden bg-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={story.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {story.mediaBlocked && (
          <div className="aspect-[16/9] bg-ink-100 grid place-items-center px-6 text-center">
            <p className="text-sm text-ink-400">
              This content has been removed for violating OPINIONPLUS guidelines.
            </p>
          </div>
        )}
      </Link>

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="wire-tag flex items-center gap-1.5">
            {story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
            {story.type}
          </span>
          <span className="text-xs text-ink-400">{date}</span>
        </div>

        <Link href={`/story/${story.id}`}>
          <h3 className="editorial-h text-xl font-bold leading-snug mb-2 hover:text-signal transition-colors">
            {story.title}
          </h3>
        </Link>
        <p className="text-sm text-ink-600 mb-4 line-clamp-2">{story.excerpt}</p>

        {author && (
          <Link href={`/profile/${author.id}`} className="nameplate mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={author.logoUrl} alt={author.publisherName} className="nameplate-seal" />
            <span className="text-sm font-semibold">{author.publisherName}</span>
            {author.suspended && (
              <span className="text-xs text-signal font-medium ml-1">Account suspended</span>
            )}
          </Link>
        )}

        <div className="flex items-center gap-4 text-xs text-ink-400 rule pt-3">
          <span className="flex items-center gap-1">
            <Heart size={13} /> {story.likes.length}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={13} /> {story.comments.length}
          </span>
          {rating && (
            <span className="flex items-center gap-1">
              <Star size={13} fill="#C99A3B" stroke="#C99A3B" /> {rating}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
