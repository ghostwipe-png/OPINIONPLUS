'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  GraduationCap, School, Users, BookOpen, Bell, BellOff, Eye, Heart, MessageCircle,
  Calendar, MapPin, Tag, Plus, X, Loader2, UserPlus, UserMinus, Settings,
  BarChart3, Trash2, Check, AlertCircle, Globe, Mail, User, Edit, Share2,
  ChevronDown, ChevronUp, Star
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

let cachedCsrfToken = null;
async function fetchCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    cachedCsrfToken = data.token;
    return cachedCsrfToken;
  } catch (e) { return ''; }
}

export default function CampusProfilePage({ params }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [campus, setCampus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('stories');

  const [stories, setStories] = useState([]);
  const [events, setEvents] = useState([]);
  const [students, setStudents] = useState([]);
  const [polls, setPolls] = useState([]);
  const [stats, setStats] = useState(null);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isCampusAdmin, setIsCampusAdmin] = useState(false);

  const [showEventModal, setShowEventModal] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [eventForm, setEventForm] = useState({ title: '', description: '', event_date: '', location: '', category: 'general' });
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] });
  const [editForm, setEditForm] = useState({ university_name: '', representative_name: '', contact_email: '' });

  useEffect(() => {
    if (!id) return;
    loadCampus();
    loadStories();
    loadEvents();
    loadStudents();
    loadPolls();
  }, [id]);

  useEffect(() => {
    if (user && id) {
      checkSubscription();
      checkAdmin();
    }
  }, [user, id]);

  const loadCampus = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}`);
      if (!res.ok) throw new Error('Campus not found');
      const data = await res.json();
      setCampus(data.campus);
      setSubscriberCount(data.campus.subscriberCount || 0);
      setEditForm({
        university_name: data.campus.university_name || '',
        representative_name: data.campus.representative_name || '',
        contact_email: data.campus.contact_email || '',
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStories = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}/stories?limit=12`);
      if (res.ok) {
        const data = await res.json();
        setStories(data.stories || []);
      }
    } catch (e) {}
  };

  const loadEvents = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (e) {}
  };

  const loadStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (e) {}
  };

  const loadPolls = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}/polls`);
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch (e) {}
  };

  const checkSubscription = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}/is-subscribed`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setIsSubscribed(!!data.subscribed);
      }
    } catch (e) {}
  };

  const checkAdmin = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses/${id}/students`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const me = (data.students || []).find(s => s.user_id === user?.id && s.role === 'admin');
        setIsCampusAdmin(!!me || user?.role === 'admin' || user?.role === 'root');
      }
    } catch (e) {}
  };

  const handleSubscribe = async () => {
    if (!user) { router.push('/login'); return; }
    const next = !isSubscribed;
    setIsSubscribed(next);
    setSubscriberCount(prev => next ? prev + 1 : Math.max(prev - 1, 0));
    try {
      const token = await fetchCsrfToken();
      await fetch(`${API_BASE}/campuses/${id}/subscribe`, {
        method: next ? 'POST' : 'DELETE',
        headers: { 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
    } catch {
      setIsSubscribed(!next);
      setSubscriberCount(prev => next ? Math.max(prev - 1, 0) : prev + 1);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/campuses/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify(eventForm),
      });
      if (res.ok) {
        setShowEventModal(false);
        setEventForm({ title: '', description: '', event_date: '', location: '', category: 'general' });
        loadEvents();
      }
    } catch (e) {} finally { setSubmitting(false); }
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const token = await fetchCsrfToken();
      await fetch(`${API_BASE}/campuses/${id}/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
      loadEvents();
    } catch (e) {}
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (pollForm.options.filter(o => o.trim()).length < 2) return;
    setSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/campuses/${id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ question: pollForm.question, options: pollForm.options.filter(o => o.trim()) }),
      });
      if (res.ok) {
        setShowPollModal(false);
        setPollForm({ question: '', options: ['', ''] });
        loadPolls();
      }
    } catch (e) {} finally { setSubmitting(false); }
  };

  const handleVote = async (pollId, optionIndex) => {
    if (!user) { router.push('/login'); return; }
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/campuses/${id}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ optionIndex }),
      });
      if (res.ok) loadPolls();
    } catch (e) {}
  };

  const handleSaveEdit = async () => {
    setSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      await fetch(`${API_BASE}/campuses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      setShowEditModal(false);
      loadCampus();
    } catch (e) {} finally { setSubmitting(false); }
  };

  const handleAddStudent = async (userId) => {
    try {
      const token = await fetchCsrfToken();
      await fetch(`${API_BASE}/campuses/${id}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      loadStudents();
    } catch (e) {}
  };

  const handleRemoveStudent = async (userId) => {
    try {
      const token = await fetchCsrfToken();
      await fetch(`${API_BASE}/campuses/${id}/students/${userId}`, {
        method: 'DELETE',
        headers: { 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
      loadStudents();
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-signal" />
      </div>
    );
  }

  if (error || !campus) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-24">
        <School size={48} className="text-ink-300 mb-4" />
        <h1 className="text-2xl font-black text-ink uppercase mb-2">Campus Not Found</h1>
        <p className="text-xs text-ink-500 mb-6">{error || 'This campus may have been removed.'}</p>
        <Link href="/campuses" className="bg-ink text-white font-bold uppercase text-xs px-6 py-3 rounded-sm">
          Back to Campuses
        </Link>
      </div>
    );
  }

  const initials = (campus.university_name || 'CU')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  const TABS = [
    { key: 'stories', label: 'Stories', icon: BookOpen, count: stories.length },
    { key: 'events', label: 'Events', icon: Calendar, count: events.length },
    { key: 'students', label: 'Students', icon: Users, count: students.length },
    { key: 'polls', label: 'Polls', icon: BarChart3, count: polls.length },
    { key: 'about', label: 'About', icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* Campus Header */}
      <div className="bg-ink text-white py-16 px-6 border-b-4 border-signal relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="shrink-0">
              {campus.logo_url ? (
                <img src={campus.logo_url} alt="" className="w-28 h-28 rounded-xl object-cover border-4 border-white/20 shadow-2xl" />
              ) : (
                <div className="w-28 h-28 rounded-xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-white font-black text-3xl">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-signal text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-sm tracking-wider">Active Edition</span>
                {isCampusAdmin && (
                  <button onClick={() => setShowEditModal(true)} className="text-white/60 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Edit campus">
                    <Settings size={16} />
                  </button>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight uppercase">{campus.university_name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-white/70">
                <span className="flex items-center gap-1.5"><User size={14} /> {campus.representative_name}</span>
                <span className="flex items-center gap-1.5"><Mail size={14} /> {campus.contact_email}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-sm"><BookOpen size={13} /> {campus.total_stories || 0} Stories</span>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-sm"><Users size={13} /> {campus.total_students || 0} Students</span>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-sm"><Bell size={13} /> {subscriberCount} Subscribers</span>
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-sm"><Eye size={13} /> {campus.total_views || 0} Views</span>
              </div>
              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={handleSubscribe}
                  className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-sm transition-colors flex items-center gap-2 ${
                    isSubscribed ? 'bg-white/10 text-white border border-white/20' : 'bg-signal text-white hover:bg-signal/90'
                  }`}
                >
                  {isSubscribed ? <BellOff size={14} /> : <Bell size={14} />}
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-1 border-b-2 border-wire mt-8 mb-6 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 -mb-0.5 transition-colors ${
                tab === t.key ? 'border-signal text-ink' : 'border-transparent text-ink-400 hover:text-ink'
              }`}
            >
              <t.icon size={14} />
              {t.label}
              {t.count > 0 && <span className="text-ink-400">({t.count})</span>}
            </button>
          ))}
        </div>

        {/* Stories Tab */}
        {tab === 'stories' && (
          <div>
            {stories.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen size={40} className="mx-auto text-ink-300 mb-4" />
                <p className="text-sm font-bold text-ink-500 uppercase">No stories published yet</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {stories.map(s => (
                  <Link key={s.id} href={`/story/${s.id}`} className="bg-white border border-wire rounded-sm p-5 hover:border-ink hover:shadow-md transition-all group">
                    <p className="text-sm font-bold text-ink group-hover:text-signal transition-colors line-clamp-2 mb-2">{s.title}</p>
                    <p className="text-xs text-ink-500 line-clamp-2 mb-3">{s.excerpt || 'Read more...'}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                      <span className="flex items-center gap-1"><Heart size={11} /> {s.likes?.length || 0}</span>
                      <span className="flex items-center gap-1"><MessageCircle size={11} /> {s.comments?.length || 0}</span>
                      <span>{new Date(s.createdAt || s.created_at).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Upcoming Events</h3>
              {isCampusAdmin && (
                <button onClick={() => setShowEventModal(true)} className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5">
                  <Plus size={13} /> Add Event
                </button>
              )}
            </div>
            {events.length === 0 ? (
              <div className="text-center py-16">
                <Calendar size={40} className="mx-auto text-ink-300 mb-4" />
                <p className="text-sm font-bold text-ink-500 uppercase">No upcoming events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map(ev => (
                  <div key={ev.id} className="bg-white border border-wire rounded-sm p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-ink-50 rounded-sm flex flex-col items-center justify-center shrink-0 border border-wire">
                        <span className="text-lg font-black text-ink">{new Date(ev.event_date).getDate()}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400">{new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short' })}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-ink">{ev.title}</p>
                        {ev.description && <p className="text-xs text-ink-500 mt-1 line-clamp-2">{ev.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                          {ev.location && <span className="flex items-center gap-1"><MapPin size={11} /> {ev.location}</span>}
                          <span className="flex items-center gap-1"><Tag size={11} /> {ev.category}</span>
                        </div>
                      </div>
                    </div>
                    {isCampusAdmin && (
                      <button onClick={() => handleDeleteEvent(ev.id)} className="text-ink-400 hover:text-signal p-1 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Students Tab */}
        {tab === 'students' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Student Journalists</h3>
              {isAuthenticated && !students.find(s => s.user_id === user?.id) && (
                <button onClick={() => handleAddStudent(user.id)} className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5">
                  <UserPlus size={13} /> Join as Student Journalist
                </button>
              )}
            </div>
            {students.length === 0 ? (
              <div className="text-center py-16">
                <Users size={40} className="mx-auto text-ink-300 mb-4" />
                <p className="text-sm font-bold text-ink-500 uppercase">No student journalists yet</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map(s => (
                  <div key={s.user_id} className="bg-white border border-wire rounded-sm p-4 flex items-center gap-3">
                    <img src={s.logo_url || ''} alt="" className="w-10 h-10 rounded-full object-cover border border-wire shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink truncate">{s.publisher_name}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                        s.role === 'admin' ? 'bg-signal/10 text-signal' : s.role === 'editor' ? 'bg-amber-50 text-amber-700' : 'bg-ink-50 text-ink-600'
                      }`}>{s.role}</span>
                    </div>
                    {isCampusAdmin && s.user_id !== user?.id && (
                      <button onClick={() => handleRemoveStudent(s.user_id)} className="text-ink-400 hover:text-signal p-1">
                        <UserMinus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Polls Tab */}
        {tab === 'polls' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">Campus Polls</h3>
              {isCampusAdmin && (
                <button onClick={() => setShowPollModal(true)} className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5">
                  <Plus size={13} /> Create Poll
                </button>
              )}
            </div>
            {polls.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 size={40} className="mx-auto text-ink-300 mb-4" />
                <p className="text-sm font-bold text-ink-500 uppercase">No active polls</p>
              </div>
            ) : (
              <div className="space-y-4">
                {polls.map(poll => (
                  <div key={poll.id} className="bg-white border border-wire rounded-sm p-5">
                    <p className="text-sm font-bold text-ink mb-4">{poll.question}</p>
                    <div className="space-y-2">
                      {poll.options.map((opt, i) => {
                        const count = poll.voteCounts?.[i] || 0;
                        const total = poll.totalVotes || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <button
                            key={i}
                            onClick={() => handleVote(poll.id, i)}
                            disabled={!user}
                            className="w-full text-left relative overflow-hidden rounded-sm border border-wire hover:border-ink transition-colors disabled:cursor-default"
                          >
                            <div className="bg-ink-50 h-9 transition-all" style={{ width: `${pct}%` }} />
                            <div className="absolute inset-0 flex items-center justify-between px-4 text-xs font-bold">
                              <span className="text-ink">{opt}</span>
                              <span className="text-ink-400">{pct}% ({count})</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-ink-400 mt-3 font-medium">{poll.totalVotes || 0} total votes</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* About Tab */}
        {tab === 'about' && (
          <div className="bg-white border border-wire rounded-sm p-6 space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">University</h3>
              <p className="text-sm font-bold text-ink">{campus.university_name}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Representative</h3>
              <p className="text-sm text-ink-600">{campus.representative_name}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Contact</h3>
              <a href={`mailto:${campus.contact_email}`} className="text-sm text-signal font-bold hover:underline">{campus.contact_email}</a>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2">Stats</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ['Stories', campus.total_stories || 0],
                  ['Students', campus.total_students || 0],
                  ['Subscribers', subscriberCount],
                ].map(([label, value]) => (
                  <div key={label} className="bg-ink-50 rounded-sm p-3">
                    <p className="text-lg font-black text-ink">{value}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Event Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm" onClick={() => setShowEventModal(false)}>
          <div className="bg-white border-2 border-ink rounded-sm w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-ink uppercase">Add Event</h3>
              <button onClick={() => setShowEventModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <input required value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Event title" className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-semibold" />
              <textarea value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} placeholder="Description (optional)" rows={2} className="w-full border border-wire rounded-sm px-3 py-2 text-xs resize-none" />
              <input required type="date" value={eventForm.event_date} onChange={e => setEventForm({...eventForm, event_date: e.target.value})} className="w-full border border-wire rounded-sm px-3 py-2 text-xs" />
              <input value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} placeholder="Location (optional)" className="w-full border border-wire rounded-sm px-3 py-2 text-xs" />
              <select value={eventForm.category} onChange={e => setEventForm({...eventForm, category: e.target.value})} className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-bold uppercase">
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="debate">Debate</option>
                <option value="election">Election</option>
              </select>
              <button type="submit" disabled={submitting} className="w-full bg-ink text-white font-bold uppercase text-xs py-2.5 rounded-sm hover:bg-signal transition-colors disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Poll Creation Modal */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm" onClick={() => setShowPollModal(false)}>
          <div className="bg-white border-2 border-ink rounded-sm w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-ink uppercase">Create Poll</h3>
              <button onClick={() => setShowPollModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreatePoll} className="space-y-3">
              <input required value={pollForm.question} onChange={e => setPollForm({...pollForm, question: e.target.value})} placeholder="Poll question" className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-semibold" />
              {pollForm.options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input required value={opt} onChange={e => { const opts = [...pollForm.options]; opts[i] = e.target.value; setPollForm({...pollForm, options: opts}); }} placeholder={`Option ${i + 1}`} className="flex-1 border border-wire rounded-sm px-3 py-2 text-xs" />
                  {pollForm.options.length > 2 && (
                    <button type="button" onClick={() => setPollForm({...pollForm, options: pollForm.options.filter((_, idx) => idx !== i)})} className="text-signal"><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setPollForm({...pollForm, options: [...pollForm.options, '']})} className="text-xs font-bold text-ink-500 hover:text-ink">+ Add option</button>
              <button type="submit" disabled={submitting} className="w-full bg-ink text-white font-bold uppercase text-xs py-2.5 rounded-sm hover:bg-signal transition-colors disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Create Poll'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Campus Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
          <div className="bg-white border-2 border-ink rounded-sm w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-ink uppercase">Edit Campus</h3>
              <button onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-3">
              <input value={editForm.university_name} onChange={e => setEditForm({...editForm, university_name: e.target.value})} placeholder="University name" className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-semibold" />
              <input value={editForm.representative_name} onChange={e => setEditForm({...editForm, representative_name: e.target.value})} placeholder="Representative name" className="w-full border border-wire rounded-sm px-3 py-2 text-xs" />
              <input value={editForm.contact_email} onChange={e => setEditForm({...editForm, contact_email: e.target.value})} placeholder="Contact email" className="w-full border border-wire rounded-sm px-3 py-2 text-xs" />
              <button type="submit" disabled={submitting} className="w-full bg-ink text-white font-bold uppercase text-xs py-2.5 rounded-sm hover:bg-signal transition-colors disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin inline" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}