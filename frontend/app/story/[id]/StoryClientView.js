'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Flag, Pencil, Trash2, Film, FileText, Paperclip, ArrowUp, List, ChevronLeft, ChevronRight, UserPlus, UserMinus, ExternalLink } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StarRating from '../../../components/StarRating';
import ShareButtons from '../../../components/ShareButtons';
import CommentThread from '../../../components/CommentThread';
import StoryCard from '../../../components/StoryCard';
import ReadLaterButton from '../../../components/ReadLaterButton';
import CollaborateButton from '../../../components/CollaborateButton';
import StoryAudioPlayer from '../../../components/StoryAudioPlayer';
import LanguageToggle from '../../../components/LanguageToggle';
import StoryQRCodeModal from '../../../components/StoryQRCodeModal';
import DOMPurify from 'dompurify';

function wordCount(html) {
  const text = (html || '').replace(/<[^>]*>/g, ' ');
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function StoryClientView() {
  const { id } = useParams();
  const router = useRouter();
  const { stories, users, toggleLike, rateStory, reportStory, deleteStory, toggleFollow, follows } = useStore();
  const { user, isAuthenticated } = useAuth();
  const [reported, setReported] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToTop, setShowToTop] = useState(false);
  const [toc, setToc] = useState([]);
  const [translation, setTranslation] = useState(null);
  const contentRef = useRef(null);

  const story = stories.find((s) => s.id === id);

  const authorId = story?.authorId || story?.author_id;
  const author = story ? users.find((u) => u.id === authorId) : null;
  const isOwner = user?.id === authorId;
  const isNews = authorId === 'u_newsdesk';

  const likesList = story?.likes || [];
  const liked = user && story ? (Array.isArray(likesList) ? likesList.includes(user.id) : false) : false;
  
  const ratingsMap = story?.ratings || {};
  const myRating = user && story ? ratingsMap[user.id] || 0 : 0;
  
  const followerCount = author ? Object.values(follows).filter((list) => list.includes(author.id)).length : 0;
  const iFollowAuthor = user && author ? (follows[user.id] || []).includes(author.id) : false;

  const related = story
    ? stories.filter((s) => (s.authorId === authorId || s.author_id === authorId) && s.id !== story.id && !s.deleted && s.privacy === 'public').slice(0, 3)
    : [];

  const feedOrder = useMemo(
    () => stories.filter((s) => !s.deleted && s.privacy === 'public').sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)),
    [stories]
  );
  const feedIndex = story ? feedOrder.findIndex((s) => s.id === story.id) : -1;
  const prevStory = feedIndex > 0 ? feedOrder[feedIndex - 1] : null;
  const nextStory = feedIndex >= 0 && feedIndex < feedOrder.length - 1 ? feedOrder[feedIndex + 1] : null;

  const storyCreatedAt = story?.createdAt || story?.created_at;
  const date = storyCreatedAt ? new Date(storyCreatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  const activeTitle = translation?.title || story?.title;
  const rawBodyHtml = translation?.body || story?.body || '';
  const bodyHtml = rawBodyHtml.includes('<') ? rawBodyHtml : rawBodyHtml.split('\n').filter((p) => p.trim()).map((p) => `<p>${p}</p>`).join('');

  const firstBlockHasText = /^\s*(<(p|blockquote|h\d)[^>]*>)?\s*[A-Za-z0-9"'\u2018\u201C]/.test(bodyHtml);
  const sanitizedHtml = typeof window !== 'undefined' ? DOMPurify.sanitize(bodyHtml) : bodyHtml;
  const words = useMemo(() => wordCount(bodyHtml), [bodyHtml]);
  const readMinutes = Math.max(1, Math.round(words / 200));

  const sourceUrl = story?.sourceUrl || story?.source_url;
  const sourceName = story?.sourceName || story?.source_name;
  const coverImage = story?.coverImage || story?.cover_image;

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
      <div className="max-w-2xl mx-auto px-5 py-32 text-center bg-paper min-h-screen">
        <p className="text-2xl font-bold mb-3 text-ink">This story no longer exists.</p>
        <Link href="/" className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-2.5 rounded-sm inline-block">Back to the feed</Link>
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
      router.push(`/profile/${authorId}`);
    }
  };

  const handleReport = () => {
    reportStory(story.id, user?.id || 'anonymous', 'Reported from story page');
    setReported(true);
  };

  const authorLogo = author?.logoUrl || author?.logo_url;
  const authorName = author?.publisherName || author?.publisher_name;

  return (
    <div className="bg-paper min-h-screen pb-24">
      <div className="fixed top-0 left-0 right-0 h-1 bg-wire/40 z-50 no-print" aria-hidden="true">
        <div className="h-full bg-signal transition-transform duration-150 origin-left" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      {toc.length > 0 && (
        <nav aria-label="Table of contents" className="no-print hidden xl:block fixed left-8 top-32 w-56 max-h-[50vh] overflow-y-auto text-xs bg-white p-4 border border-wire rounded-sm shadow-sm">
          <p className="font-bold uppercase tracking-wider text-ink mb-3 flex items-center gap-1.5"><List size={13} className="text-signal" /> In this story</p>
          <ul className="space-y-2 border-l border-wire pl-3">
            {toc.map((t) => (
              <li key={t.id} className={t.level === 3 ? 'ml-3' : ''}>
                <a href={`#${t.id}`} className="text-ink-500 hover:text-signal transition-colors line-clamp-2 font-medium">{t.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <article className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16">
        {story.privacy !== 'public' && (
          <div className="mb-6 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-sm inline-block">
            {story.privacy === 'private' ? 'Private — Visible to you only' : 'Archived Content'}
          </div>
        )}

        <div className="flex items-center gap-3 mb-6 flex-wrap text-xs font-bold uppercase tracking-wider text-ink-500">
          <span className="bg-ink text-white px-2.5 py-1 rounded-sm flex items-center gap-1.5">
            {story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
            {story.type || 'Story'}
          </span>
          <span>•</span>
          <span>{date}</span>
          <span>•</span>
          <span>{readMinutes} min read ({words.toLocaleString()} words)</span>
          
          {sourceUrl && (
            <>
              <span>•</span>
              <a 
                href={sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-signal hover:underline inline-flex items-center gap-1 font-bold bg-signal/10 px-2.5 py-1 rounded-sm border border-signal/20 transition-colors"
              >
                Source: {sourceName || 'Original Publisher'} <ExternalLink size={11} />
              </a>
            </>
          )}

          <div className="ml-auto">
            <LanguageToggle storyId={story.id} onTranslate={setTranslation} />
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-ink leading-tight tracking-tight mb-8 break-words">
          {activeTitle}
        </h1>

        {author && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 pb-8 border-b-2 border-wire">
            <div className="flex items-center gap-4">
              <Link href={`/profile/${author.id}`} className="group flex items-center gap-3">
                <img src={authorLogo} alt={authorName} className="w-14 h-14 rounded-full border-2 border-ink object-cover shadow-sm group-hover:scale-105 transition-transform" />
                <div>
                  <span className="block text-base font-bold text-ink group-hover:text-signal transition-colors">{authorName}</span>
                  <span className="block text-xs font-medium text-ink-400 mt-0.5">{followerCount} follower{followerCount === 1 ? '' : 's'}</span>
                  {author.suspended && <span className="text-[10px] font-bold text-signal uppercase">Account suspended</span>}
                </div>
              </Link>
              
              {!isOwner && user && (
                <button
                  onClick={() => toggleFollow(user.id, author.id)}
                  className={`font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm transition-colors flex items-center gap-1.5 ${
                    iFollowAuthor ? 'border border-ink text-ink hover:bg-ink hover:text-white' : 'bg-signal text-white hover:bg-signal/90'
                  }`}
                >
                  {iFollowAuthor ? <UserMinus size={13} /> : <UserPlus size={13} />}
                  {iFollowAuthor ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {isOwner && (
              <div className="flex items-center gap-3">
                <Link href={`/publish?edit=${story.id}`} className="border border-ink text-ink font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-ink hover:text-white transition-colors flex items-center gap-1.5">
                  <Pencil size={13} /> Edit
                </Link>
                <button onClick={handleDelete} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-1.5">
                  <Trash2 size={13} /> Delete
                </button>
                <CollaborateButton storyId={story.id} isOwner={isOwner} />
              </div>
            )}
          </div>
        )}

        {isNews && isAuthenticated && (
          <div className="bg-ink text-white rounded-sm p-6 mb-10 flex items-center justify-between flex-wrap gap-4 shadow-md">
            <div>
              <p className="text-base font-bold mb-1">Have a distinct take on this report?</p>
              <p className="text-xs text-white/70">Publish your editorial perspective under your own masthead.</p>
            </div>
            <Link href={`/publish?title=${encodeURIComponent('My take on: ' + story.title)}`} className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-2">
              <Pencil size={14} /> Write Your Take
            </Link>
          </div>
        )}

        {coverImage && !story.mediaBlocked && (
          <div className="mb-10 rounded-sm overflow-hidden border border-wire shadow-sm">
            <img src={coverImage} alt="" className="w-full max-h-[500px] object-cover" />
          </div>
        )}
        {story.mediaBlocked && (
          <div className="w-full aspect-[16/9] rounded-sm mb-10 border border-wire bg-ink-100 grid place-items-center px-6 text-center">
            <p className="text-sm font-bold text-ink-500">This content has been restricted for violating OPINIONPLUS publishing guidelines.</p>
          </div>
        )}

        {/* ⚡ Audio Narration Widget */}
        <StoryAudioPlayer title={activeTitle} body={bodyHtml} />

        <div
          ref={contentRef}
          className={`prose-story w-full max-w-[720px] mx-auto text-ink-800 text-lg leading-[1.85] mb-12 break-words [word-break:break-word] [overflow-wrap:anywhere]
            [&_h1]:font-display [&_h1]:text-3xl [&_h1]:font-black [&_h1]:mt-8 [&_h1]:mb-4
            [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-wire [&_h2]:pb-2
            [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:scroll-mt-24
            [&_p]:mb-6 [&_p]:font-medium
            [&_blockquote]:border-l-4 [&_blockquote]:border-signal [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-ink-700 [&_blockquote]:my-6 [&_blockquote]:text-xl
            [&_pre]:bg-ink [&_pre]:text-emerald-400 [&_pre]:rounded-sm [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:overflow-x-auto [&_pre]:my-6
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ul]:space-y-2
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ol]:space-y-2
            [&_a]:text-signal [&_a]:underline [&_a]:font-bold
            [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-sm [&_img]:my-6
            [&_table]:w-full [&_table]:border-collapse [&_table]:my-6
            [&_td]:border [&_td]:border-wire [&_td]:p-3
            [&_th]:border [&_th]:border-wire [&_th]:p-3 [&_th]:bg-ink-50 [&_th]:font-bold
            ${firstBlockHasText ? ' [&>*:first-child]:first-letter:font-display [&>*:first-child]:first-letter:font-black [&>*:first-child]:first-letter:text-signal [&>*:first-child]:first-letter:text-[4.5rem] [&>*:first-child]:first-letter:leading-[0.75] [&>*:first-child]:first-letter:float-left [&>*:first-child]:first-letter:pr-4 [&>*:first-child]:first-letter:pt-2' : ''}`}
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />

        {story.files?.length > 0 && (
          <div className="max-w-[720px] mx-auto mb-12 border-2 border-wire rounded-sm p-6 bg-ink-50/50">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-500 mb-3">Associated Files & Attachments</p>
            <ul className="space-y-2">
              {story.files.map((f, i) => (
                <li key={i} className="text-sm font-semibold flex items-center gap-2">
                  <Paperclip size={14} className="text-signal shrink-0" />
                  <a href={f.url} className="text-ink hover:text-signal underline break-words">{f.name}</a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="max-w-[720px] mx-auto mb-10">
          <ReadLaterButton story={{ id: story.id, title: activeTitle, excerpt: story.excerpt, authorName: authorName, coverImage: coverImage }} />
        </div>

        <div className="max-w-[720px] mx-auto rule pt-8 flex items-center justify-between flex-wrap gap-6 bg-white p-6 border border-wire rounded-sm shadow-sm">
          <div className="flex items-center gap-6 flex-wrap">
            <button 
              onClick={requireAuth(() => toggleLike(story.id, user.id))} 
              className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors px-4 py-2 rounded-sm border ${
                liked ? 'bg-signal text-white border-signal' : 'border-wire text-ink hover:border-ink'
              }`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {likesList.length} Likes
            </button>
            <div className="flex items-center gap-2">
              <StarRating value={myRating} onRate={requireAuth((n) => rateStory(story.id, user.id, n))} readOnly={!isAuthenticated} />
            </div>
            {isAuthenticated && !isOwner && (
              <button onClick={handleReport} disabled={reported} className="text-xs font-bold uppercase tracking-wider text-ink-400 hover:text-signal flex items-center gap-1 disabled:opacity-40 transition-colors">
                <Flag size={13} /> {reported ? 'Reported' : 'Report'}
              </button>
            )}
          </div>
          
          <div className="no-print flex items-center gap-4">
            <StoryQRCodeModal story={story} />
            <ShareButtons url={`/story/${story.id}`} title={activeTitle} />
          </div>
        </div>

        {(prevStory || nextStory) && (
          <nav aria-label="Story navigation" className="max-w-[720px] mx-auto rule mt-10 pt-8 grid grid-cols-2 gap-6">
            {prevStory ? (
              <Link href={`/story/${prevStory.id}`} className="group p-4 border border-wire rounded-sm hover:border-ink transition-colors flex items-center gap-3 text-left">
                <ChevronLeft size={20} className="shrink-0 text-ink-400 group-hover:text-signal transition-colors" />
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1">Previous Story</span>
                  <span className="block text-xs font-bold text-ink line-clamp-1 group-hover:text-signal transition-colors">{prevStory.title}</span>
                </div>
              </Link>
            ) : <span />}
            {nextStory ? (
              <Link href={`/story/${nextStory.id}`} className="group p-4 border border-wire rounded-sm hover:border-ink transition-colors flex items-center justify-end gap-3 text-right">
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-ink-400 mb-1">Next Story</span>
                  <span className="block text-xs font-bold text-ink line-clamp-1 group-hover:text-signal transition-colors">{nextStory.title}</span>
                </div>
                <ChevronRight size={20} className="shrink-0 text-ink-400 group-hover:text-signal transition-colors" />
              </Link>
            ) : <span />}
          </nav>
        )}

        <div className="max-w-[720px] mx-auto mt-16">
          <CommentThread storyId={story.id} comments={story.comments} storyAuthorId={authorId} />
        </div>

        {related.length > 0 && (
          <div className="max-w-4xl mx-auto mt-20 pt-10 border-t-2 border-wire">
            <h3 className="text-lg font-bold uppercase tracking-wider text-ink mb-6">More from {authorName}</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => (<StoryCard key={s.id} story={s} />))}
            </div>
          </div>
        )}
      </article>

      {showToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="no-print fixed bottom-8 right-8 w-12 h-12 rounded-sm bg-ink text-white grid place-items-center shadow-xl hover:bg-signal transition-colors z-40"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  );
}