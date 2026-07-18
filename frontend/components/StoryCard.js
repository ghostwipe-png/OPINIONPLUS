import Link from 'next/link';
import { Heart, MessageSquare, Star, Film, FileText, ExternalLink } from 'lucide-react';
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

  const isNews = story.authorId === 'u_newsdesk';
  // Extract source name from body if it's a news article
  const sourceMatch = isNews ? story.body?.match(/Read full article on (.*?) →/) : null;
  const sourceName = sourceMatch ? sourceMatch[1] : null;
  // Extract original link
  const linkMatch = isNews ? story.body?.match(/href="(https:\/\/[^"]+)"/) : null;
  const originalLink = linkMatch ? linkMatch[1] : null;

  return (
    <article className="card-clip rounded-sm overflow-hidden">
      <Link href={isNews && originalLink ? originalLink : `/story/${story.id}`} 
        target={isNews && originalLink ? '_blank' : '_self'}
        rel={isNews && originalLink ? 'noopener' : ''}
        className="block">
        {story.coverImage && !story.mediaBlocked && (
          <div className="aspect-[16/9] overflow-hidden bg-ink-100">
            <img src={story.coverImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {story.mediaBlocked && (
          <div className="aspect-[16/9] bg-ink-100 grid place-items-center px-6 text-center">
            <p className="text-sm text-ink-400">This content has been removed for violating OPINIONPLUS guidelines.</p>
          </div>
        )}
      </Link>

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="wire-tag flex items-center gap-1.5">
            {isNews ? <ExternalLink size={12} /> : story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
            {isNews ? 'News' : story.type}
            {sourceName && <span className="text-ink-400">· via {sourceName}</span>}
          </span>
          <span className="text-xs text-ink-400">{date}</span>
        </div>

        <Link href={isNews && originalLink ? originalLink : `/story/${story.id}`}
          target={isNews && originalLink ? '_blank' : '_self'}
          rel={isNews && originalLink ? 'noopener' : ''}>
          <h3 className="editorial-h text-xl font-bold leading-snug mb-2 hover:text-signal transition-colors">
            {story.title}
          </h3>
        </Link>
        <p className="text-sm text-ink-600 mb-4 line-clamp-2">{story.excerpt}</p>

        {author && (
          <Link href={isNews ? '#' : `/profile/${author.id}`} 
            onClick={isNews ? (e) => e.preventDefault() : undefined}
            className={`nameplate mb-4 ${isNews ? 'pointer-events-none' : ''}`}>
            <img src={author.logoUrl} alt={author.publisherName} className="nameplate-seal" />
            <span className="text-sm font-semibold">{author.publisherName}</span>
            {author.suspended && <span className="text-xs text-signal font-medium ml-1">Account suspended</span>}
          </Link>
        )}

        <div className="flex items-center gap-4 text-xs text-ink-400 rule pt-3">
          <span className="flex items-center gap-1"><Heart size={13} /> {story.likes.length}</span>
          <span className="flex items-center gap-1"><MessageSquare size={13} /> {story.comments.length}</span>
          {rating && <span className="flex items-center gap-1"><Star size={13} fill="#C99A3B" stroke="#C99A3B" /> {rating}</span>}
        </div>
      </div>
    </article>
  );
}