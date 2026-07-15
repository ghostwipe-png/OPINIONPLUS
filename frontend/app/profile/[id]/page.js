'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Camera, Check, UserPlus, UserMinus } from 'lucide-react';
import { useStore } from '../../../lib/store';
import { useAuth } from '../../../lib/auth';
import StoryCard from '../../../components/StoryCard';
import { openCloudinaryWidget } from '../../../lib/mediaUpload';

export default function ProfilePage() {
  const { id } = useParams();
  const { users, stories, upsertUser, toggleFollow, follows } = useStore();
  const { user, updateProfile } = useAuth();

  const profile = users.find((u) => u.id === id);
  const isOwner = user?.id === id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profile || {});

  if (!profile) {
    return <p className="max-w-2xl mx-auto px-5 py-24 text-center text-ink-400">Publisher not found.</p>;
  }

  const theirStories = stories
    .filter((s) => s.authorId === id && !s.deleted)
    .filter((s) => s.privacy === 'public' || isOwner)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const followerCount = Object.values(follows).filter((list) => list.includes(id)).length;
  const iFollow = user ? (follows[user.id] || []).includes(id) : false;

  const saveEdits = () => {
    upsertUser({ ...profile, ...form });
    if (isOwner) updateProfile(form);
    setEditing(false);
  };

  const changeLogo = () => {
    openCloudinaryWidget({ onSuccess: (r) => setForm((f) => ({ ...f, logoUrl: r.url })) });
  };

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      <div className="flex items-start gap-6 flex-wrap">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={editing ? form.logoUrl : profile.logoUrl}
            alt={profile.publisherName}
            className="w-24 h-24 rounded-full border-2 border-ink object-cover"
          />
          {editing && (
            <button
              onClick={changeLogo}
              className="absolute -bottom-1 -right-1 bg-ink text-paper w-8 h-8 rounded-full grid place-items-center"
              aria-label="Change logo"
            >
              <Camera size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-[240px]">
          {editing ? (
            <input
              value={form.publisherName}
              onChange={(e) => setForm((f) => ({ ...f, publisherName: e.target.value }))}
              className="editorial-h text-3xl font-bold border-b border-wire focus:border-ink outline-none w-full"
            />
          ) : (
            <h1 className="editorial-h text-3xl font-bold">{profile.publisherName}</h1>
          )}

          {profile.suspended && (
            <p className="text-signal text-sm font-semibold mt-1">Account suspended</p>
          )}

          <p className="text-xs text-ink-400 mt-1">
            {theirStories.length} post{theirStories.length === 1 ? '' : 's'} · {followerCount} follower
            {followerCount === 1 ? '' : 's'}
          </p>

          {editing ? (
            <textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              className="w-full text-sm border-b border-wire focus:border-ink outline-none mt-3 resize-none"
              placeholder="Bio"
            />
          ) : (
            <p className="text-sm text-ink-600 mt-3 max-w-lg">{profile.bio}</p>
          )}

          {editing && (
            <input
              value={form.socialLink || ''}
              onChange={(e) => setForm((f) => ({ ...f, socialLink: e.target.value }))}
              placeholder="Social link (optional)"
              className="w-full text-sm border-b border-wire focus:border-ink outline-none mt-3 py-1"
            />
          )}
          {!editing && profile.socialLink && (
            <a href={profile.socialLink} className="text-signal text-sm underline mt-2 inline-block">
              {profile.socialLink}
            </a>
          )}

          <div className="mt-5">
            {isOwner ? (
              editing ? (
                <button onClick={saveEdits} className="btn-primary px-4 py-2 rounded-sm text-sm flex items-center gap-2">
                  <Check size={14} /> Save profile
                </button>
              ) : (
                <button onClick={() => { setForm(profile); setEditing(true); }} className="btn-outline px-4 py-2 rounded-sm text-sm">
                  Edit profile
                </button>
              )
            ) : user ? (
              <button
                onClick={() => toggleFollow(user.id, id)}
                className={`px-4 py-2 rounded-sm text-sm flex items-center gap-2 ${
                  iFollow ? 'btn-outline' : 'btn-primary'
                }`}
              >
                {iFollow ? <UserMinus size={14} /> : <UserPlus size={14} />}
                {iFollow ? 'Following' : 'Follow'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rule mt-10 pt-8">
        <h2 className="wire-tag mb-5">Published</h2>
        {theirStories.length === 0 ? (
          <p className="text-sm text-ink-400">Nothing published yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {theirStories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
