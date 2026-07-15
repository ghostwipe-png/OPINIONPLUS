'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Image as ImageIcon, Paperclip, X } from 'lucide-react';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, stories.length]);

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
    <div className="max-w-3xl mx-auto px-5 py-12">
      <p className="wire-tag mb-3">{editId ? 'Edit post' : 'New post'}</p>
      <h1 className="editorial-h text-3xl font-bold mb-8">
        {editId ? 'Update your story' : 'Write it down. Put your name on it.'}
      </h1>

      <div className="space-y-6">
        <div className="flex gap-3">
          {['story', 'documentary'].map((t) => (
            <button
              key={t}
              onClick={() => set({ type: t })}
              className={`px-4 py-2 rounded-full text-xs font-semibold border ${
                draft.type === t ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'
              }`}
            >
              {t === 'story' ? 'Story' : 'Documentary'}
            </button>
          ))}
        </div>

        <input
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Headline"
          className="editorial-h w-full text-3xl font-bold border-b border-wire focus:border-ink outline-none py-2"
        />

        <textarea
          value={draft.excerpt}
          onChange={(e) => set({ excerpt: e.target.value })}
          placeholder="One or two lines that pull a reader in — shown on the feed and share cards."
          rows={2}
          className="w-full text-sm border-b border-wire focus:border-ink outline-none py-2 resize-none"
        />

        <div>
          <p className="wire-tag mb-2">Cover image</p>
          {draft.coverImage ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.coverImage} alt="" className="w-full rounded-sm border border-wire" />
              <button
                onClick={() => set({ coverImage: '' })}
                className="absolute top-2 right-2 bg-ink text-paper w-7 h-7 rounded-full grid place-items-center"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={addCover}
              className="btn-outline w-full py-6 rounded-sm flex flex-col items-center gap-2 text-sm"
            >
              <ImageIcon size={20} />
              Add a cover image or video
            </button>
          )}
        </div>

        <div>
          <p className="wire-tag mb-2">Story</p>
          <RichTextEditor
            value={draft.body}
            onChange={(html) => set({ body: html })}
            placeholder="Start writing…"
          />
        </div>

        <div>
          <p className="wire-tag mb-2">Attachments (PDF, docs)</p>
          <div className="space-y-2">
            {draft.files.map((f, i) => (
              <div key={i} className="flex items-center justify-between border border-wire rounded-sm px-3 py-2">
                <span className="text-sm flex items-center gap-2">
                  <Paperclip size={14} /> {f.name}
                </span>
                <button onClick={() => removeFile(i)} aria-label="Remove file">
                  <X size={14} />
                </button>
              </div>
            ))}
            <label className="btn-outline block text-center py-2.5 rounded-sm text-sm cursor-pointer">
              Add a file
              <input type="file" accept=".pdf,.doc,.docx" onChange={addFile} className="hidden" />
            </label>
          </div>
        </div>

        <div>
          <p className="wire-tag mb-2">Privacy</p>
          <select
            value={draft.privacy}
            onChange={(e) => set({ privacy: e.target.value })}
            className="border border-wire rounded-sm px-3 py-2 text-sm"
          >
            <option value="public">Public — anyone can read it</option>
            <option value="private">Private — only you</option>
            <option value="archived">Archived — hidden from the feed</option>
          </select>
        </div>

        <div className="rule pt-6 flex items-center gap-3 flex-wrap">
          <button onClick={() => publish()} className="btn-primary px-5 py-2.5 rounded-sm text-sm">
            {editId ? 'Save changes' : 'Publish'}
          </button>
          {!editId && (
            <button onClick={saveDraftLocally} className="btn-outline px-5 py-2.5 rounded-sm text-sm">
              {saved ? 'Draft saved ✓' : 'Save draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublishPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-5 py-12"><p>Loading editor...</p></div>}>
      <PublishForm />
    </Suspense>
  );
}