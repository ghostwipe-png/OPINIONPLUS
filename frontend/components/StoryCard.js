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
  const sourceMatch = isNews ? story.body?.match(/Read full article on (.*?) →/) : null;
  const sourceName = sourceMatch ? sourceMatch[1] : null;
  const linkMatch = isNews ? story.body?.match(/href="(https:\/\/[^"]+)"/) : null;
  const originalLink = linkMatch ? linkMatch[1] : null;

  const cardLink = isNews && originalLink ? originalLink : `/story/${story.id}`;
  const cardTarget = isNews && originalLink ? '_blank' : '_self';

  return (
    <article className="card-clip rounded-sm overflow-hidden hover:border-ink transition-colors border border-wire">
      <Link href={cardLink} target={cardTarget} rel={cardTarget === '_blank' ? 'noopener' : ''} className="block">
        {story.coverImage && !story.mediaBlocked && (
          <div className="aspect-[2/1] overflow-hidden bg-ink-50">
            <img src={story.coverImage} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        {story.mediaBlocked && (
          <div className="aspect-[2/1] bg-ink-50 grid place-items-center px-4 text-center">
            <p className="text-xs text-ink-400">Content removed</p>
          </div>
        )}
      </Link>

      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-ink-400 flex items-center gap-1">
            {isNews ? <ExternalLink size={10} /> : story.type === 'documentary' ? <Film size={10} /> : <FileText size={10} />}
            {isNews ? 'News' : story.type}
            {sourceName && <span className="text-ink-300">· {sourceName}</span>}
          </span>
          <span className="text-[10px] text-ink-400">{date}</span>
        </div>

        <Link href={cardLink} target={cardTarget} rel={cardTarget === '_blank' ? 'noopener' : ''}>
          <h3 className="editorial-h text-sm font-bold leading-snug mb-1 hover:text-signal transition-colors line-clamp-2">
            {story.title}
          </h3>
        </Link>
        <p className="text-xs text-ink-500 mb-2 line-clamp-2">{story.excerpt}</p>

        {author && (
          <Link href={isNews ? '#' : `/profile/${author.id}`}
            onClick={isNews ? (e) => e.preventDefault() : undefined}
            className={`flex items-center gap-1.5 mb-2 ${isNews ? 'pointer-events-none' : ''}`}>
            <img src={author.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover border border-wire" />
            <span className="text-xs font-medium text-ink-600">{author.publisherName}</span>
          </Link>
        )}

        <div className="flex items-center gap-3 text-[11px] text-ink-400 rule pt-2">
          <span className="flex items-center gap-1"><Heart size={11} /> {story.likes.length}</span>
          <span className="flex items-center gap-1"><MessageSquare size={11} /> {story.comments.length}</span>
          {rating && <span className="flex items-center gap-1"><Star size={11} fill="#C99A3B" stroke="#C99A3B" /> {rating}</span>}
        </div>
      </div>
    </article>
  );
}