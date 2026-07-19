'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Flag, Pencil, Trash2, Film, FileText, Paperclip, ArrowUp, List, ChevronLeft, ChevronRight, UserPlus, UserMinus } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StarRating from '../../../components/StarRating';
import ShareButtons from '../../../components/ShareButtons';
import CommentThread from '../../../components/CommentThread';
import StoryCard from '../../../components/StoryCard';
import ReadLaterButton from '../../../components/ReadLaterButton';
import CollaborateButton from '../../../components/CollaborateButton';
import DOMPurify from 'dompurify';

function wordCount(html) {
  const text = (html || '').replace(/<[^>]*>/g, ' ');
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function StoryPage() {
  const { id } = useParams();
  const router = useRouter();
  const { stories, users, toggleLike, rateStory, reportStory, deleteStory, toggleFollow, follows } = useStore();
  const { user, isAuthenticated } = useAuth();
  const [reported, setReported] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToTop, setShowToTop] = useState(false);
  const [toc, setToc] = useState([]);
  const contentRef = useRef(null);

  const story = stories.find((s) => s.id === id);

  const author = story ? users.find((u) => u.id === story.authorId) : null;
  const isOwner = user?.id === story?.authorId;
  const isNews = story?.authorId === 'u_newsdesk';
  const liked = user && story ? story.likes.includes(user.id) : false;
  const myRating = user && story ? story.ratings[user.id] || 0 : 0;
  const followerCount = author ? Object.values(follows).filter((list) => list.includes(author.id)).length : 0;
  const iFollowAuthor = user && author ? (follows[user.id] || []).includes(author.id) : false;

  const related = story
    ? stories.filter((s) => s.authorId === story.authorId && s.id !== story.id && !s.deleted && s.privacy === 'public').slice(0, 3)
    : [];

  // Next / previous within the same public, chronologically sorted feed.
  const feedOrder = useMemo(
    () => stories.filter((s) => !s.deleted && s.privacy === 'public').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [stories]
  );
  const feedIndex = story ? feedOrder.findIndex((s) => s.id === story.id) : -1;
  const prevStory = feedIndex > 0 ? feedOrder[feedIndex - 1] : null;
  const nextStory = feedIndex >= 0 && feedIndex < feedOrder.length - 1 ? feedOrder[feedIndex + 1] : null;

  const date = story ? new Date(story.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  const bodyHtml = story
    ? (story.body.includes('<') ? story.body : story.body.split('\n').filter((p) => p.trim()).map((p) => `<p>${p}</p>`).join(''))
    : '';

  const firstBlockHasText = /^\s*(<(p|blockquote|h\d)[^>]*>)?\s*[A-Za-z0-9"'\u2018\u201C]/.test(bodyHtml);
  const sanitizedHtml = typeof window !== 'undefined' ? DOMPurify.sanitize(bodyHtml) : bodyHtml;
  const words = useMemo(() => wordCount(bodyHtml), [bodyHtml]);
  const readMinutes = Math.max(1, Math.round(words / 200));

  // Build a floating table of contents from whatever h2/h3s exist in the
  // rendered body, and track scroll progress across the article.
  useEffect(() => {
    if (!contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll('h2, h3'));
    const entries = headings.map((h, i) => {
      if (!h.id) h.id = `section-${i}-${h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
      return { id: h.id, text: h.textContent, level: h.tagName === 'H2' ? 2 : 3 };
    });
    setToc(entries);
  }, [sanitizedHtml]);

  useEffect(() => {
    const onScroll = () => {
      setShowToTop(window.scrollY > 500);
      if (!contentRef.current) return;
      const rect = contentRef.current.getBoundingClientRect();
      const total = contentRef.current.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [sanitizedHtml]);

  if (!story || story.deleted) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <p className="editorial-h text-2xl font-bold mb-2">This story no longer exists.</p>
        <Link href="/" className="text-signal text-sm font-medium">Back to the feed</Link>
      </div>
    );
  }

  const requireAuth = (fn) => (...args) => {
    if (!isAuthenticated) { router.push('/login'); return; }
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
    <>
      <div className="reading-progress-track no-print" aria-hidden="true">
        <div className="reading-progress-fill" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      {toc.length > 0 && (
        <nav
          aria-label="Table of contents"
          className="no-print hidden xl:block fixed left-6 top-1/3 w-52 max-h-[50vh] overflow-y-auto text-xs"
        >
          <p className="wire-tag mb-2 flex items-center gap-1.5"><List size={12} /> In this story</p>
          <ul className="space-y-1.5 border-l border-wire pl-3">
            {toc.map((t) => (
              <li key={t.id} className={t.level === 3 ? 'ml-3' : ''}>
                <a href={`#${t.id}`} className="text-ink-500 hover:text-signal transition-colors line-clamp-2">{t.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {story.privacy !== 'public' && (
          <p className="wire-tag mb-4">{story.privacy === 'private' ? 'Private — visible to you only' : 'Archived'}</p>
        )}

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="wire-tag flex items-center gap-1.5">
            {story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
            {story.type}
          </span>
          <span className="text-xs text-ink-400">· {date}</span>
          <span className="text-xs text-ink-400">· {readMinutes} min read · {words.toLocaleString()} words</span>
        </div>

        <h1 className="editorial-h text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-6 break-words">{story.title}</h1>

        {author && (
          <div className="flex items-center justify-between flex-wrap gap-4 mb-8 pb-6 border-b border-wire">
            <div className="flex items-center gap-3">
              <Link href={`/profile/${author.id}`} className="nameplate">
                <img src={author.logoUrl} alt={author.publisherName} className="nameplate-seal w-11 h-11" />
                <span>
                  <span className="block text-sm font-semibold">{author.publisherName}</span>
                  <span className="block text-xs text-ink-400">{followerCount} follower{followerCount === 1 ? '' : 's'}</span>
                  {author.suspended && <span className="text-xs text-signal">Account suspended</span>}
                </span>
              </Link>
              {!isOwner && user && (
                <button
                  onClick={() => toggleFollow(user.id, author.id)}
                  className={`px-3 py-1.5 rounded-sm text-xs flex items-center gap-1.5 ${iFollowAuthor ? 'btn-outline' : 'btn-primary'}`}
                >
                  {iFollowAuthor ? <UserMinus size={12} /> : <UserPlus size={12} />}{iFollowAuthor ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            {isOwner && (
              <div className="flex gap-3">
                <Link href={`/publish?edit=${story.id}`} className="btn-outline px-3 py-1.5 rounded-sm text-xs flex items-center gap-1.5"><Pencil size={13} /> Edit</Link>
                <button onClick={handleDelete} className="text-xs font-semibold text-signal flex items-center gap-1.5"><Trash2 size={13} /> Delete</button>
                <CollaborateButton storyId={story.id} isOwner={isOwner} />
              </div>
            )}
          </div>
        )}

        {/* Write Your Take — for news articles */}
        {isNews && isAuthenticated && (
          <div className="bg-ink-50 border border-wire rounded-sm p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold">Have a take on this story?</p>
              <p className="text-xs text-ink-400">Write your opinion and publish it under your own masthead.</p>
            </div>
            <Link href={`/publish?title=${encodeURIComponent('My take on: ' + story.title)}`} className="btn-primary px-4 py-2 rounded-sm text-sm flex items-center gap-2">
              <Pencil size={14} /> Write your take
            </Link>
          </div>
        )}

        {story.coverImage && !story.mediaBlocked && (
          <img src={story.coverImage} alt="" className="w-full rounded-sm mb-8 border border-wire" />
        )}
        {story.mediaBlocked && (
          <div className="w-full aspect-[16/9] rounded-sm mb-8 border border-wire bg-ink-100 grid place-items-center px-6 text-center">
            <p className="text-sm text-ink-400">This content has been removed for violating OPINIONPLUS guidelines.</p>
          </div>
        )}

        <div
          ref={contentRef}
          className={`prose-story w-full max-w-[680px] mx-auto text-ink-800 text-[1.05rem] leading-[1.85] mb-10 overflow-hidden break-words [word-break:break-word] [overflow-wrap:anywhere]
            [&_h1]:font-display [&_h1]:text-2xl sm:[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:break-words
            [&_h2]:font-display [&_h2]:text-xl sm:[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:break-words [&_h2]:scroll-mt-24
            [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:break-words [&_h3]:scroll-mt-24
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
            ${firstBlockHasText ? ' [&>*:first-child]:first-letter:font-display [&>*:first-child]:first-letter:font-black [&>*:first-child]:first-letter:text-signal [&>*:first-child]:first-letter:text-[3.5rem] sm:[&>*:first-child]:first-letter:text-[4.2rem] [&>*:first-child]:first-letter:leading-[0.78] [&>*:first-child]:first-letter:float-left [&>*:first-child]:first-letter:pr-3 [&>*:first-child]:first-letter:pt-1' : ''}`}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        {story.files?.length > 0 && (
          <div className="mb-10 border border-wire rounded-sm p-4">
            <p className="wire-tag mb-2">Attachments</p>
            <ul className="space-y-1">
              {story.files.map((f, i) => (
                <li key={i} className="text-sm flex items-center gap-2 break-words">
                  <Paperclip size={13} className="shrink-0" />
                  <a href={f.url} className="underline hover:text-signal break-words">{f.name}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ReadLaterButton story={{ id: story.id, title: story.title, excerpt: story.excerpt, authorName: author?.publisherName, coverImage: story.coverImage }} />

        <div className="rule pt-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <button onClick={requireAuth(() => toggleLike(story.id, user.id))} className={`flex items-center gap-2 text-sm font-medium transition-colors ${liked ? 'text-signal' : 'text-ink-600 hover:text-signal'}`}>
              <Heart size={18} fill={liked ? '#E0492B' : 'none'} /> {story.likes.length}
            </button>
            <div className="flex items-center gap-2">
              <StarRating value={myRating} onRate={requireAuth((n) => rateStory(story.id, user.id, n))} readOnly={!isAuthenticated} />
            </div>
            {isAuthenticated && !isOwner && (
              <button onClick={handleReport} disabled={reported} className="text-xs text-ink-400 hover:text-signal flex items-center gap-1 disabled:opacity-40 transition-colors">
                <Flag size={13} /> {reported ? 'Reported' : 'Report'}
              </button>
            )}
          </div>
          <div className="no-print">
            <ShareButtons url={`/story/${story.id}`} title={story.title} />
          </div>
        </div>

        {(prevStory || nextStory) && (
          <nav aria-label="Story navigation" className="rule mt-8 pt-6 grid grid-cols-2 gap-4">
            {prevStory ? (
              <Link href={`/story/${prevStory.id}`} className="group flex items-center gap-2 text-left">
                <ChevronLeft size={16} className="shrink-0 text-ink-400 group-hover:text-signal transition-colors" />
                <span>
                  <span className="block wire-tag !text-ink-400">Previous</span>
                  <span className="block text-sm font-semibold line-clamp-1 group-hover:text-signal transition-colors">{prevStory.title}</span>
                </span>
              </Link>
            ) : <span />}
            {nextStory ? (
              <Link href={`/story/${nextStory.id}`} className="group flex items-center gap-2 text-right justify-end">
                <span>
                  <span className="block wire-tag !text-ink-400">Next</span>
                  <span className="block text-sm font-semibold line-clamp-1 group-hover:text-signal transition-colors">{nextStory.title}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ink-400 group-hover:text-signal transition-colors" />
              </Link>
            ) : <span />}
          </nav>
        )}

        <div className="mt-12">
          <CommentThread storyId={story.id} comments={story.comments} />
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h3 className="wire-tag mb-5">More from {author?.publisherName}</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (<StoryCard key={s.id} story={s} />))}
            </div>
          </div>
        )}
      </article>

      {showToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="no-print fixed bottom-6 right-6 w-10 h-10 rounded-full bg-ink text-paper grid place-items-center shadow-lg hover:bg-signal transition-colors z-40"
          aria-label="Scroll to top"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </>
  );
}

