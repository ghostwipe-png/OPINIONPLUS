'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Briefcase, Building2, MapPin, Clock, ExternalLink, Plus, DollarSign, X, CheckCircle2 } from 'lucide-react';
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

function JobBoardContent() {
  const { user, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Full-time',
    apply_link: '',
    description: '',
  });

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();

    // Check if returning from Paystack with a reference
    const reference = searchParams.get('reference');
    if (reference) {
      verifyAndPublishJob(reference);
    }
  }, [searchParams]);

  const verifyAndPublishJob = async (reference) => {
    setVerifying(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ reference }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccessMsg('Payment confirmed! Your job has been published live.');
        fetchJobs();
        window.history.replaceState({}, '', '/jobs');
      } else {
        alert(data.error || 'Payment verification failed.');
      }
    } catch (e) {
      alert('Error verifying transaction.');
    } finally {
      setVerifying(false);
    }
  };

  const formatApplyLink = (link) => {
    if (!link) return '#';
    if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) {
      return link;
    }
    return `https://${link}`;
  };

  const handleInitPaystackPayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = await fetchCsrfToken();
      const res = await fetch(`${API_BASE}/jobs/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Failed to initialize Paystack session.');
        setSubmitting(false);
      }
    } catch (e) {
      alert('Network error while connecting to Paystack.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper pb-24 relative">
      {verifying && (
        <div className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm grid place-items-center text-white p-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-4 border-signal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-lg font-black uppercase tracking-widest">Verifying Paystack Payment...</p>
            <p className="text-xs text-white/60">Please wait while we confirm your transaction securely.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500 text-white p-4 text-center text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-md">
          <CheckCircle2 size={16} /> {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-4 underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}

      <section className="bg-ink text-white py-20 px-6 border-b-4 border-signal relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="bg-signal text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-2 rounded-sm mb-4 shadow-sm">
              <Briefcase size={14} /> Media Industry Jobs
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight uppercase leading-none mb-3">
              Find Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-signal to-white">Assignment</span>
            </h1>
            <p className="text-sm font-medium text-white/70 max-w-xl">
              The premier job board for journalists, editors, copywriters, and media professionals.
            </p>
          </div>
          {isAuthenticated ? (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-white text-ink font-bold uppercase text-xs tracking-widest px-8 py-4 rounded-sm hover:bg-signal hover:text-white transition-all shadow-xl flex items-center gap-2 shrink-0"
            >
              <Plus size={16} /> Post a Job — KES 1,000
            </button>
          ) : (
            <Link 
              href="/login"
              className="bg-white/10 text-white border border-white/20 font-bold uppercase text-xs tracking-widest px-8 py-4 rounded-sm hover:bg-white hover:text-ink transition-all backdrop-blur-sm shrink-0"
            >
              Sign in to Post
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 pt-12">
        {loading ? (
          <p className="text-xs font-bold uppercase text-ink-400 py-12 text-center animate-pulse">Loading opportunities...</p>
        ) : jobs.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-wire rounded-md p-16 text-center shadow-sm">
            <Briefcase size={40} className="mx-auto text-ink-300 mb-4" />
            <p className="text-xl font-black uppercase tracking-tight text-ink mb-2">No active listings</p>
            <p className="text-sm font-medium text-ink-500 max-w-md mx-auto">Be the first to post a media role and reach our network of dedicated publishers and writers.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white border-2 border-wire hover:border-ink rounded-sm p-6 shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row gap-6">
                <div className="shrink-0 hidden sm:block">
                  <div className="w-16 h-16 bg-ink-50 rounded-sm border border-wire flex items-center justify-center overflow-hidden">
                    {job.employer_logo ? (
                      <img src={job.employer_logo} alt={job.company} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 size={24} className="text-ink-400" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <h3 className="text-xl font-black text-ink uppercase tracking-tight truncate">{job.title}</h3>
                    <p className="text-sm font-bold text-signal flex items-center gap-1.5 mt-1">
                      {job.company}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-ink-500">
                    <span className="flex items-center gap-1 bg-ink-50 px-2 py-1 rounded-sm"><MapPin size={12} /> {job.location}</span>
                    <span className="flex items-center gap-1 bg-ink-50 px-2 py-1 rounded-sm"><Clock size={12} /> {job.type}</span>
                  </div>
                  
                  {job.description && (
                    <p className="text-sm text-ink-600 line-clamp-2 font-medium leading-relaxed">
                      {job.description}
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center md:items-start justify-end mt-4 md:mt-0">
                  <a 
                    href={formatApplyLink(job.apply_link)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-ink text-white font-bold uppercase text-[11px] tracking-widest px-6 py-3 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm w-full text-center justify-center md:w-auto"
                  >
                    Apply Now <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border-2 border-ink rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-2 text-ink-400 hover:text-signal hover:bg-red-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="p-8">
              <div className="mb-6 border-b border-wire pb-4">
                <h2 className="text-2xl font-black uppercase tracking-tight text-ink flex items-center gap-2">
                  <Briefcase className="text-signal" /> Post a Media Job
                </h2>
                <p className="text-xs font-medium text-ink-500 mt-1">Listing fee: KES 1,000. Secure automated payment via Paystack.</p>
              </div>

              <form onSubmit={handleInitPaystackPayment} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Job Title</label>
                    <input 
                      required
                      value={form.title} 
                      onChange={(e) => setForm({...form, title: e.target.value})}
                      placeholder="e.g. Senior Political Correspondent" 
                      className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Company / Publication</label>
                    <input 
                      required
                      value={form.company} 
                      onChange={(e) => setForm({...form, company: e.target.value})}
                      placeholder="e.g. The Daily Observer" 
                      className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Location</label>
                    <input 
                      value={form.location} 
                      onChange={(e) => setForm({...form, location: e.target.value})}
                      placeholder="e.g. Nairobi, Kenya or Remote" 
                      className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Employment Type</label>
                    <select 
                      value={form.type} 
                      onChange={(e) => setForm({...form, type: e.target.value})}
                      className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink transition-colors"
                    >
                      <option>Full-time</option>
                      <option>Part-time</option>
                      <option>Contract</option>
                      <option>Freelance</option>
                      <option>Internship</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Application URL or Email Link</label>
                  <input 
                    required
                    value={form.apply_link} 
                    onChange={(e) => setForm({...form, apply_link: e.target.value})}
                    placeholder="https://company.com/careers or mailto:hr@company.com" 
                    className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-ink transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Short Description (Optional)</label>
                  <textarea 
                    value={form.description} 
                    onChange={(e) => setForm({...form, description: e.target.value})}
                    placeholder="Briefly describe the role and requirements..." 
                    rows={4}
                    className="w-full bg-ink-50 border border-wire rounded-sm px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-ink transition-colors resize-none"
                  />
                </div>

                <div className="bg-signal/5 border border-signal rounded-sm p-4 flex items-center justify-between mt-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-signal">Total Amount Due via Paystack</p>
                    <p className="text-xs font-medium text-ink-600 mt-0.5">Supports M-Pesa, Cards, & Mobile Money</p>
                  </div>
                  <p className="text-2xl font-black text-ink">KES 1,000</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-white border border-wire text-ink font-bold uppercase text-[11px] tracking-widest py-4 rounded-sm hover:bg-ink-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] bg-ink text-white font-bold uppercase text-[11px] tracking-widest py-4 rounded-sm hover:bg-signal transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <DollarSign size={16} /> {submitting ? 'Redirecting to Paystack...' : 'Proceed to Secure Checkout'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JobBoardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper grid place-items-center text-xs font-bold uppercase tracking-widest text-ink-400">Loading Job Board...</div>}>
      <JobBoardContent />
    </Suspense>
  );
}