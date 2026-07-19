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
  const date = new Date(story.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const isNews = story.authorId === 'u_newsdesk';
  const sourceMatch = isNews ? story.body?.match(/Original source: <a[^>]*>([^<]+)<\/a>/) : null;
  const sourceName = sourceMatch ? sourceMatch[1] : null;
  const linkMatch = isNews ? story.body?.match(/href="(https:\/\/[^"]+)"/) : null;
  const originalLink = linkMatch ? linkMatch[1] : null;
  const cardLink = isNews && originalLink ? originalLink : `/story/${story.id}`;
  const cardTarget = isNews && originalLink ? '_blank' : '_self';

  return (
    <article className="border-b border-wire py-3 hover:bg-ink-50/50 transition-colors px-1 -mx-1 rounded-sm">
      <div className="flex items-start gap-3">
        {story.coverImage && !story.mediaBlocked && (
          <Link href={cardLink} target={cardTarget} rel={cardTarget === '_blank' ? 'noopener' : ''} className="shrink-0">
            <img src={story.coverImage} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-sm object-cover" loading="lazy" />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-400 flex items-center gap-1">
              {isNews ? <ExternalLink size={10} /> : story.type === 'documentary' ? <Film size={10} /> : <FileText size={10} />}
              {isNews ? 'News' : story.type}
              {sourceName && <span className="text-ink-300">· {sourceName}</span>}
            </span>
            <span className="text-[10px] text-ink-400">{date}</span>
          </div>
          <Link href={cardLink} target={cardTarget} rel={cardTarget === '_blank' ? 'noopener' : ''}>
            <h3 className="text-sm font-semibold leading-snug hover:text-signal transition-colors line-clamp-2 mb-0.5">
              {story.title}
            </h3>
          </Link>
          <p className="text-xs text-ink-500 line-clamp-2 mb-1">{story.excerpt}</p>
          <div className="flex items-center gap-3 text-[11px] text-ink-400">
            {author && <span className="text-ink-600 font-medium text-[11px]">{author.publisherName}</span>}
            <span className="flex items-center gap-1"><Heart size={11} /> {story.likes.length}</span>
            <span className="flex items-center gap-1"><MessageSquare size={11} /> {story.comments.length}</span>
            {rating && <span className="flex items-center gap-1"><Star size={11} fill="#C99A3B" stroke="#C99A3B" /> {rating}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}