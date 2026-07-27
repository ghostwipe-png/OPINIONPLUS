'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GraduationCap, School, Plus, CheckCircle2, Globe, Mail, User, X, Search, Users, BookOpen, Bell, BellOff, Loader2, Star } from 'lucide-react';
import { useAuth } from '../../lib/auth';

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

function CampusCard({ campus, isSubscribed, onToggleSubscribe }) {
  const initials = (campus.university_name || 'CU')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  return (
    <div className="bg-white border-2 border-ink rounded-sm p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow group">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
            Active Edition
          </span>
          <Globe size={16} className="text-ink-400" />
        </div>
        
        <div className="flex items-center gap-3">
          {campus.logo_url ? (
            <img src={campus.logo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-wire shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ink text-white font-black text-sm flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-black text-ink uppercase tracking-tight truncate">{campus.university_name}</h3>
            <p className="text-[10px] text-ink-500 font-medium mt-0.5">{campus.total_students || 0} students · {campus.total_stories || 0} stories</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-wire">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-ink-400 flex-1">
          <span className="flex items-center gap-1"><BookOpen size={12} /> {campus.total_stories || 0}</span>
          <span className="flex items-center gap-1"><Users size={12} /> {campus.total_subscribers || 0}</span>
        </div>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSubscribe(campus.id); }}
          className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors flex items-center gap-1.5 ${
            isSubscribed ? 'bg-ink-50 text-ink border border-wire' : 'bg-ink text-white hover:bg-signal'
          }`}
        >
          {isSubscribed ? <BellOff size={12} /> : <Bell size={12} />}
          {isSubscribed ? 'Subscribed' : 'Subscribe'}
        </button>
      </div>

      <Link href={`/campuses/${campus.id}`} className="w-full bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2.5 rounded-sm hover:bg-signal transition-colors text-center mt-1">
        View Campus
      </Link>
    </div>
  );
}

function LeaderboardCard({ campus, rank }) {
  const initials = (campus.university_name || 'CU')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const rankColors = {
    1: 'bg-amber-100 text-amber-800 border-amber-300',
    2: 'bg-slate-100 text-slate-700 border-slate-300',
    3: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  return (
    <Link
      href={`/campuses/${campus.id}`}
      className="shrink-0 w-44 bg-white border border-wire rounded-sm p-4 hover:border-ink hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border ${rankColors[rank] || 'bg-ink-50 text-ink-600 border-wire'}`}>
          {rank}
        </span>
        {campus.logo_url ? (
          <img src={campus.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-wire" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-ink text-white font-black text-[10px] flex items-center justify-center">
            {initials}
          </div>
        )}
      </div>
      <p className="text-xs font-bold text-ink line-clamp-2 group-hover:text-signal transition-colors">{campus.university_name}</p>
      <p className="text-[10px] text-ink-400 mt-1 font-medium">{campus.total_stories || 0} stories · {campus.total_subscribers || 0} subs</p>
    </Link>
  );
}

function CampusContent() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();

  const [campuses, setCampuses] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [subscriptions, setSubscriptions] = useState({});

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    university_name: '',
    representative_name: '',
    contact_email: '',
  });

  const fetchCampuses = async () => {
    try {
      const [campRes, leaderRes] = await Promise.all([
        fetch(`${API_BASE}/campuses`),
        fetch(`${API_BASE}/campuses/leaderboard?sortBy=stories&limit=5`),
      ]);

      if (campRes.ok) {
        const data = await campRes.json();
        setCampuses(data.campuses || []);
      }
      if (leaderRes.ok) {
        const data = await leaderRes.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/campuses/subscriptions`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const map = {};
        (data.campuses || []).forEach(c => { map[c.id] = true; });
        setSubscriptions(map);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchCampuses();
    fetchSubscriptions();
    const reference = searchParams.get('reference');
    if (reference) {
      verifyCampusLicense(reference);
    }
  }, [searchParams, user]);

  const verifyCampusLicense = async (reference) => {
    setVerifying(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/campuses/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccessMsg('Campus edition is now active.');
        fetchCampuses();
        window.history.replaceState({}, '', '/campuses');
      } else {
        alert(data.error || 'Verification failed.');
      }
    } catch (e) {
      alert('Error verifying transaction.');
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleSubscribe = async (campusId) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    const isSubscribed = !!subscriptions[campusId];
    setSubscriptions(prev => ({ ...prev, [campusId]: !isSubscribed }));
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/campuses/${campusId}/subscribe`, {
        method: isSubscribed ? 'DELETE' : 'POST',
        headers: { 'X-CSRF-Token': token || '' },
        credentials: 'include',
      });
      if (!res.ok) {
        setSubscriptions(prev => ({ ...prev, [campusId]: isSubscribed }));
      }
    } catch {
      setSubscriptions(prev => ({ ...prev, [campusId]: isSubscribed }));
    }
  };

  const handleRegisterCampus = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/campuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccessMsg('Campus registered successfully!');
        setShowModal(false);
        setForm({ university_name: '', representative_name: '', contact_email: '' });
        fetchCampuses();
      } else {
        alert(data.error || 'Failed to register campus.');
      }
    } catch (e) {
      alert('Network error connecting to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCampuses = campuses.filter(c =>
    c.university_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-paper pb-24 relative">
      {verifying && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm grid place-items-center text-white p-4">
          <div className="text-center space-y-3">
            <Loader2 size={32} className="animate-spin mx-auto" />
            <p className="text-lg font-black uppercase tracking-widest">Verifying Registration...</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500 text-white p-4 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
          <CheckCircle2 size={16} /> {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-4 underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Hero Banner */}
      <section className="bg-ink text-white py-20 px-6 border-b-4 border-signal relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="bg-signal text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-2 rounded-sm mb-4 shadow-sm">
              <GraduationCap size={14} /> University & Campus Editions
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight uppercase leading-none mb-3">
              Campus News & <span className="text-transparent bg-clip-text bg-gradient-to-r from-signal to-white">Student Voices</span>
            </h1>
            <p className="text-sm font-medium text-white/70 max-w-xl">
              Empowering student journalists with professional publishing mastheads. Free for all universities.
            </p>
          </div>
          {isAuthenticated ? (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-white text-ink font-bold uppercase text-xs tracking-widest px-8 py-4 rounded-sm hover:bg-signal hover:text-white transition-all shadow-xl flex items-center gap-2 shrink-0"
            >
              <Plus size={16} /> Register Campus
            </button>
          ) : (
            <Link 
              href="/login"
              className="bg-white/10 text-white border border-white/20 font-bold uppercase text-xs tracking-widest px-8 py-4 rounded-sm hover:bg-white hover:text-ink transition-all backdrop-blur-sm shrink-0"
            >
              Sign in to Register
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 pt-12">
        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Star size={16} className="text-signal" />
              <h2 className="text-lg font-black text-ink uppercase tracking-tight">Top Campuses</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
              {leaderboard.map((c, i) => (
                <LeaderboardCard key={c.id} campus={c} rank={i + 1} />
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3.5 top-3 text-ink-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campuses by name..."
            className="w-full border border-wire rounded-sm pl-10 pr-4 py-2.5 text-xs font-medium bg-white focus:outline-none focus:border-ink"
          />
        </div>

        {/* Campus List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-signal" />
          </div>
        ) : filteredCampuses.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-wire rounded-md p-16 text-center shadow-sm">
            <School size={40} className="mx-auto text-ink-300 mb-4" />
            <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">No active campus editions</p>
            <p className="text-sm font-medium text-ink-500 max-w-md mx-auto">Register your university today to establish your official student media masthead.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampuses.map((campus) => (
              <CampusCard
                key={campus.id}
                campus={campus}
                isSubscribed={!!subscriptions[campus.id]}
                onToggleSubscribe={handleToggleSubscribe}
              />
            ))}
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-2 border-ink rounded-sm w-full max-w-lg p-8 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-2 text-ink-400 hover:text-signal rounded-full">
              <X size={20} />
            </button>
            
            <div className="mb-6 border-b border-wire pb-4">
              <h2 className="text-2xl font-black uppercase tracking-tight text-ink flex items-center gap-2">
                <GraduationCap className="text-signal" /> Campus Registration
              </h2>
              <p className="text-xs font-medium text-ink-500 mt-1">Register your official campus edition below. Free for all universities.</p>
            </div>

            <form onSubmit={handleRegisterCampus} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">University Name</label>
                <input 
                  required
                  value={form.university_name} 
                  onChange={(e) => setForm({...form, university_name: e.target.value})}
                  placeholder="e.g. University of Nairobi" 
                  className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Representative / Editor Name</label>
                <input 
                  required
                  value={form.representative_name} 
                  onChange={(e) => setForm({...form, representative_name: e.target.value})}
                  placeholder="e.g. Jane Doe (Lead Editor)" 
                  className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Institutional Email</label>
                <input 
                  required
                  type="email"
                  value={form.contact_email} 
                  onChange={(e) => setForm({...form, contact_email: e.target.value})}
                  placeholder="editor@campus.ac.ke" 
                  className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white border border-wire text-ink font-bold uppercase text-[11px] tracking-widest py-3.5 rounded-sm hover:bg-ink-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-[2] bg-ink text-white font-bold uppercase text-[11px] tracking-widest py-3.5 rounded-sm hover:bg-signal transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Registering...</> : <><CheckCircle2 size={16} /> Register Campus</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper grid place-items-center">
        <Loader2 size={24} className="animate-spin text-signal" />
      </div>
    }>
      <CampusContent />
    </Suspense>
  );
}