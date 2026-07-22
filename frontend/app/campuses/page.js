'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GraduationCap, School, Plus, CheckCircle2, Globe, Mail, User, X, DollarSign } from 'lucide-react';
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

function CampusContent() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();

  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    university_name: '',
    representative_name: '',
    contact_email: '',
  });

  const fetchCampuses = async () => {
    try {
      const res = await fetch(`${API_BASE}/campuses`);
      if (res.ok) {
        const data = await res.json();
        setCampuses(data.campuses || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampuses();
    const reference = searchParams.get('reference');
    if (reference) {
      verifyCampusLicense(reference);
    }
  }, [searchParams]);

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
        setSuccessMsg('Annual licensing fee confirmed! Campus edition is now active.');
        fetchCampuses();
        window.history.replaceState({}, '', '/campuses');
      } else {
        alert(data.error || 'Payment verification failed.');
      }
    } catch (e) {
      alert('Error verifying transaction.');
    } finally {
      setVerifying(false);
    }
  };

  const handleInitLicensePayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      // SECURITY UPGRADE: Idempotency check prevents database spam if user double-clicks checkout
      const idempotencyKey = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      
      const res = await fetch(`${API_BASE}/campuses/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ ...form, idempotency_key: idempotencyKey }),
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Failed to initialize Paystack licensing session.');
        setSubmitting(false);
      }
    } catch (e) {
      alert('Network error connecting to payment gateway.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper pb-24 relative">
      {verifying && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm grid place-items-center text-white p-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-black uppercase tracking-widest">Verifying Licensing Payment...</p>
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
              Empowering student journalists with professional publishing mastheads. Annual institutional licensing fee: KES 5,000.
            </p>
          </div>
          {isAuthenticated ? (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-white text-ink font-bold uppercase text-xs tracking-widest px-8 py-4 rounded-sm hover:bg-signal hover:text-white transition-all shadow-xl flex items-center gap-2 shrink-0"
            >
              <Plus size={16} /> Register Campus — KES 5,000
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

      {/* Campus List */}
      <div className="max-w-5xl mx-auto px-6 pt-12">
        {loading ? (
          <p className="text-xs font-bold uppercase text-ink-400 py-12 text-center animate-pulse">Loading active campuses...</p>
        ) : campuses.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-wire rounded-md p-16 text-center shadow-sm">
            <School size={40} className="mx-auto text-ink-300 mb-4" />
            <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">No active campus editions</p>
            <p className="text-sm font-medium text-ink-500 max-w-md mx-auto">Register your university today to establish your official student media masthead.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {campuses.map((campus) => (
              <div key={campus.id} className="bg-white border-2 border-ink rounded-sm p-6 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-signal text-white">
                      Active License
                    </span>
                    <Globe size={16} className="text-ink-400" />
                  </div>
                  <h3 className="text-xl font-black text-ink uppercase tracking-tight">{campus.university_name}</h3>
                  <p className="text-xs text-ink-600 font-medium flex items-center gap-1.5">
                    <User size={14} className="text-signal" /> Rep: {campus.representative_name}
                  </p>
                  <p className="text-xs text-ink-600 font-medium flex items-center gap-1.5">
                    <Mail size={14} className="text-signal" /> {campus.contact_email}
                  </p>
                </div>
                <div className="pt-4 border-t border-wire flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Verified Edition</span>
                  <Link href="/" className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors">
                    View Stories
                  </Link>
                </div>
              </div>
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
                <GraduationCap className="text-signal" /> Campus Licensing
              </h2>
              <p className="text-xs font-medium text-ink-500 mt-1">Annual institutional licensing fee: KES 5,000.</p>
            </div>

            <form onSubmit={handleInitLicensePayment} className="space-y-4">
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

              <div className="bg-signal/5 border border-signal rounded-sm p-4 flex items-center justify-between mt-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-signal">Annual Licensing Fee</p>
                  <p className="text-xs font-medium text-ink-600 mt-0.5">Secure payment via Paystack</p>
                </div>
                <p className="text-2xl font-black text-ink">KES 5,000</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white border border-wire text-ink font-bold uppercase text-[11px] tracking-widest py-3.5 rounded-sm hover:bg-ink-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-[2] bg-ink text-white font-bold uppercase text-[11px] tracking-widest py-3.5 rounded-sm hover:bg-signal transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                  <DollarSign size={16} /> {submitting ? 'Connecting Paystack...' : 'Pay KES 5,000 License'}
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
    <Suspense fallback={<div className="min-h-screen bg-paper grid place-items-center text-xs font-bold uppercase tracking-widest text-ink-400">Loading Campus Editions...</div>}>
      <CampusContent />
    </Suspense>
  );
}