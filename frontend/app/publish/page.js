'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Image as ImageIcon, Paperclip, X, FileText, Film, Save, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useStore } from '../../lib/store';
import RichTextEditor from '../../components/RichTextEditor';
import { openCloudinaryWidget, uploadDocument } from '../../lib/mediaUpload';

const DRAFT_KEY = 'op_draft';

function emptyDraft() {
  return {
    title: '',
    excerpt: '',
    body: '',
    type: 'story',
    privacy: 'public',
    coverImage: '',
    files: [],
  };
}

function PublishForm() {
  const { user, isAuthenticated, ready } = useAuth();
  const { createStory, updateStory, stories } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('edit');

  const [draft, setDraft] = useState(emptyDraft());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (editId) {
      const existing = stories.find((s) => s.id === editId);
      if (existing) {
        setDraft({
          title: existing.title,
          excerpt: existing.excerpt,
          body: existing.body,
          type: existing.type,
          privacy: existing.privacy,
          coverImage: existing.coverImage || '',
          files: existing.files || [],
        });
      }
    } else {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) setDraft(JSON.parse(raw));
      } catch (e) {
        /* ignore */
      }
    }
  }, [editId, stories]);

  useEffect(() => {
    if (ready && !isAuthenticated) router.push('/login');
  }, [ready, isAuthenticated, router]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const saveDraftLocally = () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addCover = () => {
    openCloudinaryWidget({
      onSuccess: (r) => set({ coverImage: r.url }),
    });
  };

  const addFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploaded = await uploadDocument(file);
    set({ files: [...draft.files, uploaded] });
  };

  const removeFile = (idx) => set({ files: draft.files.filter((_, i) => i !== idx) });

  const publish = (asPrivacy) => {
    if (!draft.title.trim() || !draft.body.trim()) {
      alert('Give your story a title and some body text before publishing.');
      return;
    }
    const payload = {
      ...draft,
      privacy: asPrivacy || draft.privacy,
      authorId: user.id,
    };
    if (editId) {
      updateStory(editId, payload);
      router.push(`/story/${editId}`);
    } else {
      const id = createStory(payload);
      window.localStorage.removeItem(DRAFT_KEY);
      router.push(`/story/${id}`);
    }
  };

  if (!ready || !isAuthenticated) return null;

  return (
    <div className="bg-paper min-h-screen py-12 pb-24">
      <div className="max-w-3xl mx-auto px-5">
        
        {/* Header Banner */}
        <div className="mb-8 border-b-2 border-wire/60 pb-6">
          <div className="bg-ink text-white font-bold uppercase text-xs px-3 py-1.5 inline-block rounded-sm mb-3">
            {editId ? 'Edit Publication' : 'New Publication Suite'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
            {editId ? 'Update your story' : 'Write it down. Put your name on it.'}
          </h1>
        </div>

        <div className="space-y-8">
          
          {/* Format Type Selector */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400 mb-2">Content Format</p>
            <div className="flex gap-3">
              {[
                { id: 'story', label: 'Story', icon: FileText },
                { id: 'documentary', label: 'Documentary', icon: Film },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => set({ type: id })}
                  className={`flex-1 py-3 px-4 rounded-sm border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${
                    draft.type === id 
                      ? 'bg-ink text-white border-ink shadow-sm' 
                      : 'border-wire bg-white text-ink-600 hover:border-ink'
                  }`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Headline</label>
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Enter a compelling headline..."
              className="w-full text-2xl sm:text-3xl font-black text-ink bg-white border border-wire rounded-sm p-4 focus:outline-none focus:border-ink transition-colors placeholder:text-ink-300"
            />
          </div>

          {/* Excerpt Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Excerpt / Subtitle</label>
            <textarea
              value={draft.excerpt}
              onChange={(e) => set({ excerpt: e.target.value })}
              placeholder="One or two lines that pull a reader in — shown on the feed and share cards."
              rows={2}
              className="w-full text-sm font-medium text-ink bg-white border border-wire rounded-sm p-3 focus:outline-none focus:border-ink resize-none placeholder:text-ink-300"
            />
          </div>

          {/* Cover Image Uploader */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Cover Visual</p>
            {draft.coverImage ? (
              <div className="relative rounded-sm overflow-hidden border border-wire group bg-white shadow-sm">
                <img src={draft.coverImage} alt="" className="w-full max-h-80 object-cover" />
                <button
                  onClick={() => set({ coverImage: '' })}
                  className="absolute top-3 right-3 bg-ink text-white p-2 rounded-sm hover:bg-signal transition-colors shadow-lg"
                  title="Remove image"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={addCover}
                className="w-full border-2 border-dashed border-wire bg-white hover:border-ink rounded-sm p-8 flex flex-col items-center justify-center gap-2 text-ink-600 transition-colors group cursor-pointer"
              >
                <div className="w-12 h-12 bg-ink-50 rounded-full grid place-name-center group-hover:bg-ink group-hover:text-white transition-colors">
                  <ImageIcon size={22} className="mx-auto mt-3" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink mt-2">Add Cover Image or Media</span>
                <span className="text-[11px] text-ink-400">Supports high-res photography and graphics via Cloudinary</span>
              </button>
            )}
          </div>

          {/* Rich Text Editor */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Story Body</p>
            <div className="bg-white border border-wire rounded-sm shadow-sm overflow-hidden">
              <RichTextEditor
                value={draft.body}
                onChange={(html) => set({ body: html })}
                placeholder="Start writing your feature article..."
              />
            </div>
          </div>

          {/* File Attachments */}
          <div className="space-y-3 bg-white border border-wire rounded-sm p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-ink">Attachments & Documents</p>
            {draft.files.length > 0 && (
              <div className="space-y-2">
                {draft.files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between border border-wire rounded-sm px-4 py-2.5 bg-ink-50">
                    <span className="text-xs font-bold text-ink flex items-center gap-2">
                      <Paperclip size={14} className="text-signal" /> {f.name}
                    </span>
                    <button onClick={() => removeFile(i)} aria-label="Remove file" className="text-signal hover:opacity-75">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="border border-ink bg-paper hover:bg-ink hover:text-white text-ink text-xs font-bold uppercase tracking-wider block text-center py-3 rounded-sm cursor-pointer transition-colors">
              + Attach Document (PDF, DOCX)
              <input type="file" accept=".pdf,.doc,.docx" onChange={addFile} className="hidden" />
            </label>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-2 bg-white border border-wire rounded-sm p-6">
            <label className="text-xs font-bold uppercase tracking-widest text-ink block mb-2">Publication Privacy</label>
            <select
              value={draft.privacy}
              onChange={(e) => set({ privacy: e.target.value })}
              className="w-full border border-wire rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-wider bg-paper focus:outline-none focus:border-ink"
            >
              <option value="public">Public — Anyone can read and share</option>
              <option value="private">Private — Visible only to your account</option>
              <option value="archived">Archived — Hidden from public feeds</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="rule pt-8 flex items-center gap-4 flex-wrap">
            <button 
              onClick={() => publish()} 
              className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-8 py-3.5 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-2 shadow-md"
            >
              <Send size={15} /> {editId ? 'Save Changes' : 'Publish Story'}
            </button>
            
            {!editId && (
              <button 
                onClick={saveDraftLocally} 
                className="border border-ink bg-white text-ink font-bold uppercase text-xs tracking-wider px-6 py-3.5 rounded-sm hover:bg-ink hover:text-white transition-colors flex items-center gap-2"
              >
                <Save size={15} /> {saved ? 'Draft Saved ✓' : 'Save Local Draft'}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-5 py-24 text-center font-bold text-ink-400">Loading editor suite...</div>}>
      <PublishForm />
    </Suspense>
  );
}