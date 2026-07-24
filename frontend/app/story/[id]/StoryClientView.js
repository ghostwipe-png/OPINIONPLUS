// app/story/[id]/StoryClientView.js
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Flag, Pencil, Trash2, Film, FileText, Paperclip, ArrowUp, UserPlus, UserMinus, ExternalLink, Share2 } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StarRating from '../../../components/StarRating';
import ShareButtons from '../../../components/ShareButtons';
import CommentThread from '../../../components/CommentThread';
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
    ? stories.filter((s) => (s.authorId === authorId || s.author_id === authorId) && s.id !== story.id && !s.deleted && s.privacy === 'public')
    : [];

  const feedOrder = useMemo(
    () => stories.filter((s) => !s.deleted && s.privacy === 'public').sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)),
    [stories]
  );
  
  const sidebarStories = related.length >= 3 ? related.slice(0, 5) : feedOrder.filter(s => s.id !== story?.id).slice(0, 5);

  const storyCreatedAt = story?.createdAt || story?.created_at;
  const date = storyCreatedAt ? new Date(storyCreatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

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
  const mediaUrl = story?.mediaUrl || story?.media_url;

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
    <div className="bg-paper min-h-screen pb-24 font-sans">
      {/* Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50 no-print" aria-hidden="true">
        <div className="h-full bg-signal transition-transform duration-150 origin-left" style={{ transform: `scaleX(${progress / 100})` }} />
      </div>

      {/* Main Split-Screen Container with Independent Scrolling Columns */}
      <div className="max-w-[96rem] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* ================= LEFT COLUMN: MAIN ARTICLE CONTENT (LIGHT GREY, INDEPENDENT SCROLL) ================= */}
          <div className="lg:col-span-8 bg-[#F4F4F6] rounded-3xl p-6 sm:p-12 shadow-sm lg:h-[calc(100vh-6rem)] lg:overflow-y-auto scroll-smooth space-y-6">
            
            {/* Title & Metadata Card */}
            <div className="bg-[#F4F4F6] rounded-2xl p-2 sm:p-4 relative">
              {story.privacy !== 'public' && (
                <div className="mb-4 bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded inline-block">
                  {story.privacy === 'private' ? 'Private Content' : 'Archived Content'}
                </div>
              )}

              {/* Upper Meta */}
              <div className="flex items-center gap-3 mb-4 flex-wrap text-xs font-bold uppercase tracking-wider text-gray-500">
                <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full flex items-center gap-1.5">
                  {story.type === 'documentary' ? <Film size={12} /> : <FileText size={12} />}
                  {story.type?.replace('_', ' ') || 'Story'}
                </span>
                <span>•</span>
                <span>{date}</span>
                <span>•</span>
                <span>{readMinutes} min read</span>
                
                {sourceUrl && (
                  <>
                    <span>•</span>
                    <a 
                      href={sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-signal hover:underline inline-flex items-center gap-1 bg-signal/10 px-3 py-1 rounded-full"
                    >
                      {sourceName || 'Source'} <ExternalLink size={11} />
                    </a>
                  </>
                )}
              </div>

              {/* Red Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-[#9B1C1C] uppercase leading-tight tracking-tight mb-8 break-words">
                {activeTitle}
              </h1>

              {/* Author & Action Row */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 border-t border-gray-300/60">
                <div className="flex items-center gap-4">
                  {author && (
                    <Link href={`/profile/${author.id}`} className="group flex items-center gap-3">
                      <img src={authorLogo} alt={authorName} className="w-12 h-12 rounded-full object-cover shadow-sm bg-gray-200" />
                      <div>
                        <span className="block text-sm font-bold text-gray-900 group-hover:text-signal transition-colors">{authorName}</span>
                        <span className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mt-0.5">{followerCount} followers</span>
                      </div>
                    </Link>
                  )}
                  
                  {author && !isOwner && user && (
                    <button
                      onClick={() => toggleFollow(user.id, author.id)}
                      className={`text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors flex items-center gap-1 ${
                        iFollowAuthor ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-[#9B1C1C] text-white hover:bg-black'
                      }`}
                    >
                      {iFollowAuthor ? <UserMinus size={11} /> : <UserPlus size={11} />}
                      {iFollowAuthor ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && (
                    <>
                      <Link href={`/publish?edit=${story.id}`} className="text-gray-500 hover:text-gray-900 p-2"><Pencil size={18} /></Link>
                      <button onClick={handleDelete} className="text-gray-500 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                      <CollaborateButton storyId={story.id} isOwner={isOwner} />
                    </>
                  )}
                  <div className="flex items-center justify-center p-2 rounded-full text-gray-600 hover:bg-gray-200/50 cursor-pointer">
                     <ShareButtons url={`/story/${story.id}`} title={activeTitle} />
                  </div>
                </div>
              </div>
            </div>

            {/* Media Block */}
            {story.type === 'documentary' && mediaUrl ? (
              <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-sm w-full">
                <iframe 
                  src={mediaUrl.replace('watch?v=', 'embed/')} 
                  title={activeTitle}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            ) : coverImage && !story.mediaBlocked ? (
              <div className="rounded-2xl overflow-hidden shadow-sm w-full bg-gray-200">
                <img src={coverImage} alt="" className="w-full h-auto max-h-[500px] object-cover" />
              </div>
            ) : null}

            {story.mediaBlocked && (
              <div className="w-full aspect-[16/9] rounded-2xl bg-gray-200 grid place-items-center px-6 text-center">
                <p className="text-sm font-bold text-gray-500">Media restricted per publishing guidelines.</p>
              </div>
            )}

            {/* Audio Narration Widget */}
            <div className="bg-[#F4F4F6] rounded-2xl p-2">
              <StoryAudioPlayer title={activeTitle} body={bodyHtml} />
            </div>

            {/* Article Body Container (Light Grey background seamlessly integrated) */}
            <div className="bg-[#F4F4F6] rounded-2xl p-2 sm:p-4 relative">
               <div className="absolute top-2 right-2">
                 <LanguageToggle storyId={story.id} onTranslate={setTranslation} />
               </div>

              <div
                ref={contentRef}
                className={`prose-story w-full max-w-none text-[#2D2D2D] text-lg sm:text-xl leading-[1.8] break-words [word-break:break-word] [overflow-wrap:anywhere]
                  [&_h2]:text-[#9B1C1C] [&_h2]:text-2xl sm:[&_h2]:text-3xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4
                  [&_h3]:text-[#9B1C1C] [&_h3]:text-xl sm:[&_h3]:text-2xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3
                  [&_p]:mb-6
                  [&_blockquote]:border-l-4 [&_blockquote]:border-[#9B1C1C] [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:my-8 [&_blockquote]:text-xl
                  [&_a]:text-[#9B1C1C] [&_a]:underline [&_a]:font-bold
                  [&_img]:max-w-full [&_img]:rounded-xl [&_img]:my-8 [&_img]:shadow-sm
                  ${firstBlockHasText ? ' [&>*:first-child]:first-letter:font-black [&>*:first-child]:first-letter:text-[#9B1C1C] [&>*:first-child]:first-letter:text-6xl [&>*:first-child]:first-letter:float-left [&>*:first-child]:first-letter:pr-4 [&>*:first-child]:first-letter:pt-2' : ''}`}
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            </div>

            {/* Attachments */}
            {story.files?.length > 0 && (
              <div className="w-full rounded-2xl p-6 bg-gray-200/50 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Associated Files & Attachments</p>
                <ul className="space-y-2">
                  {story.files.map((f, i) => (
                    <li key={i} className="text-sm font-semibold flex items-center gap-2">
                      <Paperclip size={16} className="text-[#9B1C1C] shrink-0" />
                      <a href={f.url} className="text-gray-800 hover:text-[#9B1C1C] underline break-words">{f.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="w-full">
              <ReadLaterButton story={{ id: story.id, title: activeTitle, excerpt: story.excerpt, authorName: authorName, coverImage: coverImage }} />
            </div>

            {/* Reactions & Comments Block */}
            <section className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 space-y-8 mt-4">
              <div className="flex items-center justify-between flex-wrap gap-6 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-6 flex-wrap">
                  <button 
                    onClick={requireAuth(() => toggleLike(story.id, user.id))} 
                    className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors px-6 py-3 rounded-full border cursor-pointer ${
                      liked ? 'bg-[#9B1C1C] text-white border-[#9B1C1C]' : 'border-gray-200 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <Heart size={16} fill={liked ? 'currentColor' : 'none'} /> {likesList.length} Likes
                  </button>
                  <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                    <StarRating value={myRating} onRate={requireAuth((n) => rateStory(story.id, user.id, n))} readOnly={!isAuthenticated} />
                  </div>
                  {isAuthenticated && !isOwner && (
                    <button onClick={handleReport} disabled={reported} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 flex items-center gap-1 disabled:opacity-40 transition-colors">
                      <Flag size={12} /> {reported ? 'Reported' : 'Report'}
                    </button>
                  )}
                </div>
                <div className="no-print">
                  <StoryQRCodeModal story={story} />
                </div>
              </div>

              <CommentThread storyId={story.id} comments={story.comments} storyAuthorId={authorId} />
            </section>
          </div>

          {/* ================= RIGHT COLUMN: RELATED STORIES (LIGHT GREY, INDEPENDENT SCROLL) ================= */}
          <aside className="lg:col-span-4 bg-[#F4F4F6] rounded-3xl p-6 shadow-sm lg:h-[calc(100vh-6rem)] lg:overflow-y-auto scroll-smooth">
            <h3 className="text-[#9B1C1C] text-lg font-black uppercase mb-6 tracking-wide px-2">Related Stories</h3>
            
            <div className="flex flex-col gap-4">
              {sidebarStories.map(s => {
                const sDate = new Date(s.createdAt || s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                return (
                  <Link 
                    href={`/story/${s.id}`} 
                    key={s.id} 
                    className="flex gap-4 p-3 bg-white rounded-2xl hover:shadow-md transition-all group"
                  >
                    <div className="w-24 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-200">
                      {s.coverImage || s.cover_image ? (
                        <img 
                          src={s.coverImage || s.cover_image} 
                          alt={s.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-[8px] font-bold uppercase tracking-widest">
                          OpinionPlus
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                      <span className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">{sDate}</span>
                      <h4 className="text-sm font-bold text-gray-900 line-clamp-3 leading-snug group-hover:text-[#9B1C1C] transition-colors">
                        {s.title}
                      </h4>
                    </div>
                  </Link>
                );
              })}
            </div>
          </aside>
          
        </div>
      </div>

      {/* Scroll to Top Button */}
      {showToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="no-print fixed bottom-8 right-8 w-12 h-12 rounded-full bg-[#9B1C1C] text-white grid place-items-center shadow-2xl hover:bg-black transition-colors z-40 cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}