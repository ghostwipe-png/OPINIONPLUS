'use client';

import { useState } from 'react';
import { Users, Plus, X, Check } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function CollaborateButton({ storyId, isOwner }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCollaborators = async () => {
    try {
      const res = await fetch(`${API_BASE}/stories/${storyId}/collaborators`);
      const data = await res.json();
      setCollaborators(data.collaborators || []);
    } catch (e) { /* ignore */ }
  };

  const invite = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/stories/${storyId}/collaborate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Invited ${data.coAuthorName}!`);
        setEmail('');
        fetchCollaborators();
      } else {
        setMessage(data.error || 'Failed to invite.');
      }
    } catch (e) {
      setMessage('Something went wrong.');
    }
    setLoading(false);
  };

  if (!isOwner) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchCollaborators(); }}
        className="text-xs flex items-center gap-1 text-ink-400 hover:text-ink-600"
      >
        <Users size={14} /> Collaborate
      </button>

      {open && (
        <div className="absolute top-8 right-0 bg-paper border border-wire rounded-sm p-4 w-72 z-20 shadow-lg">
          <p className="text-xs font-semibold mb-2">Invite co-author</p>
          <div className="flex gap-2 mb-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 border border-wire rounded-sm px-2 py-1 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
            <button onClick={invite} disabled={loading} className="btn-primary px-2 py-1 rounded-sm text-xs">
              <Plus size={12} />
            </button>
          </div>
          {message && <p className="text-xs text-ink-400 mb-2">{message}</p>}

          {collaborators.length > 0 && (
            <div className="border-t border-wire pt-2 mt-2">
              <p className="text-xs text-ink-400 mb-1">Collaborators</p>
              {collaborators.map(c => (
                <div key={c.id} className="flex items-center justify-between py-1">
                  <span className="text-xs">{c.publisher_name}</span>
                  <span className={`text-xs ${c.status === 'accepted' ? 'text-ink-600' : 'text-ink-400'}`}>
                    {c.status === 'accepted' ? <Check size={12} /> : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}